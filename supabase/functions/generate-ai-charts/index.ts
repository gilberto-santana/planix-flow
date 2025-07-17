import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.5";
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai@0.5.2";

serve(async (req) => {
  try {
    const { SUPABASE_URL, SUPABASE_ANON_KEY, GEMINI_API_KEY } = Deno.env.toObject();

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !GEMINI_API_KEY) {
      return new Response("Missing environment variables", { status: 500 });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const body = await req.json();
    const { spreadsheetId } = body;

    if (!spreadsheetId) {
      return new Response("Missing spreadsheetId", { status: 400 });
    }

    const { data: rows, error } = await supabase
      .from("spreadsheet_data")
      .select("sheet_name, row_index, column_name, cell_value")
      .eq("spreadsheet_id", spreadsheetId);

    if (error || !rows || rows.length === 0) {
      return new Response("Erro ao buscar dados da planilha", { status: 500 });
    }

    const sheets: Record<string, Record<string, string>[]> = {};
    for (const row of rows) {
      const sheet = row.sheet_name;
      const index = row.row_index;
      const column = row.column_name;
      const value = row.cell_value;

      if (!sheets[sheet]) sheets[sheet] = [];
      if (!sheets[sheet][index]) sheets[sheet][index] = {};
      sheets[sheet][index][column ?? ""] = value ?? "";
    }

    const tables = Object.entries(sheets)
      .map(([sheetName, data]) => {
        const json = JSON.stringify(data, null, 2);
        return `Sheet: ${sheetName}\n${json}`;
      })
      .join("\n\n");

    const prompt = `
Você é o maior especialista em planilhas do mundo, com domínio completo sobre funções do Excel e sobre como visualizar dados em gráficos claros e úteis.

Abaixo está o conteúdo completo de uma planilha separada por abas (sheets). Gere **no máximo 10 gráficos** com base nas colunas e dados disponíveis. Para cada gráfico, retorne um JSON com os seguintes campos:

- "type": pode ser "bar", "line", "pie" ou "doughnut"
- "title": título do gráfico
- "description": descrição curta do que ele representa
- "x": nome da coluna usada no eixo X
- "y": nome da coluna usada no eixo Y
- "sheet": nome da aba onde os dados estão localizados

Planilha:
${tables}
`;

    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    try {
      const parsed = JSON.parse(text);
      return new Response(JSON.stringify(parsed), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch {
      return new Response(`Erro ao interpretar resposta da IA:\n${text}`, { status: 400 });
    }
  } catch (err) {
    return new Response(`Erro inesperado: ${err.message}`, { status: 500 });
  }
});
