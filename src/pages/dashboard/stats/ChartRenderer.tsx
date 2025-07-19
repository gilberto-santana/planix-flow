
import { ChartData } from "@/contexts/ChartsContext";
import { Card, CardContent } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";

interface Props {
  chart: ChartData;
}

const ChartRenderer = ({ chart }: Props) => {
  console.log("📊 Stats ChartRenderer - Dados recebidos:", chart);

  if (!chart || !chart.data || !Array.isArray(chart.data) || chart.data.length === 0) {
    console.warn("⚠️ Stats ChartRenderer - Dados inválidos:", chart);
    return (
      <Card className="p-4">
        <CardContent>
          <h3 className="font-semibold text-sm mb-2">{chart?.title || "Gráfico"}</h3>
          <div className="h-[200px] flex items-center justify-center text-muted-foreground">
            Dados indisponíveis
          </div>
        </CardContent>
      </Card>
    );
  }

  // Transform data for recharts format
  const chartData = chart.data.map(item => ({
    name: item.label,
    value: Number(item.value) || 0
  }));

  console.log("📈 Stats ChartRenderer - Dados transformados:", chartData);

  const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7f50', '#00C49F', '#FFBB28', '#FF8042'];

  return (
    <Card className="p-4">
      <CardContent>
        <h3 className="font-semibold text-lg mb-4">{chart.title}</h3>

        <ResponsiveContainer width="100%" height={300}>
          {chart.type === "bar" && (
            <BarChart data={chartData}>
              <XAxis 
                dataKey="name" 
                tick={{ fontSize: 12 }}
                interval={chartData.length > 10 ? 'preserveStartEnd' : 0}
              />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="value" fill="#8884d8" />
            </BarChart>
          )}
          
          {chart.type === "line" && (
            <LineChart data={chartData}>
              <XAxis 
                dataKey="name" 
                tick={{ fontSize: 12 }}
                interval={chartData.length > 10 ? 'preserveStartEnd' : 0}
              />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Line type="monotone" dataKey="value" stroke="#8884d8" strokeWidth={2} />
            </LineChart>
          )}
          
          {chart.type === "pie" && (
            <PieChart>
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={100}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
              >
                {chartData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          )}
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export default ChartRenderer;
