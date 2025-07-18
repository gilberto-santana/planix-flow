// src/hooks/useFileProcessing.ts

import { useState } from "react";
import { useAuth } from "./useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "./use-toast";
import { ChartData } from "@/types/chart";
import { callParseUploadedSheetFunction } from "@/utils/edgeFunctionUtils";

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
    setLoading(true);
    setCharts([]);
    try {
      const parseResult = await callParseUploadedSheetFunction(file, filePath);
      if (!parseResult || !parseResult.success || !parseResult.spreadsheetId) {
        toast({ title: "Erro ao processar planilha", variant: "destructive" });
        setLoading(false);
        return;
      }

      const { spreadsheetId } = parseResult;
      setFileName(file.name);

      const { data, error } = await supabase
        .from("spreadsheet_data")
        .select("*")
        .eq("sheet_id", spreadsheetId);

      if (error || !data || data.length === 0) {
        toast({ title: "Nenhum dado encontrado após o upload.", variant: "destructive" });
        setLoading(false);
        return;
      }

      const rows = data.map((row: DatabaseRow) => ({
        row_index: row.row_index,
        column_index: row.column_index,
        column_name: row.column_name,
        value: row.cell_value,
      }));

      console.log("Enviando rows para IA:", rows); // Debug

      const aiResult = await supabase.functions.invoke("generate-ai-charts", {
        body: { rows }, // Enviar como objeto, não como string
      });

      console.log("Resultado IA:", aiResult); // Debug

      if (aiResult.error || !aiResult.data?.charts) {
        toast({ title: "Erro ao gerar gráficos com IA", variant: "destructive" });
        setLoading(false);
        return;
      }

      setCharts(aiResult.data.charts);
    } catch (err) {
      console.error("Erro no upload:", err);
      toast({ title: "Erro inesperado no upload", variant: "destructive" });
    } finally {
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
