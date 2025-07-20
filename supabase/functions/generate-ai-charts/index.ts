// supabase/functions/generate-ai-charts/index.ts

import { corsHeaders } from '../_shared/cors.ts'
import { GoogleGenerativeAI } from 'npm:@google/generative-ai'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log("🚀 Iniciando função generate-ai-charts")

    const geminiApiKey = Deno.env.get('GEMINI_API_KEY')
    if (!geminiApiKey) throw new Error("Chave API do Gemini não configurada.")

    const contentType = req.headers.get("content-type") || ""
    if (!contentType.includes("application/json")) throw new Error("Content-Type inválido")

    const bodyText = await req.text()
    if (!bodyText) throw new Error("Corpo da requisição vazio.")
    const body = JSON.parse(bodyText)

    const { data: sheetData } = body
    if (!sheetData || !Array.isArray(sheetData) || sheetData.length === 0) throw new Error("Dados da planilha inválidos")

    const genAI = new GoogleGenerativeAI(geminiApiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

    const columnMap = new Map()
    const rowMap = new Map()
    sheetData.forEach((row: any) => {
      const col = row.column_name || `Coluna ${row.column_index}`
      const rowIdx = row.row_index
      const val = row.cell_value || row.value || ''
      if (!columnMap.has(col)) columnMap.set(col, [])
      if (!rowMap.has(rowIdx)) rowMap.set(rowIdx, {})
      columnMap.get(col).push(val)
      rowMap.get(rowIdx)[col] = val
    })

    const columns = Array.from(columnMap.keys())
    const rows = Array.from(rowMap.values()).slice(0, 50)

    const inputData = {
      file_name: `planilha_${Date.now()}.xlsx`,
      data: rows.map(row => {
        const clean: any = {}
        columns.forEach(col => clean[col] = row[col] || '')
        return clean
      })
    }

    const systemInstruction = `You are a Business Intelligence Microservice. Your sole purpose is to receive spreadsheet data (converted to JSON format) and return a well-structured JSON object with deep insights, KPIs, strategic recommendations, and ready-to-render visualizations for a SaaS dashboard.

⚠️ WARNING: Do not generate any explanation or natural language text outside the JSON output. Only return a pure JSON object.

🧠 Context:
- The input may come from any type of spreadsheet: sales, inventory, HR, finance, marketing, etc.
- Your role is to understand the context and content of each spreadsheet dynamically.
- Use your intelligence to detect field names, types (number, text, date), and infer business meaning without any prior schema.

📥 Input Format:
You will receive an object like:
{
  "file_name": "example_file.xlsx",
  "data": [ { "Column1": "ValueA", "Column2": 120 }, ... ]
}

📤 Output Format (STRICT):
Return a single JSON object like:
{
  "analysis_summary": { ... },
  "visualizations": [ ... ],
  ...
}`

    const userPrompt = `Analyze this spreadsheet data and provide comprehensive business intelligence insights:\n\n${JSON.stringify(inputData, null, 2)}`

    console.log("🤖 Enviando dados para Gemini...")

    const result = await model.generateContent({
      contents: [
        {
          parts: [{ text: `${systemInstruction}\n\n${userPrompt}` }]
        }
      ]
    })

    const response = await result.response
    const responseText = response.text()

    let biResponse
    let chartConfig
    try {
      const clean = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      biResponse = JSON.parse(clean)

      if (biResponse.visualizations && Array.isArray(biResponse.visualizations)) {
        chartConfig = biResponse.visualizations.map(viz => ({
          type: viz.chart_type,
          data: viz.data,
          options: {
            responsive: true,
            plugins: {
              title: {
                display: true,
                text: viz.title
              }
            }
          }
        }))
      } else {
        throw new Error("No visualizations found in BI response")
      }
    } catch (e) {
      console.error("❌ Erro no parsing da resposta do Gemini:", e)
      chartConfig = []
    }

    if (!Array.isArray(chartConfig)) chartConfig = [chartConfig]

    console.log("✅ Gráficos gerados:", chartConfig.length)

    return new Response(JSON.stringify({ chartConfig }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    })
  } catch (error) {
    console.error("❌ Erro na função generate-ai-charts:", error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    })
  }
})
