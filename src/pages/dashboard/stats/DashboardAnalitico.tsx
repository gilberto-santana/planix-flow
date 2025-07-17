import { useEffect, useState, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import ChartRenderer from "@/components/panel/ChartRenderer";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

interface ChartData {
  title: string;
  type: string;
  x: string[];
  y: number[];
}

interface SpreadsheetRow {
  sheet_id: string;
  row_index: number;
  column_name: string;
  cell_value: string;
}

const DashboardAnalitico = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [charts, setCharts] = useState<ChartData[]>([]);
  const [recomendacoes, setRecomendacoes] = useState<string[]>([]);
  const chartsRef = useRef<HTMLDivElement>(null);

  const sheetId = new URLSearchParams(location.search).get("id");

  const handleBack = () => {
    navigate("/dashboard/stats?type=home");
  };

  const downloadAsImage = async () => {
    if (!chartsRef.current) return;
    const canvas = await html2canvas(chartsRef.current);
    const link = document.createElement("a");
    link.download = "dashboard-analitico.png";
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
    pdf.save("dashboard-analitico.pdf");
  };

  const fetchData = async () => {
    try {
      const { data, error } = await supabase
        .from("spreadsheet_data")
        .select("sheet_id, row_index, column_name, cell_value")
        .eq("sheet_id", sheetId);

      if (error) throw error;
      if (!data || data.length === 0) return;

      const rowsMap = new Map<number, Record<string, string>>();
      data.forEach((row) => {
        if (!rowsMap.has(row.row_index)) {
          rowsMap.set(row.row_index, {});
        }
        rowsMap.get(row.row_index)![row.column_name] = row.cell_value;
      });
      const rows = Array.from(rowsMap.values());

      const columnNames = Object.keys(rows[0] || {});
      const detected: ChartData[] = [];
      const insights: string[] = [];

      columnNames.forEach((xKey) => {
        columnNames.forEach((yKey) => {
          if (xKey !== yKey) {
            const xValues = rows.map((r) => r[xKey]);
            const yValues = rows.map((r) => parseFloat(r[yKey]));
            const valid = yValues.every((y) => !isNaN(y));
            if (valid) {
              detected.push({
                title: `${xKey} vs ${yKey}`,
                type: "bar",
                x: xValues,
                y: yValues,
              });
              insights.push(
                `Verifique se há correlação entre "${xKey}" e "${yKey}" — os dados sugerem uma possível relação.`
              );
            }
          }
        });
      });

      setCharts(detected);
      setRecomendacoes(insights.slice(0, 5));
    } catch (err) {
      console.error(err);
      toast({ title: "Erro", description: "Não foi possível carregar os dados." });
    }
  };

  useEffect(() => {
    if (sheetId) fetchData();
  }, [sheetId]);

  return (
    <div className="p-4 space-y-6">
      <div className="flex justify-between items-center">
        <Button onClick={handleBack}>← Voltar</Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={downloadAsImage}>
            Baixar Imagem
          </Button>
          <Button variant="outline" onClick={downloadAsPDF}>
            Baixar PDF
          </Button>
        </div>
      </div>

      <h2 className="text-xl font-bold">Dashboard Analítico</h2>
      <p className="text-muted-foreground">Gráficos gerados automaticamente + recomendações com base nos dados.</p>

      <div className="space-y-2">
        <h3 className="font-semibold">Recomendações Visuais:</h3>
        <ul className="list-disc list-inside text-sm">
          {recomendacoes.map((rec, i) => (
            <li key={i}>{rec}</li>
          ))}
        </ul>
      </div>

      <div ref={chartsRef} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {charts.map((chart, i) => (
          <ChartRenderer key={i} chart={chart} />
        ))}
      </div>
    </div>
  );
};

export default DashboardAnalitico;
