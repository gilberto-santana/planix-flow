
import { ChartGrid } from "./ChartGrid";
import { ChartData } from "@/utils/chartGeneration";

interface ChartsSectionProps {
  charts: ChartData[];
  fileName: string | null;
  loading: boolean;
}

export function ChartsSection({ charts, fileName, loading }: ChartsSectionProps) {
  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-pulse space-y-4">
          <div className="w-16 h-16 bg-primary/20 rounded-full mx-auto animate-bounce"></div>
          <p className="text-muted-foreground">Processando planilha e gerando gráficos...</p>
        </div>
      </div>
    );
  }

  if (charts.length > 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold">
            Gráficos gerados para: <span className="text-primary">{fileName}</span>
          </h2>
          <div className="text-sm text-muted-foreground">
            {charts.length} gráfico{charts.length !== 1 ? 's' : ''} gerado{charts.length !== 1 ? 's' : ''}
          </div>
        </div>
        <ChartGrid charts={charts} />
      </div>
    );
  }

  if (!fileName) {
    return (
      <div className="text-center py-16 space-y-4">
        <div className="w-24 h-24 mx-auto bg-muted rounded-full flex items-center justify-center">
          <svg className="w-12 h-12 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
        <h3 className="text-xl font-medium text-muted-foreground">
          Nenhuma planilha processada ainda
        </h3>
        <p className="text-muted-foreground">
          Faça upload de uma planilha (.csv ou .xlsx) para começar a gerar gráficos
        </p>
      </div>
    );
  }

  return null;
}
