// supabase/functions/generate-ai-charts/index.ts

import { corsHeaders } from '../_shared/cors.ts'
import { GoogleGenerativeAI } from 'npm:@google/generative-ai'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log("🚀 Iniciando função generate-ai-charts");

    const geminiApiKey = Deno.env.get('GEMINI_API_KEY')
    if (!geminiApiKey) throw new Error("Chave API do Gemini não configurada.")

    const contentType = req.headers.get("content-type") || ""
    if (!contentType.includes("application/json")) throw new Error("Content-Type inválido")

    const bodyText = await req.text()
    if (!bodyText) throw new Error("Corpo da requisição vazio.")
    const body = JSON.parse(bodyText)

    const sheetData = body.data
    if (!sheetData || !Array.isArray(sheetData) || sheetData.length === 0) throw new Error("Dados da planilha inválidos")

    const genAI = new GoogleGenerativeAI(geminiApiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

    // Estrutura dos dados da planilha
    const columnMap = new Map<string, any[]>()
    const rowMap = new Map<number, Record<string, any>>()

    sheetData.forEach((cell: any) => {
      const col = cell.column_name || `Coluna ${cell.column_index}`
      const rowIdx = cell.row_index
      const val = cell.cell_value ?? cell.value ?? ''

      if (!columnMap.has(col)) columnMap.set(col, [])
      if (!rowMap.has(rowIdx)) rowMap.set(rowIdx, {})
      columnMap.get(col)!.push(val)
      rowMap.get(rowIdx)![col] = val
    })

    const columns = Array.from(columnMap.keys())
    const rows = Array.from(rowMap.values()).slice(0, 50)

    const inputData = {
      file_name: `planilha_${Date.now()}.xlsx`,
      data: rows.map(row => {
        const clean: Record<string, any> = {}
        columns.forEach(col => clean[col] = row[col] ?? '')
        return clean
      })
    }

    // Prompt otimizado para Business Intelligence
    const prompt = `
You are a Business Intelligence Microservice. Your sole purpose is to receive spreadsheet data (in JSON format) and return a single JSON object with deep insights, KPIs, strategic recommendations, and ready-to-render visualizations for a SaaS dashboard.

⚠️ WARNING: DO NOT output anything except a pure JSON object.

Context:
- Input may be any spreadsheet: sales, inventory, HR, finance, etc.
- Analyze dynamically: detect field types, infer business meaning, generate intelligent insights beyond the obvious.

Input structure:
${JSON.stringify(inputData, null, 2)}

Output format should follow this JSON schema exactly:
{
  "analysis_summary": { ... },
  "data_quality": { ... },
  "visualizations": [ ... ],
  "top_performers": { ... },
  "recommendations": [ ... ],
  "future_analysis_suggestions": [ ... ]
}
`

    console.log("🤖 Enviando dados para Gemini...")
    const result = await model.generateContent({
      contents: [
        { text: prompt }
      ]
    })

    const response = await result.response
    const responseText = await response.text()

    console.log("📝 Resposta bruta do Gemini:", responseText.slice(0, 200), "...")

    let biResponse: any
    let chartConfig: any[] = []

    try {
      const clean = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      biResponse = JSON.parse(clean)

      if (Array.isArray(biResponse.visualizations)) {
        chartConfig = biResponse.visualizations.map((viz: any) => ({
          type: viz.chart_type,
          data: viz.data,
          options: {
            responsive: true,
            plugins: {
              title: { display: true, text: viz.title }
            }
          }
        }))
      } else {
        console.error("⚠️ Nenhuma visualização encontrada no JSON da BI")
      }
    } catch (e) {
      console.error("❌ Erro no parsing da resposta do Gemini:", e)
    }

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
