import { useState } from "react";
import { FileUpload } from "./FileUpload";
import { ChartGrid } from "./ChartGrid";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { v4 as uuidv4 } from "uuid";

export function Dashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [charts, setCharts] = useState<any[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);

  const handleFileUpload = async (file: File, fileId: string, filePath: string) => {
    if (!user) return;

    setLoading(true);
    setFileName(file.name);

    // Chama a função parse-uploaded-sheet
    const response = await fetch(`${import.meta.env.VITE_SUPABASE_FUNCTION_URL}/parse-uploaded-sheet`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        filePath,
        fileId,
        userId: user.id,
      }),
    });

    const result = await response.json();
    if (!response.ok) {
      console.error("Erro no parsing:", result.error);
      setLoading(false);
      return;
    }

    // Busca os dados processados no Supabase
    const { data, error } = await supabase
      .from("spreadsheet_data")
      .select("*")
      .eq("file_id", fileId)
      .order("row_index", { ascending: true });

    if (error || !data) {
      console.error("Erro ao buscar dados:", error);
      setLoading(false);
      return;
    }

    // Gera os gráficos automaticamente
    const generatedCharts = generateChartSet(data);
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

// Lógica simples de geração automática de gráficos (exemplo)
function generateChartSet(rows: any[]) {
  if (!rows || rows.length === 0) return [];

  const bySheet = new Map<string, any[]>();

  for (const row of rows) {
    if (!bySheet.has(row.sheet_name)) bySheet.set(row.sheet_name, []);
    bySheet.get(row.sheet_name)!.push(row);
  }

  const charts: any[] = [];

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
      const chart = {
        type: "bar",
        title: `${label} (${sheetName})`,
        data: parsedRows.map((r) => ({ name: r[labels[0]], value: Number(r[label]) || 0 })),
      };
      charts.push(chart);
    }
  }

  return charts;
}
