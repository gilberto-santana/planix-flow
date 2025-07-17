
// src/pages/dashboard/PlanilhaDetalhada.tsx

import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartData } from "@/utils/chartGeneration";
import { Chart } from "@/components/ui/chart";

const PlanilhaDetalhada = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [charts, setCharts] = useState<ChartData[]>([]);
  const [planilhaInfo, setPlanilhaInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const spreadsheetId = searchParams.get("id");

  useEffect(() => {
    if (!user || !spreadsheetId) return;

    const fetchPlanilhaData = async () => {
      try {
        // Buscar informações da planilha
        const { data: spreadsheet } = await supabase
          .from("spreadsheets")
          .select("*")
          .eq("id", spreadsheetId)
          .single();

        setPlanilhaInfo(spreadsheet);

        // Buscar dados para gráficos
        const { data } = await supabase
          .from("spreadsheet_data")
          .select(`
            *,
            sheets!inner(
              sheet_name,
              spreadsheets!inner(
                file_name
              )
            )
          `)
          .eq("sheets.spreadsheet_id", spreadsheetId);

        if (data) {
          // Transform the database data
          const transformedData = data.map(item => ({
            cell_value: item.cell_value || '',
            column_index: item.column_index,
            column_name: item.column_name || '',
            row_index: item.row_index,
            sheet_name: (item.sheets as any)?.sheet_name || '',
            file_name: (item.sheets as any)?.spreadsheets?.file_name || '',
            data_type: item.data_type || 'string',
            sheet_id: item.sheet_id,
            created_at: item.created_at
          }));

          // Generate charts
          const chartModule = await import("@/utils/chartGeneration");
          const generatedCharts = chartModule.generateChartSet(transformedData);
          setCharts(generatedCharts);
        }
      } catch (error) {
        console.error("Erro ao carregar dados da planilha:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchPlanilhaData();
  }, [user, spreadsheetId]);

  const handleBack = () => {
    navigate("/dashboard/stats?type=home");
  };

  if (loading) {
    return (
      <div className="p-4">
        <div className="text-center">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <Button onClick={handleBack}>← Voltar</Button>
      </div>

      {planilhaInfo && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Detalhes da Planilha</CardTitle>
          </CardHeader>
          <CardContent>
            <p><strong>Nome:</strong> {planilhaInfo.file_name}</p>
            <p><strong>Data de Upload:</strong> {new Date(planilhaInfo.created_at).toLocaleDateString()}</p>
            <p><strong>Status:</strong> {planilhaInfo.processing_status}</p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        <h2 className="text-xl font-bold">Gráficos Gerados ({charts.length})</h2>
        
        {charts.length === 0 ? (
          <p className="text-muted-foreground">Nenhum gráfico foi gerado para esta planilha.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {charts.map((chart, index) => (
              <div key={index}>
                <h3 className="text-lg font-semibold mb-2">{chart.title}</h3>
                <Chart chart={chart} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PlanilhaDetalhada;
