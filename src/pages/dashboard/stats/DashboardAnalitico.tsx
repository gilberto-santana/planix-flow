// src/pages/dashboard/stats/DashboardAnalitico.tsx

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ChartData, generateChartSet } from "@/utils/chartGeneration";
import ChartRenderer from "@/components/panel/ChartRenderer";
import { Button } from "@/components/ui/button";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Sparkles, Lightbulb } from "lucide-react";

export default function DashboardAnalitico() {
  const [charts, setCharts] = useState<ChartData[]>([]);
  const [fileName, setFileName] = useState<string>("");
  const [recomendacoes, setRecomendacoes] = useState<string[]>([]);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const fileId = searchParams.get("id");

  useEffect(() => {
    const fetchData = async () => {
      if (!fileId) return;

      const { data: spreadsheet } = await supabase
        .from("spreadsheets")
        .select("file_name")
        .eq("id", fileId)
        .single();

      setFileName(spreadsheet?.file_name || "");

      const { data, error } = await supabase
        .from("spreadsheet_data")
        .select("*")
        .eq("spreadsheet_id", fileId);

      if (error || !data) return;

      const charts = generateChartSet(data);
      setCharts(charts);

      const insights: string[] = [];
      const colunas = [...new Set(data.map((row) => row.column_name))];
      if (colunas.includes("quantidade")) {
        insights.push("Produtos com maior volume podem indicar sucesso de vendas ou necessidade de estoque.");
      }
      if (colunas.includes("data") || colunas.includes("mês")) {
        insights.push("Análise temporal pode revelar sazonalidade e oportunidades de promoção.");
      }
      if (colunas.includes("nome") || colunas.includes("cliente")) {
        insights.push("Possível identificar clientes mais ativos ou produtos mais populares por nome.");
      }

      setRecomendacoes(insights);
    };

    fetchData();
  }, [fileId]);

  return (
    <div className="p-4 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold">Detalhes da Planilha</h2>
          <p className="text-sm text-muted-foreground">{fileName}</p>
        </div>
        <Button onClick={() => navigate("/dashboard/stats?type=home")}>← Voltar</Button>
      </div>

      {recomendacoes.length > 0 && (
        <div className="bg-muted p-4 rounded-xl">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-yellow-400" />
            Recomendações com base nos dados
          </h3>
          <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
            {recomendacoes.map((rec, index) => (
              <li key={index}>{rec}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {charts.map((chart, i) => (
          <ChartRenderer key={i} chart={chart} />
        ))}
      </div>
    </div>
  );
}
