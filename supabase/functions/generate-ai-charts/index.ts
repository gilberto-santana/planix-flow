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

    let body: any;
    try {
      body = await req.json();
    } catch (err) {
      console.error("Erro ao ler JSON:", err);
      return new Response(JSON.stringify({ error: "Invalid or missing JSON body." }), { status: 400 });
    }

    const { sheet_id } = body;
    if (!sheet_id) {
      return new Response(JSON.stringify({ error: "Missing sheet_id in body." }), { status: 400 });
    }

    // Buscar os dados da planilha
    const { data: rows, error } = await supabase
      .from("spreadsheet_data")
      .select("column_name, row_index, cell_value")
      .eq("sheet_id", sheet_id);

    if (error || !rows || rows.length === 0) {
      return new Response(JSON.stringify({ error: "No data found for this sheet." }), { status: 404 });
    }

    // Estrutura os dados para o prompt
    const formatted = rows.map((r) => ({
      column: r.column_name,
      row: r.row_index,
      value: r.cell_value,
    }));

    const prompt = `
Você é um assistente de análise de dados. Abaixo está um conjunto de dados extraído de uma planilha.
Gere até 10 gráficos úteis e variados com base nos dados. Para cada gráfico, forneça um título e um objeto JSON no formato:

{
  "type": "bar" | "line" | "pie",
  "title": "Título do gráfico",
  "x": [array de valores do eixo X],
  "y": [array de valores do eixo Y]
}

Aqui estão os dados:
${JSON.stringify(formatted)}
`;

    const geminiResponse = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=" + GEMINI_API_KEY, {
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

    const geminiJson = await geminiResponse.json();
    const text = geminiJson.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      return new Response(JSON.stringify({ error: "Failed to get response from Gemini." }), { status: 500 });
    }

    // Extrair os gráficos do texto retornado (assumindo JSON válido no corpo)
    const charts = JSON.parse(text);

    return new Response(JSON.stringify({ charts }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Erro geral:", e);
    return new Response(JSON.stringify({ error: "Erro interno no servidor." }), { status: 500 });
  }
});
