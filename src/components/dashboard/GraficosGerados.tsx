// src/components/dashboard/GraficosGerados.tsx

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ChartData, generateChartSet } from "@/utils/chartGeneration";
import { SheetRow } from "@/types/ChartData";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

const GraficosGerados = () => {
  const navigate = useNavigate();
  const [charts, setCharts] = useState<ChartData[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    const { data, error } = await supabase
      .from("spreadsheet_data")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) {
      const parsed = data as SheetRow[];
      const chartSet = generateChartSet(parsed);
      setCharts(chartSet);
    }

    setLoading(false);
  };

  const handleBack = () => {
    navigate("/dashboard/stats?type=home");
  };

  const handlePrint = () => {
    window.print();
  };

  useEffect(() => {
    fetchData();
  }, []);

  const colors = ["#8884d8", "#82ca9d", "#ffc658", "#ff8042", "#00C49F", "#FFBB28"];

  return (
    <div className="p-4 space-y-6">
      <div className="flex justify-between items-center">
        <Button onClick={handleBack}>← Voltar</Button>
        <div className="space-x-2">
          <Button variant="outline" onClick={handlePrint}>Imprimir</Button>
        </div>
      </div>

      {loading ? (
        <p>Carregando gráficos...</p>
      ) : charts.length === 0 ? (
        <p className="text-muted-foreground">Nenhum gráfico gerado ainda.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {charts.map((chart, i) => (
            <div key={i} className="border rounded-lg p-4 shadow">
              <h3 className="text-lg font-semibold mb-2">{chart.title}</h3>
              <ResponsiveContainer width="100%" height={300}>
                {chart.type === "pie" ? (
                  <PieChart>
                    <Pie data={chart.data} dataKey="value" nameKey="name" outerRadius={100}>
                      {chart.data.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                ) : (
                  <BarChart data={chart.data}>
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" fill="#8884d8" />
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default GraficosGerados;
