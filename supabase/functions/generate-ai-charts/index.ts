
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

    // Prompt melhorado para gerar JSON válido
    const prompt = `Você é um especialista em análise de dados e visualização. Analise os seguintes dados de planilha e gere até 10 gráficos em formato JSON compatível com Chart.js.

DADOS DA PLANILHA:
${JSON.stringify(sheetData, null, 2)}

INSTRUÇÕES:
1. Analise os dados e identifique padrões interessantes
2. Crie gráficos relevantes (barras, linhas, pizza) baseados nos dados
3. Responda APENAS com um array JSON válido, sem texto adicional
4. Cada gráfico deve ter esta estrutura:
{
  "type": "bar|line|pie",
  "data": {
    "labels": ["Label1", "Label2"],
    "datasets": [{
      "label": "Nome do Dataset",
      "data": [valor1, valor2],
      "backgroundColor": ["#3B82F6", "#10B981"],
      "borderColor": ["#1E40AF", "#047857"],
      "borderWidth": 1
    }]
  },
  "options": {
    "responsive": true,
    "plugins": {
      "title": {
        "display": true,
        "text": "Título do Gráfico"
      }
    }
  }
}

Responda apenas com o array JSON, começando com [ e terminando com ].`

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
      
      // Fallback: criar gráfico simples baseado nos dados
      chartConfig = [{
        type: "bar",
        data: {
          labels: sheetData.slice(0, 10).map((item, index) => item.column_name || `Item ${index + 1}`),
          datasets: [{
            label: "Dados da Planilha",
            data: sheetData.slice(0, 10).map(item => {
              const value = parseFloat(item.cell_value || item.value || "0")
              return isNaN(value) ? 0 : value
            }),
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
              text: "Gráfico Automático dos Dados"
            }
          }
        }
      }]
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
