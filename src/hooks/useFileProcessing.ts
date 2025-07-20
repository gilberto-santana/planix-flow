
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

// Function to convert Chart.js format to our standardized format
const convertChartJsToStandardFormat = (chartJsData: any) => {
  console.log("🔄 Converting Chart.js data to standard format:", chartJsData);
  
  try {
    if (!chartJsData || !Array.isArray(chartJsData)) {
      console.error("❌ Invalid chartJsData structure:", chartJsData);
      return [];
    }

    const convertedCharts = chartJsData.map((chart: any, index: number) => {
      console.log(`🔍 Processing chart ${index + 1}:`, chart);

      // Extract title from options or generate one
      const title = chart.options?.plugins?.title?.text || 
                   chart.data?.datasets?.[0]?.label || 
                   `Gráfico ${index + 1}`;

      // Convert Chart.js data structure to standardized format
      const labels = chart.data?.labels || [];
      const dataset = chart.data?.datasets?.[0];
      const values = dataset?.data || [];

      console.log(`📋 Chart ${index + 1} - Labels:`, labels);
      console.log(`📋 Chart ${index + 1} - Values:`, values);

      // Validate that we have both labels and values
      if (!labels.length || !values.length || labels.length !== values.length) {
        console.warn(`⚠️ Chart ${index + 1} data mismatch:`, { 
          labelsLength: labels.length, 
          valuesLength: values.length 
        });
        return null;
      }

      // Create standardized data array using 'name' field (consistent with recharts)
      const standardData = labels.map((label: string, idx: number) => {
        const value = Number(values[idx]);
        return {
          name: String(label || `Item ${idx + 1}`),
          value: isNaN(value) ? 0 : Math.abs(value) // Use absolute values to avoid negative chart issues
        };
      }).filter(item => item.name && (item.value > 0 || item.value === 0)); // Keep valid data including zero values

      console.log(`✅ Converted chart ${index + 1} data:`, { 
        title, 
        type: chart.type, 
        dataLength: standardData.length,
        sampleData: standardData.slice(0, 3)
      });

      // Only return chart if it has valid data
      if (standardData.length === 0) {
        console.warn(`⚠️ Chart ${index + 1} has no valid data after conversion`);
        return null;
      }

      return {
        type: chart.type || 'bar',
        title: title,
        data: standardData
      };
    }).filter(Boolean); // Remove null charts

    console.log("✅ All charts converted successfully:", {
      totalCharts: convertedCharts.length,
      chartTitles: convertedCharts.map(c => c.title)
    });
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

    console.log("🚀 Starting file upload process for:", file.name);
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

      console.log("📤 Parsing uploaded sheet with params:", parseParams);
      const parseResult = await callParseUploadedSheetFunction(parseParams);

      if (parseResult.error || !parseResult.data?.success) {
        console.error("❌ Parse result error:", parseResult.error);
        toast({ 
          title: "Erro ao processar planilha", 
          description: parseResult.error || "Falha no processamento",
          variant: "destructive" 
        });
        setLoading(false);
        return;
      }

      console.log("✅ Sheet parsed successfully, setting filename:", file.name);
      setFileName(file.name);
      
      // Wait for processing to complete
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Find the spreadsheet in database
      const { data: spreadsheets, error: spreadsheetError } = await supabase
        .from("spreadsheets")
        .select("id")
        .eq("file_name", file.name)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1);

      if (spreadsheetError || !spreadsheets?.length) {
        console.error("❌ Spreadsheet not found:", spreadsheetError);
        toast({ title: "Erro ao buscar planilha processada", variant: "destructive" });
        setLoading(false);
        return;
      }

      const spreadsheetId = spreadsheets[0].id;
      console.log("📋 Found spreadsheet ID:", spreadsheetId);

      // Get sheet data
      const { data: sheetData, error: sheetError } = await supabase
        .from("sheets")
        .select("id")
        .eq("spreadsheet_id", spreadsheetId)
        .limit(1);

      if (sheetError || !sheetData?.length) {
        console.error("❌ Sheet not found:", sheetError);
        toast({ title: "Nenhuma aba encontrada na planilha", variant: "destructive" });
        setLoading(false);
        return;
      }

      const sheetId = sheetData[0].id;
      console.log("📄 Found sheet ID:", sheetId);

      // Get spreadsheet data for AI processing
      const { data, error } = await supabase
        .from("spreadsheet_data")
        .select("*")
        .eq("sheet_id", sheetId);

      if (error || !data || data.length === 0) {
        console.error("❌ No spreadsheet data found:", error);
        toast({ title: "Nenhum dado encontrado após o upload.", variant: "destructive" });
        setLoading(false);
        return;
      }

      // Transform database rows for AI processing
      const rows = data.map((row: DatabaseRow) => ({
        row_index: row.row_index,
        column_index: row.column_index,
        column_name: row.column_name,
        value: row.cell_value,
      }));

      console.log("📊 Sending data to AI for chart generation:", { 
        totalRows: rows.length, 
        sampleData: rows.slice(0, 3) 
      });

      // Call AI function to generate charts
      const aiResult = await supabase.functions.invoke("generate-ai-charts", {
        body: { data: rows }
      });

      console.log("🤖 AI function result:", aiResult);

      if (aiResult.error) {
        console.error("❌ AI function error:", aiResult.error);
        toast({ 
          title: "Erro ao gerar gráficos com IA", 
          description: aiResult.error.message,
          variant: "destructive" 
        });
        setLoading(false);
        return;
      }

      if (!aiResult.data?.chartConfig || aiResult.data.chartConfig.length === 0) {
        console.warn("⚠️ No charts generated by AI");
        toast({ 
          title: "Nenhum gráfico gerado", 
          description: "A IA não conseguiu gerar gráficos para esta planilha." 
        });
        setCharts([]);
        setLoading(false);
        return;
      }

      console.log("📋 Raw Chart.js data from AI:", aiResult.data.chartConfig);

      // Convert Chart.js format to standardized format
      const convertedCharts = convertChartJsToStandardFormat(aiResult.data.chartConfig);

      if (convertedCharts.length === 0) {
        console.error("❌ No valid charts after conversion");
        toast({ 
          title: "Erro na conversão dos gráficos", 
          description: "Não foi possível converter os gráficos para exibição." 
        });
        setLoading(false);
        return;
      }

      console.log("✅ Charts successfully converted and stored:", convertedCharts.length);
      setCharts(convertedCharts);
      toast({ 
        title: "Gráficos gerados com sucesso!", 
        description: `${convertedCharts.length} gráfico(s) criado(s).` 
      });

    } catch (err) {
      console.error("❌ Unexpected error in file upload:", err);
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
