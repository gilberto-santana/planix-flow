// supabase/functions/parse-uploaded-sheet/index.ts

import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.5";
import * as xlsx from "https://esm.sh/xlsx";

serve(async (req) => {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = Deno.env.toObject();

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const { filePath, fileId, userId } = await req.json();

    if (!filePath || !fileId || !userId) {
      return new Response(JSON.stringify({ error: "Missing required params" }), { status: 400 });
    }

    const { data: fileData, error: downloadError } = await supabase.storage
      .from("spreadsheets")
      .download(filePath);

    if (downloadError) {
      return new Response(JSON.stringify({ error: downloadError.message }), { status: 500 });
    }

    const arrayBuffer = await fileData.arrayBuffer();
    const workbook = xlsx.read(arrayBuffer, { type: "array" });

    const insertPayload = [];

    for (const sheetName of workbook.SheetNames) {
      const sheet = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });

      for (let rowIndex = 0; rowIndex < sheet.length; rowIndex++) {
        const row = sheet[rowIndex];
        for (let colIndex = 0; colIndex < row.length; colIndex++) {
          insertPayload.push({
            user_id: userId,
            file_id: fileId,
            sheet_name: sheetName,
            row_index: rowIndex,
            column_name: `Coluna ${colIndex + 1}`,
            value: String(row[colIndex] ?? ""),
          });
        }
      }
    }

    if (insertPayload.length > 0) {
      const { error: insertError } = await supabase
        .from("spreadsheet_data")
        .insert(insertPayload);

      if (insertError) {
        return new Response(JSON.stringify({ error: insertError.message }), { status: 500 });
      }
    }

    return new Response(JSON.stringify({ success: true, rows: insertPayload.length }), {
      status: 200,
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
