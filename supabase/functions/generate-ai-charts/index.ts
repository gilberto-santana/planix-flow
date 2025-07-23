
import "https://deno.land/std@0.203.0/dotenv/load.ts";
import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.5";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const geminiApiKey = Deno.env.get("GEMINI_API_KEY");

console.log("🤖 [AI-CHARTS] Função iniciada!");

function generateFallbackCharts(data: any[]): any[] {
  console.log("📊 [AI-CHARTS] Gerando gráficos de fallback...");
  
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

  // Tentar extrair dados reais
  const columns = new Map();
  data.forEach(row => {
    if (row.column_name && row.value) {
      const numValue = parseFloat(String(row.value));
      if (!isNaN(numValue)) {
        if (!columns.has(row.column_name)) {
          columns.set(row.column_name, []);
        }
        columns.get(row.column_name).push({
          label: `Linha ${row.row_index || 1}`,
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
  console.log("📨 [AI-CHARTS] Requisição recebida:", req.method);

  if (req.method === 'OPTIONS') {
    console.log("✅ [AI-CHARTS] Respondendo OPTIONS");
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    console.log("📝 [AI-CHARTS] Lendo body da requisição...");
    const body = await req.text();
    
    if (!body.trim()) {
      console.log("⚠️ [AI-CHARTS] Body vazio, retornando fallback");
      return new Response(JSON.stringify({
        success: true,
        source: "fallback-empty",
        chartConfig: generateFallbackCharts([])
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    let requestData;
    try {
      requestData = JSON.parse(body);
      console.log("✅ [AI-CHARTS] JSON parseado com sucesso");
    } catch (parseError) {
      console.error("❌ [AI-CHARTS] Erro ao parsear JSON:", parseError);
      return new Response(JSON.stringify({
        success: true,
        source: "fallback-parse-error",
        chartConfig: generateFallbackCharts([])
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const data = requestData.data || requestData;
    console.log("📊 [AI-CHARTS] Dados recebidos:", data?.length || 0, "registros");

    if (!data || !Array.isArray(data) || data.length === 0) {
      console.log("⚠️ [AI-CHARTS] Dados inválidos, usando fallback");
      return new Response(JSON.stringify({
        success: true,
        source: "fallback-no-data",
        chartConfig: generateFallbackCharts([])
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Tentar usar Gemini se a chave estiver disponível
    if (geminiApiKey) {
      console.log("🤖 [AI-CHARTS] Tentando usar Gemini...");
      
      const prompt = `
Você é um assistente de visualização de dados.

Analise os dados da planilha e gere até 5 gráficos úteis. Use o melhor tipo de gráfico dependendo dos dados (pie para proporções, bar para comparações).

Retorne APENAS um JSON válido no formato:

[
  {
    "type": "bar",
    "title": "Título do gráfico",
    "data": [
      { "label": "Item A", "value": 123 },
      { "label": "Item B", "value": 456 }
    ]
  }
]

Dados da planilha:
${JSON.stringify(data.slice(0, 20), null, 2)}
`.trim();

      try {
        console.log("🚀 [AI-CHARTS] Fazendo requisição para Gemini...");
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
            console.log("✅ [AI-CHARTS] Resposta do Gemini recebida");
            try {
              const aiCharts = JSON.parse(textResponse);
              if (Array.isArray(aiCharts) && aiCharts.length > 0) {
                console.log("🎯 [AI-CHARTS] Gráficos da IA gerados:", aiCharts.length);
                return new Response(JSON.stringify({
                  success: true,
                  source: "gemini",
                  chartConfig: aiCharts
                }), {
                  headers: { ...corsHeaders, "Content-Type": "application/json" }
                });
              }
            } catch (jsonError) {
              console.error("❌ [AI-CHARTS] Erro ao parsear resposta da IA:", jsonError);
            }
          }
        } else {
          console.error("❌ [AI-CHARTS] Gemini retornou erro:", geminiResponse.status);
        }
      } catch (geminiError) {
        console.error("❌ [AI-CHARTS] Erro na requisição Gemini:", geminiError);
      }
    } else {
      console.log("⚠️ [AI-CHARTS] Chave Gemini não configurada");
    }

    // Fallback com dados reais
    console.log("📊 [AI-CHARTS] Usando fallback com dados reais");
    const fallbackCharts = generateFallbackCharts(data);
    
    return new Response(JSON.stringify({
      success: true,
      source: "fallback-with-data",
      chartConfig: fallbackCharts
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("❌ [AI-CHARTS] Erro geral:", error);
    return new Response(JSON.stringify({
      success: true,
      source: "fallback-error",
      chartConfig: generateFallbackCharts([])
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
