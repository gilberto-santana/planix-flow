// src/hooks/useFileProcessing.ts

import { useState } from "react";
import { useAuth } from "./useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "./use-toast";
import { useNavigate } from "react-router-dom";
import { ChartData } from "@/utils/chartGeneration";

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
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [charts, setCharts] = useState<ChartData[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);

  const handleFileUpload = async (file: File, fileId: string, fileUrl: string) => {
    if (!user) return;

    setLoading(true);
    setFileName(file.name);

    const { name, size, type } = file;
    const filePath = `${fileId}.${name.split(".").pop()}`;

    try {
      const { data: parseResult } = await supabase.functions.invoke("parse-uploaded-sheet", {
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

      let spreadsheetId = parseResult?.spreadsheetId;

      if (!spreadsheetId) {
        const { data: spreadsheets } = await supabase
          .from("spreadsheets")
          .select("id")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1);

        if (!spreadsheets?.length) {
          toast({ title: "Erro", description: "ID da planilha não encontrado." });
          setLoading(false);
          return;
        }

        spreadsheetId = spreadsheets[0].id;
      }

      // ✅ Chamada Gemini para gerar gráficos AI
      const { data: aiResult, error: aiError } = await supabase.functions.invoke("generate-ai-charts", {
        body: JSON.stringify({ spreadsheetId }),
      });

      if (aiError) {
        console.error("Erro Gemini:", aiError);
      } else {
        setCharts(aiResult?.charts ?? []);
      }

      // ✅ Atualiza status da planilha
      await supabase
        .from("spreadsheets")
        .update({ status: "processed" })
        .eq("id", spreadsheetId);

      toast({
        title: "Planilha processada com sucesso!",
        description: `Os dados foram analisados.`,
      });

      navigate(`/dashboard/stats?type=sheet&id=${spreadsheetId}`);
    } catch (err) {
      console.error("Erro ao processar:", err);
      toast({ title: "Erro", description: "Falha ao processar a planilha." });
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
