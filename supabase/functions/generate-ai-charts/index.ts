
import "https://deno.land/std@0.203.0/dotenv/load.ts";
import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.5';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

// Rate limiting - simple in-memory store
const requestCounts = new Map();
const RATE_LIMIT = 30; // requests per minute for AI generation
const RATE_WINDOW = 60000; // 1 minute in ms

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const userRequests = requestCounts.get(userId) || [];
  
  // Remove old requests outside the window
  const recentRequests = userRequests.filter((time: number) => now - time < RATE_WINDOW);
  
  if (recentRequests.length >= RATE_LIMIT) {
    return false;
  }
  
  recentRequests.push(now);
  requestCounts.set(userId, recentRequests);
  return true;
}

const geminiApiKey = Deno.env.get("GEMINI_API_KEY");

console.log("🤖 [AI-CHARTS] Função iniciada!");

function generateFallbackCharts(data: any[]): any[] {
  console.log("📊 [AI-CHARTS] Gerando gráficos de fallback...");
  
  if (!data || data.length === 0) {
    console.log("🔄 [AI-CHARTS] Sem dados, retornando exemplo padrão");
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

  console.log("🔍 [AI-CHARTS] Analisando dados recebidos:", data.length, "registros");

  // Extrair colunas e valores
  const columns = new Map();
  data.forEach((row, index) => {
    console.log(`📝 [AI-CHARTS] Linha ${index}:`, row);
    
    if (row.column_name && row.value !== null && row.value !== undefined) {
      const numValue = parseFloat(String(row.value));
      
      if (!isNaN(numValue)) {
        if (!columns.has(row.column_name)) {
          columns.set(row.column_name, []);
        }
        columns.get(row.column_name).push({
          label: `Linha ${row.row_index || index + 1}`,
          value: Math.abs(numValue)
        });
      } else {
        // Para valores não numéricos, criar contadores
        if (!columns.has('Categorias')) {
          columns.set('Categorias', []);
        }
        const existing = columns.get('Categorias').find((item: any) => item.label === row.value);
        if (existing) {
          existing.value += 1;
        } else {
          columns.get('Categorias').push({
            label: String(row.value).slice(0, 20),
            value: 1
          });
        }
      }
    }
  });

  const charts = [];
  let chartCount = 0;

  console.log("📊 [AI-CHARTS] Colunas encontradas:", Array.from(columns.keys()));

  for (const [columnName, values] of columns) {
    if (chartCount >= 3) break;
    if (values.length > 0) {
      charts.push({
        title: `Análise: ${columnName}`,
        type: "bar",
        data: values.slice(0, 8) // Limitar para não sobrecarregar
      });
      chartCount++;
      console.log(`✅ [AI-CHARTS] Gráfico criado: ${columnName} (${values.length} valores)`);
    }
  }

  if (charts.length === 0) {
    console.log("🔄 [AI-CHARTS] Nenhum gráfico gerado, usando padrão");
    return [{
      title: "Gráfico Exemplo",
      type: "pie",
      data: [
        { label: "Categoria 1", value: 40 },
        { label: "Categoria 2", value: 35 },
        { label: "Categoria 3", value: 25 }
      ]
    }];
  }

  console.log("🎯 [AI-CHARTS] Fallback gerado:", charts.length, "gráficos");
  return charts;
}

serve(async (req) => {
  console.log("📨 [AI-CHARTS] Requisição recebida:", req.method);

  if (req.method === 'OPTIONS') {
    console.log("✅ [AI-CHARTS] Respondendo OPTIONS");
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    // Simplified authentication - get user ID from header if available
    const authHeader = req.headers.get('authorization');
    let userId = 'anonymous';
    
    if (authHeader) {
      try {
        const token = authHeader.replace('Bearer ', '');
        const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = Deno.env.toObject();
        const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
        
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (user && !authError) {
          userId = user.id;
          console.log("🤖 [AI-CHARTS] Usuário autenticado:", userId);
        }
      } catch (err) {
        console.log("⚠️ [AI-CHARTS] Falha na autenticação, continuando como anônimo");
      }
    }
    
    // Check rate limit (more generous)
    if (!checkRateLimit(userId)) {
      console.log("⚠️ [AI-CHARTS] Rate limit atingido para:", userId);
      // Don't fail, just log and continue
    }
    
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

    // SEMPRE tentar usar Gemini primeiro se disponível
    if (geminiApiKey) {
      console.log("🤖 [AI-CHARTS] Tentando usar Gemini...");
      
      try {
        const prompt = `
Analise os dados da planilha e gere 2-3 gráficos úteis em JSON.

Retorne APENAS um array JSON válido no formato:
[
  {
    "type": "bar",
    "title": "Nome do gráfico",
    "data": [
      { "label": "Item 1", "value": 100 },
      { "label": "Item 2", "value": 200 }
    ]
  }
]

Use "bar" para comparações, "pie" para proporções, "line" para tendências.

Dados (primeiros 10 registros):
${JSON.stringify(data.slice(0, 10), null, 2)}
        `.trim();

        console.log("🚀 [AI-CHARTS] Enviando para Gemini...");
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
            console.log("📝 [AI-CHARTS] Resposta bruta:", textResponse.slice(0, 200) + "...");
            
            try {
              // Tentar extrair JSON da resposta
              let jsonStr = textResponse.trim();
              
              // Remover markdown se presente
              if (jsonStr.startsWith('```json')) {
                jsonStr = jsonStr.replace(/```json\n?/, '').replace(/\n?```$/, '');
              } else if (jsonStr.startsWith('```')) {
                jsonStr = jsonStr.replace(/```\n?/, '').replace(/\n?```$/, '');
              }
              
              const aiCharts = JSON.parse(jsonStr);
              
              if (Array.isArray(aiCharts) && aiCharts.length > 0) {
                // Validar estrutura dos gráficos
                const validCharts = aiCharts.filter(chart => 
                  chart && 
                  chart.title && 
                  chart.data && 
                  Array.isArray(chart.data) &&
                  chart.data.length > 0 &&
                  chart.data.every((item: any) => 
                    item.label && 
                    typeof item.value === 'number'
                  )
                );
                
                if (validCharts.length > 0) {
                  console.log("🎯 [AI-CHARTS] Gráficos da IA validados:", validCharts.length);
                  return new Response(JSON.stringify({
                    success: true,
                    source: "gemini",
                    chartConfig: validCharts
                  }), {
                    headers: { ...corsHeaders, "Content-Type": "application/json" }
                  });
                } else {
                  console.log("⚠️ [AI-CHARTS] Gráficos da IA inválidos");
                }
              } else {
                console.log("⚠️ [AI-CHARTS] Resposta da IA não é array válido");
              }
            } catch (jsonError) {
              console.error("❌ [AI-CHARTS] Erro ao parsear resposta da IA:", jsonError);
              console.log("📝 [AI-CHARTS] Texto que falhou:", textResponse.slice(0, 500));
            }
          } else {
            console.log("⚠️ [AI-CHARTS] Gemini não retornou texto");
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

    // Fallback com dados reais SEMPRE funciona
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
