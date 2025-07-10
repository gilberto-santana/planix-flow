// supabase/functions/parse-uploaded-sheet/index.ts

import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.5";
import { readXlsxFile } from "https://esm.sh/read-excel-file@5.7.0";

serve(async (req) => {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = Deno.env.toObject();

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return new Response(
      JSON.stringify({ error: "Missing Supabase credentials" }),
      { status: 500 }
    );
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const { filePath, fileId, userId } = await req.json();

    if (!filePath || !fileId || !userId) {
      return new Response(
        JSON.stringify({ error: "Missing filePath, fileId or userId" }),
        { status: 400 }
      );
    }

    const { data, error } = await supabase.storage
      .from("spreadsheets")
      .download(filePath);

    if (error || !data) {
      return new Response(
        JSON.stringify({ error: "Failed to download file from storage" }),
        { status: 500 }
      );
    }

    const buffer = await data.arrayBuffer();
    const sheets = await readXlsxFile(new Uint8Array(buffer), { getSheets: true });

    for (const sheetName of sheets) {
      const rows = await readXlsxFile(new Uint8Array(buffer), { sheet: sheetName });

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
            value: String(row[colIndex] ?? ""),
            created_at: new Date().toISOString(),
          });
        }
      }

      if (insertPayload.length > 0) {
        const { error: insertError } = await supabase
          .from("spreadsheet_data")
          .insert(insertPayload);

        if (insertError) {
          return new Response(
            JSON.stringify({ error: "Failed to insert parsed data", details: insertError }),
            { status: 500 }
          );
        }
      }
    }

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: "Unexpected error", details: err }), {
      status: 500,
    });
  }
});
