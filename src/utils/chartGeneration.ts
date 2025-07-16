
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

    const header = sortedRows[0];
    const keys = Object.keys(header);
    const chartsPerSheet: ChartData[] = [];

    for (let i = 1; i < keys.length; i++) {
      const labelKey = keys[0];
      const valueKey = keys[i];

      const labels: string[] = [];
      const data: number[] = [];

      for (let j = 1; j < sortedRows.length; j++) {
        const row = sortedRows[j];
        const label = row[labelKey];
        const value = parseFloat(row[valueKey]);

        if (label && !isNaN(value)) {
          labels.push(label);
          data.push(value);
        }
      }

      if (labels.length && data.length) {
        chartsPerSheet.push({
          title: `${sheetName} - ${valueKey}`,
          labels,
          data,
          type: "bar",
          sheetName,
        });
      }
    }

    charts.push(...chartsPerSheet);
  });

  return charts;
}
