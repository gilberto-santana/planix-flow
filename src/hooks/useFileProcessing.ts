// src/hooks/useFileProcessing.ts

import { useState } from "react";
import { useAuth } from "./useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "./use-toast";
import { useCharts } from "@/contexts/ChartsContext";
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

const convertChartJsToStandardFormat = (chartJsData: any) => {
  try {
    if (!chartJsData || !Array.isArray(chartJsData)) return [];

    const convertedCharts = chartJsData.map((chart: any, index: number) => {
      const title = chart.title || `Gráfico ${index + 1}`;
      if (chart.data && Array.isArray(chart.data)) {
        const chartData = chart.data.filter((item: any) => item && typeof item.label === "string" && typeof item.value === "number");
        if (chartData.length === 0) return null;
        return { type: chart.type || "bar", title, data: chartData };
      }
      const labels = chart.data?.labels || [];
      const dataset = chart.data?.datasets?.[0];
      const values = dataset?.data || [];
      if (!labels.length || !values.length || labels.length !== values.length) return null;
      const standardData = labels.map((label: string, idx: number) => ({
        label: String(label || `Item ${idx + 1}`),
        value: Math.abs(Number(values[idx]) || 0)
      })).filter((item: any) => item.label);
      if (standardData.length === 0) return null;
      return { type: chart.type || "bar", title, data: standardData };
    }).filter(Boolean);

    return convertedCharts;
  } catch (error) {
    console.error("Erro ao converter gráficos:", error);
    return [];
  }
};

export function useFileProcessing() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const { charts, fileName, setCharts, setFileName } = useCharts();

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
        fileType: file.type || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      };

      const parseResult = await callParseUploadedSheetFunction(parseParams);

      if (parseResult.error || !parseResult.data?.success) {
        toast({ title: "Erro ao processar planilha", description: parseResult.error || "Falha no processamento", variant: "destructive" });
        setLoading(false);
        return;
      }

      setFileName(file.name);
      await new Promise(resolve => setTimeout(resolve, 1000));

      const { data: spreadsheets } = await supabase
        .from("spreadsheets")
        .select("id")
        .eq("file_name", file.name)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1);

      if (!spreadsheets?.length) {
        toast({ title: "Erro ao buscar planilha processada", variant: "destructive" });
        setLoading(false);
        return;
      }

      const spreadsheetId = spreadsheets[0].id;

      const { data: sheetData } = await supabase
        .from("sheets")
        .select("id")
        .eq("spreadsheet_id", spreadsheetId)
        .limit(1);

      if (!sheetData?.length) {
        toast({ title: "Nenhuma aba encontrada na planilha", variant: "destructive" });
        setLoading(false);
        return;
      }

      const sheetId = sheetData[0].id;

      const { data, error } = await supabase
        .from("spreadsheet_data")
        .select("*")
        .eq("sheet_id", sheetId);

      if (error || !data?.length) {
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

      console.log("🤖 Calling AI function with", rows.length, "data points");
      console.log("🎯 IMPORTANTE: Chamando função generate-ai-charts com IA Gemini!");

      // Call the AI function
      const aiResult = await supabase.functions.invoke("generate-ai-charts", {
        body: { data: rows },
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (aiResult.error) {
        toast({ title: "Erro ao gerar gráficos com IA", description: aiResult.error.message, variant: "destructive" });
        setLoading(false);
        return;
      }

      const chartConfig = aiResult.data?.chartConfig;
      if (!chartConfig || chartConfig.length === 0) {
        toast({ title: "Nenhum gráfico gerado", description: "A IA não conseguiu gerar gráficos para esta planilha." });
        setCharts([]);
        setLoading(false);
        return;
      }

      const convertedCharts = convertChartJsToStandardFormat(chartConfig);

      if (convertedCharts.length === 0) {
        toast({ title: "Erro na conversão dos gráficos", description: "Não foi possível converter os gráficos para exibição." });
        setLoading(false);
        return;
      }

      setCharts(convertedCharts);
      toast({ title: "Gráficos gerados com sucesso!", description: `${convertedCharts.length} gráfico(s) criado(s) pela IA.` });

    } catch (err) {
      toast({ title: "Erro inesperado no upload", description: err instanceof Error ? err.message : "Erro desconhecido", variant: "destructive" });
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
