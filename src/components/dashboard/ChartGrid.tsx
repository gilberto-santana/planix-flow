
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
  console.log("📊 ChartGrid - Charts received:", {
    chartCount: charts?.length || 0,
    chartTitles: charts?.map(c => c?.title) || []
  });

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
        console.log(`📈 ChartGrid - Rendering chart ${index}:`, {
          title: chart?.title,
          type: chart?.type,
          dataLength: chart?.data?.length,
          sampleData: chart?.data?.slice(0, 2)
        });

        if (!chart || !chart.data || !Array.isArray(chart.data) || chart.data.length === 0) {
          console.warn(`⚠️ ChartGrid - Chart ${index} has invalid data:`, chart);
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

        // Transform chart data for recharts (standardize to use 'name' field)
        const chartData = chart.data.map((item, dataIndex) => {
          const name = item.name || item.label || `Item ${dataIndex + 1}`;
          const value = Number(item.value) || 0;
          
          return { name, value };
        }).filter(item => item.name && (item.value >= 0 || !isNaN(item.value)));

        console.log(`📊 ChartGrid - Chart ${index} processed data:`, {
          originalLength: chart.data.length,
          processedLength: chartData.length,
          processedSample: chartData.slice(0, 2)
        });

        if (chartData.length === 0) {
          console.warn(`⚠️ ChartGrid - Chart ${index} has no valid data after processing`);
          return (
            <Card key={index} className="p-4">
              <CardHeader>
                <CardTitle>{chart.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                  Nenhum dado válido encontrado
                </div>
              </CardContent>
            </Card>
          );
        }

        const renderChart = () => {
          switch (chart.type) {
            case "bar":
              return (
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="name" 
                    tick={{ fontSize: 12 }}
                    interval={chartData.length > 6 ? 'preserveStartEnd' : 0}
                    angle={chartData.length > 4 ? -45 : 0}
                    textAnchor={chartData.length > 4 ? "end" : "middle"}
                    height={chartData.length > 4 ? 60 : 30}
                  />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#8884d8" />
                </BarChart>
              );
            
            case "line":
              return (
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="name" 
                    tick={{ fontSize: 12 }}
                    interval={chartData.length > 6 ? 'preserveStartEnd' : 0}
                    angle={chartData.length > 4 ? -45 : 0}
                    textAnchor={chartData.length > 4 ? "end" : "middle"}
                    height={chartData.length > 4 ? 60 : 30}
                  />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Line dataKey="value" stroke="#8884d8" strokeWidth={2} />
                </LineChart>
              );
            
            case "pie":
              return (
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
              );
            
            default:
              console.warn(`⚠️ Unknown chart type: ${chart.type}`);
              return (
                <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                  Tipo de gráfico não suportado: {chart.type}
                </div>
              );
          }
        };

        return (
          <Card key={index} className="p-4">
            <CardHeader>
              <CardTitle>{chart.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                {renderChart()}
              </ResponsiveContainer>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};
