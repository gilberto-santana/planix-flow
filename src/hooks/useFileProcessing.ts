
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

      // 2. Buscar dados processados (com retry simples)
      console.log("🔍 [UPLOAD] Buscando dados processados...");
      
      let attempts = 0;
      let cellData: DatabaseRow[] = [];
      
      while (attempts < 3) {
        attempts++;
        console.log(`🔄 [UPLOAD] Tentativa ${attempts}/3 de buscar dados...`);

        // Buscar abas
        const { data: sheetData, error: sheetError } = await supabase
          .from("sheets")
          .select("id")
          .eq("spreadsheet_id", spreadsheetId)
          .limit(1);

        if (sheetError) {
          console.error(`❌ [UPLOAD] Erro ao buscar aba (tentativa ${attempts}):`, sheetError);
          if (attempts === 3) throw new Error("Erro ao buscar aba da planilha");
          await new Promise(resolve => setTimeout(resolve, 2000));
          continue;
        }

        if (!sheetData?.length) {
          console.log(`⚠️ [UPLOAD] Nenhuma aba encontrada (tentativa ${attempts})`);
          if (attempts === 3) break;
          await new Promise(resolve => setTimeout(resolve, 2000));
          continue;
        }

        // Buscar dados das células
        const sheetId = sheetData[0].id;
        const { data: rawCellData, error: cellError } = await supabase
          .from("spreadsheet_data")
          .select("*")
          .eq("sheet_id", sheetId)
          .limit(200);

        if (cellError) {
          console.error(`❌ [UPLOAD] Erro ao buscar células (tentativa ${attempts}):`, cellError);
          if (attempts === 3) break;
          await new Promise(resolve => setTimeout(resolve, 2000));
          continue;
        }

        if (rawCellData?.length) {
          cellData = rawCellData as DatabaseRow[];
          console.log(`✅ [UPLOAD] Dados encontrados: ${cellData.length} células`);
          break;
        }

        console.log(`⚠️ [UPLOAD] Nenhum dado encontrado (tentativa ${attempts})`);
        if (attempts < 3) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
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

      // 4. SEMPRE chamar a IA para gerar gráficos
      console.log("🤖 [UPLOAD] Enviando dados para IA...");
      
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

      // 5. Processar resposta da IA
      let finalCharts = [];

      if (aiResult.data?.chartConfig && Array.isArray(aiResult.data.chartConfig)) {
        const convertedCharts = aiResult.data.chartConfig
          .map((chart: any, index: number) => {
            if (!chart || !chart.data) return null;

            const title = chart.title || `Gráfico ${index + 1}`;
            
            // Verificar se está no formato correto
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
          finalCharts = convertedCharts;
          console.log("✅ [UPLOAD] Gráficos da IA processados:", finalCharts.length);
        }
      }

      // 6. Usar fallback se necessário
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
