// supabase/functions/generate-ai-charts/index.ts

import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.5";

serve(async (req) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const geminiApiKey = Deno.env.get("GEMINI_API_KEY");

  if (!geminiApiKey) {
    return new Response("GEMINI_API_KEY não configurada", { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { sheetId } = await req.json();
    if (!sheetId) {
      return new Response("sheetId não fornecido", { status: 400 });
    }

    const { data, error } = await supabase
      .from("spreadsheet_data")
      .select("column_name, cell_value, row_index")
      .eq("sheet_id", sheetId)
      .order("row_index", { ascending: true });

    if (error || !data || data.length === 0) {
      return new Response("Erro ao buscar dados da planilha", { status: 500 });
    }

    // Converte os dados em linhas estruturadas
    const linhas: Record<string, string>[] = [];
    const mapa = new Map<number, Record<string, string>>();

    data.forEach((item) => {
      if (!mapa.has(item.row_index)) {
        mapa.set(item.row_index, {});
      }
      if (item.column_name && item.cell_value !== null) {
        mapa.get(item.row_index)![item.column_name] = item.cell_value;
      }
    });

    mapa.forEach((row) => linhas.push(row));

    const prompt = `
Você é um gerador de gráficos para dashboards. Com base nos dados fornecidos abaixo (em JSON), gere até 10 gráficos úteis que revelem padrões, comparações, tendências ou distribuições. Formato de resposta:

[
  {
    "title": "Título do gráfico",
    "description": "Breve explicação do que representa",
    "type": "bar | line | pie | scatter | area",
    "x": "campo usado no eixo X",
    "y": "campo usado no eixo Y",
    "color": "campo usado para colorir ou segmentar (opcional)"
  }
]

Dados:
${JSON.stringify(linhas)}
    `.trim();

    const geminiResponse = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=" + geminiApiKey, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });

    if (!geminiResponse.ok) {
      const msg = await geminiResponse.text();
      console.error("Erro na chamada Gemini:", msg);
      return new Response("Erro ao chamar o Gemini: " + msg, { status: 500 });
    }

    const geminiJson = await geminiResponse.json();
    const content = geminiJson.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!content) {
      return new Response("Resposta vazia do Gemini", { status: 500 });
    }

    const charts = JSON.parse(content);
    return new Response(JSON.stringify(charts), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (err) {
    console.error("Erro geral:", err);
    return new Response("Erro interno na função: " + String(err), { status: 500 });
  }
});
