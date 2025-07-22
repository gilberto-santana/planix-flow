import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('🔄 Parse uploaded sheet function called');

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { fileUrl, userId, fileName, fileSize, fileType } = await req.json();

    console.log('📦 Processing file:', { fileUrl, userId, fileName, fileSize, fileType });

    if (!fileUrl || !userId || !fileName) {
      console.error('❌ Missing required parameters');
      return new Response(
        JSON.stringify({ success: false, message: 'Missing required parameters' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Bloquear arquivos Excel por enquanto
    if (fileType.includes('excel') || fileName.endsWith('.xlsx')) {
      console.error('❌ Excel parsing not implemented');
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Arquivos .xlsx ainda não são suportados. Converta para CSV.',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Download the file from storage
    console.log('📥 Downloading file from:', fileUrl);
    const fileResponse = await fetch(fileUrl);
    
    if (!fileResponse.ok) {
      console.error('❌ Failed to download file:', fileResponse.statusText);
      return new Response(
        JSON.stringify({ success: false, message: 'Failed to download file' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const fileBuffer = await fileResponse.arrayBuffer();
    console.log('✅ File downloaded, size:', fileBuffer.byteLength);

    // Parse CSV
    const textData = new TextDecoder().decode(fileBuffer);
    const lines = textData.split('\n').filter(line => line.trim());
    const headers = lines[0]?.split(',').map(h => h.trim()) || [];
    
    const parsedData = lines.slice(1).map((line, rowIndex) => {
      const values = line.split(',').map(v => v.trim());
      return headers.map((header, colIndex) => ({
        row_index: rowIndex + 1,
        column_index: colIndex,
        column_name: header,
        cell_value: values[colIndex] || '',
        data_type: 'string'
      }));
    }).flat();

    console.log('📊 Parsed data points:', parsedData.length);

    if (parsedData.length === 0) {
      console.error('❌ CSV vazio ou mal formatado');
      return new Response(
        JSON.stringify({ success: false, message: 'Nenhum dado encontrado na planilha' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Create spreadsheet record
    const { data: spreadsheet, error: spreadsheetError } = await supabase
      .from('spreadsheets')
      .insert({
        user_id: userId,
        file_name: fileName,
        file_path: fileUrl.split('/').pop(),
        file_size: fileSize,
        file_type: fileType,
        processing_status: 'processing',
        sheet_count: 1
      })
      .select()
      .single();

    if (spreadsheetError) {
      console.error('❌ Error creating spreadsheet:', spreadsheetError);
      return new Response(
        JSON.stringify({ success: false, message: 'Failed to create spreadsheet record' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    console.log('✅ Spreadsheet created:', spreadsheet.id);

    // Create sheet record
    const { data: sheet, error: sheetError } = await supabase
      .from('sheets')
      .insert({
        spreadsheet_id: spreadsheet.id,
        user_id: userId,
        sheet_name: 'Sheet1',
        sheet_index: 0,
        row_count: Math.max(...parsedData.map(d => d.row_index)),
        column_count: Math.max(...parsedData.map(d => d.column_index)) + 1
      })
      .select()
      .single();

    if (sheetError) {
      console.error('❌ Error creating sheet:', sheetError);
      return new Response(
        JSON.stringify({ success: false, message: 'Failed to create sheet record' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    console.log('✅ Sheet created:', sheet.id);

    // Insert spreadsheet data
    const dataToInsert = parsedData.map(item => ({
      ...item,
      sheet_id: sheet.id,
      user_id: userId
    }));

    const { error: dataError } = await supabase
      .from('spreadsheet_data')
      .insert(dataToInsert);

    if (dataError) {
      console.error('❌ Error inserting data:', dataError);
      return new Response(
        JSON.stringify({ success: false, message: 'Failed to insert spreadsheet data' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    console.log('✅ Data inserted successfully');

    // Update spreadsheet status
    await supabase
      .from('spreadsheets')
      .update({ processing_status: 'completed' })
      .eq('id', spreadsheet.id);

    console.log('✅ Processing completed successfully');

    return new Response(
      JSON.stringify({ success: true, message: 'Spreadsheet processed successfully' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error in parse-uploaded-sheet function:', error);
    return new Response(
      JSON.stringify({ success: false, message: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
