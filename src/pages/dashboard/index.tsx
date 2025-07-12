import React from "react";
import { FileUpload } from "@/components/FileUpload";
import { useFileProcessing } from "@/hooks/useFileProcessing";
import { Card, CardContent } from "@/components/ui/card";
import { BarChart, PieChart } from "lucide-react";
import { ChartData } from "@/utils/chartGeneration";
import { Chart } from "@/components/Chart";

const Dashboard = () => {
  const { charts, loading, fileName } = useFileProcessing();

  return (
    <div className="p-6 space-y-8">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      <FileUpload />

      {loading && <p className="text-muted-foreground">Processando planilha...</p>}

      {fileName && !loading && (
        <div>
          <h2 className="text-lg font-semibold mt-4">Gráficos gerados a partir de: <span className="font-mono">{fileName}</span></h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-4">
            {charts.length > 0 ? (
              charts.map((chart: ChartData, index: number) => (
                <Card key={index}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      {chart.type === "bar" ? <BarChart className="w-4 h-4" /> : <PieChart className="w-4 h-4" />}
                      <span className="text-sm font-medium text-muted-foreground">
                        {chart.title}
                      </span>
                    </div>
                    <Chart chart={chart} />
                  </CardContent>
                </Card>
              ))
            ) : (
              <p className="text-muted-foreground">Nenhum gráfico gerado.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
