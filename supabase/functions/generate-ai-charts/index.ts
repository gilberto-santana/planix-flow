import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.5";

serve(async (req) => {
  try {
    const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GEMINI_API_KEY } = Deno.env.toObject();

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !GEMINI_API_KEY) {
      return new Response(JSON.stringify({ error: "Missing environment variables." }), { status: 500 });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    if (!req.body) {
      console.error("❌ Corpo da requisição vazio.");
      return new Response(JSON.stringify({ error: "Requisição sem corpo." }), { status: 400 });
    }

    let payload: any;
    try {
      const bodyText = await req.text();
      if (!bodyText || bodyText.trim() === "") {
        console.error("❌ Body vazio.");
        return new Response(JSON.stringify({ error: "Body vazio." }), { status: 400 });
      }

      payload = JSON.parse(bodyText);
    } catch (error) {
      console.error("❌ Erro ao parsear JSON:", error);
      return new Response(JSON.stringify({ error: "JSON inválido no corpo da requisição." }), { status: 400 });
    }

    const { rows } = payload;
    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      console.error("❌ Nenhum dado 'rows' válido:", rows);
      return new Response(JSON.stringify({ error: "Nenhum dado recebido para gerar gráficos." }), { status: 400 });
    }

    const prompt = `
Você é um gerador de gráficos de dados em JSON.
Gere até 10 gráficos úteis baseados nos dados abaixo. Use os dados diretamente para sugerir agrupamentos, séries temporais, totais por categoria, etc.
Retorne apenas JSON no formato:

[
  {
    "title": "Título do gráfico",
    "type": "bar" | "line" | "pie",
    "data": [
      {"label": "categoria1", "value": 100},
      {"label": "categoria2", "value": 200}
    ]
  }
]

IMPORTANTE: Use exatamente essa estrutura com "data" contendo array de objetos com "label" e "value".

DADOS:
${JSON.stringify(rows)}
`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }],
              role: "user",
            },
          ],
        }),
      }
    );

    const result = await response.json();
    const text = result?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const jsonStart = text.indexOf("[");
    const jsonEnd = text.lastIndexOf("]") + 1;
    const jsonString = text.slice(jsonStart, jsonEnd);

    let charts = [];
    try {
      charts = JSON.parse(jsonString);
    } catch (e) {
      console.error("❌ Erro ao parsear JSON da IA:", jsonString);
      return new Response(JSON.stringify({ error: "Falha ao parsear o JSON retornado pela IA." }), { status: 500 });
    }

    return new Response(JSON.stringify({ charts }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    console.error("❌ Erro interno:", err);
    return new Response(JSON.stringify({ error: "Erro interno." }), { status: 500 });
  }
});
