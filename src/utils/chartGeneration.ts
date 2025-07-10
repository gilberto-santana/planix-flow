
export interface SpreadsheetRow {
  row_index: number;
  column_name: string;
  value: string;
  sheet_name: string;
}

export interface ChartData {
  title: string;
  type: "bar" | "line" | "pie";
  data: { name: string; value: number }[];
}

export function generateChartSet(rows: SpreadsheetRow[]): ChartData[] {
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
