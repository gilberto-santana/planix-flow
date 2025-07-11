// supabase/functions/parse-uploaded-sheet/index.ts

import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.5";
import * as XLSX from "https://esm.sh/xlsx@0.18.5";

serve(async (req) => {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = Deno.env.toObject();

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("❌ Credenciais Supabase ausentes.");
    return new Response(
      JSON.stringify({ error: "Missing Supabase credentials" }),
      { status: 500 }
    );
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  let body;
  try {
    body = await req.json();
  } catch (jsonError) {
    console.error("❌ Erro ao fazer parse do JSON:", jsonError);
    return new Response(
      JSON.stringify({
        error: "Invalid JSON in request body",
        details: jsonError?.message ?? "Sem mensagem",
      }),
      { status: 400 }
    );
  }

  const { filePath, fileId, userId } = body;

  if (!filePath || !fileId || !userId) {
    console.error("❌ Parâmetros ausentes:", { filePath, fileId, userId });
    return new Response(
      JSON.stringify({ error: "Missing filePath, fileId or userId" }),
      { status: 400 }
    );
  }

  try {
    const { data, error } = await supabase.storage
      .from("spreadsheets")
      .download(filePath);

    if (error || !data) {
      console.error("❌ Erro ao baixar arquivo:", error);
      return new Response(
        JSON.stringify({ error: "Failed to download file from storage" }),
        { status: 500 }
      );
    }

    const buffer = await data.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const rows: any[][] = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        defval: "",
        raw: false,
      });

      const insertPayload = [];

      for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
        const row = rows[rowIndex];
        for (let colIndex = 0; colIndex < row.length; colIndex++) {
          insertPayload.push({
            user_id: userId,
            file_id: fileId,
            sheet_name: sheetName,
            row_index: rowIndex,
            column_name: `Coluna ${colIndex + 1}`,
            value: String(row[colIndex]),
            created_at: new Date().toISOString(),
          });
        }
      }

      if (insertPayload.length > 0) {
        const { error: insertError } = await supabase
          .from("spreadsheet_data")
          .insert(insertPayload);

        if (insertError) {
          console.error("❌ Erro ao inserir dados:", insertError);
          return new Response(
            JSON.stringify({
              error: "Failed to insert parsed data",
              details: insertError,
            }),
            { status: 500 }
          );
        }
      }
    }

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (err) {
    console.error("❌ Erro inesperado:", err);
    return new Response(
      JSON.stringify({
        error: "Unexpected error",
        message: err?.message ?? "Sem mensagem",
        stack: err?.stack ?? "Sem stack",
      }),
      { status: 500 }
    );
  }
});
