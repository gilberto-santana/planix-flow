
import { supabase } from "@/integrations/supabase/client";

export interface ParseUploadedSheetParams {
  fileId: string;
  userId: string;
  filePath: string;
  fileName: string;
  fileSize: number;
  fileType: string;
}

export interface ParseUploadedSheetResult {
  success?: boolean;
  message?: string;
  spreadsheetId?: string;
  totalCells?: number;
  sheetsCount?: number;
}

export async function callParseUploadedSheetFunction(
  params: ParseUploadedSheetParams
): Promise<{ data: ParseUploadedSheetResult | null; error: string | null }> {
  console.log("🔄 [EDGE-UTILS] Chamando parse-uploaded-sheet...");

  const payload = {
    fileUrl: `https://lferxmdlttvitbuvekps.supabase.co/storage/v1/object/public/spreadsheets/${params.filePath}`,
    userId: params.userId,
    fileName: params.fileName,
    filePath: params.filePath,
    fileSize: params.fileSize,
    fileType: params.fileType
  };

  console.log("📤 [EDGE-UTILS] Payload:", payload);

  try {
    const { data, error } = await supabase.functions.invoke('parse-uploaded-sheet', {
      body: JSON.stringify(payload)
    });

    console.log("📥 [EDGE-UTILS] Resposta recebida:", { data, error });

    if (error) {
      console.error("❌ [EDGE-UTILS] Erro na Edge Function:", error);
      return { data: null, error: error.message };
    }

    return { data, error: null };
  } catch (err: any) {
    console.error("❌ [EDGE-UTILS] Erro inesperado:", err);
    return { data: null, error: err.message || "Erro desconhecido" };
  }
}
