
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

// Function to convert Chart.js format to our simple format
const convertChartJsToSimpleFormat = (chartJsData: any) => {
  console.log("🔄 Converting Chart.js data:", chartJsData);
  
  try {
    if (!chartJsData || !Array.isArray(chartJsData)) {
      console.error("❌ Invalid chartJsData structure:", chartJsData);
      return [];
    }

    const convertedCharts = chartJsData.map((chart: any, index: number) => {
      // Extract title from options or generate one
      const title = chart.options?.plugins?.title?.text || 
                   chart.data?.datasets?.[0]?.label || 
                   `Gráfico ${index + 1}`;

      // Convert Chart.js data structure to simple format
      const labels = chart.data?.labels || [];
      const dataset = chart.data?.datasets?.[0];
      const values = dataset?.data || [];

      // Create simple data array
      const simpleData = labels.map((label: string, idx: number) => ({
        label: label || `Item ${idx + 1}`,
        value: values[idx] || 0
      }));

      console.log(`✅ Converted chart ${index + 1}:`, { title, type: chart.type, dataLength: simpleData.length });

      return {
        type: chart.type || 'bar',
        title: title,
        data: simpleData
      };
    });

    console.log("✅ All charts converted successfully:", convertedCharts.length);
    return convertedCharts;
  } catch (error) {
    console.error("❌ Error converting Chart.js data:", error);
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
        toast({ 
          title: "Erro ao processar planilha", 
          description: parseResult.error || "Falha no processamento",
          variant: "destructive" 
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

      console.log("📊 Enviando dados para IA:", { totalRows: rows.length, sampleData: rows.slice(0, 3) });

      const aiResult = await supabase.functions.invoke("generate-ai-charts", {
        body: { data: rows }
      });

      console.log("🤖 Resposta completa da IA:", aiResult);

      if (aiResult.error) {
        console.error("❌ Erro da Edge Function:", aiResult.error);
        toast({ 
          title: "Erro ao gerar gráficos com IA", 
          description: aiResult.error.message,
          variant: "destructive" 
        });
        setLoading(false);
        return;
      }

      if (!aiResult.data?.chartConfig || aiResult.data.chartConfig.length === 0) {
        toast({ 
          title: "Nenhum gráfico gerado", 
          description: "A IA não conseguiu gerar gráficos para esta planilha." 
        });
        setCharts([]);
        setLoading(false);
        return;
      }

      console.log("📋 Dados brutos dos gráficos (Chart.js format):", aiResult.data.chartConfig);

      // Convert Chart.js format to our simple format
      const convertedCharts = convertChartJsToSimpleFormat(aiResult.data.chartConfig);

      if (convertedCharts.length === 0) {
        toast({ 
          title: "Erro na conversão dos gráficos", 
          description: "Não foi possível converter os gráficos para exibição." 
        });
        setLoading(false);
        return;
      }

      console.log("✅ Gráficos convertidos para formato simples:", convertedCharts);
      setCharts(convertedCharts);
      toast({ 
        title: "Gráficos gerados com sucesso!", 
        description: `${convertedCharts.length} gráfico(s) criado(s).` 
      });

    } catch (err) {
      console.error("❌ Erro inesperado no upload:", err);
      toast({ 
        title: "Erro inesperado no upload", 
        description: err instanceof Error ? err.message : "Erro desconhecido",
        variant: "destructive" 
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
