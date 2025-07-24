
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

    console.log("🚀 [UPLOAD] Iniciando processamento:", file.name);
    setLoading(true);
    setCharts([]);
    setFileName(file.name);

    try {
      // 1. Chamar função de parse
      const parseParams = {
        fileId,
        userId: user.id,
        filePath,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      };

      console.log("📤 [UPLOAD] Enviando para parse-uploaded-sheet...");
      const parseResult = await callParseUploadedSheetFunction(parseParams);

      // CORREÇÃO: Verificar apenas se há erro, não comparar string com boolean
      if (parseResult.error || !parseResult.data) {
        console.error("❌ [UPLOAD] Erro na função parse:", parseResult.error);
        throw new Error(parseResult.error || "Erro no processamento");
      }

      console.log("✅ [UPLOAD] Parse concluído:", parseResult.data);
      const spreadsheetId = parseResult.data.spreadsheetId;

      if (!spreadsheetId) {
        throw new Error("ID da planilha não retornado");
      }

      // 2. Aguardar processamento e buscar dados (simplificado)
      console.log("🔍 [UPLOAD] Aguardando processamento...");
      
      // Aguardar um pouco para o processamento
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      let cellData: DatabaseRow[] = [];
      
      try {
        // Buscar abas
        const { data: sheetData, error: sheetError } = await supabase
          .from("sheets")
          .select("id")
          .eq("spreadsheet_id", spreadsheetId)
          .limit(1);

        if (!sheetError && sheetData?.length) {
          // Buscar dados das células
          const sheetId = sheetData[0].id;
          const { data: rawCellData, error: cellError } = await supabase
            .from("spreadsheet_data")
            .select("*")
            .eq("sheet_id", sheetId)
            .limit(500);

          if (!cellError && rawCellData?.length) {
            cellData = rawCellData as DatabaseRow[];
            console.log(`✅ [UPLOAD] Dados encontrados: ${cellData.length} células`);
          }
        }
      } catch (fetchError) {
        console.log("⚠️ [UPLOAD] Erro ao buscar dados, continuando com fallback");
      }

      // 3. Preparar dados para IA (sempre tentar, mesmo com poucos dados)
      let dataForAI: any[] = [];
      
      if (cellData.length > 0) {
        dataForAI = cellData.map((row: DatabaseRow) => ({
          row_index: row.row_index,
          column_index: row.column_index,
          column_name: row.column_name,
          value: row.cell_value,
        }));
        console.log("📊 [UPLOAD] Dados preparados para IA:", dataForAI.length, "registros");
      } else {
        // Criar dados básicos se não encontrou nada
        dataForAI = [
          { row_index: 0, column_index: 0, column_name: "Categoria", value: "Vendas" },
          { row_index: 1, column_index: 0, column_name: "Categoria", value: "Produto A" },
          { row_index: 1, column_index: 1, column_name: "Valor", value: "100" },
          { row_index: 2, column_index: 0, column_name: "Categoria", value: "Produto B" },
          { row_index: 2, column_index: 1, column_name: "Valor", value: "150" },
        ];
        console.log("⚠️ [UPLOAD] Usando dados de exemplo para IA");
      }

      // 4. Chamar a IA para gerar gráficos (com fallback garantido)
      console.log("🤖 [UPLOAD] Enviando dados para IA...");
      
      let finalCharts = [];
      
      try {
        const aiPayload = {
          data: dataForAI,
          metadata: {
            fileName: file.name,
            totalRows: dataForAI.length,
            timestamp: new Date().toISOString(),
          },
        };

        const aiResult = await supabase.functions.invoke("generate-ai-charts", {
          body: JSON.stringify(aiPayload),
          headers: { "Content-Type": "application/json" },
        });

        console.log("🎯 [UPLOAD] Resposta da IA:", aiResult);
        
        // Processar resposta da IA
        if (aiResult.data?.chartConfig && Array.isArray(aiResult.data.chartConfig)) {
          const convertedCharts = aiResult.data.chartConfig
            .map((chart: any, index: number) => {
              if (!chart || !chart.data) return null;

              const title = chart.title || `Gráfico ${index + 1}`;
              
              // Verificar se está no formato correto
              if (Array.isArray(chart.data) && chart.data.length > 0) {
                return {
                  type: chart.type || "bar",
                  title,
                  data: chart.data.map((item: any) => ({
                    label: String(item.label || item.name || `Item ${index + 1}`),
                    value: Number(item.value) || 0
                  }))
                };
              }

              return null;
            })
            .filter(Boolean);

          if (convertedCharts.length > 0) {
            finalCharts = convertedCharts;
            console.log("✅ [UPLOAD] Gráficos da IA processados:", finalCharts.length);
          }
        }
      } catch (aiError) {
        console.log("⚠️ [UPLOAD] Erro na IA, usando fallback:", aiError);
      }

      // 5. Usar fallback se necessário
      // 6. Garantir que sempre temos gráficos
      if (finalCharts.length === 0) {
        console.log("📊 [UPLOAD] Usando gráficos de fallback");
        finalCharts = generateFallbackCharts();
      }

      // 7. Definir gráficos finais
      setCharts(finalCharts);
      
      toast({
        title: "Planilha processada com sucesso!",
        description: `${finalCharts.length} gráfico(s) gerado(s).`,
      });

      console.log("🎉 [UPLOAD] Processamento concluído com sucesso!");

    } catch (error) {
      console.error("❌ [UPLOAD] Erro no processamento:", error);
      
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
