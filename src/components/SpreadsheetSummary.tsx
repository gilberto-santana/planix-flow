// src/components/SpreadsheetSummary.tsx

import { Card, CardContent } from "@/components/ui/card";
import { BarChart2, FileText, Layers, Upload } from "lucide-react";

interface SpreadsheetSummaryProps {
  totalSheets: number;
  totalTabs: number;
  totalCharts: number;
  uploadsLast7Days: number;
}

const SummaryItem = ({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) => (
  <Card className="flex items-center gap-4 p-4 shadow">
    <Icon className="w-8 h-8 text-primary" />
    <div>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-sm text-muted-foreground">{label}</div>
    </div>
  </Card>
);

export default function SpreadsheetSummary({
  totalSheets,
  totalTabs,
  totalCharts,
  uploadsLast7Days,
}: SpreadsheetSummaryProps) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
      <SummaryItem
        icon={FileText}
        label="Planilhas carregadas"
        value={totalSheets.toString()}
      />
      <SummaryItem
        icon={Layers}
        label="Abas de planilhas"
        value={totalTabs.toString()}
      />
      <SummaryItem
        icon={BarChart2}
        label="Visualizações criadas"
        value={totalCharts.toString()}
      />
      <SummaryItem
        icon={Upload}
        label="Últimos 7 dias"
        value={uploadsLast7Days.toString()}
      />
    </div>
  );
}
