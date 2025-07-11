
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

  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = Deno.env.toObject();

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("❌ Credenciais Supabase ausentes.");
    return new Response(
      JSON.stringify({ error: "Missing Supabase credentials" }),
      { status: 500, headers: corsHeaders }
    );
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  let bodyText: string;
  try {
    bodyText = await req.text();
    console.log("📥 Body recebido:", bodyText.substring(0, 200) + "...");
  } catch (readError) {
    console.error("❌ Erro ao ler body:", readError);
    return new Response(
      JSON.stringify({ error: "Erro ao ler body", details: readError?.message }),
      { status: 400, headers: corsHeaders }
    );
  }

  let body: any;
  try {
    body = JSON.parse(bodyText);
    console.log("📋 Dados parseados:", { filePath: body.filePath, fileId: body.fileId, userId: body.userId });
  } catch (jsonError) {
    console.error("❌ Erro ao fazer parse do JSON:", jsonError);
    return new Response(
      JSON.stringify({ error: "Invalid JSON in request body", details: jsonError?.message }),
      { status: 400, headers: corsHeaders }
    );
  }

  const { filePath, fileId, userId, fileName, fileSize, fileType } = body;

  if (!filePath || !fileId || !userId || !fileName) {
    console.error("❌ Parâmetros ausentes:", { filePath, fileId, userId, fileName });
    return new Response(
      JSON.stringify({ error: "Missing required parameters: filePath, fileId, userId, fileName" }),
      { status: 400, headers: corsHeaders }
    );
  }

  try {
    console.log("📂 Iniciando download do arquivo:", filePath);
    
    // Download file from storage
    const { data, error } = await supabase.storage
      .from("spreadsheets")
      .download(filePath);

    if (error || !data) {
      console.error("❌ Erro ao baixar arquivo:", error);
      return new Response(
        JSON.stringify({ error: "Failed to download file from storage", details: error }),
        { status: 500, headers: corsHeaders }
      );
    }

    console.log("✅ Arquivo baixado com sucesso");

    // Create spreadsheet record
    const { data: spreadsheetData, error: spreadsheetError } = await supabase
      .from("spreadsheets")
      .insert({
        id: fileId,
        user_id: userId,
        file_name: fileName,
        file_path: filePath,
        file_size: fileSize || 0,
        file_type: fileType || 'unknown',
        upload_status: 'uploaded',
        processing_status: 'processing'
      })
      .select()
      .single();

    if (spreadsheetError) {
      console.error("❌ Erro ao criar registro de spreadsheet:", spreadsheetError);
      return new Response(
        JSON.stringify({ error: "Failed to create spreadsheet record", details: spreadsheetError }),
        { status: 500, headers: corsHeaders }
      );
    }

    console.log("✅ Registro de spreadsheet criado:", spreadsheetData.id);

    // Parse Excel file
    const buffer = await data.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    
    console.log("📊 Planilha processada, abas encontradas:", workbook.SheetNames);

    let totalRowsProcessed = 0;
    const sheetsCreated = [];

    for (let sheetIndex = 0; sheetIndex < workbook.SheetNames.length; sheetIndex++) {
      const sheetName = workbook.SheetNames[sheetIndex];
      const sheet = workbook.Sheets[sheetName];
      
      console.log(`📄 Processando aba: ${sheetName}`);

      // Create sheet record
      const sheetId = crypto.randomUUID();
      const { data: sheetData, error: sheetError } = await supabase
        .from("sheets")
        .insert({
          id: sheetId,
          spreadsheet_id: fileId,
          sheet_name: sheetName,
          sheet_index: sheetIndex
        })
        .select()
        .single();

      if (sheetError) {
        console.error("❌ Erro ao criar registro de sheet:", sheetError);
        continue;
      }

      sheetsCreated.push(sheetData);
      console.log(`✅ Aba criada: ${sheetName} (${sheetId})`);

      // Convert sheet to JSON
      const rows: any[][] = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        defval: "",
        raw: false,
      });

      console.log(`📊 Aba ${sheetName}: ${rows.length} linhas encontradas`);

      const insertPayload = [];

      for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
        const row = rows[rowIndex];
        for (let colIndex = 0; colIndex < row.length; colIndex++) {
          const cellValue = String(row[colIndex] || "");
          if (cellValue.trim()) { // Only insert non-empty cells
            insertPayload.push({
              sheet_id: sheetId,
              row_index: rowIndex,
              column_index: colIndex,
              column_name: `Coluna ${colIndex + 1}`,
              cell_value: cellValue,
              data_type: typeof row[colIndex] === 'number' ? 'number' : 'text'
            });
          }
        }
      }

      console.log(`📝 Inserindo ${insertPayload.length} células para aba ${sheetName}`);

      if (insertPayload.length > 0) {
        // Insert in batches to avoid timeout
        const batchSize = 1000;
        for (let i = 0; i < insertPayload.length; i += batchSize) {
          const batch = insertPayload.slice(i, i + batchSize);
          const { error: insertError } = await supabase
            .from("spreadsheet_data")
            .insert(batch);

          if (insertError) {
            console.error(`❌ Erro ao inserir batch ${i}-${i + batchSize} da aba ${sheetName}:`, insertError);
          } else {
            console.log(`✅ Batch ${i}-${i + batchSize} inserido com sucesso`);
          }
        }
      }

      totalRowsProcessed += rows.length;

      // Update sheet with row/column counts
      await supabase
        .from("sheets")
        .update({
          row_count: rows.length,
          column_count: Math.max(...rows.map(row => row.length))
        })
        .eq("id", sheetId);
    }

    // Update spreadsheet status and sheet count
    await supabase
      .from("spreadsheets")
      .update({
        processing_status: 'completed',
        sheet_count: sheetsCreated.length
      })
      .eq("id", fileId);

    console.log(`🎉 Processamento concluído! ${sheetsCreated.length} abas, ${totalRowsProcessed} linhas processadas`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        sheetsProcessed: sheetsCreated.length,
        totalRows: totalRowsProcessed,
        sheets: sheetsCreated.map(s => ({ id: s.id, name: s.sheet_name }))
      }), 
      { status: 200, headers: corsHeaders }
    );
  } catch (err) {
    console.error("❌ Erro inesperado:", err);
    
    // Try to update spreadsheet status to failed
    try {
      await supabase
        .from("spreadsheets")
        .update({ processing_status: 'failed' })
        .eq("id", fileId);
    } catch (updateError) {
      console.error("❌ Erro ao atualizar status para failed:", updateError);
    }

    return new Response(
      JSON.stringify({ 
        error: "Unexpected error", 
        message: err?.message, 
        stack: err?.stack 
      }),
      { status: 500, headers: corsHeaders }
    );
  }
});
