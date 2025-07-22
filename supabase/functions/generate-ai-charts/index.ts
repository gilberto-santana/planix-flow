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

    let requestData;
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

    const data = requestData.data || requestData;
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
Você é uma IA que analisa planilhas enviadas por usuários e gera sugestões de gráficos interativos para visualização de dados. 
A planilha pode conter qualquer tipo de informação: vendas, clientes, produtos, controle de estoque, etc. 
Seu trabalho é:

1. Detectar automaticamente os tipos de dados em cada coluna (datas, textos, números, categorias).
2. Identificar colunas que podem ser usadas como "dimensões" (ex: datas, categorias, nomes) e "métricas" (ex: valores numéricos, quantidades).
3. Gerar até 10 sugestões de gráficos úteis para análise e tomada de decisão, usando combinações relevantes de dimensão + métrica.
4. Escolher o tipo de gráfico mais adequado: barras, pizza, linhas, colunas, etc.
5. Evitar gráficos redundantes (ex: não repetir a mesma métrica em todas as combinações possíveis).
6. Gerar apenas gráficos que façam sentido e tragam valor para quem está analisando a planilha.

Formato de saída:
[
  {
    "title": "Título claro e útil do gráfico",
    "description": "Breve explicação do que o gráfico mostra",
    "xAxis": "Nome da coluna usada no eixo X",
    "yAxis": "Nome da coluna usada no eixo Y (ou métrica)",
    "type": "bar" | "line" | "pie" | "column"
  }
]

IMPORTANTE: Não assuma o conteúdo da planilha. Sempre analise os dados e gere sugestões que façam sentido de forma geral, sem depender do contexto específico.

Dados:
${JSON.stringify(data.slice(0, 50), null, 2)}
      `;

      try {
        const geminiResponse = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
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
            } catch (_) {}
          }
        }
      } catch (_) {}
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
