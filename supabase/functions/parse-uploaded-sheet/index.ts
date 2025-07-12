import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.5";
import * as xlsx from "https://esm.sh/xlsx@0.18.5";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  try {
    const body = await req.json();

    const { filePath, fileId, userId } = body || {};
    if (!filePath || !fileId || !userId) {
      return new Response(JSON.stringify({ error: "Parâmetros ausentes" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = Deno.env.toObject();
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: fileData, error: downloadError } = await supabase.storage
      .from("spreadsheets")
      .download(filePath);

    if (downloadError || !fileData) {
      return new Response(JSON.stringify({ error: "Erro ao baixar arquivo" }), {
        status: 500,
        headers: corsHeaders,
      });
    }

    const arrayBuffer = await fileData.arrayBuffer();
    const workbook = xlsx.read(arrayBuffer, { type: "array" });

    const insertedSpreadsheet = await supabase
      .from("spreadsheets")
      .insert({ id: fileId, user_id: userId, file_name: filePath.split("/").pop() })
      .select("id")
      .single();

    if (insertedSpreadsheet.error) {
      throw insertedSpreadsheet.error;
    }

    const spreadsheet_id = insertedSpreadsheet.data.id;
    const sheetInserts = [];
    const dataInserts = [];

    workbook.SheetNames.forEach((sheetName, sheetIndex) => {
      const sheetId = crypto.randomUUID();
      sheetInserts.push({ id: sheetId, spreadsheet_id, sheet_name: sheetName });

      const sheet = workbook.Sheets[sheetName];
      const range = xlsx.utils.decode_range(sheet["!ref"]!);

      for (let row = range.s.r; row <= range.e.r; row++) {
        for (let col = range.s.c; col <= range.e.c; col++) {
          const cellRef = xlsx.utils.encode_cell({ r: row, c: col });
          const cell = sheet[cellRef];

          dataInserts.push({
            id: crypto.randomUUID(),
            sheet_id: sheetId,
            row_index: row,
            column_index: col,
            column_name: xlsx.utils.encode_col(col),
            cell_value: cell?.v?.toString?.() || "",
            data_type: typeof cell?.v === "number" ? "number" : "string",
          });
        }
      }
    });

    await supabase.from("sheets").insert(sheetInserts);
    for (let i = 0; i < dataInserts.length; i += 1000) {
      const chunk = dataInserts.slice(i, i + 1000);
      await supabase.from("spreadsheet_data").insert(chunk);
    }

    return new Response(JSON.stringify({ status: "sucesso" }), {
      status: 200,
      headers: corsHeaders,
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Erro interno", message: err.message }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};
