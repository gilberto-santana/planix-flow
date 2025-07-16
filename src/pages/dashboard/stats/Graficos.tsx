
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { ChartData } from "@/utils/chartGeneration";
import { Bar, BarChart, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

const Graficos = () => {
  const [charts, setCharts] = useState<ChartData[]>([]);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      const { data, error } = await supabase
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
        .eq("user_id", user.id);

      if (!error && data) {
        // Transform the database data to match SpreadsheetRow interface
        const transformedData = data.map(item => ({
          cell_value: item.cell_value || '',
          column_index: item.column_index,
          column_name: item.column_name || '',
          row_index: item.row_index,
          sheet_name: (item.sheets as any)?.sheet_name || '',
          file_name: (item.sheets as any)?.spreadsheets?.file_name || '',
          data_type: item.data_type || 'string'
        }));

        // @ts-ignore
        const chartModule = await import("@/utils/chartGeneration");
        const charts = chartModule.generateChartSet(transformedData);
        setCharts(charts);
      }
    };

    fetchData();
  }, [user]);

  const handleBack = () => {
    navigate("/dashboard/stats?type=home");
  };

  const handleExport = async () => {
    window.print(); // Exporta como PDF ou imagem via navegador
  };

  return (
    <div className="p-4">
      <div className="flex justify-between mb-4">
        <Button onClick={handleBack}>← Voltar</Button>
        <Button onClick={handleExport}>📄 Exportar</Button>
      </div>

      {charts.length === 0 && (
        <p className="text-muted-foreground text-center">Nenhum gráfico disponível.</p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {charts.map((chart, index) => (
          <Card key={index} className="p-4">
            <h3 className="text-lg font-semibold mb-2">{chart.title}</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                {chart.type === "bar" ? (
                  <BarChart data={chart.labels.map((label, i) => ({ label, value: chart.data[i] }))}>
                    <XAxis dataKey="label" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" />
                  </BarChart>
                ) : chart.type === "pie" ? (
                  <PieChart>
                    <Pie data={chart.labels.map((label, i) => ({ name: label, value: chart.data[i] }))} dataKey="value" label>
                      {chart.labels.map((_, i) => (
                        <Cell key={i} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                ) : null}
              </ResponsiveContainer>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default Graficos;
