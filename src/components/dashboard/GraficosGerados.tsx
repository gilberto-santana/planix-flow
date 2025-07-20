// src/components/dashboard/GraficosGerados.tsx

import { useEffect } from "react";
import { useFileProcessing } from "@/hooks/useFileProcessing";
import { ChartRenderer } from "@/components/ChartRenderer";
import { Loader2 } from "lucide-react";

const GraficosGerados = () => {
  const { charts, loading } = useFileProcessing();

  useEffect(() => {
    console.log("📊 GraficosGerados - charts:", charts);
  }, [charts]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-muted-foreground">
        <Loader2 className="w-10 h-10 animate-spin mb-4" />
        Carregando gráficos com inteligência artificial...
      </div>
    );
  }

  if (!charts || charts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-muted-foreground">
        <p>Nenhum gráfico gerado ainda.</p>
        <p className="text-sm text-muted-foreground">Faça o upload de uma planilha para visualizar os gráficos.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 p-4">
      {charts.map((chart, index) => (
        <ChartRenderer key={index} chart={chart} />
      ))}
    </div>
  );
};

export default GraficosGerados;
