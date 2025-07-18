// src/hooks/useFileProcessing.ts

import { useState } from "react";
import { useAuth } from "./useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "./use-toast";
import { ChartData } from "@/utils/chartGeneration";
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
    if (!user?.id) {
      toast({ title: "Usuário não autenticado", variant: "destructive" });
      return;
    }

    setLoading(true);
    setCharts([]);

    try {
      const parseParams = {
        fileId,
        userId: user.id,
        filePath,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      };

      const parseResult = await callParseUploadedSheetFunction(parseParams);

      if (parseResult.error || !parseResult.data?.success) {
        toast({
          title: "Erro ao processar planilha",
          description: parseResult.error || "Falha no processamento",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      setFileName(file.name);
      await new Promise(resolve => setTimeout(resolve, 1000));

      const { data: spreadsheets, error: spreadsheetError } = await supabase
        .from("spreadsheets")
        .select("id")
        .eq("file_name", file.name)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1);

      if (spreadsheetError || !spreadsheets?.length) {
        toast({ title: "Erro ao buscar planilha processada", variant: "destructive" });
        setLoading(false);
        return;
      }

      const spreadsheetId = spreadsheets[0].id;

      const { data: sheetData, error: sheetError } = await supabase
        .from("sheets")
        .select("id")
        .eq("spreadsheet_id", spreadsheetId)
        .limit(1);

      if (sheetError || !sheetData?.length) {
        toast({ title: "Nenhuma aba encontrada na planilha", variant: "destructive" });
        setLoading(false);
        return;
      }

      const sheetId = sheetData[0].id;

      const { data, error } = await supabase
        .from("spreadsheet_data")
        .select("*")
        .eq("sheet_id", sheetId);

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

      if (!rows || rows.length === 0) {
        toast({ title: "Nenhum dado válido para enviar à IA", variant: "destructive" });
        setLoading(false);
        return;
      }

      console.log("Enviando rows para IA:", rows); // debug opcional

      const aiResult = await supabase.functions.invoke("generate-ai-charts", {
        body: { rows }, // ENVIO DIRETO COMO OBJETO
      });

      if (aiResult.error) {
        toast({
          title: "Erro ao gerar gráficos com IA",
          description: aiResult.error.message,
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      if (!aiResult.data?.charts || aiResult.data.charts.length === 0) {
        toast({
          title: "Nenhum gráfico gerado",
          description: "A IA não conseguiu gerar gráficos para esta planilha.",
        });
        setCharts([]);
        setLoading(false);
        return;
      }

      setCharts(aiResult.data.charts);
      toast({
        title: "Gráficos gerados com sucesso!",
        description: `${aiResult.data.charts.length} gráfico(s) criado(s).`,
      });
    } catch (err) {
      toast({
        title: "Erro inesperado no upload",
        description: err instanceof Error ? err.message : "Erro desconhecido",
        variant: "destructive",
      });
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
