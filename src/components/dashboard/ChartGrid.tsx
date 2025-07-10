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

interface ChartGridProps {
  charts: {
    title: string;
    type: "bar" | "line" | "pie";
    data: { name: string; value: number }[];
  }[];
}

export const ChartGrid = ({ charts }: ChartGridProps) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
      {charts.map((chart, index) => (
        <Card key={index} className="p-4">
          <CardHeader>
            <CardTitle>{chart.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              {chart.type === "bar" && (
                <BarChart data={chart.data}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" />
                </BarChart>
              )}
              {chart.type === "line" && (
                <LineChart data={chart.data}>
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
                    data={chart.data}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label
                  >
                    {chart.data.map((_, i) => (
                      <Cell key={`cell-${i}`} />
                    ))}
                  </Pie>
                </PieChart>
              )}
            </ResponsiveContainer>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
