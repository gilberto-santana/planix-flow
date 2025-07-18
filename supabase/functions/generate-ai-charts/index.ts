// File: supabase/functions/generate-ai-charts/index.ts

import { corsHeaders } from '../_shared/cors.ts'
import { GoogleGenerativeAI } from 'npm:@google/generative-ai'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    const { data: sheetData } = body

    if (!sheetData) {
      throw new Error("Dados da planilha ('sheetData') não encontrados no corpo da requisição.")
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
    console.error(error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    })
  }
})
