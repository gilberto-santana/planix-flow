import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.5";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const supabase = createClient(supabaseUrl!, serviceRoleKey!);

function generateFallbackCharts(data: any[]): any[] {
  if (!data || data.length === 0) {
    return [{
      title: "Dados de Exemplo",
      type: "bar",
      data: [
        { label: "Item A", value: 25 },
        { label: "Item B", value: 45 },
        { label: "Item C", value: 30 }
      ]
    }];
  }

  const columns = new Map();
  data.forEach(row => {
    if (row.column_name && row.value) {
      const numValue = parseFloat(String(row.value));
      if (!isNaN(numValue)) {
        if (!columns.has(row.column_name)) {
          columns.set(row.column_name, []);
        }
        columns.get(row.column_name).push({
          label: `Linha ${row.row_index}`,
          value: Math.abs(numValue)
        });
      }
    }
  });

  const charts = [];
  let chartCount = 0;

  for (const [columnName, values] of columns) {
    if (chartCount >= 3) break;
    if (values.length > 0) {
      charts.push({
        title: `Análise: ${columnName}`,
        type: "bar",
        data: values.slice(0, 10)
      });
      chartCount++;
    }
  }

  return charts.length > 0 ? charts : [{
    title: "Gráfico Exemplo",
    type: "pie",
    data: [
      { label: "Categoria 1", value: 40 },
      { label: "Categoria 2", value: 35 },
      { label: "Categoria 3", value: 25 }
    ]
  }];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    let requestData;
    const contentType = req.headers.get("content-type") || "";

    const body = await req.text();
    if (!body.trim()) {
      return new Response(JSON.stringify({
        error: "Body vazio",
        fallback: true,
        chartConfig: generateFallbackCharts([])
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    try {
      requestData = JSON.parse(body);
    } catch (parseError) {
      return new Response(JSON.stringify({
        error: "Erro ao parsear JSON",
        fallback: true,
        chartConfig: generateFallbackCharts([])
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    let data = requestData.data || requestData;
    if (!data || !Array.isArray(data) || data.length === 0) {
      return new Response(JSON.stringify({
        error: "Dados inválidos",
        fallback: true,
        chartConfig: generateFallbackCharts([])
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (geminiApiKey) {
      const prompt = `
You are a chart generation assistant. You receive a dataset extracted from a spreadsheet. Your goal is to analyze the data and automatically generate up to 10 relevant charts based on the structure and content of the data.

The data is dynamic and may represent any type of content: product lists, inventory, customer records, financial tables, marketing metrics, or others.

Your task:
- Automatically detect the type of columns (e.g., category, numeric, date, ID, etc.).
- Select the most meaningful combinations of fields to generate insightful visualizations.
- Choose the best chart type for each case: use pie charts for proportion comparison, bar/column charts for categorical metrics, and line charts for trends over time.
- Avoid generating charts based on ID-like or low-variation fields.
- Do not assume any specific subject like sales or customers — always adapt based on the actual data received.
- Prefer clarity, usefulness, and uniqueness over quantity.

Output format:
[
  {
    "type": "bar" | "line" | "pie",
    "title": "string",
    "data": [{ "label": "string", "value": number }]
  }
]

Data sample:
${JSON.stringify(data.slice(0, 50), null, 2)}
      `.trim();

      try {
        const geminiResponse = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }]
            })
          }
        );

        if (geminiResponse.ok) {
          const geminiJson = await geminiResponse.json();
          const textResponse = geminiJson.candidates?.[0]?.content?.parts?.[0]?.text;

          if (textResponse) {
            try {
              const aiCharts = JSON.parse(textResponse);
              if (Array.isArray(aiCharts) && aiCharts.length > 0) {
                return new Response(JSON.stringify({
                  success: true,
                  source: "gemini",
                  chartConfig: aiCharts
                }), {
                  headers: { ...corsHeaders, "Content-Type": "application/json" }
                });
              }
            } catch (aiParseError) {
              console.warn("⚠️ [GEMINI] Erro ao parsear resposta da IA:", aiParseError);
            }
          }
        }
      } catch (geminiError) {
        console.warn("⚠️ [GEMINI] Erro na API:", geminiError);
      }
    }

    const fallbackCharts = generateFallbackCharts(data);
    return new Response(JSON.stringify({
      success: true,
      source: "fallback",
      chartConfig: fallbackCharts
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    return new Response(JSON.stringify({
      error: error.message,
      fallback: true,
      chartConfig: generateFallbackCharts([])
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
