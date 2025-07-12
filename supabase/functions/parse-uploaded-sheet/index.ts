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
    if (!body || !body.fileUrl || !body.userId || !body.fileName) {
      console.error('❌ Body incompleto ou inválido');
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { 'Access-Control-Allow-Origin': '*' },
      });
    }

    const { fileUrl, userId, fileName } = body;

    const response = await fetch(fileUrl);
    const arrayBuffer = await response.arrayBuffer();
    const workbook = xlsx.read(arrayBuffer, { type: 'array' });

    // Criar registro na tabela spreadsheets
    const { data: spreadsheet, error: insertSpreadsheetError } = await supabase
      .from('spreadsheets')
      .insert({ user_id: userId, file_name: fileName })
      .select()
      .single();

    if (insertSpreadsheetError || !spreadsheet) {
      console.error('Erro ao criar registro em spreadsheets:', insertSpreadsheetError);
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

      // Criar registro na tabela sheets
      const { data: sheet, error: insertSheetError } = await supabase
        .from('sheets')
        .insert({ spreadsheet_id: spreadsheetId, name: sheetName })
        .select()
        .single();

      if (insertSheetError || !sheet) {
        console.error(`Erro ao criar sheet '${sheetName}':`, insertSheetError);
        continue;
      }

      const sheetId = sheet.id;
      const rowsToInsert = [];

      for (let rowIndex = 0; rowIndex < sheetData.length; rowIndex++) {
        const row = sheetData[rowIndex];

        for (let columnIndex = 0; columnIndex < row.length; columnIndex++) {
          const cellValue = row[columnIndex];
          const columnName = sheetData[0]?.[columnIndex] || `Coluna ${columnIndex + 1}`;
          if (rowIndex === 0) continue; // pular cabeçalho

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
        const { error: insertDataError } = await supabase
          .from('spreadsheet_data')
          .insert(rowsToInsert);

        if (insertDataError) {
          console.error(`Erro ao inserir dados na planilha '${sheetName}':`, insertDataError);
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
