
// src/components/dashboard/GraficosGerados.tsx

import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useCharts } from "@/contexts/ChartsContext";
import ChartRenderer from "@/components/panel/ChartRenderer";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { useRef } from "react";

const GraficosGerados = () => {
  const navigate = useNavigate();
  const { charts, fileName } = useCharts();
  const chartsRef = useRef<HTMLDivElement>(null);

  const handleBack = () => {
    navigate("/dashboard/stats?type=home");
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

  if (charts.length === 0) {
    return (
      <div className="p-4 space-y-6">
        <div className="flex justify-between items-center">
          <Button onClick={handleBack}>← Voltar</Button>
        </div>

        <div className="text-center py-16 space-y-4">
          <div className="w-24 h-24 mx-auto bg-muted rounded-full flex items-center justify-center">
            <svg className="w-12 h-12 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h3 className="text-xl font-medium text-muted-foreground">
            Nenhum gráfico gerado
          </h3>
          <p className="text-muted-foreground">
            Faça upload de uma planilha (.csv ou .xlsx) primeiro para gerar gráficos
          </p>
          <Button onClick={() => navigate("/")}>
            Fazer Upload de Planilha
          </Button>
        </div>
      </div>
    );
  }

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

      <div className="space-y-2">
        <h2 className="text-xl font-bold">Gráficos Gerados</h2>
        {fileName && (
          <p className="text-muted-foreground">
            Planilha: <span className="font-medium">{fileName}</span> • {charts.length} gráfico{charts.length !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      <div ref={chartsRef} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {charts.map((chart, i) => (
          <ChartRenderer key={i} chart={chart} />
        ))}
      </div>
    </div>
  );
};

export default GraficosGerados;
