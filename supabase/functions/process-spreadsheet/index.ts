import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// File validation constants
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_TYPES = [
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv'
];
const ALLOWED_EXTENSIONS = ['.xls', '.xlsx', '.csv'];

interface FileUploadRequest {
  fileName: string;
  fileSize: number;
  fileType: string;
}

function sanitizeFileName(fileName: string): string {
  // Remove path traversal attempts and dangerous characters
  return fileName
    .replace(/[\/\\:*?"<>|]/g, '_')
    .replace(/\.+/g, '.')
    .replace(/^\./, '')
    .trim();
}

function validateFile(fileName: string, fileSize: number, fileType: string): { valid: boolean; error?: string } {
  // Size validation
  if (fileSize > MAX_FILE_SIZE) {
    return { valid: false, error: 'File size exceeds 10MB limit' };
  }

  // MIME type validation
  if (!ALLOWED_MIME_TYPES.includes(fileType)) {
    return { valid: false, error: 'Invalid file type. Only .xls, .xlsx, and .csv files are allowed' };
  }

  // Extension validation
  const hasValidExtension = ALLOWED_EXTENSIONS.some(ext => 
    fileName.toLowerCase().endsWith(ext)
  );
  
  if (!hasValidExtension) {
    return { valid: false, error: 'Invalid file extension. Only .xls, .xlsx, and .csv files are allowed' };
  }

  // Additional security checks
  if (fileName.includes('..') || fileName.includes('/') || fileName.includes('\\')) {
    return { valid: false, error: 'Invalid file name' };
  }

  return { valid: true };
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get user from auth header
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new Error('Invalid authentication');
    }

    const { fileName, fileSize, fileType }: FileUploadRequest = await req.json();

    console.log(`Processing file upload request for user ${user.id}: ${fileName}`);

    // Validate file
    const validation = validateFile(fileName, fileSize, fileType);
    if (!validation.valid) {
      console.error(`File validation failed: ${validation.error}`);
      return new Response(
        JSON.stringify({ error: validation.error }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }

    // Sanitize file name
    const sanitizedFileName = sanitizeFileName(fileName);
    const filePath = `${user.id}/${Date.now()}_${sanitizedFileName}`;

    // Insert spreadsheet record
    const { data: spreadsheet, error: insertError } = await supabase
      .from('spreadsheets')
      .insert({
        user_id: user.id,
        file_name: sanitizedFileName,
        file_path: filePath,
        file_size: fileSize,
        file_type: fileType,
        upload_status: 'uploaded',
        processing_status: 'pending'
      })
      .select()
      .single();

    if (insertError) {
      console.error('Failed to insert spreadsheet record:', insertError);
      throw insertError;
    }

    console.log(`Spreadsheet record created successfully: ${spreadsheet.id}`);

    return new Response(
      JSON.stringify({
        spreadsheetId: spreadsheet.id,
        filePath: filePath,
        message: 'File processed successfully'
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );

  } catch (error: any) {
    console.error('Error in process-spreadsheet function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
};

serve(handler);