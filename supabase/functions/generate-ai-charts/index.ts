
import { corsHeaders } from '../_shared/cors.ts'
import { GoogleGenerativeAI } from 'npm:@google/generative-ai'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log("🚀 Iniciando função generate-ai-charts");

    // Verificar se a chave API existe
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY')
    if (!geminiApiKey) {
      console.error("❌ GEMINI_API_KEY não encontrada nos secrets");
      throw new Error("Chave API do Gemini não configurada. Configure GEMINI_API_KEY nos secrets do Supabase.")
    }

    console.log("✅ Chave API encontrada, comprimento:", geminiApiKey.length);

    const contentType = req.headers.get("content-type") || ""
    if (!contentType.includes("application/json")) {
      throw new Error("Requisição inválida: Content-Type não é application/json")
    }

    const bodyText = await req.text()
    console.log("📨 Body recebido:", bodyText ? "✅ Não vazio" : "❌ Vazio");
    
    if (!bodyText) {
      throw new Error("Corpo da requisição vazio.")
    }

    let body
    try {
      body = JSON.parse(bodyText)
    } catch (e) {
      console.error("❌ Erro ao fazer parse do JSON:", e);
      throw new Error("JSON malformado recebido na requisição.")
    }

    const { data: sheetData } = body
    if (!sheetData || !Array.isArray(sheetData) || sheetData.length === 0) {
      console.error("❌ Dados da planilha inválidos:", { sheetData: sheetData ? "exists" : "null", isArray: Array.isArray(sheetData), length: sheetData?.length });
      throw new Error("Dados da planilha ('data') não encontrados ou vazios.")
    }

    console.log("📊 Dados da planilha válidos:", { totalRows: sheetData.length, sampleRow: sheetData[0] });

    // Inicializar Gemini com modelo atualizado
    const genAI = new GoogleGenerativeAI(geminiApiKey)
    // Usar modelo mais recente e confiável
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

    // Convert raw spreadsheet data to structured format
    console.log("🔄 Processing spreadsheet data structure...");
    
    // Group data by column to understand spreadsheet structure
    const columnMap = new Map();
    const rowMap = new Map();
    
    sheetData.forEach((row: any) => {
      const columnName = row.column_name || `Coluna ${row.column_index}`;
      const rowIndex = row.row_index;
      const cellValue = row.cell_value || row.value || '';
      
      if (!columnMap.has(columnName)) {
        columnMap.set(columnName, []);
      }
      
      if (!rowMap.has(rowIndex)) {
        rowMap.set(rowIndex, {});
      }
      
      columnMap.get(columnName).push(cellValue);
      rowMap.get(rowIndex)[columnName] = cellValue;
    });
    
    // Create structured data representation
    const columns = Array.from(columnMap.keys());
    const rows = Array.from(rowMap.values()).slice(0, 50); // Limit to first 50 rows for AI processing
    
    const structuredData = {
      columns: columns,
      totalRows: rowMap.size,
      sampleRows: rows.slice(0, 10),
      columnSummary: columns.map(col => ({
        name: col,
        sampleValues: columnMap.get(col).slice(0, 5),
        totalValues: columnMap.get(col).length
      }))
    };
    
    console.log("📊 Structured data for AI:", {
      totalColumns: columns.length,
      totalRows: rowMap.size,
      columns: columns
    });

    // Enhanced prompt for better chart generation
    const prompt = `Você é um especialista em análise de dados e visualização. Analise os dados estruturados da planilha abaixo e gere gráficos relevantes em formato JSON compatível com Chart.js.

ESTRUTURA DOS DADOS:
Colunas: ${columns.join(', ')}
Total de linhas: ${rowMap.size}

DADOS DA PLANILHA:
${JSON.stringify(structuredData, null, 2)}

INSTRUÇÕES CRÍTICAS:
1. ANALISE AS COLUNAS REAIS da planilha: ${columns.join(', ')}
2. Use os NOMES REAIS das colunas como labels nos gráficos
3. Identifique colunas numéricas para valores e colunas categóricas para labels
4. Crie gráficos que façam sentido para os dados (ex: se tem "Produto" e "Quantidade", faça um gráfico de barras)
5. Para cada gráfico, use dados reais da planilha, não dados fictícios
6. Responda APENAS com um array JSON válido, sem texto adicional

FORMATO DE RESPOSTA (exatamente assim):
[
  {
    "type": "bar|line|pie",
    "data": {
      "labels": ["valor_real_coluna1", "valor_real_coluna2"],
      "datasets": [{
        "label": "Nome_Real_da_Coluna",
        "data": [valor_numerico_real1, valor_numerico_real2],
        "backgroundColor": ["#3B82F6", "#10B981", "#F59E0B"],
        "borderColor": ["#1E40AF", "#047857", "#D97706"],
        "borderWidth": 1
      }]
    },
    "options": {
      "responsive": true,
      "plugins": {
        "title": {
          "display": true,
          "text": "Título_Baseado_Nos_Dados_Reais"
        }
      }
    }
  }
]

IMPORTANTE: Use apenas os nomes de colunas e dados que realmente existem na planilha!`

    console.log("🤖 Enviando dados para Gemini...");

    const result = await model.generateContent(prompt)
    const response = await result.response
    const responseText = response.text()

    console.log("📝 Resposta bruta do Gemini:", responseText.substring(0, 200) + "...");

    // Tentar fazer parse da resposta
    let chartConfig
    try {
      // Limpar a resposta caso tenha markdown ou texto extra
      const cleanResponse = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      chartConfig = JSON.parse(cleanResponse)
    } catch (e) {
      console.error("❌ Erro ao fazer parse da resposta do Gemini:", e);
      console.error("Resposta original:", responseText);
      
      // Improved fallback: create meaningful charts based on actual spreadsheet structure
      console.log("⚠️ Using fallback chart generation based on spreadsheet structure");
      
      const fallbackCharts = [];
      
      // Find numeric columns for chart data
      const numericColumns = columns.filter(col => {
        const values = columnMap.get(col);
        const numericValues = values.filter(val => !isNaN(parseFloat(val))).length;
        return numericValues > values.length * 0.5; // At least 50% numeric values
      });
      
      // Find categorical columns for labels
      const categoricalColumns = columns.filter(col => !numericColumns.includes(col));
      
      console.log("📊 Fallback analysis:", { numericColumns, categoricalColumns });
      
      if (numericColumns.length > 0 && categoricalColumns.length > 0) {
        // Create a chart combining categorical and numeric data
        const labelColumn = categoricalColumns[0];
        const valueColumn = numericColumns[0];
        
        const chartData = rows.slice(0, 10).map(row => ({
          label: row[labelColumn] || 'Sem nome',
          value: parseFloat(row[valueColumn]) || 0
        })).filter(item => item.label && !isNaN(item.value));
        
        fallbackCharts.push({
          type: "bar",
          data: {
            labels: chartData.map(item => item.label),
            datasets: [{
              label: valueColumn,
              data: chartData.map(item => item.value),
              backgroundColor: ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6"],
              borderColor: ["#1E40AF", "#047857", "#D97706", "#DC2626", "#7C3AED"],
              borderWidth: 1
            }]
          },
          options: {
            responsive: true,
            plugins: {
              title: {
                display: true,
                text: `${valueColumn} por ${labelColumn}`
              }
            }
          }
        });
      }
      
      // If we have multiple numeric columns, create a comparison chart
      if (numericColumns.length > 1) {
        const firstNumeric = numericColumns[0];
        const secondNumeric = numericColumns[1];
        
        const comparisonData = rows.slice(0, 8).map((row, index) => ({
          label: `Linha ${index + 1}`,
          value1: parseFloat(row[firstNumeric]) || 0,
          value2: parseFloat(row[secondNumeric]) || 0
        }));
        
        fallbackCharts.push({
          type: "bar",
          data: {
            labels: comparisonData.map(item => item.label),
            datasets: [
              {
                label: firstNumeric,
                data: comparisonData.map(item => item.value1),
                backgroundColor: "#3B82F6",
                borderColor: "#1E40AF",
                borderWidth: 1
              },
              {
                label: secondNumeric,
                data: comparisonData.map(item => item.value2),
                backgroundColor: "#10B981",
                borderColor: "#047857",
                borderWidth: 1
              }
            ]
          },
          options: {
            responsive: true,
            plugins: {
              title: {
                display: true,
                text: `Comparação: ${firstNumeric} vs ${secondNumeric}`
              }
            }
          }
        });
      }
      
      chartConfig = fallbackCharts.length > 0 ? fallbackCharts : [{
        type: "bar",
        data: {
          labels: columns.slice(0, 5),
          datasets: [{
            label: "Contagem de Dados",
            data: columns.slice(0, 5).map(col => columnMap.get(col).length),
            backgroundColor: "#3B82F6",
            borderColor: "#1E40AF",
            borderWidth: 1
          }]
        },
        options: {
          responsive: true,
          plugins: {
            title: {
              display: true,
              text: "Estrutura da Planilha"
            }
          }
        }
      }];
    }

    // Validar se chartConfig é um array
    if (!Array.isArray(chartConfig)) {
      console.error("❌ Resposta do Gemini não é um array válido");
      chartConfig = [chartConfig] // Converter para array se necessário
    }

    console.log("✅ Gráficos gerados com sucesso:", chartConfig.length);

    return new Response(JSON.stringify({ chartConfig }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    })
  } catch (error) {
    console.error("❌ Erro na função generate-ai-charts:", error);
    
    // Tratamento específico para erros de API key
    if (error.message?.includes('API key not valid') || error.message?.includes('Invalid API key')) {
      return new Response(JSON.stringify({ 
        error: "Chave API do Gemini inválida. Verifique se a GEMINI_API_KEY está correta nos secrets do Supabase." 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401
      })
    }
    
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    })
  }
})
