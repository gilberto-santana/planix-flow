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
    if (!user) return;

    setLoading(true);
    setFileName(file.name);

    try {
      const { data: result, error: invokeError } = await supabase.functions.invoke("parse-uploaded-sheet", {
        body: {
          filePath,
          fileId,
          userId: user.id,
        },
      });

      if (invokeError) {
        console.error("Erro ao invocar função:", invokeError);
        toast({ title: "Erro ao processar", description: "Não foi possível processar a planilha." });
        setLoading(false);
        return;
      }

      const sheetsQuery = await supabase
        .from("sheets")
        .select("id, sheet_name")
        .eq("spreadsheet_id", fileId);

      if (sheetsQuery.error || !sheetsQuery.data) {
        console.error("Erro ao buscar sheets:", sheetsQuery.error);
        toast({ title: "Erro ao carregar dados", description: "Erro ao buscar as abas da planilha." });
        setLoading(false);
        return;
      }

      const sheets = sheetsQuery.data;
      const sheetIds = sheets.map(sheet => sheet.id);

      if (sheetIds.length === 0) {
        console.log("Nenhuma aba encontrada para esta planilha");
        toast({ title: "Aviso", description: "Nenhuma aba foi encontrada nesta planilha." });
        setLoading(false);
        return;
      }

      const dataQuery = await supabase
        .from("spreadsheet_data")
        .select("*")
        .in("sheet_id", sheetIds)
        .order("row_index", { ascending: true });

      if (dataQuery.error || !dataQuery.data) {
        console.error("Erro ao buscar dados:", dataQuery.error);
        toast({ title: "Erro ao carregar dados", description: "Erro ao buscar os dados da planilha." });
        setLoading(false);
        return;
      }

      const data = dataQuery.data as DatabaseRow[];
      const sheetsMap = new Map(sheets.map(sheet => [sheet.id, sheet.sheet_name]));

      const normalized: SpreadsheetRow[] = data.map((row: DatabaseRow) => ({
        row_index: row.row_index,
        column_name: row.column_name || "",
        value: row.cell_value || "",
        sheet_name: sheetsMap.get(row.sheet_id) || "Aba",
      }));

      const generatedCharts = generateChartSet(normalized);
      setCharts(generatedCharts);
      setLoading(false);

      toast({
        title: "Planilha processada com sucesso!",
        description: `${generatedCharts.length} gráficos foram gerados.`
      });
    } catch (error) {
      console.error("Erro no processamento:", error);
      toast({ title: "Erro", description: "Erro inesperado durante o processamento." });
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
