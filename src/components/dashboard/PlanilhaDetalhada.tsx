// src/pages/dashboard/stats/PlanilhaDetalhada.tsx

import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import ChartRenderer from "@/components/dashboard/ChartRenderer";

interface ChartData {
  title: string;
  data: any[];
  xAxisKey: string;
  dataKey: string;
  type: string;
}

const PlanilhaDetalhada = () => {
  const [searchParams] = useSearchParams();
  const sheetId = searchParams.get("id");
  const [fileName, setFileName] = useState<string | null>(null);
  const [uploadDate, setUploadDate] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [charts, setCharts] = useState<ChartData[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    if (!sheetId) return;

    const fetchSheetInfo = async () => {
      const { data, error } = await supabase
        .from("sheets")
        .select("spreadsheet_id, sheet_name, created_at, status, spreadsheets(file_name, created_at)")
        .eq("id", sheetId)
        .single();

      if (data) {
        setFileName(data.spreadsheets?.file_name || "Desconhecido");
        setUploadDate(new Date(data.spreadsheets?.created_at).toLocaleDateString());
        setStatus(data.status || "indefinido");
      }
    };

    const fetchCharts = async () => {
      const { data, error } = await supabase
        .from("charts")
        .select("*")
        .eq("sheet_id", sheetId);

      if (data) {
        const parsedCharts = data.map((chart: any) => ({
          title: chart.title,
          data: chart.data,
          xAxisKey: chart.x_axis_key,
          dataKey: "value",
          type: chart.type,
        }));
        setCharts(parsedCharts);
      }
    };

    fetchSheetInfo();
    fetchCharts();
  }, [sheetId]);

  return (
    <div className="p-6">
      <Button variant="outline" className="mb-4" onClick={() => navigate("/dashboard")}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        Voltar
      </Button>

      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-2">Detalhes da Planilha</h2>
        <p><strong>Nome:</strong> {fileName}</p>
        <p><strong>Data de Upload:</strong> {uploadDate}</p>
        <p><strong>Status:</strong> {status}</p>
      </div>

      <h3 className="text-lg font-semibold mb-4">Gráficos Gerados ({charts.length})</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {charts.map((chart, index) => (
          <Card key={index} className="p-4">
            <ChartRenderer
              title={chart.title}
              data={chart.data}
              xAxisKey={chart.xAxisKey}
              dataKey={chart.dataKey}
              type={chart.type}
            />
          </Card>
        ))}
      </div>
    </div>
  );
};

export default PlanilhaDetalhada;
