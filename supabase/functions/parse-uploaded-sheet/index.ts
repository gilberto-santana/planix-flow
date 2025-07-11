
import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.5";
import * as XLSX from "https://esm.sh/xlsx@0.18.5";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log("🚀 Edge Function iniciada:", {
    method: req.method,
    url: req.url,
    contentType: req.headers.get('content-type')
  });

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log("✅ Retornando resposta CORS");
    return new Response(null, { headers: corsHeaders });
  }

  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = Deno.env.toObject();

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("❌ Credenciais Supabase ausentes");
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: "Missing Supabase credentials" 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  let body: any;
  try {
    const bodyText = await req.text();
    console.log("📥 Raw body recebido:", bodyText.substring(0, 200) + "...");
    
    if (!bodyText.trim()) {
      console.error("❌ Body vazio recebido");
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Empty request body" 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    body = JSON.parse(bodyText);
    console.log("📋 Body parseado com sucesso:", {
      hasFilePath: !!body.filePath,
      hasFileId: !!body.fileId,
      hasUserId: !!body.userId,
      hasFileName: !!body.fileName
    });
  } catch (error) {
    console.error("❌ Erro ao processar body:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: "Invalid JSON in request body",
        details: error?.message 
      }),
      { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }

  const { filePath, fileId, userId, fileName, fileSize, fileType } = body;

  // Validate required parameters
  const missingParams = [];
  if (!filePath) missingParams.push('filePath');
  if (!fileId) missingParams.push('fileId');
  if (!userId) missingParams.push('userId');
  if (!fileName) missingParams.push('fileName');

  if (missingParams.length > 0) {
    console.error("❌ Parâmetros ausentes:", missingParams);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: "Missing required parameters",
        missing: missingParams 
      }),
      { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }

  try {
    console.log(`📂 Tentando baixar arquivo: ${filePath}`);
    
    // Download file from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("spreadsheets")
      .download(filePath);

    if (downloadError || !fileData) {
      console.error("❌ Erro ao baixar arquivo:", downloadError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Failed to download file from storage", 
          details: downloadError?.message 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log("✅ Arquivo baixado com sucesso");

    // Create spreadsheet record
    console.log("💾 Criando registro de spreadsheet...");
    const { data: spreadsheetData, error: spreadsheetError } = await supabase
      .from("spreadsheets")
      .insert({
        id: fileId,
        user_id: userId,
        file_name: fileName,
        file_path: filePath,
        file_size: fileSize || 0,
        file_type: fileType || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        upload_status: 'uploaded',
        processing_status: 'processing'
      })
      .select()
      .single();

    if (spreadsheetError) {
      console.error("❌ Erro ao criar registro de spreadsheet:", spreadsheetError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Failed to create spreadsheet record", 
          details: spreadsheetError.message 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log("✅ Registro de spreadsheet criado:", spreadsheetData.id);

    // Parse Excel file
    console.log("📊 Processando arquivo Excel...");
    const buffer = await fileData.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    
    console.log("📋 Planilha processada:", {
      sheetCount: workbook.SheetNames.length,
      sheetNames: workbook.SheetNames
    });

    let totalCellsProcessed = 0;
    const sheetsCreated = [];

    for (let sheetIndex = 0; sheetIndex < workbook.SheetNames.length; sheetIndex++) {
      const sheetName = workbook.SheetNames[sheetIndex];
      const sheet = workbook.Sheets[sheetName];
      
      console.log(`📄 Processando aba ${sheetIndex + 1}/${workbook.SheetNames.length}: ${sheetName}`);

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
        console.error(`❌ Erro ao criar aba ${sheetName}:`, sheetError);
        continue;
      }

      sheetsCreated.push(sheetData);
      console.log(`✅ Aba criada: ${sheetName} (${sheetId})`);

      // Convert sheet to JSON with proper handling
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
          const cellValue = row[colIndex];
          if (cellValue !== null && cellValue !== undefined && String(cellValue).trim() !== "") {
            insertPayload.push({
              sheet_id: sheetId,
              row_index: rowIndex,
              column_index: colIndex,
              column_name: rowIndex === 0 ? String(cellValue) : `Coluna ${colIndex + 1}`,
              cell_value: String(cellValue),
              data_type: typeof cellValue === 'number' ? 'number' : 'text'
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
            console.error(`❌ Erro ao inserir batch ${i + 1}-${Math.min(i + batchSize, insertPayload.length)}:`, insertError);
          } else {
            console.log(`✅ Batch ${i + 1}-${Math.min(i + batchSize, insertPayload.length)} inserido`);
          }
        }
      }

      totalCellsProcessed += insertPayload.length;

      // Update sheet with counts
      await supabase
        .from("sheets")
        .update({
          row_count: rows.length,
          column_count: Math.max(...rows.map(row => row.length), 0)
        })
        .eq("id", sheetId);
    }

    // Update spreadsheet status
    await supabase
      .from("spreadsheets")
      .update({
        processing_status: 'completed',
        sheet_count: sheetsCreated.length
      })
      .eq("id", fileId);

    console.log(`🎉 Processamento concluído! ${sheetsCreated.length} abas, ${totalCellsProcessed} células processadas`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Spreadsheet processed successfully",
        sheetsProcessed: sheetsCreated.length,
        totalCells: totalCellsProcessed,
        sheets: sheetsCreated.map(s => ({ id: s.id, name: s.sheet_name }))
      }), 
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error("❌ Erro inesperado:", error);
    
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
        success: false,
        error: "Unexpected error during processing", 
        message: error?.message,
        stack: error?.stack 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
