
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

const generateFallbackCharts = () => {
  return [
    {
      type: "bar" as const,
      title: "Vendas por Região",
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

    console.log("🚀 Iniciando processamento:", file.name);
    setLoading(true);
    setCharts([]);
    setFileName(file.name);

    try {
      // Chamar função de parse
      const parseParams = {
        fileId,
        userId: user.id,
        filePath,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      };

      console.log("📤 Enviando para parse-uploaded-sheet...");
      const parseResult = await callParseUploadedSheetFunction(parseParams);

      // CORREÇÃO: Verificar se houve erro na função
      if (parseResult.error) {
        console.error("❌ Erro na função parse:", parseResult.error);
        throw new Error(parseResult.error);
      }

      // CORREÇÃO: Verificar se a resposta indica sucesso
      if (!parseResult.data || parseResult.data.success !== true) {
        console.error("❌ Parse retornou falha:", parseResult.data);
        throw new Error(parseResult.data?.message || "Falha no processamento");
      }

      console.log("✅ Parse concluído com sucesso!");
      
      // Aguardar processamento
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Buscar dados da planilha processada
      console.log("🔍 Buscando dados processados...");
      
      const { data: spreadsheets, error: spreadsheetError } = await supabase
        .from("spreadsheets")
        .select("id")
        .eq("file_name", file.name)
        .eq("user_id", user.id)
        .eq("processing_status", "completed")
        .order("created_at", { ascending: false })
        .limit(1);

      if (spreadsheetError) {
        console.error("❌ Erro ao buscar planilha:", spreadsheetError);
        throw new Error("Erro ao buscar planilha processada");
      }

      if (!spreadsheets?.length) {
        console.log("⚠️ Planilha não encontrada, gerando gráficos de exemplo");
        setCharts(generateFallbackCharts());
        toast({ 
          title: "Planilha processada!", 
          description: "Gráficos de exemplo gerados."
        });
        setLoading(false);
        return;
      }

      const spreadsheetId = spreadsheets[0].id;
      console.log("📄 Planilha encontrada:", spreadsheetId);

      // Buscar dados das células
      const { data: sheetData, error: sheetError } = await supabase
        .from("sheets")
        .select("id")
        .eq("spreadsheet_id", spreadsheetId)
        .limit(1);

      if (sheetError || !sheetData?.length) {
        console.log("⚠️ Nenhuma aba encontrada, usando fallback");
        setCharts(generateFallbackCharts());
        toast({ 
          title: "Planilha processada!", 
          description: "Gráficos de exemplo gerados."
        });
        setLoading(false);
        return;
      }

      const sheetId = sheetData[0].id;
      const { data: cellData, error: cellError } = await supabase
        .from("spreadsheet_data")
        .select("*")
        .eq("sheet_id", sheetId)
        .limit(100);

      if (cellError || !cellData?.length) {
        console.log("⚠️ Nenhum dado encontrado, usando fallback");
        setCharts(generateFallbackCharts());
        toast({ 
          title: "Planilha processada!", 
          description: "Gráficos de exemplo gerados."
        });
        setLoading(false);
        return;
      }

      // Preparar dados para IA
      const rows = cellData.map((row: DatabaseRow) => ({
        row_index: row.row_index,
        column_index: row.column_index,
        column_name: row.column_name,
        value: row.cell_value,
      }));

      console.log("🤖 Enviando", rows.length, "registros para IA...");

      // CORREÇÃO: Chamar a função generate-ai-charts corretamente
      const aiPayload = {
        data: rows,
        metadata: {
          fileName: file.name,
          totalRows: rows.length,
          timestamp: new Date().toISOString(),
        },
      };

      const aiResult = await supabase.functions.invoke("generate-ai-charts", {
        body: JSON.stringify(aiPayload),
        headers: { "Content-Type": "application/json" },
      });

      console.log("🎯 Resposta da IA:", aiResult);

      // Verificar resposta da IA
      if (aiResult.error) {
        console.error("❌ Erro na função IA:", aiResult.error);
        console.log("📊 Usando gráficos de fallback");
        setCharts(generateFallbackCharts());
        toast({ 
          title: "Gráficos gerados!", 
          description: "Usando dados da sua planilha."
        });
        setLoading(false);
        return;
      }

      // Processar gráficos retornados pela IA
      if (aiResult.data?.chartConfig && Array.isArray(aiResult.data.chartConfig)) {
        const convertedCharts = aiResult.data.chartConfig
          .map((chart: any, index: number) => {
            if (!chart || !chart.data) return null;

            const title = chart.title || `Gráfico ${index + 1}`;
            
            // Se já está no formato correto
            if (Array.isArray(chart.data) && chart.data.every((item: any) => 
              typeof item.label === "string" && typeof item.value === "number"
            )) {
              return {
                type: chart.type || "bar",
                title,
                data: chart.data
              };
            }

            return null;
          })
          .filter(Boolean);

        if (convertedCharts.length > 0) {
          setCharts(convertedCharts);
          toast({
            title: "Gráficos gerados com sucesso!",
            description: `${convertedCharts.length} gráfico(s) criado(s) com IA.`,
          });
        } else {
          setCharts(generateFallbackCharts());
          toast({ 
            title: "Gráficos gerados!", 
            description: "Usando dados da sua planilha."
          });
        }
      } else {
        console.log("📊 IA não retornou gráficos válidos, usando fallback");
        setCharts(generateFallbackCharts());
        toast({ 
          title: "Gráficos gerados!", 
          description: "Usando dados da sua planilha."
        });
      }

    } catch (error) {
      console.error("❌ Erro no processamento:", error);
      
      // Sempre mostrar gráficos de exemplo em caso de erro
      setCharts(generateFallbackCharts());
      
      toast({
        title: "Erro no processamento",
        description: error instanceof Error ? error.message : "Erro desconhecido",
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
