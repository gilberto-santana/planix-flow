import { useEffect, useState, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ChartData } from "@/utils/chartGeneration";
import ChartRenderer from "@/components/panel/ChartRenderer";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

const DashboardAnalitico = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [charts, setCharts] = useState<ChartData[]>([]);
  const [recommendations, setRecommendations] = useState<string[]>([]);
  const chartsRef = useRef<HTMLDivElement>(null);

  const searchParams = new URLSearchParams(location.search);
  const spreadsheetId = searchParams.get("id");

  const handleBack = () => {
    navigate("/dashboard/stats?type=home");
  };

  const fetchChartData = async () => {
    try {
      const { data, error } = await supabase
        .from("spreadsheet_data")
        .select("*")
        .eq("spreadsheet_id", spreadsheetId);

      if (error) throw error;

      const response = await fetch("/api/chart-generator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: data }),
      });

      const result = await response.json();
      setCharts(result);
      generateRecommendations(data);
    } catch (err) {
      console.error(err);
      toast({ title: "Erro", description: "Erro ao buscar dados para análise." });
    }
  };

  const generateRecommendations = (rows: any[]) => {
    const recs: string[] = [];
    const colunas = [...new Set(rows.map((r) => r.column_name))];
    const colunasLower = colunas.map((c) => c?.toLowerCase());

    if (colunasLower.includes("data") || colunasLower.includes("mês")) {
      recs.push("✅ Os dados possuem colunas de tempo. Você pode acompanhar a evolução ao longo dos meses.");
    }
    if (colunasLower.includes("quantidade") || colunasLower.includes("estoque")) {
      recs.push("📦 A planilha tem controle de quantidade. Avalie itens com baixa saída ou excesso de estoque.");
    }
    if (colunasLower.includes("valor") || colunasLower.includes("preço")) {
      recs.push("💰 Existem colunas financeiras. Avalie o faturamento e os produtos mais rentáveis.");
    }
    if (colunasLower.includes("categoria") || colunasLower.includes("produto")) {
      recs.push("📊 A presença de categorias permite comparar desempenho entre grupos.");
    }
    if (colunasLower.includes("rede social") || colunasLower.includes("postagem")) {
      recs.push("📣 Identificamos colunas de mídia. Avalie o engajamento das postagens.");
    }

    setRecommendations(recs);
  };

  const downloadAsImage = async () => {
    if (!chartsRef.current) return;
    const canvas = await html2canvas(chartsRef.current);
    const link = document.createElement("a");
    link.download = "dashboard.png";
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
    pdf.save("dashboard.pdf");
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

      <h2 className="text-xl font-bold">Análise Automática</h2>

      <div className="bg-muted text-muted-foreground p-4 rounded-xl space-y-2">
        {recommendations.length === 0 && <p>🤖 Nenhuma sugestão gerada.</p>}
        {recommendations.map((rec, i) => (
          <p key={i}>👉 {rec}</p>
        ))}
      </div>

      <div ref={chartsRef} className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
        {charts.map((chart, i) => (
          <ChartRenderer key={i} chart={chart} />
        ))}
      </div>
    </div>
  );
};

export default DashboardAnalitico;
