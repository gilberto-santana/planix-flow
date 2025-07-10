import { useState } from "react";
import { DashboardHeader } from "./DashboardHeader";
import { DashboardStats } from "./DashboardStats";
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

    try {
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

      // Simplified query with explicit typing to avoid deep type instantiation
      const query = supabase
        .from("spreadsheet_data")
        .select("row_index, column_name, cell_value, sheet_id, id, column_index, created_at, data_type")
        .eq("file_id", fileId)
        .order("row_index", { ascending: true });

      const { data, error } = await query;

      if (error || !data) {
        console.error("Erro ao buscar dados:", error);
        toast({ title: "Erro ao carregar dados", description: "Erro ao buscar os dados da planilha." });
        setLoading(false);
        return;
      }

      // Get sheet names in a separate query - fixed column name
      const sheetIds = [...new Set(data.map(row => row.sheet_id))];
      const { data: sheetsData, error: sheetsError } = await supabase
        .from("sheets")
        .select("id, sheet_name")
        .in("id", sheetIds);

      if (sheetsError) {
        console.error("Erro ao buscar sheets:", sheetsError);
      }

      const sheetsMap = new Map(sheetsData?.map(sheet => [sheet.id, sheet.sheet_name]) || []);

      const normalized: SpreadsheetRow[] = data.map((row: DatabaseRow) => ({
        row_index: row.row_index,
        column_name: row.column_name || "",
        value: row.cell_value || "",
        sheet_name: sheetsMap.get(row.sheet_id) || "Aba",
      }));

      const generatedCharts = generateChartSet(normalized);
      setCharts(generatedCharts);
      setLoading(false);
      
      toast({ 
        title: "Planilha processada com sucesso!", 
        description: `${generatedCharts.length} gráficos foram gerados.` 
      });
    } catch (error) {
      console.error("Erro no processamento:", error);
      toast({ title: "Erro", description: "Erro inesperado durante o processamento." });
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader />
      
      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* Welcome Section */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold gradient-text">
            Bem-vindo ao seu Dashboard
          </h1>
          <p className="text-muted-foreground text-lg">
            Faça upload de suas planilhas e visualize dados através de gráficos interativos
          </p>
        </div>

        {/* Statistics Cards */}
        <DashboardStats />

        {/* File Upload Section */}
        <div className="space-y-4">
          <h2 className="text-2xl font-semibold">Upload de Planilha</h2>
          <FileUpload onFileUpload={handleFileUpload} />
        </div>

        {/* Loading State */}
        {loading && (
          <div className="text-center py-8">
            <div className="animate-pulse space-y-4">
              <div className="w-16 h-16 bg-primary/20 rounded-full mx-auto animate-bounce"></div>
              <p className="text-muted-foreground">Processando planilha e gerando gráficos...</p>
            </div>
          </div>
        )}

        {/* Charts Section */}
        {!loading && charts.length > 0 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold">
                Gráficos gerados para: <span className="text-primary">{fileName}</span>
              </h2>
              <div className="text-sm text-muted-foreground">
                {charts.length} gráfico{charts.length !== 1 ? 's' : ''} gerado{charts.length !== 1 ? 's' : ''}
              </div>
            </div>
            <ChartGrid charts={charts} />
          </div>
        )}

        {/* Empty State */}
        {!loading && charts.length === 0 && !fileName && (
          <div className="text-center py-16 space-y-4">
            <div className="w-24 h-24 mx-auto bg-muted rounded-full flex items-center justify-center">
              <svg className="w-12 h-12 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h3 className="text-xl font-medium text-muted-foreground">
              Nenhuma planilha processada ainda
            </h3>
            <p className="text-muted-foreground">
              Faça upload de uma planilha (.csv ou .xlsx) para começar a gerar gráficos
            </p>
          </div>
        )}
      </main>
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
