import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';

interface ChartData {
  type: 'bar' | 'line' | 'pie';
  title: string;
  data: any[];
}

interface ChartGridProps {
  charts: ChartData[];
}

const COLORS = [
  'hsl(220 100% 60%)',  // Primary
  'hsl(280 100% 70%)',  // Secondary
  'hsl(190 100% 60%)',  // Accent
  'hsl(120 100% 50%)',  // Success
  'hsl(30 100% 60%)',   // Warning
  'hsl(0 100% 60%)',    // Destructive
];

export function ChartGrid({ charts }: ChartGridProps) {
  const renderChart = (chart: ChartData, index: number) => {
    const baseProps = {
      data: chart.data,
      margin: { top: 5, right: 30, left: 20, bottom: 5 }
    };

    switch (chart.type) {
      case 'bar':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart {...baseProps}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis 
                dataKey="name" 
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
              />
              <YAxis 
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  boxShadow: 'var(--shadow-glow)'
                }}
              />
              <Bar 
                dataKey="value" 
                fill={COLORS[index % COLORS.length]}
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        );

      case 'line':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart {...baseProps}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis 
                dataKey="name" 
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
              />
              <YAxis 
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  boxShadow: 'var(--shadow-glow)'
                }}
              />
              <Line 
                type="monotone" 
                dataKey="value" 
                stroke={COLORS[index % COLORS.length]}
                strokeWidth={3}
                dot={{ fill: COLORS[index % COLORS.length], strokeWidth: 2, r: 6 }}
                activeDot={{ r: 8, stroke: COLORS[index % COLORS.length], strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        );

      case 'pie':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={chart.data}
                cx="50%"
                cy="50%"
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              >
                {chart.data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  boxShadow: 'var(--shadow-glow)'
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        );

      default:
        return null;
    }
  };

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
      {charts.map((chart, index) => (
        <Card 
          key={index} 
          className="glass glow-primary animate-fade-in animate-float"
          style={{ 
            animationDelay: `${index * 0.1}s`,
            animationDuration: `${6 + index}s`
          }}
        >
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: COLORS[index % COLORS.length] }}
              />
              {chart.title}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {renderChart(chart, index)}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}