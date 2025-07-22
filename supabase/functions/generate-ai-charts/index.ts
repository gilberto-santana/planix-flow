
import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.5";

// Configuração de CORS robusta
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

console.log("🔧 [INIT] Environment check:", {
  hasGeminiKey: !!geminiApiKey,
  hasSupabaseUrl: !!supabaseUrl,
  hasServiceRole: !!serviceRoleKey
});

const supabase = createClient(supabaseUrl!, serviceRoleKey!);

// Função para gerar gráficos de fallback
function generateFallbackCharts(data: any[]): any[] {
  console.log("🔄 [FALLBACK] Gerando gráficos de exemplo com", data.length, "registros");
  
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

  // Agrupar dados por coluna para criar gráficos
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
    if (chartCount >= 3) break; // Máximo 3 gráficos
    
    if (values.length > 0) {
      charts.push({
        title: `Análise: ${columnName}`,
        type: "bar",
        data: values.slice(0, 10) // Máximo 10 itens por gráfico
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
  console.log(`📥 [REQUEST] ${req.method} ${req.url}`);

  // Tratamento de CORS - CRÍTICO
  if (req.method === 'OPTIONS') {
    console.log("✅ [CORS] Respondendo OPTIONS request");
    return new Response(null, {
      status: 200,
      headers: corsHeaders
    });
  }

  try {
    // Validação flexível do body
    let requestData;
    const contentType = req.headers.get("content-type") || "";
    
    console.log("📋 [HEADERS] Content-Type:", contentType);

    try {
      const body = await req.text();
      console.log("📦 [BODY] Tamanho do body:", body.length);
      
      if (!body.trim()) {
        console.warn("⚠️ [BODY] Body vazio recebido");
        return new Response(JSON.stringify({
          error: "Body vazio",
          fallback: true,
          chartConfig: generateFallbackCharts([])
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      requestData = JSON.parse(body);
      console.log("✅ [PARSE] Body parseado com sucesso");
    } catch (parseError) {
      console.error("❌ [PARSE] Erro ao parsear body:", parseError);
      return new Response(JSON.stringify({
        error: "Erro ao parsear JSON",
        fallback: true,
        chartConfig: generateFallbackCharts([])
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Extração flexível dos dados
    let data = requestData.data || requestData;
    
    console.log("📊 [DATA] Estrutura recebida:", {
      hasData: !!data,
      isArray: Array.isArray(data),
      length: Array.isArray(data) ? data.length : 'N/A',
      hasMetadata: !!requestData.metadata,
      sampleKeys: data && typeof data === 'object' ? Object.keys(data).slice(0, 5) : []
    });

    if (!data || !Array.isArray(data) || data.length === 0) {
      console.warn("⚠️ [DATA] Dados inválidos ou vazios, usando fallback");
      return new Response(JSON.stringify({
        error: "Dados inválidos",
        fallback: true,
        chartConfig: generateFallbackCharts([])
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Tentar usar Gemini se disponível
    if (geminiApiKey) {
      console.log("🤖 [GEMINI] Tentando gerar gráficos com IA");
      
      const prompt = `
Você é uma IA especializada em criar gráficos. Analise os dados e gere até 3 gráficos úteis no formato JSON:

[
  {
    "title": "Nome do gráfico",
    "type": "bar" | "pie" | "line",
    "data": [
      { "label": "Rótulo", "value": 123 },
      { "label": "Rótulo 2", "value": 456 }
    ]
  }
]

Use apenas dados numéricos válidos. Responda APENAS com o JSON, sem texto explicativo.

Dados: ${JSON.stringify(data.slice(0, 50), null, 2)}
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
                console.log("✅ [GEMINI] Gráficos gerados com sucesso:", aiCharts.length);
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

    // Fallback sempre funcional
    console.log("🔄 [FALLBACK] Usando geração local de gráficos");
    const fallbackCharts = generateFallbackCharts(data);
    
    return new Response(JSON.stringify({
      success: true,
      source: "fallback",
      chartConfig: fallbackCharts
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("❌ [ERROR] Erro inesperado:", error);
    
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
