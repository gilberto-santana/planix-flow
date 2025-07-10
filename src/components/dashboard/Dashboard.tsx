import { useState } from "react";
import { FileUpload } from "./FileUpload";
import { ChartGrid } from "./ChartGrid";
import { DashboardHeader } from "./DashboardHeader";
import { DashboardStats } from "./DashboardStats";
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

  if (!user) {
    return <p className="text-muted-foreground">Verificando autenticação do usuário...</p>;
  }

  const handleFileUpload = async (file: File, fileId: string, filePath: string) => {
    setLoading(true);
    setFileName(file.name);

    try {
      toast({
        title: "Processando planilha",
        description: `Iniciando o processamento de ${file.name}...`,
      });

      const { data, error } = await supabase.functions.invoke('parse-uploaded-sheet', {
        body: {
          filePath,
          fileId,
          userId: user.id,
        }
      });

      if (error) {
        console.error("Erro no parsing:", error);
        toast({
          title: "Erro no processamento",
          description: "Não foi possível processar a planilha. Tente novamente.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // Query the spreadsheet data with proper typing
      const { data: rawData, error: fetchError } = await supabase
        .from("spreadsheet_data")
        .select(`
          *,
          sheets!inner(
            sheet_name,
            spreadsheet_id
          )
        `)
        .eq("sheets.spreadsheet_id", fileId)
        .order("row_index", { ascending: true });

      if (fetchError || !rawData) {
        console.error("Erro ao buscar dados:", fetchError);
        toast({
          title: "Erro ao carregar dados",
          description: "Não foi possível carregar os dados da planilha.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // Transform the data to match our interface
      const transformedData: SpreadsheetRow[] = rawData.map((row: any) => ({
        row_index: row.row_index,
        column_name: row.column_name || '',
        value: row.cell_value || '',
        sheet_name: row.sheets.sheet_name
      }));

      const generatedCharts = generateChartSet(transformedData);
      setCharts(generatedCharts);

      toast({
        title: "Planilha processada com sucesso!",
        description: `${generatedCharts.length} gráficos foram gerados para ${file.name}.`,
      });
    } catch (err) {
      console.error("Erro inesperado:", err);
      toast({
        title: "Erro inesperado",
        description: "Ocorreu um erro durante o processamento. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader />
      
      <main className="container mx-auto py-6 space-y-6">
        <div className="space-y-2">
          <h2 className="text-2xl font-bold tracking-tight">Bem-vindo ao seu Dashboard</h2>
          <p className="text-muted-foreground">
            Faça upload de planilhas e gere gráficos automáticos dos seus dados.
          </p>
        </div>

        <DashboardStats />

        <div className="space-y-6">
          <FileUpload onFileUpload={handleFileUpload} />
          
          {loading && (
            <div className="flex items-center justify-center p-8">
              <div className="text-center space-y-2">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className="text-muted-foreground">Processando planilha e gerando gráficos...</p>
              </div>
            </div>
          )}
          
          {!loading && charts.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold">Gráficos gerados para: {fileName}</h3>
                <span className="text-sm text-muted-foreground">
                  {charts.length} gráfico{charts.length !== 1 ? 's' : ''} criado{charts.length !== 1 ? 's' : ''}
                </span>
              </div>
              <ChartGrid charts={charts} />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function generateChartSet(rows: SpreadsheetRow[]): ChartData[] {
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
