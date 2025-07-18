// File: supabase/functions/generate-ai-charts/index.ts

import { corsHeaders } from '../_shared/cors.ts'
import { GoogleGenerativeAI } from 'npm:@google/generative-ai'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const contentType = req.headers.get("content-type") || ""
    if (!contentType.includes("application/json")) {
      throw new Error("Requisição inválida: Content-Type não é application/json")
    }

    const bodyText = await req.text()
    if (!bodyText) {
      throw new Error("Corpo da requisição vazio.")
    }

    let body
    try {
      body = JSON.parse(bodyText)
    } catch (e) {
      throw new Error("JSON malformado recebido na requisição.")
    }

    const { data: sheetData } = body
    if (!sheetData || !Array.isArray(sheetData) || sheetData.length === 0) {
      throw new Error("Dados da planilha ('data') não encontrados ou vazios.")
    }

    const geminiApiKey = Deno.env.get('GEMINI_API_KEY')
    const genAI = new GoogleGenerativeAI(geminiApiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' })

    const prompt = `Você é um gerador de gráficos. Baseado neste JSON de dados de planilha: ${JSON.stringify(
      sheetData
    )}, gere até 10 gráficos em formato JSON compatível com Chart.js. Responda com um array direto, sem explicações.`

    const result = await model.generateContent(prompt)
    const response = await result.response
    const chartConfig = JSON.parse(response.text())

    return new Response(JSON.stringify({ chartConfig }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    })
  } catch (error) {
    console.error("❌ Erro na função generate-ai-charts:", error.message)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    })
  }
})
