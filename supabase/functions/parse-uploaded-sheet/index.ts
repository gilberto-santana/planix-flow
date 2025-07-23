
import { serve } from 'https://deno.land/std@0.192.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.5';
import * as xlsx from 'https://esm.sh/xlsx@0.18.5';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = Deno.env.toObject();
  const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

  let spreadsheetId: string | null = null;

  try {
    console.log('🚀 [PARSE] Iniciando processamento da planilha...');
    
    const body = await req.json();
    const { fileUrl, userId, fileName, filePath, fileSize, fileType } = body;

    if (!fileUrl || !userId || !fileName || !filePath || !fileSize || !fileType) {
      console.error('❌ [PARSE] Campos obrigatórios ausentes');
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'Campos obrigatórios ausentes' 
      }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    console.log('📥 [PARSE] Baixando arquivo:', fileUrl);
    const response = await fetch(fileUrl);
    if (!response.ok) {
      throw new Error(`Erro ao baixar arquivo: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    console.log('📊 [PARSE] Lendo planilha...');
    const workbook = xlsx.read(arrayBuffer, { type: 'array' });

    console.log('💾 [PARSE] Criando registro da planilha...');
    const { data: spreadsheet, error: spreadsheetError } = await supabase
      .from('spreadsheets')
      .insert({
        user_id: userId,
        file_name: fileName,
        file_path: filePath,
        file_size: fileSize,
        file_type: fileType,
        processing_status: 'processing',
        sheet_count: workbook.SheetNames.length
      })
      .select()
      .single();

    if (spreadsheetError || !spreadsheet) {
      console.error('❌ [PARSE] Erro ao criar planilha:', spreadsheetError);
      throw new Error('Erro ao criar registro da planilha');
    }

    spreadsheetId = spreadsheet.id;
    console.log('✅ [PARSE] Planilha criada:', spreadsheetId);

    let totalRowsProcessed = 0;

    for (let sheetIndex = 0; sheetIndex < workbook.SheetNames.length; sheetIndex++) {
      const sheetName = workbook.SheetNames[sheetIndex];
      console.log(`📋 [PARSE] Processando aba ${sheetIndex + 1}/${workbook.SheetNames.length}: ${sheetName}`);

      const sheetData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], {
        header: 1,
        raw: false,
        blankrows: false,
      });

      if (!Array.isArray(sheetData) || sheetData.length === 0) {
        console.log(`⚠️ [PARSE] Aba '${sheetName}' está vazia, pulando...`);
        continue;
      }

      // Criar registro da aba com sheet_index
      const { data: sheet, error: sheetError } = await supabase
        .from('sheets')
        .insert({
          spreadsheet_id: spreadsheetId,
          sheet_name: sheetName,
          sheet_index: sheetIndex,
          user_id: userId,
          row_count: sheetData.length,
          column_count: Array.isArray(sheetData[0]) ? sheetData[0].length : 0
        })
        .select()
        .single();

      if (sheetError || !sheet) {
        console.error(`❌ [PARSE] Erro ao criar aba '${sheetName}':`, sheetError);
        continue;
      }

      const sheetId = sheet.id;
      console.log(`✅ [PARSE] Aba criada: ${sheetId}`);

      const rowsToInsert = [];
      const headers = Array.isArray(sheetData[0]) ? sheetData[0] : [];

      for (let rowIndex = 0; rowIndex < sheetData.length; rowIndex++) {
        const row = sheetData[rowIndex];
        if (!Array.isArray(row)) continue;

        for (let columnIndex = 0; columnIndex < row.length; columnIndex++) {
          const cellValue = row[columnIndex];
          if (cellValue === null || cellValue === undefined || cellValue === '') continue;

          const columnName = rowIndex === 0 
            ? String(cellValue) 
            : (headers[columnIndex] || `Coluna ${columnIndex + 1}`);

          rowsToInsert.push({
            sheet_id: sheetId,
            row_index: rowIndex,
            column_index: columnIndex,
            column_name: columnName,
            cell_value: String(cellValue),
            data_type: typeof cellValue,
            user_id: userId,
          });
        }
      }

      if (rowsToInsert.length > 0) {
        console.log(`💾 [PARSE] Inserindo ${rowsToInsert.length} células da aba '${sheetName}'...`);
        
        // Inserir em lotes de 1000 para evitar timeouts
        const batchSize = 1000;
        for (let i = 0; i < rowsToInsert.length; i += batchSize) {
          const batch = rowsToInsert.slice(i, i + batchSize);
          const { error: insertDataError } = await supabase
            .from('spreadsheet_data')
            .insert(batch);

          if (insertDataError) {
            console.error(`❌ [PARSE] Erro ao inserir lote ${i / batchSize + 1}:`, insertDataError);
            throw new Error(`Erro ao inserir dados da aba '${sheetName}'`);
          }
        }
        
        totalRowsProcessed += rowsToInsert.length;
        console.log(`✅ [PARSE] ${rowsToInsert.length} células inseridas da aba '${sheetName}'`);
      }
    }

    // Marcar como completado
    console.log('🎯 [PARSE] Finalizando processamento...');
    const { error: updateError } = await supabase
      .from('spreadsheets')
      .update({ 
        processing_status: 'completed',
        updated_at: new Date().toISOString()
      })
      .eq('id', spreadsheetId);

    if (updateError) {
      console.error('❌ [PARSE] Erro ao atualizar status:', updateError);
    }

    console.log(`🎉 [PARSE] Processamento concluído! Total de células: ${totalRowsProcessed}`);

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Planilha processada com sucesso',
      spreadsheetId,
      totalCells: totalRowsProcessed,
      sheetsCount: workbook.SheetNames.length
    }), {
      status: 200,
      headers: corsHeaders,
    });

  } catch (err) {
    console.error('❌ [PARSE] Erro inesperado:', err);

    // Rollback: remover planilha se foi criada
    if (spreadsheetId) {
      try {
        console.log('🔄 [PARSE] Fazendo rollback...');
        await supabase.from('spreadsheets').delete().eq('id', spreadsheetId);
      } catch (rollbackError) {
        console.error('❌ [PARSE] Erro no rollback:', rollbackError);
      }
    }

    return new Response(JSON.stringify({ 
      success: false,
      message: err instanceof Error ? err.message : 'Erro interno do servidor'
    }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
