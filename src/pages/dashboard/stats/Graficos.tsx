
import { useCharts } from "@/contexts/ChartsContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import ChartRenderer from "./ChartRenderer";

const Graficos = () => {
  const { charts, fileName } = useCharts();
  const navigate = useNavigate();

  console.log("📊 Graficos Page - Estado atual:", { 
    chartsLength: charts.length, 
    fileName,
    sampleChart: charts[0] 
  });

  const handleBack = () => {
    navigate("/dashboard/stats?type=home");
  };

  const handleExport = async () => {
    window.print(); // Exporta como PDF ou imagem via navegador
  };

  if (charts.length === 0) {
    return (
      <div className="p-4">
        <div className="flex justify-between mb-4">
          <Button onClick={handleBack}>← Voltar</Button>
        </div>

        <div className="text-center py-16 space-y-4">
          <div className="w-24 h-24 mx-auto bg-muted rounded-full flex items-center justify-center">
            <svg className="w-12 h-12 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h3 className="text-xl font-medium text-muted-foreground">
            Nenhum gráfico disponível
          </h3>
          <p className="text-muted-foreground">
            Faça upload de uma planilha (.csv ou .xlsx) primeiro para gerar gráficos
          </p>
          <Button onClick={() => navigate("/dashboard/stats?type=home")}>
            Fazer Upload de Planilha
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="flex justify-between mb-4">
        <Button onClick={handleBack}>← Voltar</Button>
        <Button onClick={handleExport}>📄 Exportar</Button>
      </div>

      <div className="space-y-2 mb-6">
        <h2 className="text-xl font-bold">Gráficos Gerados</h2>
        {fileName && (
          <p className="text-muted-foreground">
            Planilha: <span className="font-medium">{fileName}</span> • {charts.length} gráfico{charts.length !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {charts.map((chart, index) => {
          console.log(`📊 Renderizando gráfico ${index + 1}:`, chart);
          return (
            <ChartRenderer key={index} chart={chart} />
          );
        })}
      </div>
    </div>
  );
};

export default Graficos;
