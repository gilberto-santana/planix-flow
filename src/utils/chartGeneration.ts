// src/utils/chartGeneration.ts

export interface ChartData {
  id?: string;
  type: "bar" | "pie" | "line";
  title: string;
  labels: string[];
  data: number[];
  sheetName?: string;
}

export interface SpreadsheetRow {
  row_index: number;
  column_name: string | null;
  cell_value: string | null;
  sheet_id: string;
  sheet_name: string;
  column_index: number;
  created_at: string;
  data_type: string | null;
}

export function generateChartSet(rows: SpreadsheetRow[]): ChartData[] {
  if (rows.length === 0) return [];

  const groupedBySheet = new Map<string, SpreadsheetRow[]>();
  rows.forEach((row) => {
    if (!groupedBySheet.has(row.sheet_name)) {
      groupedBySheet.set(row.sheet_name, []);
    }
    groupedBySheet.get(row.sheet_name)!.push(row);
  });

  const charts: ChartData[] = [];

  groupedBySheet.forEach((sheetRows, sheetName) => {
    const byRowIndex = new Map<number, Map<string, string | null>>();

    sheetRows.forEach((row) => {
      if (!byRowIndex.has(row.row_index)) {
        byRowIndex.set(row.row_index, new Map());
      }
      byRowIndex.get(row.row_index)!.set(row.column_name || "", row.cell_value);
    });

    const sortedRows = [...byRowIndex.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([, map]) => Object.fromEntries(map));

    if (sortedRows.length < 2) return;

    const headers = Object.keys(sortedRows[0]);
    const dataRows = sortedRows.slice(1);

    // Gerar todos os pares coluna categórica vs valor numérico
    for (let labelKey of headers) {
      for (let valueKey of headers) {
        if (labelKey === valueKey) continue;

        const labels: string[] = [];
        const values: number[] = [];

        for (const row of dataRows) {
          const label = row[labelKey];
          const raw = row[valueKey];
          const value = parseFloat(raw?.toString().replace(",", "."));

          if (
            typeof label === "string" &&
            label.trim() !== "" &&
            !isNaN(value)
          ) {
            labels.push(label.trim());
            values.push(value);
          }
        }

        if (labels.length > 0 && values.length > 0) {
          charts.push({
            type: "bar",
            title: `${sheetName} – ${valueKey} por ${labelKey}`,
            labels,
            data: values,
            sheetName,
          });
        }
      }
    }
  });

  return charts;
}
