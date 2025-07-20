// supabase/functions/generate-ai-charts/index.ts

import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";

serve(async (req) => {
  console.log("\u{1F680} Iniciando função generate-ai-charts");

  const body = await req.json();

  if (!body || !body.sheetName || !body.structuredData) {
    return new Response(
      JSON.stringify({ error: "Parâmetros obrigatórios ausentes" }),
      { status: 400 }
    );
  }

  const { sheetName, structuredData } = body;
  console.log("\u{1F4E8} Body recebido:", body);

  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");

  if (!GEMINI_API_KEY) {
    return new Response(
      JSON.stringify({ error: "Chave da API do Gemini ausente" }),
      { status: 500 }
    );
  }
  console.log("✅ Chave API encontrada, comprimento:", GEMINI_API_KEY.length);

  const systemInstruction = `Você é um assistente especialista em inteligência de negócios. Sempre que receber dados de planilha, sua função é gerar gráficos analíticos úteis, objetivos e personalizados, mesmo sem saber previamente o contexto. Siga estas instruções:

- Analise a estrutura dos dados e os campos disponíveis (nomes, datas, números, categorias, etc).
- Detecte o tipo de planilha (ex: vendas, estoque, clientes, etc) apenas com base nos rótulos e valores.
- Crie no mínimo 3 e no máximo 10 gráficos diferentes que ajudem o gestor a tomar decisões estratégicas.
- Cada gráfico deve conter: title, description, type (bar, pie, line, table etc), xKey, yKey e summary.
- Crie gráficos apenas com base em dados presentes na planilha. Nunca invente colunas.
- Evite gráficos óbvios. Priorize insights mais profundos, como rankings, correlações, tendências, outliers, etc.
- Identifique o campo temporal (data, mês, etc) se houver, e use como base para séries temporais.
- Utilize todos os dados disponíveis — inclusive campos de texto e categorias.
- Seja objetivo, evite repetições e não inclua instruções na resposta.`;

  const userPrompt = `Os dados da planilha são os seguintes:

${JSON.stringify(structuredData, null, 2)}

Gere os gráficos com base nesses dados, seguindo as instruções.`;

  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  console.log("\u{1F916} Enviando dados para Gemini...");

  try {
    const result = await model.generateContent(`${systemInstruction}\n\n${userPrompt}`);
    const response = await result.response;
    const text = response.text();

    console.log("\u{1F4C8} Resposta do Gemini recebida:", text);

    const parsed = JSON.parse(text);

    if (!Array.isArray(parsed)) {
      throw new Error("Resposta da IA não é um array de gráficos");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const chartData = parsed.map((chart: any) => ({
      sheet_name: sheetName,
      ...chart,
    }));

    const { error } = await supabase.from("chart_data").insert(chartData);

    if (error) {
      console.error("Erro ao salvar gráficos:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
      });
    }

    console.log(`✅ Gráficos gerados: ${chartData.length}`);

    return new Response(JSON.stringify({ success: true }));
  } catch (err) {
    console.error("❌ Erro na função generate-ai-charts:", err);
    return new Response(
      JSON.stringify({ error: "Falha ao gerar os gráficos com a IA" }),
      { status: 500 }
    );
  }
});
