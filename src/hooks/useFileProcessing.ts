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
      console.log("🚀 Iniciando processamento do arquivo:", file.name);

      const parseParams = {
        fileId,
        userId: user.id,
        filePath,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      };

      // Call the parse-uploaded-sheet function
      const parseResult = await callParseUploadedSheetFunction(parseParams);
      
      if (parseResult.error || !parseResult.data?.success) {
        console.error("❌ Erro no processamento:", parseResult.error);
        toast({ 
          title: "Erro ao processar planilha", 
          description: parseResult.error || "Falha no processamento",
          variant: "destructive" 
        });
        setLoading(false);
        return;
      }

      console.log("✅ Planilha processada com sucesso");
      setFileName(file.name);

      // Wait a moment for data to be inserted
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Get the spreadsheet data for AI chart generation
      const { data: spreadsheets, error: spreadsheetError } = await supabase
        .from("spreadsheets")
        .select("id")
        .eq("file_name", file.name)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1);

      if (spreadsheetError || !spreadsheets?.length) {
        console.error("❌ Erro ao buscar spreadsheet:", spreadsheetError);
        toast({ title: "Erro ao buscar planilha processada", variant: "destructive" });
        setLoading(false);
        return;
      }

      const spreadsheetId = spreadsheets[0].id;

      // Get sheet data
      const { data: sheetData, error: sheetError } = await supabase
        .from("sheets")
        .select("id")
        .eq("spreadsheet_id", spreadsheetId)
        .limit(1);

      if (sheetError || !sheetData?.length) {
        console.error("❌ Erro ao buscar sheet:", sheetError);
        toast({ title: "Nenhuma aba encontrada na planilha", variant: "destructive" });
        setLoading(false);
        return;
      }

      const sheetId = sheetData[0].id;

      // Get spreadsheet data for AI
      const { data, error } = await supabase
        .from("spreadsheet_data")
        .select("*")
        .eq("sheet_id", sheetId);

      if (error || !data || data.length === 0) {
        console.error("❌ Nenhum dado encontrado:", error);
        toast({ title: "Nenhum dado encontrado após o upload.", variant: "destructive" });
        setLoading(false);
        return;
      }

      console.log("📊 Dados encontrados para IA:", data.length, "registros");

      // Transform data for AI
      const rows = data.map((row: DatabaseRow) => ({
        row_index: row.row_index,
        column_index: row.column_index,
        column_name: row.column_name,
        value: row.cell_value,
      }));

      console.log("🤖 Enviando dados para IA...");

      // Call AI chart generation
      const aiResult = await supabase.functions.invoke("generate-ai-charts", {
        body: JSON.stringify({ rows }) // <- CORREÇÃO AQUI
      });

      console.log("🤖 Resultado da IA:", aiResult);

      if (aiResult.error) {
        console.error("❌ Erro na função de IA:", aiResult.error);
        toast({ 
          title: "Erro ao gerar gráficos com IA", 
          description: aiResult.error.message,
          variant: "destructive" 
        });
        setLoading(false);
        return;
      }

      if (!aiResult.data?.charts || aiResult.data.charts.length === 0) {
        console.log("⚠️ Nenhum gráfico foi gerado pela IA");
        toast({ 
          title: "Nenhum gráfico gerado", 
          description: "A IA não conseguiu gerar gráficos para esta planilha." 
        });
        setCharts([]);
        setLoading(false);
        return;
      }

      console.log("✅ Gráficos gerados:", aiResult.data.charts.length);
      setCharts(aiResult.data.charts);
      toast({ 
        title: "Gráficos gerados com sucesso!", 
        description: `${aiResult.data.charts.length} gráfico(s) criado(s).` 
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
