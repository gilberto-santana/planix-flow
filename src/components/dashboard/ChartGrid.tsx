
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ResponsiveContainer,
  BarChart,
  LineChart,
  PieChart,
  Bar,
  Line,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { ChartData } from "@/contexts/ChartsContext";

interface ChartGridProps {
  charts: ChartData[];
}

export const ChartGrid = ({ charts }: ChartGridProps) => {
  console.log("📊 ChartGrid - Gráficos recebidos:", charts);

  if (!charts || charts.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Nenhum gráfico disponível
      </div>
    );
  }

  const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7f50', '#00C49F', '#FFBB28', '#FF8042'];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
      {charts.map((chart, index) => {
        console.log(`📈 ChartGrid - Renderizando gráfico ${index}:`, chart);

        if (!chart || !chart.data || !Array.isArray(chart.data) || chart.data.length === 0) {
          console.warn(`⚠️ ChartGrid - Gráfico ${index} com dados inválidos:`, chart);
          return (
            <Card key={index} className="p-4">
              <CardHeader>
                <CardTitle>{chart?.title || `Gráfico ${index + 1}`}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                  Dados indisponíveis
                </div>
              </CardContent>
            </Card>
          );
        }

        // Transform chart data for recharts
        const chartData = chart.data.map(item => ({
          name: item.label,
          value: Number(item.value) || 0
        }));

        console.log(`📊 ChartGrid - Dados transformados para gráfico ${index}:`, chartData);

        return (
          <Card key={index} className="p-4">
            <CardHeader>
              <CardTitle>{chart.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <>
                  {chart.type === "bar" && (
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="name" 
                        tick={{ fontSize: 12 }}
                        interval={chartData.length > 8 ? 'preserveStartEnd' : 0}
                      />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Bar dataKey="value" fill="#8884d8" />
                    </BarChart>
                  )}
                  {chart.type === "line" && (
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="name" 
                        tick={{ fontSize: 12 }}
                        interval={chartData.length > 8 ? 'preserveStartEnd' : 0}
                      />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Line dataKey="value" stroke="#8884d8" strokeWidth={2} />
                    </LineChart>
                  )}
                  {chart.type === "pie" && (
                    <PieChart>
                      <Tooltip />
                      <Pie
                        data={chartData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      >
                        {chartData.map((_, i) => (
                          <Cell key={`cell-${i}`} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                    </PieChart>
                  )}
                </>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};
