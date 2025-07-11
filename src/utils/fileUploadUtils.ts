
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
  console.log("📤 Fazendo upload para storage...");
  
  const { error: uploadError } = await supabase.storage
    .from('spreadsheets')
    .upload(filePath, file, {
      contentType: file.type,
      upsert: false
    });

  if (uploadError) {
    console.error("❌ Erro no upload:", uploadError);
    return { success: false, error: `Erro no upload: ${uploadError.message}` };
  }

  console.log("✅ Upload concluído");
  return { success: true };
}

export async function verifyFileInStorage(
  filePath: string,
  userId: string,
  maxAttempts: number = 5
): Promise<FileUploadResult> {
  console.log("🔍 Verificando arquivo no storage...");
  
  const fileId = filePath.split('/')[1].split('.')[0];
  const ext = filePath.split('.').pop();
  
  let verificationAttempts = 0;
  let fileExists = false;

  while (verificationAttempts < maxAttempts && !fileExists) {
    verificationAttempts++;
    console.log(`🔍 Tentativa de verificação ${verificationAttempts}/${maxAttempts}`);

    const { data: fileList, error: checkError } = await supabase.storage
      .from('spreadsheets')
      .list(userId, {
        search: `${fileId}.${ext}`
      });

    if (checkError) {
      console.error("❌ Erro ao verificar arquivo:", checkError);
      
      if (verificationAttempts >= maxAttempts) {
        return { success: false, error: `Erro na verificação: ${checkError.message}` };
      }
    } else if (fileList && fileList.length > 0) {
      fileExists = true;
      console.log("✅ Arquivo verificado no storage");
    } else {
      console.log(`⏳ Arquivo não encontrado ainda, tentativa ${verificationAttempts}`);
      if (verificationAttempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  if (!fileExists) {
    console.error("❌ Arquivo não foi encontrado após múltiplas verificações");
    return { success: false, error: "Arquivo não foi salvo corretamente" };
  }

  return { success: true };
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
