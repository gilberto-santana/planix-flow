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
  success: boolean;
  message?: string;
}

export async function callParseUploadedSheetFunction(
  params: ParseUploadedSheetParams
): Promise<{ data: ParseUploadedSheetResult | null; error: string | null }> {
  console.log("🔄 Chamando Edge Function parse-uploaded-sheet...", params);

  const payload = {
    fileUrl: `https://lferxmdlttvitbuvekps.supabase.co/storage/v1/object/public/spreadsheets/${params.filePath}`,
    userId: params.userId,
    fileName: params.fileName,
    filePath: params.filePath,
    fileSize: params.fileSize,
    fileType: params.fileType
  };

  console.log("📦 Payload para Edge Function:", payload);

  try {
    console.log("🔍 [EDGE-UTILS] Iniciando chamada para parse-uploaded-sheet...");
    const { data, error } = await supabase.functions.invoke('parse-uploaded-sheet', {
      body: JSON.stringify(payload)
    });

    console.log("🔍 [EDGE-UTILS] Resposta bruta da edge function:");
    console.log("🔍 [EDGE-UTILS] data:", data);
    console.log("🔍 [EDGE-UTILS] error:", error);
    console.log("🔍 [EDGE-UTILS] typeof data:", typeof data);
    console.log("🔍 [EDGE-UTILS] JSON.stringify(data):", JSON.stringify(data));

    if (error) {
      console.error("❌ Erro na Edge Function:", error);
      return { data: null, error: error.message };
    }

    console.log("✅ Edge Function executada com sucesso:", data);
    return { data, error: null };
  } catch (err: any) {
    console.error("❌ Erro inesperado:", err);
    return { data: null, error: err.message || "Erro desconhecido" };
  }
}
