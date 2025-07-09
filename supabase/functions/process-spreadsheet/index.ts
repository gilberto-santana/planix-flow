
import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.5";
import * as XLSX from "https://esm.sh/xlsx@0.18.5";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('📥 Process spreadsheet function called:', {
    method: req.method,
    url: req.url,
    headers: Object.fromEntries(req.headers.entries())
  });

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('✅ Returning CORS preflight response');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { SUPABASE_URL, SUPABASE_ANON_KEY } = Deno.env.toObject();
    console.log('🔧 Environment check:', { 
      hasUrl: !!SUPABASE_URL, 
      hasKey: !!SUPABASE_ANON_KEY 
    });
    
    // Get authorization header for JWT verification
    const authHeader = req.headers.get('Authorization');
    console.log('🔐 Auth header check:', { hasAuthHeader: !!authHeader });
    
    if (!authHeader) {
      console.error('❌ No authorization header found');
      return new Response(JSON.stringify({ error: "Unauthorized - No auth header" }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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

    console.log('🔍 Verifying user authentication...');
    // Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError) {
      console.error('❌ Auth error:', authError);
      return new Response(JSON.stringify({ error: "Unauthorized - Auth error", details: authError.message }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    if (!user) {
      console.error('❌ No user found');
      return new Response(JSON.stringify({ error: "Unauthorized - No user" }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('✅ User authenticated:', { userId: user.id, email: user.email });

    // Parse form data to get the file
    console.log('📄 Parsing form data...');
    const formData = await req.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      console.error('❌ No file provided in form data');
      return new Response(JSON.stringify({ error: "No file provided" }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('📄 File received:', { 
      name: file.name, 
      size: file.size, 
      type: file.type 
    });

    // Create unique file path
    const fileName = `${user.id}/${Date.now()}_${file.name}`;
    console.log('📂 Uploading to storage path:', fileName);
    
    // Upload file to Storage
    const { error: uploadError } = await supabase.storage
      .from('spreadsheets')
      .upload(fileName, file, {
        contentType: file.type,
        upsert: false
      });

    if (uploadError) {
      console.error('❌ Storage upload error:', uploadError);
      return new Response(JSON.stringify({ error: "Failed to upload file", details: uploadError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('✅ File uploaded to storage successfully');

    // Get the uploaded file to process
    console.log('📥 Downloading file for processing...');
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('spreadsheets')
      .download(fileName);

    if (downloadError || !fileData) {
      console.error('❌ Storage download error:', downloadError);
      return new Response(JSON.stringify({ error: "Failed to download file", details: downloadError?.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('📊 Processing spreadsheet...');
    const arrayBuffer = await fileData.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: "array" });

    console.log('📋 Workbook info:', { 
      sheetCount: workbook.SheetNames.length, 
      sheetNames: workbook.SheetNames 
    });

    // Insert metadata into spreadsheets table
    console.log('💾 Inserting spreadsheet metadata...');
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
        processing_status: "processing"
      })
      .select()
      .single();

    if (spreadsheetError || !spreadsheet) {
      console.error('❌ Spreadsheet insert error:', spreadsheetError);
      return new Response(JSON.stringify({ error: "Failed to insert spreadsheet metadata", details: spreadsheetError?.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('✅ Spreadsheet metadata inserted:', { id: spreadsheet.id });

    // Process each sheet
    for (let i = 0; i < workbook.SheetNames.length; i++) {
      const sheetName = workbook.SheetNames[i];
      console.log(`📄 Processing sheet ${i + 1}/${workbook.SheetNames.length}: ${sheetName}`);
      
      const sheet = workbook.Sheets[sheetName];
      const json = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

      const columnCount = json[0]?.length || 0;
      const rowCount = json.length;

      console.log(`📊 Sheet stats:`, { rows: rowCount, columns: columnCount });

      // Create sheet record
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
        console.error(`❌ Sheet insert error for ${sheetName}:`, sheetInsertError);
        continue;
      }

      console.log(`✅ Sheet record created:`, { id: sheetRow.id, name: sheetName });

      // Process data rows (skip header row)
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
        console.log(`💾 Inserting ${dataRows.length} data rows for sheet ${sheetName}...`);
        const { error: insertError } = await supabase
          .from("spreadsheet_data")
          .insert(dataRows);

        if (insertError) {
          console.error(`❌ Data insert error for ${sheetName}:`, insertError);
        } else {
          console.log(`✅ Data inserted successfully for sheet ${sheetName}`);
        }
      }
    }

    // Update processing status to completed
    console.log('🏁 Updating processing status to completed...');
    const { error: updateError } = await supabase
      .from("spreadsheets")
      .update({ processing_status: "completed" })
      .eq("id", spreadsheet.id);

    if (updateError) {
      console.error('❌ Status update error:', updateError);
    }

    console.log('🎉 Processing completed successfully!');
    return new Response(JSON.stringify({ 
      success: true, 
      spreadsheet_id: spreadsheet.id,
      message: "Spreadsheet processed successfully" 
    }), { 
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error("💥 Unexpected error:", err);
    return new Response(JSON.stringify({ 
      error: "Internal server error", 
      details: err.message,
      stack: err.stack 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
