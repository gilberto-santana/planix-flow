// File: supabase/functions/parse-uploaded-sheet/index.ts

import { serve } from 'https://deno.land/std@0.192.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.5';
import * as xlsx from 'https://esm.sh/xlsx@0.18.5';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': '*',
      },
    });
  }

  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = Deno.env.toObject();
  const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

  try {
    const body = await req.json();
    const { fileUrl, userId, fileName, filePath, fileSize, fileType } = body;

    if (!fileUrl || !userId || !fileName || !filePath || !fileSize || !fileType) {
      console.error('❌ Body incompleto ou inválido');
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { 'Access-Control-Allow-Origin': '*' },
      });
    }

    const response = await fetch(fileUrl);
    const arrayBuffer = await response.arrayBuffer();

    let workbook = xlsx.read(arrayBuffer, { type: 'array' });

    // Fallback caso não detecte nenhuma aba
    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      const uint8Array = new Uint8Array(arrayBuffer);
      workbook = xlsx.read(uint8Array, { type: 'array' });
    }

    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      console.error('❌ Nenhuma aba detectada no arquivo:', fileName);
      return new Response(JSON.stringify({ error: 'Nenhuma aba foi encontrada nesta planilha.' }), {
        status: 422,
        headers: { 'Access-Control-Allow-Origin': '*' },
      });
    }

    const { data: spreadsheet, error: spreadsheetError } = await supabase
      .from('spreadsheets')
      .insert({
        user_id: userId,
        file_name: fileName,
        file_path: filePath,
        file_size: fileSize,
        file_type: fileType,
      })
      .select()
      .single();

    if (spreadsheetError || !spreadsheet) {
      console.error('Erro ao criar registro em spreadsheets:', spreadsheetError);
      return new Response(JSON.stringify({ error: 'Erro ao criar planilha' }), {
        status: 500,
        headers: { 'Access-Control-Allow-Origin': '*' },
      });
    }

    const spreadsheetId = spreadsheet.id;

    for (const sheetName of workbook.SheetNames) {
      const sheetData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], {
        header: 1,
        raw: false,
        blankrows: false,
      });

      const { data: sheet, error: sheetError } = await supabase
        .from('sheets')
        .insert({
          spreadsheet_id: spreadsheetId,
          sheet_name: sheetName,
          user_id: userId,
        })
        .select()
        .single();

      if (sheetError || !sheet) {
        console.error(`Erro ao criar sheet '${sheetName}':`, sheetError);
        continue;
      }

      const sheetId = sheet.id;
      const rowsToInsert = [];

      for (let rowIndex = 0; rowIndex < sheetData.length; rowIndex++) {
        const row = sheetData[rowIndex];
        if (!Array.isArray(row)) continue;

        for (let columnIndex = 0; columnIndex < row.length; columnIndex++) {
          const cellValue = row[columnIndex];
          const columnName = sheetData[0]?.[columnIndex] || `Coluna ${columnIndex + 1}`;
          if (rowIndex === 0) continue;

          rowsToInsert.push({
            sheet_id: sheetId,
            row_index: rowIndex,
            column_index: columnIndex,
            column_name: columnName,
            cell_value: cellValue,
            data_type: typeof cellValue,
            user_id: userId,
          });
        }
      }

      if (rowsToInsert.length > 0) {
        const { error: insertDataError } = await supabase
          .from('spreadsheet_data')
          .insert(rowsToInsert);

        if (insertDataError) {
          console.error(`Erro ao inserir dados na aba '${sheetName}':`, insertDataError);
        }
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
    });
  } catch (err) {
    console.error('❌ Erro inesperado:', err);
    return new Response(JSON.stringify({ error: 'Erro interno' }), {
      status: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
    });
  }
});
