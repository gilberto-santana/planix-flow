
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
import { ChartData } from "@/utils/chartGeneration";

interface ChartGridProps {
  charts: ChartData[];
}

export const ChartGrid = ({ charts }: ChartGridProps) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
      {charts.map((chart, index) => {
        // Transform chart data for recharts
        const chartData = chart.data.map(item => ({
          name: item.label,
          value: item.value
        }));

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
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="value" />
                    </BarChart>
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
                        label
                      >
                        {chartData.map((_, i) => (
                          <Cell key={`cell-${i}`} />
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
