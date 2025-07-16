
import { ChartData } from "@/utils/chartGeneration";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ResponsiveContainer,
  BarChart,
  PieChart,
  LineChart,
  Bar,
  Pie,
  Line,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

interface ChartRendererProps {
  chart: ChartData;
}

const ChartRenderer = ({ chart }: ChartRendererProps) => {
  // Transform chart data for recharts
  const chartData = chart.labels.map((label, i) => ({
    name: label,
    value: chart.data[i]
  }));

  const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7f50', '#00C49F', '#FFBB28', '#FF8042'];

  return (
    <Card className="p-4">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">{chart.title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          {chart.type === "bar" && (
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="#8884d8" />
            </BarChart>
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
                label
              >
                {chartData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          )}
          {chart.type === "line" && (
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Line dataKey="value" stroke="#8884d8" strokeWidth={2} />
            </LineChart>
          )}
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export default ChartRenderer;
