
import { supabase } from "@/integrations/supabase/client";

export interface EdgeFunctionCallOptions {
  filePath: string;
  fileId: string;
  userId: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  maxRetries?: number;
  retryDelay?: number;
}

export interface EdgeFunctionResult {
  success: boolean;
  error?: string;
  data?: any;
}

export async function callParseUploadedSheetFunction(
  options: EdgeFunctionCallOptions
): Promise<EdgeFunctionResult> {
  const { maxRetries = 3, retryDelay = 2000, ...requestBody } = options;

  console.log("🚀 Iniciando processamento:", { 
    fileName: requestBody.fileName, 
    fileId: requestBody.fileId, 
    filePath: requestBody.filePath, 
    fileSize: requestBody.fileSize,
    userId: requestBody.userId
  });

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    console.log(`📤 Tentativa ${attempt}/${maxRetries} de processamento`);
    
    try {
      console.log("📤 Dados para envio:", requestBody);

      // Validate request body before sending
      const bodyString = JSON.stringify(requestBody);
      console.log("📤 Body serializado, tamanho:", bodyString.length);

      if (bodyString.length === 0) {
        throw new Error("Request body is empty after serialization");
      }

      // Call the edge function with 60 second timeout using Promise.race
      console.log("📤 Enviando para Edge Function...");
      
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Function call timeout after 60 seconds')), 60000);
      });

      const functionPromise = supabase.functions.invoke("parse-uploaded-sheet", {
        body: requestBody,
        headers: {
          "Content-Type": "application/json",
        }
      });

      const { data: result, error: invokeError } = await Promise.race([
        functionPromise,
        timeoutPromise.then(() => ({ data: null, error: new Error('Timeout') }))
      ]) as any;

      console.log("📊 Resposta da Edge Function (tentativa", attempt + "):", { 
        result, 
        error: invokeError,
        hasResult: !!result,
        resultSuccess: result?.success
      });

      if (invokeError) {
        console.error(`❌ Erro na tentativa ${attempt}:`, invokeError);
        
        if (attempt === maxRetries) {
          return { 
            success: false, 
            error: `Falha após ${maxRetries} tentativas: ${invokeError.message}` 
          };
        }
        
        // Wait before retry
        console.log(`⏳ Aguardando ${retryDelay}ms antes da próxima tentativa...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        continue;
      }

      if (!result) {
        console.error(`❌ Resultado vazio na tentativa ${attempt}`);
        
        if (attempt === maxRetries) {
          return { 
            success: false, 
            error: "Resposta vazia do servidor após todas as tentativas" 
          };
        }
        
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        continue;
      }

      if (!result.success) {
        console.error(`❌ Processamento falhou na tentativa ${attempt}:`, result);
        
        if (attempt === maxRetries) {
          const errorMessage = result?.error || result?.message || "Erro desconhecido durante o processamento";
          return { success: false, error: errorMessage };
        }
        
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        continue;
      }

      // Success! Break out of retry loop
      console.log("✅ Processamento bem-sucedido na tentativa", attempt);
      return { success: true, data: result };

    } catch (error) {
      console.error(`❌ Erro na tentativa ${attempt}:`, error);
      
      if (attempt === maxRetries) {
        const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
        return { 
          success: false, 
          error: `Erro após ${maxRetries} tentativas: ${errorMessage}` 
        };
      }
      
      await new Promise(resolve => setTimeout(resolve, retryDelay));
      continue;
    }
  }

  return { success: false, error: "Erro inesperado no processamento" };
}
