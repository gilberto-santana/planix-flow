
import { corsHeaders } from '../_shared/cors.ts'
import { GoogleGenerativeAI } from 'npm:@google/generative-ai'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log("🚀 Iniciando função generate-ai-charts");
    console.log("📋 Request headers:", Object.fromEntries(req.headers.entries()));
    console.log("📋 Request method:", req.method);

    const geminiApiKey = Deno.env.get('GEMINI_API_KEY')
    if (!geminiApiKey) {
      console.error("❌ Chave API do Gemini não configurada.")
      throw new Error("Chave API do Gemini não configurada.")
    }
    console.log("✅ Chave API encontrada, comprimento:", geminiApiKey.length);

    // Validação mais flexível do Content-Type
    const contentType = req.headers.get("content-type") || ""
    console.log("📋 Content-Type recebido:", contentType);
    
    if (!contentType.includes("application/json") && !contentType.includes("text/plain")) {
      console.warn("⚠️ Content-Type não é JSON, tentando processar mesmo assim...");
    }

    let bodyText: string;
    try {
      bodyText = await req.text()
      console.log("📨 Body recebido:", bodyText ? "✅ Não vazio" : "❌ Vazio");
      console.log("📨 Body length:", bodyText.length);
    } catch (error) {
      console.error("❌ Erro ao ler body:", error);
      throw new Error("Erro ao ler corpo da requisição")
    }

    if (!bodyText) {
      console.error("❌ Corpo da requisição está vazio");
      throw new Error("Corpo da requisição vazio.")
    }

    let body: any;
    try {
      body = JSON.parse(bodyText)
      console.log("✅ JSON parseado com sucesso");
    } catch (parseError) {
      console.error("❌ Erro ao fazer parse do JSON:", parseError);
      console.log("📝 Body que causou erro:", bodyText.substring(0, 200));
      throw new Error("JSON inválido no corpo da requisição")
    }

    const sheetData = body.data

    if (!sheetData || !Array.isArray(sheetData) || sheetData.length === 0) {
      console.error("❌ Dados inválidos:", { 
        hasData: !!sheetData, 
        isArray: Array.isArray(sheetData), 
        length: sheetData?.length 
      });
      throw new Error("Dados da planilha inválidos ou vazios")
    }

    console.log("📊 Dados da planilha válidos:", {
      totalRows: sheetData.length,
      sampleRow: sheetData[0],
      dataTypes: sheetData.slice(0, 3).map(row => typeof row)
    });

    console.log("🔄 Processing spreadsheet data structure...");

    // Process and structure the spreadsheet data
    const columnMap = new Map<string, any[]>()
    const rowMap = new Map<number, Record<string, any>>()

    sheetData.forEach((cell: any, index: number) => {
      try {
        const col = cell.column_name || `Coluna ${cell.column_index}`
        const rowIdx = cell.row_index
        const val = cell.cell_value ?? cell.value ?? ''

        if (!columnMap.has(col)) columnMap.set(col, [])
        if (!rowMap.has(rowIdx)) rowMap.set(rowIdx, {})
        columnMap.get(col)!.push(val)
        rowMap.get(rowIdx)![col] = val
      } catch (cellError) {
        console.warn(`⚠️ Erro processando célula ${index}:`, cellError);
      }
    })

    const columns = Array.from(columnMap.keys())
    const rows = Array.from(rowMap.values()).slice(0, 50) // Limit to 50 rows for AI processing

    if (columns.length === 0 || rows.length === 0) {
      console.error("❌ Nenhuma coluna ou linha válida encontrada");
      throw new Error("Não foi possível processar os dados da planilha")
    }

    // Create structured data for AI analysis
    const structuredData = {
      file_name: `planilha_${Date.now()}.xlsx`,
      total_columns: columns.length,
      total_rows: rows.length,
      columns: columns,
      data: rows.map(row => {
        const clean: Record<string, any> = {}
        columns.forEach(col => clean[col] = row[col] ?? '')
        return clean
      }),
      column_summaries: columns.map(col => {
        const values = columnMap.get(col) || []
        const nonEmptyValues = values.filter(v => v && v.toString().trim() !== '')
        const isNumeric = nonEmptyValues.some(v => !isNaN(Number(v)))
        return {
          name: col,
          type: isNumeric ? 'numeric' : 'categorical',
          sample_values: nonEmptyValues.slice(0, 5),
          unique_count: new Set(nonEmptyValues).size
        }
      })
    }

    console.log("📊 Structured data for AI:", {
      totalColumns: structuredData.total_columns,
      totalRows: structuredData.total_rows,
      columns: structuredData.columns,
      columnSummariesCount: structuredData.column_summaries.length
    });

    const genAI = new GoogleGenerativeAI(geminiApiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

    // Enhanced Business Intelligence prompt
    const systemInstruction = `You are a Business Intelligence Microservice. Your sole purpose is to receive spreadsheet data (converted to JSON format) and return a well-structured JSON object with deep insights, KPIs, strategic recommendations, and ready-to-render visualizations for a SaaS dashboard.

⚠️ WARNING: Do not generate any explanation or natural language text outside the JSON output. Only return a pure JSON object.

🧠 Context:
- The input may come from any type of spreadsheet: sales, inventory, HR, finance, marketing, etc.
- Your role is to understand the context and content of each spreadsheet dynamically.
- Use your intelligence to detect field names, types (number, text, date), and infer business meaning without any prior schema.

📤 Output Format (STRICT):
Return a single JSON object with this structure:
{
  "analysis_summary": {
    "source_file": "example_file.xlsx",
    "total_rows": 1500,
    "total_columns": 8,
    "executive_summary": "Short summary of the most relevant business insights for a decision-maker.",
    "identified_kpis": [
      { "name": "Total Sales", "value": 45892.0, "format": "currency_brl" }
    ]
  },
  "visualizations": [
    {
      "chart_id": "v1",
      "title": "Sales by Category",
      "chart_type": "bar",
      "data": {
        "labels": ["Category A", "Category B", "Category C"],
        "datasets": [
          {
            "label": "Total Sales",
            "data": [12500, 9800, 8700]
          }
        ]
      }
    }
  ]
}

IMPORTANT: The "visualizations" array must contain Chart.js compatible data structure. Use actual column names from the spreadsheet as labels, not generic names like "Item 1".`

    const userPrompt = `Analyze this spreadsheet data and generate business intelligence insights with Chart.js compatible visualizations:

${JSON.stringify(structuredData, null, 2)}

Generate 2-4 relevant charts based on the actual data structure. Use real column names and values, not placeholders.`

    console.log("🤖 Enviando dados para Gemini...");
    console.log("📤 Prompt length:", userPrompt.length);

    let result: any;
    try {
      // FIXED: Correct Gemini API payload structure
      result = await model.generateContent({
        contents: [
          {
            role: 'user',
            parts: [{ text: `${systemInstruction}\n\n${userPrompt}` }]
          }
        ]
      })
      console.log("✅ Gemini respondeu com sucesso");
    } catch (geminiError) {
      console.error("❌ Erro na chamada do Gemini:", geminiError);
      throw new Error(`Erro na API do Gemini: ${geminiError.message}`)
    }

    const response = await result.response
    const responseText = await response.text()

    console.log("📝 Resposta bruta do Gemini:", responseText.slice(0, 200), "...");
    console.log("📝 Response length:", responseText.length);

    let biResponse: any
    let chartConfig: any[] = []

    try {
      // Clean up the response text
      const cleanedResponse = responseText
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .replace(/^[^{]*/, '') // Remove any text before the first {
        .replace(/[^}]*$/, '}') // Ensure it ends with }
        .trim()

      console.log("🧹 Resposta limpa:", cleanedResponse.slice(0, 200), "...");

      biResponse = JSON.parse(cleanedResponse)
      console.log("✅ JSON parseado com sucesso");

      if (Array.isArray(biResponse.visualizations)) {
        chartConfig = biResponse.visualizations.map((viz: any) => ({
          type: viz.chart_type || 'bar',
          title: viz.title || 'Gráfico',
          data: viz.data?.labels?.map((label: string, index: number) => ({
            label: label,
            value: viz.data?.datasets?.[0]?.data?.[index] || 0
          })) || []
        })).filter((chart: any) => chart.data.length > 0)

        console.log("📊 Gráficos convertidos:", chartConfig.length);
      } else {
        console.warn("⚠️ Nenhuma visualização encontrada no JSON da BI")
      }
    } catch (parseError) {
      console.error("❌ Erro no parsing da resposta do Gemini:", parseError)
      console.log("📝 Texto original:", responseText);

      // Fallback: Generate basic charts from the structured data
      console.log("🔄 Gerando gráficos de fallback...");
      
      const numericColumns = structuredData.column_summaries.filter(col => col.type === 'numeric')
      const categoricalColumns = structuredData.column_summaries.filter(col => col.type === 'categorical')

      console.log("📊 Colunas encontradas:", {
        numericCount: numericColumns.length,
        categoricalCount: categoricalColumns.length,
        numericCols: numericColumns.map(c => c.name),
        categoricalCols: categoricalColumns.map(c => c.name)
      });

      if (numericColumns.length > 0 && categoricalColumns.length > 0) {
        const categoryCol = categoricalColumns[0].name
        const valueCol = numericColumns[0].name

        console.log("📊 Usando colunas:", { categoryCol, valueCol });

        // Group data by category and sum values
        const groupedData = new Map<string, number>()
        structuredData.data.forEach(row => {
          const category = String(row[categoryCol] || 'Sem categoria')
          const value = Number(row[valueCol]) || 0
          groupedData.set(category, (groupedData.get(category) || 0) + value)
        })

        console.log("📊 Dados agrupados:", Array.from(groupedData.entries()));

        chartConfig = [{
          type: 'bar',
          title: `${valueCol} por ${categoryCol}`,
          data: Array.from(groupedData.entries()).map(([label, value]) => ({
            label,
            value
          }))
        }]

        if (groupedData.size <= 8) {
          chartConfig.push({
            type: 'pie',
            title: `Distribuição de ${valueCol}`,
            data: Array.from(groupedData.entries()).map(([label, value]) => ({
              label,
              value
            }))
          })
        }
      } else if (numericColumns.length > 0) {
        // Create a simple chart with top values
        const col = numericColumns[0]
        const values = structuredData.data
          .map(row => ({ label: `Registro ${structuredData.data.indexOf(row) + 1}`, value: Number(row[col.name]) || 0 }))
          .filter(item => item.value > 0)
          .sort((a, b) => b.value - a.value)
          .slice(0, 10)

        if (values.length > 0) {
          chartConfig = [{
            type: 'bar',
            title: `Top ${col.name}`,
            data: values
          }]
        }
      }

      console.log("📊 Gráficos de fallback gerados:", chartConfig.length);
    }

    if (chartConfig.length === 0) {
      console.warn("⚠️ Nenhum gráfico pôde ser gerado");
      return new Response(JSON.stringify({ 
        chartConfig: [],
        message: "Não foi possível gerar gráficos para esta planilha",
        debug: {
          columnsFound: columns.length,
          rowsProcessed: rows.length,
          structuredData: structuredData
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      })
    }

    console.log("✅ Gráficos gerados:", chartConfig.length);
    console.log("🎯 CONFIRMADO: Gráficos gerados pela IA Gemini!");

    return new Response(JSON.stringify({ 
      chartConfig,
      debug: {
        totalColumns: columns.length,
        totalRows: rows.length,
        chartsGenerated: chartConfig.length
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    })

  } catch (error) {
    console.error("❌ Erro na função generate-ai-charts:", error)
    console.error("❌ Stack trace:", error.stack)
    return new Response(JSON.stringify({ 
      error: error.message,
      chartConfig: [],
      debug: {
        errorType: error.constructor.name,
        timestamp: new Date().toISOString()
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    })
  }
})
