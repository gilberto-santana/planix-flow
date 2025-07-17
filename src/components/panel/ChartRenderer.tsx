import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { ChartData } from "@/utils/chartGeneration";

interface Props {
  chart: ChartData;
}

const ChartRenderer = ({ chart }: Props) => {
  const [insight, setInsight] = useState<string | null>(null);

  useEffect(() => {
    if (!chart?.data || chart.data.length < 2) return;

    const values = chart.data.map((d) => Number(d.value)).filter((v) => !isNaN(v));
    if (values.length === 0) return;

    const total = values.reduce((acc, v) => acc + v, 0);
    const avg = total / values.length;
    const max = Math.max(...values);
    const min = Math.min(...values);

    const first = values[0];
    const last = values[values.length - 1];

    const diff = last - first;
    const percent = ((diff / first) * 100).toFixed(1);

    let msg = "";

    if (diff > 0) msg += `📈 Tendência de alta (${percent}% desde o início).\n`;
    else if (diff < 0) msg += `📉 Tendência de queda (${percent}% desde o início).\n`;
    else msg += "⏸️ Estável ao longo do tempo.\n";

    msg += `🔢 Média: ${avg.toFixed(1)} | Máximo: ${max} | Mínimo: ${min}`;

    setInsight(msg);
  }, [chart]);

  return (
    <Card className="p-2">
      <CardContent>
        <h3 className="font-semibold text-sm mb-2">{chart.title}</h3>

        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chart.data}>
            <XAxis dataKey="label" hide={chart.data.length > 30} />
            <YAxis />
            <Tooltip />
            <Bar dataKey="value" fill="#8884d8" />
          </BarChart>
        </ResponsiveContainer>

        {insight && (
          <div className="mt-3 text-xs whitespace-pre-wrap bg-muted p-2 rounded">
            {insight}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ChartRenderer;
