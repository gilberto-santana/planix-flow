// src/hooks/useFileProcessing.ts

import { useState } from "react";
import { useAuth } from "./useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "./use-toast";
import { generateChartSet, ChartData, SpreadsheetRow } from "@/utils/chartGeneration";

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

  const handleFileUpload = async (file: File, fileId: string, fileUrl: string): Promise<string | null> => {
    if (!user) return null;

    setLoading(true);
    setFileName(file.name);

    const { name, size, type } = file;
    const filePath = `${fileId}.${name.split(".").pop()}`;

    try {
      const { data: parseResult, error: invokeError } = await supabase.functions.invoke("parse-uploaded-sheet", {
        body: JSON.stringify({
          fileId,
          userId: user.id,
          fileUrl,
          filePath,
          fileName: name,
          fileSize: size,
          fileType: type,
        }),
      });

      console.log("🟢 parseResult:", parseResult);
      console.log("🟠 invokeError:", invokeError);

      let spreadsheetId = parseResult?.spreadsheetId;

      // fallback: se não veio o ID da função, tenta buscar o mais recente criado
      if (!spreadsheetId) {
        console.warn("⚠️ spreadsheetId não retornado pela função. Buscando manualmente...");

        const { data: spreadsheets, error: fallbackError } = await supabase
          .from("spreadsheets")
          .select("id")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1);

        if (fallbackError || !spreadsheets?.length) {
          toast({
            title: "Erro ao processar",
            description: "Não foi possível encontrar o ID da planilha processada.",
          });
          setLoading(false);
          return null;
        }

        spreadsheetId = spreadsheets[0].id;
      }

      const sheetsQuery = await supabase
        .from("sheets")
        .select("id, sheet_name")
        .eq("spreadsheet_id", spreadsheetId);

      if (sheetsQuery.error) {
        console.error("❌ Erro ao buscar sheets:", sheetsQuery.error);
        toast({
          title: "Erro ao carregar dados",
          description: "Erro ao buscar as abas da planilha.",
        });
        setLoading(false);
        return null;
      }

      const sheets = sheetsQuery.data || [];
      if (sheets.length === 0) {
        toast({
          title: "Aviso",
          description: "Nenhuma aba foi encontrada nesta planilha.",
        });
        setLoading(false);
        return null;
      }

      const sheetIds = sheets.map((s) => s.id);
      const sheetsMap = new Map(sheets.map((s) => [s.id, s.sheet_name]));

      const dataQuery = await supabase
        .from("spreadsheet_data")
        .select("*")
        .in("sheet_id", sheetIds)
        .order("row_index", { ascending: true });

      if (dataQuery.error) {
        console.error("❌ Erro ao buscar dados:", dataQuery.error);
        toast({
          title: "Erro ao carregar dados",
          description: "Erro ao buscar os dados da planilha.",
        });
        setLoading(false);
        return null;
      }

      const data = (dataQuery.data || []) as DatabaseRow[];

      const normalized: SpreadsheetRow[] = data.map((row) => ({
        row_index: row.row_index,
        column_name: row.column_name || "",
        cell_value: row.cell_value || "",
        sheet_id: row.sheet_id,
        sheet_name: sheetsMap.get(row.sheet_id) || "Aba",
        column_index: row.column_index,
        created_at: row.created_at,
        data_type: row.data_type,
      }));

      const generatedCharts = generateChartSet(normalized);
      setCharts(generatedCharts);

      toast({
        title: "Planilha processada com sucesso!",
        description: `${generatedCharts.length} gráficos foram gerados.`,
      });

      return spreadsheetId;
    } catch (err) {
      console.error("❌ Erro inesperado:", err);
      toast({
        title: "Erro inesperado",
        description: "Algo deu errado ao processar a planilha.",
      });
      return null;
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
