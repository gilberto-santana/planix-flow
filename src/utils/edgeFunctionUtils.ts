// src/utils/edgeFunctionUtils.ts

import { supabase } from "@/integrations/supabase/client";

interface ParseUploadedSheetParams {
  fileId: string;
  userId: string;
  filePath: string;
  fileName: string;
  fileSize: number;
  fileType: string;
}

export async function callParseUploadedSheetFunction({
  fileId,
  userId,
  filePath,
  fileName,
  fileSize,
  fileType,
}: ParseUploadedSheetParams) {
  try {
    const requestBody = {
      fileId,
      userId,
      filePath,
      fileName,
      fileSize,
      fileType,
    };

    const { data, error } = await supabase.functions.invoke("parse-uploaded-sheet", {
      body: JSON.stringify(requestBody),
      headers: {
        "Content-Type": "application/json",
      },
    });

    return { data, error };
  } catch (error) {
    console.error("Erro ao chamar função parse-uploaded-sheet:", error);
    return { data: null, error };
  }
}
