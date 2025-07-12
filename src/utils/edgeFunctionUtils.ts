
export async function invokeEdgeFunction<T>(
  functionName: string,
  payload: Record<string, any>
): Promise<{ data: T | null; error: string | null }> {
  try {
    const response = await fetch(`/functions/v1/${functionName}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { data: null, error: `Erro ${response.status}: ${errorText}` };
    }

    const data = await response.json();
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message || "Erro desconhecido" };
  }
}

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
    fileSize: params.fileSize,
    fileType: params.fileType
  };

  console.log("📦 Payload para Edge Function:", payload);

  const result = await invokeEdgeFunction<ParseUploadedSheetResult>(
    "parse-uploaded-sheet",
    payload
  );

  if (result.error) {
    console.error("❌ Erro na Edge Function:", result.error);
    return { data: null, error: result.error };
  }

  console.log("✅ Edge Function executada com sucesso:", result.data);
  return result;
}
