
import { supabase } from "@/integrations/supabase/client";

export interface FileUploadResult {
  success: boolean;
  error?: string;
}

export async function uploadFileToStorage(
  file: File,
  filePath: string,
  userId: string
): Promise<FileUploadResult> {
  console.log("📤 Fazendo upload para storage...", { filePath, fileName: file.name, fileSize: file.size });
  
  // First, try to remove existing file if it exists to avoid conflicts
  try {
    await supabase.storage.from('spreadsheets').remove([filePath]);
    console.log("🗑️ Arquivo existente removido");
  } catch (removeError) {
    console.log("ℹ️ Nenhum arquivo existente encontrado para remover");
  }
  
  const { error: uploadError } = await supabase.storage
    .from('spreadsheets')
    .upload(filePath, file, {
      contentType: file.type,
      upsert: true
    });

  if (uploadError) {
    console.error("❌ Erro no upload:", uploadError);
    return { success: false, error: `Erro no upload: ${uploadError.message}` };
  }

  console.log("✅ Upload concluído com sucesso");
  return { success: true };
}

export async function verifyFileInStorage(
  filePath: string,
  userId: string,
  maxAttempts: number = 3
): Promise<FileUploadResult> {
  console.log("🔍 Verificando arquivo no storage...", { filePath });
  
  // Simplified verification - just try to download the file
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    console.log(`🔍 Tentativa de verificação ${attempt}/${maxAttempts}`);

    try {
      const { data, error } = await supabase.storage
        .from('spreadsheets')
        .download(filePath);

      if (error) {
        console.error("❌ Erro ao verificar arquivo:", error);
        if (attempt === maxAttempts) {
          return { success: false, error: `Erro na verificação: ${error.message}` };
        }
      } else if (data && data.size > 0) {
        console.log("✅ Arquivo verificado no storage, tamanho:", data.size);
        return { success: true };
      }
    } catch (error) {
      console.error("❌ Erro na verificação:", error);
      if (attempt === maxAttempts) {
        return { success: false, error: "Falha na verificação do arquivo" };
      }
    }

    if (attempt < maxAttempts) {
      console.log("⏳ Aguardando antes da próxima tentativa...");
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  return { success: false, error: "Arquivo não foi encontrado após verificações" };
}

export async function testFileAccess(filePath: string): Promise<FileUploadResult> {
  console.log("🧪 Testando acesso ao arquivo...");
  
  const { data: testDownload, error: testError } = await supabase.storage
    .from('spreadsheets')
    .download(filePath);

  if (testError || !testDownload) {
    console.error("❌ Erro no teste de acesso:", testError);
    return { success: false, error: `Arquivo não acessível: ${testError?.message || 'Dados vazios'}` };
  }

  console.log("✅ Arquivo acessível, tamanho:", testDownload.size);
  return { success: true };
}
