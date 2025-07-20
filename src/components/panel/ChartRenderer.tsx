
import { Card, CardContent } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";
import { ChartData } from "@/contexts/ChartsContext";

interface Props {
  chart: ChartData;
}

const ChartRenderer = ({ chart }: Props) => {
  console.log("📊 ChartRenderer - Chart data received:", {
    title: chart?.title,
    type: chart?.type,
    dataLength: chart?.data?.length,
    sampleData: chart?.data?.slice(0, 2)
  });

  // Validate chart data structure
  if (!chart || !chart.data || !Array.isArray(chart.data) || chart.data.length === 0) {
    console.warn("⚠️ ChartRenderer - Invalid chart data:", chart);
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

  // Transform and validate data for recharts
  const chartData = chart.data.map((item, index) => {
    const name = item.name || item.label || `Item ${index + 1}`;
    const value = Number(item.value) || 0;
    
    console.log(`📈 Data point ${index}:`, { original: item, transformed: { name, value } });
    
    return { name, value };
  }).filter(item => item.name && (item.value >= 0 || !isNaN(item.value)));

  console.log("📊 ChartRenderer - Processed data:", {
    originalLength: chart.data.length,
    processedLength: chartData.length,
    processedData: chartData
  });

  if (chartData.length === 0) {
    console.warn("⚠️ ChartRenderer - No valid data after processing");
    return (
      <Card className="p-4">
        <CardContent>
          <h3 className="font-semibold text-sm mb-2">{chart.title}</h3>
          <div className="h-[200px] flex items-center justify-center text-muted-foreground">
            Nenhum dado válido encontrado
          </div>
        </CardContent>
      </Card>
    );
  }

  const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7f50', '#00C49F', '#FFBB28', '#FF8042'];

  // Render the appropriate chart based on type
  const renderChart = () => {
    switch (chart.type) {
      case "bar":
        return (
          <BarChart data={chartData}>
            <XAxis 
              dataKey="name" 
              tick={{ fontSize: 12 }}
              interval={chartData.length > 8 ? 'preserveStartEnd' : 0}
              angle={chartData.length > 5 ? -45 : 0}
              textAnchor={chartData.length > 5 ? "end" : "middle"}
              height={chartData.length > 5 ? 60 : 30}
            />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Bar dataKey="value" fill="#8884d8" />
          </BarChart>
        );
      
      case "line":
        return (
          <LineChart data={chartData}>
            <XAxis 
              dataKey="name" 
              tick={{ fontSize: 12 }}
              interval={chartData.length > 8 ? 'preserveStartEnd' : 0}
              angle={chartData.length > 5 ? -45 : 0}
              textAnchor={chartData.length > 5 ? "end" : "middle"}
              height={chartData.length > 5 ? 60 : 30}
            />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Line type="monotone" dataKey="value" stroke="#8884d8" strokeWidth={2} />
          </LineChart>
        );
      
      case "pie":
        return (
          <PieChart>
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={80}
              label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
            >
              {chartData.map((_, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        );
      
      default:
        console.warn("⚠️ Unknown chart type:", chart.type);
        return (
          <div className="h-[200px] flex items-center justify-center text-muted-foreground">
            Tipo de gráfico não suportado: {chart.type}
          </div>
        );
    }
  };

  return (
    <Card className="p-4">
      <CardContent>
        <h3 className="font-semibold text-sm mb-2">{chart.title}</h3>
        <ResponsiveContainer width="100%" height={200}>
          {renderChart()}
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export default ChartRenderer;
