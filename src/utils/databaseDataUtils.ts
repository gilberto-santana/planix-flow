
import { supabase } from "@/integrations/supabase/client";
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

export interface DataLoadResult {
  success: boolean;
  charts?: ChartData[];
  error?: string;
  sheetsCount?: number;
}

export async function loadAndGenerateCharts(
  fileId: string,
  maxWaitTime: number = 10000
): Promise<DataLoadResult> {
  console.log("✅ Processamento concluído, aguardando consistência do banco...");

  let waitTime = 1000; // Start with 1 second
  let totalWaited = 0;

  while (totalWaited < maxWaitTime) {
    await new Promise(resolve => setTimeout(resolve, waitTime));
    totalWaited += waitTime;

    // Query the sheets data
    console.log("🔍 Buscando abas da planilha...");
    const sheetsQuery = await supabase
      .from("sheets")
      .select("id, sheet_name")
      .eq("spreadsheet_id", fileId)
      .order("sheet_index", { ascending: true });

    if (sheetsQuery.error) {
      console.error("❌ Erro ao buscar sheets:", sheetsQuery.error);
      
      if (totalWaited >= maxWaitTime) {
        return { success: false, error: "Erro ao buscar as abas da planilha." };
      }
      
      waitTime = Math.min(waitTime * 1.5, 3000); // Exponential backoff, max 3s
      continue;
    }

    const sheets = sheetsQuery.data || [];
    console.log("📄 Abas encontradas:", sheets.length);

    if (sheets.length === 0) {
      if (totalWaited >= maxWaitTime) {
        console.log("⚠️ Nenhuma aba encontrada após esperar");
        return { success: false, error: "Nenhuma aba foi encontrada nesta planilha." };
      }
      
      waitTime = Math.min(waitTime * 1.5, 3000);
      continue;
    }

    // Found sheets, proceed with data loading
    const sheetIds = sheets.map(sheet => sheet.id);

    // Query the spreadsheet data
    console.log("🔍 Buscando dados das células...");
    const dataQuery = await supabase
      .from("spreadsheet_data")
      .select("*")
      .in("sheet_id", sheetIds)
      .order("row_index", { ascending: true })
      .order("column_index", { ascending: true })
      .limit(5000); // Limit to prevent memory issues

    if (dataQuery.error) {
      console.error("❌ Erro ao buscar dados:", dataQuery.error);
      return { success: false, error: "Erro ao buscar os dados da planilha." };
    }

    const data = dataQuery.data as DatabaseRow[];
    console.log("📊 Dados encontrados:", data.length, "células");

    if (data.length === 0) {
      if (totalWaited >= maxWaitTime) {
        console.log("⚠️ Nenhum dado encontrado após esperar");
        return { success: false, error: "Nenhum dado foi encontrado na planilha." };
      }
      
      waitTime = Math.min(waitTime * 1.5, 3000);
      continue;
    }

    // Data found, proceed with chart generation
    const sheetsMap = new Map(sheets.map(sheet => [sheet.id, sheet.sheet_name]));

    // Normalize data for chart generation
    const normalized: SpreadsheetRow[] = data.map((row: DatabaseRow) => ({
      row_index: row.row_index,
      column_name: row.column_name || `Coluna ${row.column_index + 1}`,
      cell_value: row.cell_value || "",
      sheet_id: row.sheet_id,
      sheet_name: sheetsMap.get(row.sheet_id) || "Aba",
      column_index: row.column_index,
      created_at: row.created_at,
      data_type: row.data_type,
    }));

    console.log("🔄 Dados normalizados:", normalized.length);

    // Generate charts
    const generatedCharts = generateChartSet(normalized);
    console.log("📈 Gráficos gerados:", generatedCharts.length);

    return { 
      success: true, 
      charts: generatedCharts, 
      sheetsCount: sheets.length 
    };
  }

  return { success: false, error: "Timeout aguardando dados do banco" };
}
