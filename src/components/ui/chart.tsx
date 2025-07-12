import { Card, CardContent } from "@/components/ui/card"
import { BarChart, Bar, XAxis, YAxis, PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts"
import { ChartData } from "@/utils/chartGeneration"

interface ChartProps {
  chart: ChartData
}

export const Chart = ({ chart }: ChartProps) => {
  const COLORS = ["#8884d8", "#82ca9d", "#ffc658", "#ff7f50", "#a1cfff", "#ffb6b9"]

  if (chart.type === "pie") {
    return (
      <Card className="w-full max-w-[600px]">
        <CardContent className="h-[300px] pt-6">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chart.data}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={100}
                label
              >
                {chart.data.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    )
  }

  if (chart.type === "bar") {
    return (
      <Card className="w-full max-w-[600px]">
        <CardContent className="h-[300px] pt-6">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chart.data}>
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="value" fill="#8884d8" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    )
  }

  return null
}
