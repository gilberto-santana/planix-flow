import { useCharts } from "@/contexts/ChartsContext";
import { Card } from "@/components/ui/card";
import { Bar, Doughnut, Pie, Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  Title,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  ArcElement,
  BarElement,
  PointElement,
  LineElement,
} from "chart.js";

ChartJS.register(
  Title,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  ArcElement,
  BarElement,
  PointElement,
  LineElement
);

const GraficosGerados = () => {
  const { charts } = useCharts();

  if (!charts || charts.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-12">
        Nenhum gráfico gerado ainda.
      </div>
    );
  }

  const renderChart = (chart: any, index: number) => {
    const labels = chart.data.map((d: any) => d.label);
    const values = chart.data.map((d: any) => d.value);

    const data = {
      labels,
      datasets: [
        {
          label: chart.title,
          data: values,
          backgroundColor: [
            "rgba(75, 192, 192, 0.5)",
            "rgba(255, 99, 132, 0.5)",
            "rgba(255, 205, 86, 0.5)",
            "rgba(54, 162, 235, 0.5)",
            "rgba(153, 102, 255, 0.5)",
            "rgba(201, 203, 207, 0.5)",
          ],
          borderColor: "rgba(0,0,0,0.1)",
          borderWidth: 1,
        },
      ],
    };

    const options = {
      responsive: true,
      plugins: {
        legend: { display: true, position: "top" as const },
        title: { display: true, text: chart.title },
      },
    };

    const type = chart.type || "bar";

    return (
      <Card key={index} className="p-4 my-4">
        {type === "bar" && <Bar data={data} options={options} />}
        {type === "doughnut" && <Doughnut data={data} options={options} />}
        {type === "pie" && <Pie data={data} options={options} />}
        {type === "line" && <Line data={data} options={options} />}
      </Card>
    );
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <h2 className="text-xl font-semibold mb-4">Gráficos gerados pela IA</h2>
      {charts.map((chart, index) => renderChart(chart, index))}
    </div>
  );
};

export default GraficosGerados;
