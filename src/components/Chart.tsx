
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardContent } from '@/components/ui/card';
import { ChartData } from '@/utils/chartGeneration';

interface ChartProps {
  data: ChartData;
}

export const Chart = ({ data }: ChartProps) => {
  const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7f50', '#00C49F', '#FFBB28', '#FF8042'];

  // Transform chart data for recharts
  const chartData = data.data.map(item => ({
    name: item.label,
    value: item.value
  }));

  return (
    <Card className="w-full max-w-4xl mx-auto my-4 shadow-md">
      <CardContent>
        <h2 className="text-lg font-semibold mb-2">{data.title}</h2>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            {data.type === 'bar' ? (
              <BarChart data={chartData}>
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="value" fill="#8884d8" />
              </BarChart>
            ) : (
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
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            )}
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};
