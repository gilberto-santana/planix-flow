
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

    try {
      const requestBody = {
        filePath,
        fileId,
        userId: user.id,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type
      };

      console.log("📤 Enviando para Edge Function:", requestBody);

      // Call the edge function
      const { data: result, error: invokeError } = await supabase.functions.invoke("parse-uploaded-sheet", {
        body: requestBody,
        headers: {
          "Content-Type": "application/json",
        },
      });

      console.log("📊 Resposta da Edge Function:", { result, error: invokeError });

      if (invokeError) {
        console.error("❌ Erro ao invocar função:", invokeError);
        toast({ 
          title: "Erro ao processar", 
          description: `Falha na comunicação com o servidor: ${invokeError.message}`,
          variant: "destructive"
        });
        setLoading(false);
        return;
      }

      if (!result?.success) {
        console.error("❌ Processamento falhou:", result);
        const errorMessage = result?.error || result?.message || "Erro desconhecido durante o processamento";
        toast({ 
          title: "Erro no processamento", 
          description: errorMessage,
          variant: "destructive"
        });
        setLoading(false);
        return;
      }

      console.log("✅ Processamento concluído, aguardando consistência do banco...");

      // Wait for database consistency
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Query the sheets data
      console.log("🔍 Buscando abas da planilha...");
      const sheetsQuery = await supabase
        .from("sheets")
        .select("id, sheet_name")
        .eq("spreadsheet_id", fileId)
        .order("sheet_index", { ascending: true });

      if (sheetsQuery.error) {
        console.error("❌ Erro ao buscar sheets:", sheetsQuery.error);
        toast({ 
          title: "Erro ao carregar dados", 
          description: "Erro ao buscar as abas da planilha.",
          variant: "destructive"
        });
        setLoading(false);
        return;
      }

      const sheets = sheetsQuery.data || [];
      console.log("📄 Abas encontradas:", sheets.length);

      if (sheets.length === 0) {
        console.log("⚠️ Nenhuma aba encontrada");
        toast({ 
          title: "Aviso", 
          description: "Nenhuma aba foi encontrada nesta planilha.",
          variant: "destructive"
        });
        setLoading(false);
        return;
      }

      const sheetIds = sheets.map(sheet => sheet.id);

      // Query the spreadsheet data
      console.log("🔍 Buscando dados das células...");
      const dataQuery = await supabase
        .from("spreadsheet_data")
        .select("*")
        .in("sheet_id", sheetIds)
        .order("row_index", { ascending: true })
        .order("column_index", { ascending: true });

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
        console.log("⚠️ Nenhum dado encontrado");
        toast({ 
          title: "Aviso", 
          description: "Nenhum dado foi encontrado na planilha.",
          variant: "destructive"
        });
        setLoading(false);
        return;
      }

      // Create sheets map
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

    } catch (error) {
      console.error("❌ Erro no processamento:", error);
      toast({ 
        title: "Erro", 
        description: `Erro inesperado: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
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
