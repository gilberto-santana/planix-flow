// supabase/functions/generate-ai-charts/index.ts

import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.5";

serve(async (req) => {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GEMINI_API_KEY } = Deno.env.toObject();

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const { spreadsheetId } = await req.json();

    if (!spreadsheetId) {
      return new Response(JSON.stringify({ error: "Missing spreadsheetId" }), {
        status: 400,
      });
    }

    const { data: spreadsheetData, error } = await supabase
      .from("spreadsheet_data")
      .select("sheet_name, row_index, column_name, cell_value")
      .eq("spreadsheet_id", spreadsheetId);

    if (error) {
      return new Response(JSON.stringify({ error: "Erro ao buscar dados" }), { status: 500 });
    }

    const sheets: Record<string, any[]> = {};

    for (const row of spreadsheetData) {
      const { sheet_name, row_index, column_name, cell_value } = row;
      if (!sheets[sheet_name]) sheets[sheet_name] = [];
      if (!sheets[sheet_name][row_index]) sheets[sheet_name][row_index] = {};
      sheets[sheet_name][row_index][column_name] = cell_value;
    }

    const sheetKeys = Object.keys(sheets);

    const charts = [];

    for (const sheetName of sheetKeys) {
      const rows = sheets[sheetName].filter(Boolean);

      const prompt = `Analyze the following spreadsheet data and return up to 10 visual insights as chart objects. Each chart should have a 'title', 'type' (bar, line, pie, etc), and 'data' with 'labels' and 'datasets'. Use JSON format only.

Sheet: ${sheetName}

Data:
${JSON.stringify(rows)}

Return only the JSON array.`;

      const geminiRes = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=" + GEMINI_API_KEY, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt,
                },
              ],
            },
          ],
        }),
      });

      const geminiJson = await geminiRes.json();
      const textPart = geminiJson.candidates?.[0]?.content?.parts?.[0]?.text;

      try {
        const parsed = JSON.parse(textPart);
        charts.push(...parsed);
      } catch (e) {
        console.error("Erro ao fazer parse do JSON retornado pelo Gemini:", textPart);
      }
    }

    return new Response(JSON.stringify({ charts }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (e) {
    console.error("Erro geral:", e);
    return new Response(JSON.stringify({ error: "Erro geral" }), { status: 500 });
  }
});
