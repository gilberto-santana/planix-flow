// supabase/functions/process-spreadsheet/index.ts

import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.5";
import * as XLSX from "https://esm.sh/xlsx@0.18.5";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { SUPABASE_URL, SUPABASE_ANON_KEY } = Deno.env.toObject();
    
    // Get authorization header for JWT verification
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized - No auth header" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    // Create authenticated supabase client
    const supabase = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    // Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized - Invalid token" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    // Parse form data to get the file
    const formData = await req.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return new Response(JSON.stringify({ error: "No file provided" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    // Create unique file path
    const fileName = `${user.id}/${Date.now()}_${file.name}`;
    
    // Upload file to Storage
    const { error: uploadError } = await supabase.storage
      .from('spreadsheets')
      .upload(fileName, file, {
        contentType: file.type,
        upsert: false
      });

    if (uploadError) {
      return new Response(JSON.stringify({ error: "Failed to upload file", details: uploadError }), {
        status: 500,
        headers: corsHeaders,
      });
    }

    // Get the uploaded file to process
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('spreadsheets')
      .download(fileName);

    if (downloadError || !fileData) {
      return new Response(JSON.stringify({ error: "Failed to download file", details: downloadError }), {
        status: 500,
        headers: corsHeaders,
      });
    }

    const arrayBuffer = await fileData.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: "array" });

    // Inserir metadata na tabela spreadsheets
    const { data: spreadsheet, error: spreadsheetError } = await supabase
      .from("spreadsheets")
      .insert({
        user_id: user.id,
        file_name: file.name,
        file_path: fileName,
        file_size: arrayBuffer.byteLength,
        file_type: file.type,
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

    return new Response(JSON.stringify({ success: true }), { 
      status: 200,
      headers: corsHeaders 
    });
  } catch (err) {
    console.error("Erro inesperado:", err);
    return new Response(JSON.stringify({ error: "Internal server error", details: err.message }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
