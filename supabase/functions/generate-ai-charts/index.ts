
import { corsHeaders } from '../_shared/cors.ts'
import { GoogleGenerativeAI } from 'npm:@google/generative-ai'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log("🚀 [AI-CHARTS] Função iniciada");
    console.log("📋 [AI-CHARTS] Method:", req.method);
    console.log("📋 [AI-CHARTS] Headers:", Object.fromEntries(req.headers.entries()));

    const geminiApiKey = Deno.env.get('GEMINI_API_KEY')
    if (!geminiApiKey) {
      console.error("❌ [AI-CHARTS] Chave API do Gemini não configurada")
      return new Response(JSON.stringify({ 
        error: "Chave API do Gemini não configurada",
        chartConfig: []
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      })
    }

    console.log("✅ [AI-CHARTS] Chave API encontrada");

    // Read and parse body
    let bodyText: string;
    let body: any;

    try {
      bodyText = await req.text()
      console.log("📨 [AI-CHARTS] Body recebido - comprimento:", bodyText.length);
      
      if (!bodyText || bodyText.trim() === '') {
        console.error("❌ [AI-CHARTS] Body vazio recebido");
        return new Response(JSON.stringify({ 
          error: "Corpo da requisição está vazio",
          chartConfig: []
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        })
      }

      body = JSON.parse(bodyText)
      console.log("✅ [AI-CHARTS] JSON parseado com sucesso");
    } catch (parseError) {
      console.error("❌ [AI-CHARTS] Erro ao fazer parse do JSON:", parseError);
      return new Response(JSON.stringify({ 
        error: "JSON inválido no corpo da requisição",
        chartConfig: []
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      })
    }

    const sheetData = body.data

    if (!sheetData || !Array.isArray(sheetData) || sheetData.length === 0) {
      console.error("❌ [AI-CHARTS] Dados inválidos:", { 
        hasData: !!sheetData, 
        isArray: Array.isArray(sheetData), 
        length: sheetData?.length 
      });
      return new Response(JSON.stringify({ 
        error: "Dados da planilha inválidos ou vazios",
        chartConfig: []
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      })
    }

    console.log("📊 [AI-CHARTS] Dados válidos recebidos:", {
      totalRows: sheetData.length,
      sampleRow: sheetData[0]
    });

    // Process and structure the spreadsheet data
    const columnMap = new Map<string, any[]>()
    const rowMap = new Map<number, Record<string, any>>()

    sheetData.forEach((cell: any) => {
      try {
        const col = cell.column_name || `Coluna ${cell.column_index}`
        const rowIdx = cell.row_index
        const val = cell.value || cell.cell_value || ''

        if (!columnMap.has(col)) columnMap.set(col, [])
        if (!rowMap.has(rowIdx)) rowMap.set(rowIdx, {})
        
        columnMap.get(col)!.push(val)
        rowMap.get(rowIdx)![col] = val
      } catch (cellError) {
        console.warn(`⚠️ [AI-CHARTS] Erro processando célula:`, cellError);
      }
    })

    const columns = Array.from(columnMap.keys())
    const rows = Array.from(rowMap.values()).slice(0, 50) // Limit to 50 rows

    if (columns.length === 0 || rows.length === 0) {
      console.error("❌ [AI-CHARTS] Nenhuma coluna ou linha válida");
      return new Response(JSON.stringify({ 
        error: "Não foi possível processar os dados da planilha",
        chartConfig: []
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      })
    }

    // Create structured data for AI analysis
    const structuredData = {
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
          sample_values: nonEmptyValues.slice(0, 3),
          unique_count: new Set(nonEmptyValues).size
        }
      })
    }

    console.log("📊 [AI-CHARTS] Dados estruturados:", {
      totalColumns: structuredData.total_columns,
      totalRows: structuredData.total_rows,
      columns: structuredData.columns.slice(0, 5)
    });

    const genAI = new GoogleGenerativeAI(geminiApiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

    const prompt = `Analise os dados da planilha e gere 2-3 gráficos relevantes. 

DADOS:
${JSON.stringify(structuredData, null, 2)}

INSTRUÇÕES:
1. Use nomes reais das colunas, não genéricos
2. Retorne APENAS um JSON válido no formato:
[
  {
    "type": "bar",
    "title": "Título Real",
    "data": [
      {"label": "Item1", "value": 123},
      {"label": "Item2", "value": 456}
    ]
  }
]

3. Tipos permitidos: "bar", "line", "pie"
4. Use dados reais da planilha
5. Não adicione texto explicativo, apenas o JSON`;

    console.log("🤖 [AI-CHARTS] Enviando para Gemini...");

    let result: any;
    try {
      result = await model.generateContent(prompt)
      console.log("✅ [AI-CHARTS] Gemini respondeu");
    } catch (geminiError) {
      console.error("❌ [AI-CHARTS] Erro no Gemini:", geminiError);
      
      // Generate fallback charts
      console.log("🔄 [AI-CHARTS] Gerando gráficos de fallback...");
      const fallbackCharts = generateFallbackCharts(structuredData);
      
      return new Response(JSON.stringify({ 
        chartConfig: fallbackCharts,
        source: 'fallback'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      })
    }

    const response = await result.response
    const responseText = await response.text()

    console.log("📝 [AI-CHARTS] Resposta recebida:", responseText.slice(0, 200));

    let chartConfig: any[] = []

    try {
      // Clean and parse response
      const cleanedResponse = responseText
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .replace(/^[^[{]*/, '')
        .replace(/[^}\]]*$/, '')
        .trim()

      const parsed = JSON.parse(cleanedResponse)
      chartConfig = Array.isArray(parsed) ? parsed : [parsed]

      // Validate chart structure
      chartConfig = chartConfig.filter(chart => 
        chart && 
        chart.type && 
        chart.title && 
        Array.isArray(chart.data) && 
        chart.data.length > 0
      )

      console.log("✅ [AI-CHARTS] Gráficos processados:", chartConfig.length);

    } catch (parseError) {
      console.error("❌ [AI-CHARTS] Erro no parsing:", parseError);
      console.log("🔄 [AI-CHARTS] Usando fallback...");
      chartConfig = generateFallbackCharts(structuredData);
    }

    if (chartConfig.length === 0) {
      console.log("🔄 [AI-CHARTS] Nenhum gráfico válido, usando fallback...");
      chartConfig = generateFallbackCharts(structuredData);
    }

    console.log("🎯 [AI-CHARTS] Retornando gráficos:", chartConfig.length);

    return new Response(JSON.stringify({ 
      chartConfig,
      totalGenerated: chartConfig.length,
      source: 'ai'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    })

  } catch (error) {
    console.error("❌ [AI-CHARTS] Erro geral:", error)
    return new Response(JSON.stringify({ 
      error: error.message,
      chartConfig: [],
      stack: error.stack
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    })
  }
})

function generateFallbackCharts(structuredData: any): any[] {
  const charts: any[] = []
  
  try {
    const numericColumns = structuredData.column_summaries.filter((col: any) => col.type === 'numeric')
    const categoricalColumns = structuredData.column_summaries.filter((col: any) => col.type === 'categorical')

    console.log("📊 [FALLBACK] Colunas:", {
      numeric: numericColumns.length,
      categorical: categoricalColumns.length
    });

    if (numericColumns.length > 0 && categoricalColumns.length > 0) {
      const categoryCol = categoricalColumns[0].name
      const valueCol = numericColumns[0].name

      // Group data
      const groupedData = new Map<string, number>()
      structuredData.data.forEach((row: any) => {
        const category = String(row[categoryCol] || 'Sem categoria')
        const value = Number(row[valueCol]) || 0
        groupedData.set(category, (groupedData.get(category) || 0) + value)
      })

      // Create bar chart
      charts.push({
        type: 'bar',
        title: `${valueCol} por ${categoryCol}`,
        data: Array.from(groupedData.entries()).map(([label, value]) => ({
          label,
          value
        }))
      })

      // Create pie chart if reasonable number of categories
      if (groupedData.size <= 8 && groupedData.size > 1) {
        charts.push({
          type: 'pie',
          title: `Distribuição de ${valueCol}`,
          data: Array.from(groupedData.entries()).map(([label, value]) => ({
            label,
            value
          }))
        })
      }
    } else if (numericColumns.length > 0) {
      // Simple numeric chart
      const col = numericColumns[0]
      const values = structuredData.data
        .map((row: any, index: number) => ({ 
          label: `Registro ${index + 1}`, 
          value: Number(row[col.name]) || 0 
        }))
        .filter((item: any) => item.value > 0)
        .sort((a: any, b: any) => b.value - a.value)
        .slice(0, 10)

      if (values.length > 0) {
        charts.push({
          type: 'bar',
          title: `Top 10 - ${col.name}`,
          data: values
        })
      }
    }

    console.log("✅ [FALLBACK] Gráficos gerados:", charts.length);
    return charts

  } catch (error) {
    console.error("❌ [FALLBACK] Erro:", error);
    return []
  }
}
