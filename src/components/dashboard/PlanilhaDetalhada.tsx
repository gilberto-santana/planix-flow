// src/components/dashboard/PlanilhaDetalhada.tsx

import { useEffect, useState, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ChartData } from "@/utils/chartGeneration";
import ChartRenderer from "@/components/panel/ChartRenderer";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

const PlanilhaDetalhada = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [charts, setCharts] = useState<ChartData[]>([]);
  const chartsRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const [diagnostics, setDiagnostics] = useState<string[]>([]);

  const spreadsheetId = new URLSearchParams(location.search).get("id");

  const handleBack = () => {
    navigate("/dashboard/stats?type=home");
  };

  const fetchChartData = async () => {
    if (!spreadsheetId) return;
    setLoading(true);
    try {
      // Get spreadsheet data for AI chart generation
      const { data: sheetData, error: sheetError } = await supabase
        .from("sheets")
        .select("id")
        .eq("spreadsheet_id", spreadsheetId)
        .limit(1);

      if (sheetError || !sheetData?.length) {
        console.error("Erro ao buscar sheet:", sheetError);
        toast({ title: "Nenhuma aba encontrada na planilha", variant: "destructive" });
        setLoading(false);
        return;
      }

      const sheetId = sheetData[0].id;

      const { data, error } = await supabase
        .from("spreadsheet_data")
        .select("*")
        .eq("sheet_id", sheetId);

      if (error) throw error;

      if (!data || data.length === 0) {
        toast({ title: "Nenhum dado encontrado", variant: "destructive" });
        setLoading(false);
        return;
      }

      const rows = data.map((row: any) => ({
        row_index: row.row_index,
        column_index: row.column_index,
        column_name: row.column_name,
        value: row.cell_value,
      }));

      const aiResult = await supabase.functions.invoke("generate-ai-charts", {
        body: { rows }
      });

      if (aiResult.error) {
        console.error("Erro na função de IA:", aiResult.error);
        toast({ title: "Erro ao gerar gráficos com IA", variant: "destructive" });
        setLoading(false);
        return;
      }

      if (!aiResult.data?.charts || aiResult.data.charts.length === 0) {
        console.log("Nenhum gráfico foi gerado pela IA");
        toast({ title: "Nenhum gráfico gerado", description: "A IA não conseguiu gerar gráficos para esta planilha." });
        setCharts([]);
        setLoading(false);
        return;
      }

      setCharts(aiResult.data.charts);

      // No insights for now, just clear diagnostics
      setDiagnostics([]);
    } catch (err) {
      console.error(err);
      toast({ title: "Erro", description: "Erro ao buscar dados para gráficos." });
    } finally {
      setLoading(false);
    }
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
    pdf.save("relatorio-graficos.pdf");
  };

  useEffect(() => {
    fetchChartData();
  }, [spreadsheetId]);

  return (
    <div className="p-4 space-y-6">
      <div className="flex justify-between items-center">
        <Button onClick={handleBack}>← Voltar</Button>
        <Button variant="outline" onClick={downloadAsPDF}>Baixar PDF</Button>
      </div>

      <h2 className="text-2xl font-bold">Detalhes da Planilha</h2>

      {diagnostics.length > 0 && (
        <div className="bg-purple-900 text-purple-100 p-4 rounded-xl">
          <h3 className="font-semibold mb-2">📊 Recomendações Visuais:</h3>
          <ul className="list-disc list-inside space-y-1">
            {diagnostics.map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ul>
        </div>
      )}

      <div ref={chartsRef} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {charts.map((chart, i) => (
          <ChartRenderer key={i} chart={chart} />
        ))}
      </div>
    </div>
  );
};

export default PlanilhaDetalhada;
