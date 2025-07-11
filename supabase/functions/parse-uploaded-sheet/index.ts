
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
    contentType: req.headers.get('content-type'),
    contentLength: req.headers.get('content-length')
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

  // Detailed logging for request inspection
  let body: any;
  let rawBody: string = "";
  
  try {
    console.log("📥 Tentando ler o body da requisição...");
    
    // Try to get raw body first
    rawBody = await req.text();
    console.log("📋 Raw body length:", rawBody.length);
    console.log("📋 Raw body preview (first 500 chars):", rawBody.substring(0, 500));
    
    if (!rawBody || rawBody.trim() === "") {
      console.error("❌ Body completamente vazio");
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Request body is empty",
          debug: {
            bodyLength: rawBody.length,
            headers: Object.fromEntries(req.headers.entries())
          }
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Try to parse JSON
    try {
      body = JSON.parse(rawBody);
      console.log("✅ JSON parseado com sucesso:", {
        hasFilePath: !!body.filePath,
        hasFileId: !!body.fileId,
        hasUserId: !!body.userId,
        hasFileName: !!body.fileName,
        keys: Object.keys(body || {})
      });
    } catch (jsonError) {
      console.error("❌ Erro ao parsear JSON:", jsonError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Invalid JSON format",
          debug: {
            jsonError: jsonError.message,
            rawBodyPreview: rawBody.substring(0, 200)
          }
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

  } catch (error) {
    console.error("❌ Erro crítico ao ler requisição:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: "Failed to read request body",
        debug: {
          errorMessage: error?.message,
          errorStack: error?.stack
        }
      }),
      { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }

  // Extract and validate parameters
  const { filePath, fileId, userId, fileName, fileSize, fileType } = body || {};

  console.log("🔍 Parâmetros extraídos:", {
    filePath: filePath ? "presente" : "ausente",
    fileId: fileId ? "presente" : "ausente", 
    userId: userId ? "presente" : "ausente",
    fileName: fileName ? "presente" : "ausente",
    fileSize,
    fileType
  });

  // Validate required parameters with detailed feedback
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
        missing: missingParams,
        received: {
          filePath: !!filePath,
          fileId: !!fileId,
          userId: !!userId,
          fileName: !!fileName
        }
      }),
      { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    console.log(`📂 Iniciando processamento para arquivo: ${fileName}`);
    console.log(`📂 Caminho do arquivo: ${filePath}`);
    
    // Test connection to storage first
    console.log("🔗 Testando conexão com storage...");
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    
    if (bucketsError) {
      console.error("❌ Erro ao acessar storage:", bucketsError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Storage connection failed", 
          details: bucketsError.message 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    
    console.log("✅ Conexão com storage OK, buckets:", buckets?.map(b => b.name));

    // Download file from storage with detailed logging
    console.log(`📥 Tentando baixar: ${filePath} do bucket 'spreadsheets'`);
    
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("spreadsheets")
      .download(filePath);

    if (downloadError) {
      console.error("❌ Erro detalhado no download:", {
        error: downloadError,
        filePath,
        bucket: "spreadsheets"
      });
      
      // Try to list files to debug
      const pathParts = filePath.split('/');
      const folder = pathParts.length > 1 ? pathParts[0] : '';
      
      if (folder) {
        const { data: filesList, error: listError } = await supabase.storage
          .from("spreadsheets")
          .list(folder);
          
        console.log("📁 Arquivos na pasta:", { folder, files: filesList, listError });
      }
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Failed to download file from storage", 
          details: downloadError.message,
          debug: {
            filePath,
            bucket: "spreadsheets"
          }
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (!fileData) {
      console.error("❌ Arquivo baixado mas dados são null");
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "File downloaded but data is null"
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log("✅ Arquivo baixado com sucesso, tamanho:", fileData.size);

    // Create spreadsheet record with better error handling
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

    // Parse Excel file with error handling
    console.log("📊 Processando arquivo Excel...");
    let workbook;
    
    try {
      const buffer = await fileData.arrayBuffer();
      console.log("📊 Buffer criado, tamanho:", buffer.byteLength);
      
      workbook = XLSX.read(buffer, { type: "array" });
      console.log("📊 Workbook processado:", {
        sheetCount: workbook.SheetNames.length,
        sheetNames: workbook.SheetNames.slice(0, 5) // Only log first 5 sheet names
      });
    } catch (xlsxError) {
      console.error("❌ Erro ao processar Excel:", xlsxError);
      
      // Update spreadsheet status to failed
      await supabase
        .from("spreadsheets")
        .update({ processing_status: 'failed' })
        .eq("id", fileId);
        
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Failed to parse Excel file", 
          details: xlsxError.message 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    let totalCellsProcessed = 0;
    const sheetsCreated = [];
    const maxSheets = 10; // Limit sheets to prevent timeout

    const sheetsToProcess = workbook.SheetNames.slice(0, maxSheets);
    console.log(`📋 Processando ${sheetsToProcess.length} de ${workbook.SheetNames.length} abas`);

    for (let sheetIndex = 0; sheetIndex < sheetsToProcess.length; sheetIndex++) {
      const sheetName = sheetsToProcess[sheetIndex];
      const sheet = workbook.Sheets[sheetName];
      
      console.log(`📄 Processando aba ${sheetIndex + 1}/${sheetsToProcess.length}: ${sheetName}`);

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

      // Convert sheet to JSON with limits to prevent timeout
      const rows: any[][] = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        defval: "",
        raw: false,
      });

      // Limit rows and columns to prevent timeout
      const maxRows = 1000;
      const maxCols = 50;
      const limitedRows = rows.slice(0, maxRows).map(row => row.slice(0, maxCols));

      console.log(`📊 Aba ${sheetName}: ${limitedRows.length} linhas (limitado de ${rows.length})`);

      const insertPayload = [];

      for (let rowIndex = 0; rowIndex < limitedRows.length; rowIndex++) {
        const row = limitedRows[rowIndex];
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
        // Insert in smaller batches to avoid timeout
        const batchSize = 500;
        for (let i = 0; i < insertPayload.length; i += batchSize) {
          const batch = insertPayload.slice(i, i + batchSize);
          
          try {
            const { error: insertError } = await supabase
              .from("spreadsheet_data")
              .insert(batch);

            if (insertError) {
              console.error(`❌ Erro ao inserir batch ${i + 1}-${Math.min(i + batchSize, insertPayload.length)}:`, insertError);
            } else {
              console.log(`✅ Batch ${i + 1}-${Math.min(i + batchSize, insertPayload.length)} inserido`);
            }
          } catch (batchError) {
            console.error(`❌ Erro crítico no batch:`, batchError);
          }
        }
      }

      totalCellsProcessed += insertPayload.length;

      // Update sheet with counts
      try {
        await supabase
          .from("sheets")
          .update({
            row_count: limitedRows.length,
            column_count: Math.max(...limitedRows.map(row => row.length), 0)
          })
          .eq("id", sheetId);
      } catch (updateError) {
        console.error("❌ Erro ao atualizar contadores da aba:", updateError);
      }
    }

    // Update spreadsheet status
    try {
      await supabase
        .from("spreadsheets")
        .update({
          processing_status: 'completed',
          sheet_count: sheetsCreated.length
        })
        .eq("id", fileId);
    } catch (statusError) {
      console.error("❌ Erro ao atualizar status final:", statusError);
    }

    console.log(`🎉 Processamento concluído! ${sheetsCreated.length} abas, ${totalCellsProcessed} células processadas`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Spreadsheet processed successfully",
        sheetsProcessed: sheetsCreated.length,
        totalCells: totalCellsProcessed,
        sheets: sheetsCreated.map(s => ({ id: s.id, name: s.sheet_name })),
        debug: {
          totalSheetsInFile: workbook.SheetNames.length,
          limitApplied: workbook.SheetNames.length > maxSheets
        }
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
        debug: {
          stack: error?.stack?.substring(0, 1000) // Limit stack trace
        }
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
