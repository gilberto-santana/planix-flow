// supabase/functions/analyze-with-gemini/index.ts

import { serve } from "https://deno.land/std@0.192.0/http/server.ts";

serve(async (req) => {
  try {
    const { rows } = await req.json();

    const GEMINI_API_KEY = "AIzaSyB6VGJWhoHPN8-qMK4XWx8Ft6slrKGQvOY";

    if (!GEMINI_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Chave da API Gemini não configurada." }),
        { status: 500 }
      );
    }

    if (!rows || rows.length === 0) {
      return new Response(
        JSON.stringify({ error: "Nenhum dado recebido para análise." }),
        { status: 400 }
      );
    }

    const plainTextData = rows
      .map((r: any) => `${r.sheet_name} | ${r.column_name}: ${r.cell_value}`)
      .join("\n");

    const prompt = `
Você é um especialista em análise de dados de planilhas, com domínio absoluto em Excel, BI, dashboards e interpretação de KPIs. Sua missão é interpretar os dados fornecidos e sugerir gráficos altamente úteis e estratégicos, mesmo com dados incompletos.

Regras:
- Gere sugestões de até 10 gráficos no total.
- Para cada gráfico, defina:
  - título
  - tipo de gráfico (barra, pizza, linha etc)
  - descrição do insight que será revelado com este gráfico
  - colunas a serem utilizadas
- Evite repetir colunas em gráficos com o mesmo objetivo.
- Mostre variedade de tipos de gráficos (não apenas barras).
- Seja inteligente mesmo com dados simples, imagine cenários de uso real.
- Nunca retorne sugestões vagas ou genéricas.

Exemplo de formato de resposta:
[
  {
    "titulo": "Total de vendas por categoria",
    "tipo": "bar",
    "descricao": "Compara o volume de vendas por categoria de produto",
    "colunas": ["Categoria", "Vendas"]
  },
  ...
]

Aqui estão os dados da planilha:
${plainTextData}
    `.trim();

    const geminiResponse = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=" +
        GEMINI_API_KEY,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }],
            },
          ],
        }),
      }
    );

    const geminiJson = await geminiResponse.json();

    const text = geminiJson.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      return new Response(
        JSON.stringify({ error: "Resposta vazia do Gemini." }),
        { status: 500 }
      );
    }

    // Extrair JSON do texto retornado
    const jsonStart = text.indexOf("[");
    const jsonEnd = text.lastIndexOf("]") + 1;
    const jsonString = text.substring(jsonStart, jsonEnd);

    let chartSuggestions = [];

    try {
      chartSuggestions = JSON.parse(jsonString);
    } catch (e) {
      return new Response(
        JSON.stringify({ error: "Erro ao interpretar resposta do Gemini.", raw: text }),
        { status: 500 }
      );
    }

    return new Response(JSON.stringify(chartSuggestions), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: "Erro inte
