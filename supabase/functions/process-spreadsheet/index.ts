// supabase/functions/process-spreadsheet/index.ts

import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.5";
import * as XLSX from "https://esm.sh/xlsx@0.18.5";

serve(async (req) => {
  try {
    const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = Deno.env.toObject();
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    const { type, record } = await req.json();

    if (type !== "INSERT" || !record?.name || !record?.bucket_id) {
      return new Response(JSON.stringify({ error: "Invalid event payload" }), {
        status: 400,
      });
    }

    const filePath = record.name;
    const bucket = record.bucket_id;
    const userId = filePath.split("/")[0];

    // Baixar o arquivo do Storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from(bucket)
      .download(filePath);

    if (downloadError || !fileData) {
      return new Response(JSON.stringify({ error: "Failed to download file", details: downloadError }), {
        status: 500,
      });
    }

    const arrayBuffer = await fileData.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: "array" });

    // Inserir metadata na tabela spreadsheets
    const { data: spreadsheet, error: spreadsheetError } = await supabase
      .from("spreadsheets")
      .insert({
        user_id: userId,
        file_name: filePath.split("/").pop(),
        file_path: filePath,
        file_size: arrayBuffer.byteLength,
        file_type: record.metadata?.mimetype || "unknown",
        sheet_count: workbook.SheetNames.length,
        upload_status: "uploaded",
        processing_status: "parsed"
      })
      .select()
      .single();

    if (spreadsheetError || !spreadsheet) {
      return new Response(JSON.stringify({ error: "Failed to insert spreadsheet metadata", details: spreadsheetError }), {
        status: 500,
      });
    }

    for (let i = 0; i < workbook.SheetNames.length; i++) {
      const sheetName = workbook.SheetNames[i];
      const sheet = workbook.Sheets[sheetName];
      const json = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

      const columnCount = json[0]?.length || 0;
      const rowCount = json.length;

      // Criar registro da aba
      const { data: sheetRow, error: sheetInsertError } = await supabase
        .from("sheets")
        .insert({
          spreadsheet_id: spreadsheet.id,
          sheet_name: sheetName,
          sheet_index: i,
          column_count: columnCount,
          row_count: rowCount,
        })
        .select()
        .single();

      if (sheetInsertError || !sheetRow) {
        console.error("Erro ao criar sheet:", sheetInsertError);
        continue;
      }

      const dataRows = [];

      for (let r = 1; r < json.length; r++) {
        const row = json[r];
        for (let c = 0; c < row.length; c++) {
          const cellValue = row[c];
          const columnName = json[0]?.[c] || `Column ${c + 1}`;
          const dataType = typeof cellValue;

          dataRows.push({
            sheet_id: sheetRow.id,
            row_index: r,
            column_index: c,
            column_name: columnName,
            cell_value: cellValue?.toString() || "",
            data_type: dataType,
          });
        }
      }

      if (dataRows.length > 0) {
        const { error: insertError } = await supabase
          .from("spreadsheet_data")
          .insert(dataRows);

        if (insertError) {
          console.error("Erro ao inserir dados:", insertError);
        }
      }
    }

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (err) {
    console.error("Erro inesperado:", err);
    return new Response(JSON.stringify({ error: "Internal server error", details: err.message }), {
      status: 500,
    });
  }
});
