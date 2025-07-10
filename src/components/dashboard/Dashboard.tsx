import { useState } from "react";
import { FileUpload } from "./FileUpload";
import { ChartGrid } from "./ChartGrid";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

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

interface SpreadsheetRow {
  row_index: number;
  column_name: string;
  value: string;
  sheet_name: string;
}

interface ChartData {
  title: string;
  type: "bar" | "line" | "pie";
  data: { name: string; value: number }[];
}

export function Dashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [charts, setCharts] = useState<ChartData[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);

  const handleFileUpload = async (file: File, fileId: string, filePath: string) => {
    if (!user) return;

    setLoading(true);
    setFileName(file.name);

    const { data: result, error: invokeError } = await supabase.functions.invoke("parse-uploaded-sheet", {
      body: {
        filePath,
        fileId,
        userId: user.id,
      },
    });

    if (invokeError) {
      console.error("Erro ao invocar função:", invokeError);
      toast({ title: "Erro ao processar", description: "Não foi possível processar a planilha." });
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("spreadsheet_data")
      .select(`
        row_index,
        column_name,
        cell_value,
        sheet_id,
        id,
        column_index,
        created_at,
        data_type,
        sheets ( name )
      `)
      .eq("file_id", fileId)
      .order("row_index", { ascending: true });

    if (error || !data) {
      console.error("Erro ao buscar dados:", error);
      toast({ title: "Erro ao carregar dados", description: "Erro ao buscar os dados da planilha." });
      setLoading(false);
      return;
    }

    const normalized: SpreadsheetRow[] = data.map((row: any) => ({
      row_index: row.row_index,
      column_name: row.column_name || "",
      value: row.cell_value || "",
      sheet_name: row.sheets?.name || "Aba",
    }));

    const generatedCharts = generateChartSet(normalized);
    setCharts(generatedCharts);
    setLoading(false);
  };

  return (
    <div className="p-4 space-y-6">
      <FileUpload onFileUpload={handleFileUpload} />
      {loading && <p className="text-muted-foreground">Processando planilha e gerando gráficos...</p>}
      {!loading && charts.length > 0 && (
        <>
          <h2 className="text-xl font-semibold">Gráficos gerados para: {fileName}</h2>
          <ChartGrid charts={charts} />
        </>
      )}
    </div>
  );
}

function generateChartSet(rows: SpreadsheetRow[]) {
  if (!rows || rows.length === 0) return [];

  const bySheet = new Map<string, SpreadsheetRow[]>();

  for (const row of rows) {
    if (!bySheet.has(row.sheet_name)) bySheet.set(row.sheet_name, []);
    bySheet.get(row.sheet_name)!.push(row);
  }

  const charts: ChartData[] = [];

  for (const [sheetName, sheetRows] of bySheet.entries()) {
    const byRow = new Map<number, Map<string, string>>();

    for (const row of sheetRows) {
      if (!byRow.has(row.row_index)) byRow.set(row.row_index, new Map());
      byRow.get(row.row_index)!.set(row.column_name, row.value);
    }

    const parsedRows = [...byRow.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([, map]) => Object.fromEntries(map));

    if (parsedRows.length < 2) continue;

    const labels = Object.keys(parsedRows[0]).filter((k) => k.toLowerCase() !== "total");
    for (const label of labels) {
      const chart: ChartData = {
        type: "bar",
        title: `${label} (${sheetName})`,
        data: parsedRows.map((r) => ({
          name: r[labels[0]],
          value: Number(r[label]) || 0,
        })),
      };
      charts.push(chart);
    }
  }

  return charts;
}
