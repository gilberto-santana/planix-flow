// src/components/ChartRenderer.tsx

import { ChartData } from "@/utils/chartGeneration";
import { Bar, Pie, Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Title,
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Title
);

interface Props {
  chart: ChartData;
}

const ChartRenderer = ({ chart }: Props) => {
  const chartConfig = {
    type: chart.type,
    data: {
      labels: chart.data.map(item => item.label),
      datasets: [
        {
          label: chart.title,
          data: chart.data.map(item => item.value),
          backgroundColor: "rgba(99, 102, 241, 0.6)",
          borderColor: "rgba(99, 102, 241, 1)",
          borderWidth: 1,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: true },
        title: {
          display: true,
          text: chart.title,
        },
      },
    },
  };

  switch (chart.type) {
    case "bar":
      return <Bar {...chartConfig} />;
    case "pie":
      return <Pie {...chartConfig} />;
    case "line":
      return <Line {...chartConfig} />;
    default:
      return <p>Tipo de gráfico não suportado: {chart.type}</p>;
  }
};

export default ChartRenderer;
