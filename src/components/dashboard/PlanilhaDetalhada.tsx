// src/pages/dashboard/PlanilhaDetalhada.tsx

import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ChartData, generateChartSet } from "@/utils/chartGeneration";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ChartRenderer } from "@/components/ChartRenderer";

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

const PlanilhaDetalhada = () => {
  const location = useLocation();
  const { toast } = useToast();
  const [charts, setCharts] = useState<ChartData[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetNames, setSheetNames] = useState<Record<string, string>>({});

  const searchParams = new URLSearchParams(location.search);
  const spreadsheetId = searchParams.get("id");

  useEffect(() => {
    const fetchData = async () => {
      if (!spreadsheetId) return;

      setLoading(true);

      const { data: sheets, error: sheetsError } = await supabase
        .from("sheets")
        .select("id, sheet_name")
        .eq("spreadsheet_id", spreadsheetId);

      if (sheetsError || !sheets) {
        toast({
          title: "Erro",
          description: "Erro ao buscar abas da planilha.",
        });
        setLoading(false);
        return;
      }

      const sheetMap = Object.fromEntries(sheets.map((s) => [s.id, s.sheet_name]));
      setSheetNames(sheetMap);

      const sheetIds = sheets.map((s) => s.id);

      const { data: rows, error: rowsError } = await supabase
        .from("spreadsheet_data")
        .select("*")
        .in("sheet_id", sheetIds)
        .order("row_index", { ascending: true });

      if (rowsError || !rows) {
        toast({
          title: "Erro",
          description: "Erro ao buscar dados da planilha.",
        });
        setLoading(false);
        return;
      }

      const normalized = rows.map((row: DatabaseRow) => ({
        row_index: row.row_index,
        column_name: row.column_name || "",
        cell_value: row.cell_value || "",
        sheet_id: row.sheet_id,
        sheet_name: sheetMap[row.sheet_id] || "Aba",
        column_index: row.column_index,
        created_at: row.created_at,
        data_type: row.data_type,
      }));

      const charts = generateChartSet(normalized);
      setCharts(charts);
      setLoading(false);
    };

    fetchData();
  }, [spreadsheetId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin w-6 h-6 mr-2" />
        Carregando gráficos da planilha...
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-xl font-bold">Gráficos da Planilha</h2>
      {charts.length === 0 ? (
        <p>Nenhum gráfico foi gerado para esta planilha.</p>
      ) : (
        charts.map((chart, idx) => (
          <ChartRenderer key={idx} chart={chart} />
        ))
      )}
    </div>
  );
};

export default PlanilhaDetalhada;
