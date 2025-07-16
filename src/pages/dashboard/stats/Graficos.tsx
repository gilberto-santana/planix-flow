// src/pages/dashboard/stats/Graficos.tsx

import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

import { supabase } from "@/integrations/supabase/client";
import { ChartData } from "@/utils/chartGeneration";
import ChartRenderer from "@/components/ChartRenderer";

const GraficosPage = () => {
  const [charts, setCharts] = useState<ChartData[]>([]);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchCharts = async () => {
      const { data, error } = await supabase
        .from("chart_data")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Erro ao buscar gráficos:", error.message);
      } else {
        setCharts(data || []);
      }

      setLoading(false);
    };

    fetchCharts();
  }, []);

  const handleExportImage = async () => {
    if (!containerRef.current) return;
    const canvas = await html2canvas(containerRef.current);
    const link = document.createElement("a");
    link.download = "graficos.png";
    link.href = canvas.toDataURL();
    link.click();
  };

  const handleExportPDF = async () => {
    if (!containerRef.current) return;
    const canvas = await html2canvas(containerRef.current);
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "px",
      format: [canvas.width, canvas.height],
    });
    pdf.addImage(imgData, "PNG", 0, 0);
    pdf.save("graficos.pdf");
  };

  if (loading) return <p className="p-4">Carregando gráficos...</p>;

  return (
    <div className="p-4 space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => navigate(-1)}>← Voltar</Button>
        <Button variant="outline" onClick={handleExportImage}>Salvar como Imagem</Button>
        <Button variant="outline" onClick={handleExportPDF}>Salvar como PDF</Button>
      </div>

      <div ref={containerRef} className="grid gap-6 mt-6">
        {charts.length === 0 ? (
          <p>Nenhum gráfico gerado até o momento.</p>
        ) : (
          charts.map((chart, index) => (
            <ChartRenderer key={index} chart={chart} />
          ))
        )}
      </div>
    </div>
  );
};

export default GraficosPage;
