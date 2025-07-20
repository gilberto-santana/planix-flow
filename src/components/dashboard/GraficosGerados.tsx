// src/components/dashboard/GraficosGerados.tsx

import { useCharts } from "@/contexts/ChartsContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartRenderer } from "@/components/charts/ChartRenderer";
import { useFileProcessing } from "@/hooks/useFileProcessing";
import { Loader2 } from "lucide-react";

const GraficosGerados = () => {
  const { charts } = useCharts();
  const { loading } = useFileProcessing();

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="animate-spin mr-2" />
        <span>Gerando gráficos com IA...</span>
      </div>
    );
  }

  if (!charts || charts.length === 0) {
    return (
      <div className="text-center text-muted-foreground mt-8">
        Nenhum gráfico gerado até o momento.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {charts.map((chart, index) => {
        if (!chart || !chart.type || !chart.data) {
          console.warn("Gráfico inválido:", chart);
          return null;
        }

        return (
          <Card key={index} className="mb-4">
            <CardHeader>
              <CardTitle>{chart.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <ChartRenderer chart={chart} />
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default GraficosGerados;
