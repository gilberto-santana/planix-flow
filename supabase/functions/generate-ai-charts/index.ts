// supabase/functions/generate-ai-charts/index.ts

import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.5";

serve(async (req) => {
  try {
    const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GEMINI_API_KEY } = Deno.env.toObject();

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !GEMINI_API_KEY) {
      return new Response(JSON.stringify({ error: "Missing environment variables." }), { status: 500 });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    let payload = {};
    try {
      payload = await req.json();
    } catch (error) {
      console.error("Erro ao ler JSON:", error);
      return new Response(JSON.stringify({ error: "Body inválido ou ausente no JSON." }), { status: 400 });
    }

    const { rows } = payload as { rows: any[] };
    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return new Response(JSON.stringify({ error: "Nenhum dado recebido." }), { status: 400 });
    }

    const prompt = `
Você é um gerador de gráficos de dados em JSON.
Gere até 10 gráficos úteis baseados nos dados abaixo. Use os dados diretamente para sugerir agrupamentos, séries temporais, totais por categoria, etc.
Retorne apenas JSON no formato:

[
  {
    "title": "Título do gráfico",
    "type": "bar" | "line" | "pie",
    "x": [array de categorias ou datas],
    "y": [array de valores],
    "xLabel": "Eixo X",
    "yLabel": "Eixo Y"
  },
  ...
]

DADOS:
${JSON.stringify(rows)}
`;

    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=" + GEMINI_API_KEY, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }],
            role: "user",
          },
        ],
      }),
    });

    const result = await response.json();
    const text = result?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const jsonStart = text.indexOf("[");
    const jsonEnd = text.lastIndexOf("]") + 1;
    const jsonString = text.slice(jsonStart, jsonEnd);

    let charts = [];
    try {
      charts = JSON.parse(jsonString);
    } catch (e) {
      return new Response(JSON.stringify({ error: "Falha ao parsear o JSON retornado pela IA." }), { status: 500 });
    }

    return new Response(JSON.stringify({ charts }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    console.error("Erro geral:", err);
    return new Response(JSON.stringify({ error: "Erro interno." }), { status: 500 });
  }
});
