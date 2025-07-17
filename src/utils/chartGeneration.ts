// src/utils/chartGeneration.ts

export interface ChartData {
  id?: string;
  type: "bar" | "pie" | "line";
  title: string;
  data: { label: string; value: number }[];
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
    const dataRows = sortedRows.slice(1);
    const keys = Object.keys(header);

    for (let i = 0; i < keys.length; i++) {
      for (let j = 0; j < keys.length; j++) {
        if (i === j) continue;

        const labelKey = keys[i];
        const valueKey = keys[j];

        const data: { label: string; value: number }[] = [];

        for (const row of dataRows) {
          const rawLabel = row[labelKey];
          const rawValue = row[valueKey];
          const label = rawLabel?.toString().trim();
          const value = parseFloat(rawValue?.toString().replace(",", "."));

          if (label && !isNaN(value)) {
            data.push({ label, value });
          }
        }

        if (data.length) {
          charts.push({
            type: "bar",
            title: `${sheetName} – ${valueKey} por ${labelKey}`,
            data,
            sheetName,
          });
        }
      }
    }
  });

  return charts;
}
