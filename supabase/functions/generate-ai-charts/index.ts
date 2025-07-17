// supabase/functions/generate-ai-charts/index.ts

import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { GoogleGenerativeAI } from "npm:@google/generative-ai";

const genAI = new GoogleGenerativeAI(Deno.env.get("GEMINI_API_KEY") || "");

serve(async (req) => {
  try {
    const { rows } = await req.json();

    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

    const prompt = `
Você é um gerador de gráficos inteligente. Com base nos dados da planilha a seguir, crie no máximo 10 sugestões de gráficos, cada uma com título, tipo e colunas a serem usadas. A estrutura da resposta deve ser exatamente esta:

[
  {
    "title": "Título do gráfico",
    "type": "bar" | "line" | "pie" | "area",
    "xAxis": "nome da coluna para o eixo X",
    "yAxis": "nome da coluna para o eixo Y"
  },
  ...
]

Considere os dados abaixo (no formato JSON):
${JSON.stringify(rows)}
`;

    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    return new Response(text, {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (e) {
    console.error("Error generating charts:", e);
    return new Response(
      JSON.stringify({ error: "Failed to create the graph" }),
      { status: 500 }
    );
  }
});
