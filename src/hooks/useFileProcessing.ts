
import { useState } from "react";
import { useAuth } from "./useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "./use-toast";
import { generateChartSet, ChartData, SpreadsheetRow } from "@/utils/chartGeneration";

interface DatabaseRow {
  row_index: number;
  column_name: string | null;
  cell_value: string | null;
  sheet_id: string;
  id: string;
  column_index: number;
  created_at: string;
  data_type: string | null;
}

export function useFileProcessing() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [charts, setCharts] = useState<ChartData[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);

  const handleFileUpload = async (file: File, fileId: string, filePath: string) => {
    if (!user) {
      console.error("❌ Usuário não autenticado");
      toast({ 
        title: "Erro", 
        description: "Usuário não autenticado",
        variant: "destructive"
      });
      return;
    }

    console.log("🚀 Iniciando processamento:", { 
      fileName: file.name, 
      fileId, 
      filePath, 
      fileSize: file.size,
      userId: user.id
    });

    setLoading(true);
    setFileName(file.name);

    // Retry configuration
    const maxRetries = 3;
    const retryDelay = 2000; // 2 seconds

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      console.log(`📤 Tentativa ${attempt}/${maxRetries} de processamento`);
      
      try {
        const requestBody = {
          filePath,
          fileId,
          userId: user.id,
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type
        };

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
            toast({ 
              title: "Erro ao processar", 
              description: `Falha após ${maxRetries} tentativas: ${invokeError.message}`,
              variant: "destructive"
            });
            setLoading(false);
            return;
          }
          
          // Wait before retry
          console.log(`⏳ Aguardando ${retryDelay}ms antes da próxima tentativa...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          continue;
        }

        if (!result) {
          console.error(`❌ Resultado vazio na tentativa ${attempt}`);
          
          if (attempt === maxRetries) {
            toast({ 
              title: "Erro ao processar", 
              description: "Resposta vazia do servidor após todas as tentativas",
              variant: "destructive"
            });
            setLoading(false);
            return;
          }
          
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          continue;
        }

        if (!result.success) {
          console.error(`❌ Processamento falhou na tentativa ${attempt}:`, result);
          
          if (attempt === maxRetries) {
            const errorMessage = result?.error || result?.message || "Erro desconhecido durante o processamento";
            toast({ 
              title: "Erro no processamento", 
              description: errorMessage,
              variant: "destructive"
            });
            setLoading(false);
            return;
          }
          
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          continue;
        }

        // Success! Break out of retry loop
        console.log("✅ Processamento bem-sucedido na tentativa", attempt);
        break;

      } catch (error) {
        console.error(`❌ Erro na tentativa ${attempt}:`, error);
        
        if (attempt === maxRetries) {
          const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
          toast({ 
            title: "Erro", 
            description: `Erro após ${maxRetries} tentativas: ${errorMessage}`,
            variant: "destructive"
          });
          setLoading(false);
          return;
        }
        
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        continue;
      }
    }

    try {
      console.log("✅ Processamento concluído, aguardando consistência do banco...");

      // Wait for database consistency with exponential backoff
      const maxWaitTime = 10000; // 10 seconds max
      let waitTime = 1000; // Start with 1 second
      let totalWaited = 0;

      while (totalWaited < maxWaitTime) {
        await new Promise(resolve => setTimeout(resolve, waitTime));
        totalWaited += waitTime;

        // Query the sheets data
        console.log("🔍 Buscando abas da planilha...");
        const sheetsQuery = await supabase
          .from("sheets")
          .select("id, sheet_name")
          .eq("spreadsheet_id", fileId)
          .order("sheet_index", { ascending: true });

        if (sheetsQuery.error) {
          console.error("❌ Erro ao buscar sheets:", sheetsQuery.error);
          
          if (totalWaited >= maxWaitTime) {
            toast({ 
              title: "Erro ao carregar dados", 
              description: "Erro ao buscar as abas da planilha.",
              variant: "destructive"
            });
            setLoading(false);
            return;
          }
          
          waitTime = Math.min(waitTime * 1.5, 3000); // Exponential backoff, max 3s
          continue;
        }

        const sheets = sheetsQuery.data || [];
        console.log("📄 Abas encontradas:", sheets.length);

        if (sheets.length === 0) {
          if (totalWaited >= maxWaitTime) {
            console.log("⚠️ Nenhuma aba encontrada após esperar");
            toast({ 
              title: "Aviso", 
              description: "Nenhuma aba foi encontrada nesta planilha.",
              variant: "destructive"
            });
            setLoading(false);
            return;
          }
          
          waitTime = Math.min(waitTime * 1.5, 3000);
          continue;
        }

        // Found sheets, proceed with data loading
        const sheetIds = sheets.map(sheet => sheet.id);

        // Query the spreadsheet data
        console.log("🔍 Buscando dados das células...");
        const dataQuery = await supabase
          .from("spreadsheet_data")
          .select("*")
          .in("sheet_id", sheetIds)
          .order("row_index", { ascending: true })
          .order("column_index", { ascending: true })
          .limit(5000); // Limit to prevent memory issues

        if (dataQuery.error) {
          console.error("❌ Erro ao buscar dados:", dataQuery.error);
          toast({ 
            title: "Erro ao carregar dados", 
            description: "Erro ao buscar os dados da planilha.",
            variant: "destructive"
          });
          setLoading(false);
          return;
        }

        const data = dataQuery.data as DatabaseRow[];
        console.log("📊 Dados encontrados:", data.length, "células");

        if (data.length === 0) {
          if (totalWaited >= maxWaitTime) {
            console.log("⚠️ Nenhum dado encontrado após esperar");
            toast({ 
              title: "Aviso", 
              description: "Nenhum dado foi encontrado na planilha.",
              variant: "destructive"
            });
            setLoading(false);
            return;
          }
          
          waitTime = Math.min(waitTime * 1.5, 3000);
          continue;
        }

        // Data found, proceed with chart generation
        const sheetsMap = new Map(sheets.map(sheet => [sheet.id, sheet.sheet_name]));

        // Normalize data for chart generation
        const normalized: SpreadsheetRow[] = data.map((row: DatabaseRow) => ({
          row_index: row.row_index,
          column_name: row.column_name || `Coluna ${row.column_index + 1}`,
          value: row.cell_value || "",
          sheet_name: sheetsMap.get(row.sheet_id) || "Aba",
        }));

        console.log("🔄 Dados normalizados:", normalized.length);

        // Generate charts
        const generatedCharts = generateChartSet(normalized);
        console.log("📈 Gráficos gerados:", generatedCharts.length);

        setCharts(generatedCharts);
        setLoading(false);

        toast({
          title: "Planilha processada com sucesso!",
          description: `${generatedCharts.length} gráficos foram gerados a partir de ${sheets.length} aba(s).`
        });

        return; // Success, exit the function
      }

    } catch (error) {
      console.error("❌ Erro no pós-processamento:", error);
      toast({ 
        title: "Erro", 
        description: `Erro ao gerar gráficos: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
        variant: "destructive"
      });
      setLoading(false);
    }
  };

  return {
    loading,
    charts,
    fileName,
    handleFileUpload,
  };
}
