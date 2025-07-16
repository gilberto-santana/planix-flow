// src/components/dashboard/GraficosGerados.tsx

import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ChartData } from "@/utils/chartGeneration";
import ChartRenderer from "@/components/panel/ChartRenderer";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

const GraficosGerados = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [charts, setCharts] = useState<ChartData[]>([]);
  const chartsRef = useRef<HTMLDivElement>(null);

  const handleBack = () => {
    navigate("/dashboard/stats?type=home");
  };

  const fetchChartData = async () => {
    try {
      const { data, error } = await supabase.from("spreadsheet_data").select("*");
      if (error) throw error;

      const response = await fetch("/api/chart-generator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: data }),
      });

      const result = await response.json();
      setCharts(result);
    } catch (err) {
      console.error(err);
      toast({ title: "Erro", description: "Erro ao buscar dados para gráficos." });
    }
  };

  const downloadAsImage = async () => {
    if (!chartsRef.current) return;
    const canvas = await html2canvas(chartsRef.current);
    const link = document.createElement("a");
    link.download = "graficos.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  const downloadAsPDF = async () => {
    if (!chartsRef.current) return;
    const canvas = await html2canvas(chartsRef.current);
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF();
    const imgProps = pdf.getImageProperties(imgData);
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
    pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
    pdf.save("graficos.pdf");
  };

  useEffect(() => {
    fetchChartData();
  }, []);

  return (
    <div className="p-4 space-y-6">
      <div className="flex justify-between items-center">
        <Button onClick={handleBack}>← Voltar</Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={downloadAsImage}>
            Baixar como Imagem
          </Button>
          <Button variant="outline" onClick={downloadAsPDF}>
            Baixar como PDF
          </Button>
        </div>
      </div>

      <h2 className="text-xl font-bold">Gráficos Gerados</h2>

      <div ref={chartsRef} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {charts.map((chart, i) => (
          <ChartRenderer key={i} chart={chart} />
        ))}
      </div>
    </div>
  );
};

export default GraficosGerados;
