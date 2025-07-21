
// src/components/dashboard/GraficosGerados.tsx

import { useFileProcessing } from "@/hooks/useFileProcessing";
import { Card } from "@/components/ui/card";
import { Bar, Line, Pie } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
  PointElement,
  LineElement,
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
  PointElement,
  LineElement
);

export default function GraficosGerados() {
  const { charts, loading } = useFileProcessing();

  if (loading) {
    return <div className="p-4">Carregando gráficos...</div>;
  }

  if (!charts || charts.length === 0) {
    return <div className="p-4">Nenhum gráfico gerado até o momento.</div>;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 p-4">
      {charts.map((chart, index) => {
        const labels = chart.data.map((d) => d.label);
        const values = chart.data.map((d) => d.value);

        const data = {
          labels,
          datasets: [
            {
              label: chart.title,
              data: values,
              backgroundColor: "rgba(75,192,192,0.4)",
              borderColor: "rgba(75,192,192,1)",
              borderWidth: 1,
            },
          ],
        };

        const options = {
          responsive: true,
          plugins: {
            legend: { display: true },
            title: { display: true, text: chart.title },
          },
        };

        return (
          <Card key={index} className="p-4">
            {chart.type === "bar" && <Bar data={data} options={options} />}
            {chart.type === "line" && <Line data={data} options={options} />}
            {chart.type === "pie" && <Pie data={data} options={options} />}
          </Card>
        );
      })}
    </div>
  );
}
