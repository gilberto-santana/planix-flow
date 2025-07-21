// supabase/functions/generate-ai-charts/index.ts

import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.5";

const openAiApiKey = Deno.env.get("GEMINI_API_KEY");
const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!openAiApiKey || !supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing environment variables for Gemini or Supabase");
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

serve(async (req) => {
  try {
    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      return new Response("Content-Type must be application/json", { status: 400 });
    }

    const { data } = await req.json();
    if (!data || !Array.isArray(data)) {
      return new Response("Missing or invalid 'data' field in request body", { status: 400 });
    }

    const prompt = buildPrompt(data);

    const geminiResponse = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" + openAiApiKey, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });

    const geminiJson = await geminiResponse.json();

    const textResponse = geminiJson.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!textResponse) {
      console.error("Invalid response from Gemini:", JSON.stringify(geminiJson));
      return new Response("Invalid response from Gemini", { status: 500 });
    }

    let parsed;
    try {
      parsed = JSON.parse(textResponse);
    } catch (err) {
      console.error("Error parsing Gemini response:", err);
      return new Response("Error parsing Gemini response", { status: 500 });
    }

    return new Response(JSON.stringify({ chartConfig: parsed }), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response("Internal error in generate-ai-charts", { status: 500 });
  }
});

function buildPrompt(data: any[]): string {
  return `
Você é uma IA que cria gráficos com base em dados de planilhas. 
Analise os dados a seguir (um array de objetos com colunas e valores de uma planilha) 
e gere até 5 sugestões de gráficos úteis, no formato JSON com este padrão:

[
  {
    "title": "Nome do gráfico",
    "type": "bar" | "pie" | "line",
    "data": [
      { "label": "Rótulo 1", "value": 123 },
      { "label": "Rótulo 2", "value": 456 }
    ]
  },
  ...
]

Use somente dados numéricos. 
Evite gráficos redundantes ou com poucos dados. 
Nunca retorne texto explicativo, apenas o JSON direto.

Aqui estão os dados da planilha:

${JSON.stringify(data, null, 2)}
  `.trim();
}
