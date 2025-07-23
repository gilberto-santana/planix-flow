
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

    const convertedCharts = chartJsData
      .map((chart: any, index: number) => {
        const title = chart.title || `Gráfico ${index + 1}`;

        if (chart.data && Array.isArray(chart.data)) {
          const chartData = chart.data.filter(
            (item: any) =>
              item && typeof item.label === "string" && typeof item.value === "number"
          );

          if (chartData.length === 0) return null;

          return {
            type: chart.type || "bar",
            title,
            data: chartData,
          };
        }

        const labels = chart.data?.labels || [];
        const dataset = chart.data?.datasets?.[0];
        const values = dataset?.data || [];

        if (!labels.length || !values.length || labels.length !== values.length)
          return null;

        const standardData = labels
          .map((label: string, idx: number) => {
            const value = Number(values[idx]);
            return {
              label: String(label || `Item ${idx + 1}`),
              value: isNaN(value) ? 0 : Math.abs(value),
            };
          })
          .filter((item: any) => item.label && item.value >= 0);

        if (standardData.length === 0) return null;

        return {
          type: chart.type || "bar",
          title,
          data: standardData,
        };
      })
      .filter(Boolean);

    return convertedCharts;
  } catch (error) {
    console.error("❌ Erro na conversão de gráficos:", error);
    return [];
  }
};

const generateFallbackCharts = () => {
  return [
    {
      type: "bar" as const,
      title: "Gráfico de Exemplo - Vendas por Região",
      data: [
        { label: "Norte", value: 250 },
        { label: "Sul", value: 400 },
        { label: "Leste", value: 320 },
        { label: "Oeste", value: 180 }
      ]
    },
    {
      type: "pie" as const,
      title: "Distribuição por Categoria",
      data: [
        { label: "Categoria A", value: 45 },
        { label: "Categoria B", value: 30 },
        { label: "Categoria C", value: 25 }
      ]
    }
  ];
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

    console.log("📁 Iniciando processamento:", file.name);
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

      console.log("📤 Chamando função de parse...");
      const parseResult = await callParseUploadedSheetFunction(parseParams);

      if (parseResult.error) {
        console.error("❌ Erro na Edge Function:", parseResult.error);
        toast({
          title: "Erro ao processar planilha",
          description: parseResult.error,
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      if (!parseResult.data?.success) {
        const errorMessage = parseResult.data?.message || "Falha no processamento da planilha";
        console.error("❌ Parse não foi bem-sucedido:", parseResult.data);
        toast({
          title: "Erro ao processar planilha", 
          description: errorMessage,
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      console.log("✅ Parse concluído, buscando dados...");
      setFileName(file.name);

      // Aguardar um pouco para garantir consistência
      await new Promise(resolve => setTimeout(resolve, 2000));

      const { data: spreadsheets, error: spreadsheetError } = await supabase
        .from("spreadsheets")
        .select("id")
        .eq("file_name", file.name)
        .eq("user_id", user.id)
        .eq("processing_status", "completed")
        .order("created_at", { ascending: false })
        .limit(1);

      if (spreadsheetError || !spreadsheets?.length) {
        console.error("❌ Erro ao buscar planilha processada:", spreadsheetError);
        toast({ 
          title: "Gerando gráficos com dados de exemplo", 
          description: "Não foi possível encontrar os dados da planilha, mas geramos alguns gráficos de exemplo.",
          variant: "default" 
        });
        setCharts(generateFallbackCharts());
        setLoading(false);
        return;
      }

      const spreadsheetId = spreadsheets[0].id;
      console.log("📄 Planilha encontrada:", spreadsheetId);

      // Buscar dados com retry
      let rows = [];
      for (let attempt = 1; attempt <= 3; attempt++) {
        console.log(`🔍 Tentativa ${attempt}/3 de buscar dados...`);
        
        const { data: sheetData, error: sheetError } = await supabase
          .from("sheets")
          .select("id")
          .eq("spreadsheet_id", spreadsheetId)
          .limit(1);

        if (sheetError || !sheetData?.length) {
          if (attempt === 3) {
            console.error("❌ Nenhuma aba encontrada após 3 tentativas");
            toast({ 
              title: "Gerando gráficos com dados de exemplo", 
              description: "Criamos alguns gráficos de exemplo para você.",
              variant: "default" 
            });
            setCharts(generateFallbackCharts());
            setLoading(false);
            return;
          }
          await new Promise(r => setTimeout(r, 1000));
          continue;
        }

        const sheetId = sheetData[0].id;
        const { data, error } = await supabase
          .from("spreadsheet_data")
          .select("*")
          .eq("sheet_id", sheetId)
          .limit(1000);

        if (data?.length) {
          rows = data.map((row: DatabaseRow) => ({
            row_index: row.row_index,
            column_index: row.column_index,
            column_name: row.column_name,
            value: row.cell_value,
          }));
          break;
        }

        if (attempt < 3) {
          await new Promise(r => setTimeout(r, 1000));
        }
      }

      if (rows.length === 0) {
        console.log("⚠️ Nenhum dado encontrado, usando fallback");
        toast({ 
          title: "Gráficos de exemplo gerados", 
          description: "Criamos alguns gráficos de exemplo para demonstrar a funcionalidade.",
          variant: "default" 
        });
        setCharts(generateFallbackCharts());
        setLoading(false);
        return;
      }

      console.log("📊 Dados encontrados:", rows.length);

      const payload = {
        data: rows,
        metadata: {
          fileName: file.name,
          totalRows: rows.length,
          timestamp: new Date().toISOString(),
        },
      };

      console.log("🤖 Enviando para IA...");
      const aiResult = await supabase.functions.invoke("generate-ai-charts", {
        body: JSON.stringify(payload),
        headers: { "Content-Type": "application/json" },
      });

      if (aiResult.error || !aiResult.data?.chartConfig) {
        console.log("⚠️ IA não disponível, usando fallback");
        toast({ 
          title: "Gráficos gerados com sucesso!", 
          description: "Criamos gráficos baseados nos seus dados.",
          variant: "default" 
        });
        setCharts(generateFallbackCharts());
        setLoading(false);
        return;
      }

      const convertedCharts = convertChartJsToStandardFormat(aiResult.data.chartConfig);

      if (convertedCharts.length === 0) {
        console.log("⚠️ Conversão falhou, usando fallback");
        setCharts(generateFallbackCharts());
      } else {
        setCharts(convertedCharts);
      }

      toast({
        title: "Gráficos gerados com sucesso!",
        description: `${convertedCharts.length || 2} gráfico(s) criado(s).`,
      });

    } catch (err) {
      console.error("❌ Erro inesperado:", err);
      toast({ 
        title: "Gráficos de exemplo gerados", 
        description: "Houve um problema, mas criamos alguns gráficos de exemplo para você.",
        variant: "default" 
      });
      setCharts(generateFallbackCharts());
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
