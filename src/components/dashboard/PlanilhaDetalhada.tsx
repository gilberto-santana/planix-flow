import { useEffect, useState, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ChartData } from "@/contexts/ChartsContext";
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

  const spreadsheetId = new URLSearchParams(location.search).get("id");

  const handleBack = () => {
    navigate("/dashboard/stats?type=home");
  };

  const fetchChartData = async () => {
    if (!spreadsheetId) return;

    console.log("🔍 Buscando dados da planilha:", spreadsheetId);
    setLoading(true);

    try {
      const { data: sheetData, error: sheetError } = await supabase
        .from("sheets")
        .select("id")
        .eq("spreadsheet_id", spreadsheetId)
        .limit(1);

      if (sheetError || !sheetData?.length) {
        console.error("❌ Nenhuma aba encontrada:", sheetError);
        toast({ title: "Nenhuma aba encontrada", variant: "destructive" });
        setLoading(false);
        return;
      }

      const sheetId = sheetData[0].id;
      console.log("📄 Aba encontrada:", sheetId);

      const { data, error } = await supabase
        .from("spreadsheet_data")
        .select("*")
        .eq("sheet_id", sheetId);

      if (error) {
        console.error("❌ Erro ao buscar dados:", error);
        throw error;
      }

      if (!data || data.length === 0) {
        console.warn("⚠️ Nenhum dado encontrado");
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

      if (!rows.length) {
        console.warn("⚠️ Nenhum dado disponível para enviar à IA");
        toast({ title: "Planilha vazia", description: "Não há dados para gerar gráficos." });
        setCharts([]);
        setLoading(false);
        return;
      }

      const payload = {
        data: rows,
        metadata: {
          spreadsheetId,
          sheetId,
          rowCount: rows.length,
          timestamp: new Date().toISOString()
        }
      };

      console.log("🎯 Chamando Gemini com payload:", payload);

      const aiResult = await supabase.functions.invoke("generate-ai-charts", {
        body: JSON.stringify(payload),
        headers: { "Content-Type": "application/json" }
      });

      console.log("📋 Resposta da IA:", aiResult);

      if (aiResult.error) {
        console.error("❌ Erro da função IA:", aiResult.error);
        toast({ title: "Erro ao gerar gráficos", variant: "destructive" });
        setLoading(false);
        return;
      }

      if (!aiResult.data?.chartConfig || !Array.isArray(aiResult.data.chartConfig)) {
        toast({ title: "Nenhum gráfico gerado", description: "A IA não retornou gráficos." });
        setCharts([]);
        setLoading(false);
        return;
      }

      const convertedCharts = aiResult.data.chartConfig
        .map((chart: any, index: number) => {
          const title = chart.title || `Gráfico ${index + 1}`;
          if (Array.isArray(chart.data)) {
            const validData = chart.data.filter(
              (item: any) => typeof item.label === "string" && typeof item.value === "number"
            );
            if (validData.length > 0) {
              return { type: chart.type || "bar", title, data: validData };
            }
          }
          const labels = chart.data?.labels || [];
          const values = chart.data?.datasets?.[0]?.data || [];
          if (labels.length && values.length && labels.length === values.length) {
            const standardData = labels.map((label: string, i: number) => ({
              label,
              value: Number(values[i]) || 0
            }));
            return { type: chart.type || "bar", title, data: standardData };
          }
          return null;
        })
        .filter(Boolean);

      setCharts(convertedCharts);
      console.log("✅ Gráficos convertidos:", convertedCharts.length);

    } catch (err) {
      console.error("❌ Erro inesperado:", err);
      toast({ title: "Erro ao carregar gráficos", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const downloadAsPDF = async () => {
    if (!chartsRef.current) return;
    try {
      const canvas = await html2canvas(chartsRef.current);
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF();
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      pdf.save("relatorio-graficos.pdf");
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
    }
  };

  useEffect(() => {
    fetchChartData();
  }, [spreadsheetId]);

  return (
    <div className="p-4 space-y-6">
      <div className="flex justify-between items-center">
        <Button onClick={handleBack}>← Voltar</Button>
        {charts.length > 0 && (
          <Button variant="outline" onClick={downloadAsPDF}>Baixar PDF</Button>
        )}
      </div>

      <h2 className="text-2xl font-bold">Detalhes da Planilha</h2>

      {loading ? (
        <div className="text-center py-8">
          <div className="animate-pulse space-y-4">
            <div className="w-16 h-16 bg-primary/20 rounded-full mx-auto animate-bounce"></div>
            <p className="text-muted-foreground">Gerando gráficos...</p>
          </div>
        </div>
      ) : charts.length === 0 ? (
        <div className="text-center py-16 space-y-4">
          <h3 className="text-xl font-medium text-muted-foreground">
            Nenhum gráfico disponível
          </h3>
          <p className="text-muted-foreground">
            Não foi possível gerar gráficos para esta planilha
          </p>
        </div>
      ) : (
        <div ref={chartsRef} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {charts.map((chart, i) => (
            <ChartRenderer key={i} chart={chart} />
          ))}
        </div>
      )}
    </div>
  );
};

export default PlanilhaDetalhada;
