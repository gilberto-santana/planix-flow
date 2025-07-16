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
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { 'Access-Control-Allow-Origin': '*' },
      });
    }

    const response = await fetch(fileUrl);
    const arrayBuffer = await response.arrayBuffer();

    const workbook = xlsx.read(arrayBuffer, {
      type: 'array',
      raw: false,
      blankrows: false,
    });

    if (!workbook || workbook.SheetNames.length === 0) {
      return new Response(JSON.stringify({ error: 'Planilha vazia ou inválida' }), {
        status: 400,
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
      return new Response(JSON.stringify({ error: 'Erro ao criar planilha' }), {
        status: 500,
        headers: { 'Access-Control-Allow-Origin': '*' },
      });
    }

    const spreadsheetId = spreadsheet.id;

    for (const [sheetIndex, sheetName] of workbook.SheetNames.entries()) {
      const sheetData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], {
        header: 1,
        raw: false,
        blankrows: false,
      });

      if (!sheetData || sheetData.length < 2) continue;

      const { data: sheet, error: sheetError } = await supabase
        .from('sheets')
        .insert({
          spreadsheet_id: spreadsheetId,
          sheet_name: sheetName,
          sheet_index: sheetIndex,
          user_id: userId,
        })
        .select()
        .single();

      if (sheetError || !sheet) continue;

      const sheetId = sheet.id;
      const headerRow = sheetData[0];
      const rowsToInsert = [];

      for (let rowIndex = 1; rowIndex < sheetData.length; rowIndex++) {
        const row = sheetData[rowIndex];
        if (!Array.isArray(row)) continue;

        for (let columnIndex = 0; columnIndex < row.length; columnIndex++) {
          const cellValue = row[columnIndex];
          const columnName = headerRow[columnIndex] || `Coluna ${columnIndex + 1}`;

          rowsToInsert.push({
            sheet_id: sheetId,
            row_index: rowIndex,
            column_index: columnIndex,
            column_name: columnName,
            cell_value: cellValue,
            data_type: typeof cellValue,
          });
        }
      }

      if (rowsToInsert.length > 0) {
        await supabase.from('spreadsheet_data').insert(rowsToInsert);
      }
    }

    return new Response(
      JSON.stringify({ success: true, spreadsheetId }),
      {
        status: 200,
        headers: { 'Access-Control-Allow-Origin': '*' },
      }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Erro interno' }), {
      status: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
    });
  }
});
