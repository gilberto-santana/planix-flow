// src/components/dashboard/DashboardStats.tsx

import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { FileText, Upload, BarChart2, Clock } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const DashboardStats = () => {
  const navigate = useNavigate();
  const [totalPlanilhas, setTotalPlanilhas] = useState(0);
  const [totalAbas, setTotalAbas] = useState(0);
  const [totalGraficos, setTotalGraficos] = useState(0);
  const [uploadsRecentes, setUploadsRecentes] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      const { data: planilhas } = await supabase.from("spreadsheets").select("*");
      const { data: abas } = await supabase.from("sheets").select("*");
      const { data: graficos } = await supabase.from("spreadsheet_data").select("*");

      setTotalPlanilhas(planilhas?.length || 0);
      setTotalAbas(abas?.length || 0);
      setTotalGraficos(graficos?.length || 0);

      const seteDiasAtras = new Date();
      seteDiasAtras.setDate(seteDiasAtras.getDate() - 7);

      const { data: recentes } = await supabase
        .from("spreadsheets")
        .select("id")
        .gte("created_at", seteDiasAtras.toISOString());

      setUploadsRecentes(recentes?.length || 0);
    };

    fetchData();
  }, []);

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <Card
        onClick={() => navigate("/dashboard/stats?type=all-files")}
        className="cursor-pointer hover:shadow-md transition"
      >
        <CardContent className="p-4">
          <div className="flex justify-between items-center">
            <div>
              <h4 className="text-sm font-medium">Total de Planilhas</h4>
              <p className="text-2xl font-bold">{totalPlanilhas}</p>
              <p className="text-muted-foreground text-sm">Planilhas carregadas</p>
            </div>
            <FileText className="h-5 w-5 text-muted-foreground" />
          </div>
        </CardContent>
      </Card>

      <Card className="cursor-default">
        <CardContent className="p-4">
          <div className="flex justify-between items-center">
            <div>
              <h4 className="text-sm font-medium">Abas Processadas</h4>
              <p className="text-2xl font-bold">{totalAbas}</p>
              <p className="text-muted-foreground text-sm">Abas de planilhas</p>
            </div>
            <Upload className="h-5 w-5 text-muted-foreground" />
          </div>
        </CardContent>
      </Card>

      <Card
        onClick={() => navigate("/dashboard/stats?type=charts")}
        className="cursor-pointer hover:shadow-md transition"
      >
        <CardContent className="p-4">
          <div className="flex justify-between items-center">
            <div>
              <h4 className="text-sm font-medium">Gráficos Gerados</h4>
              <p className="text-2xl font-bold">{totalGraficos}</p>
              <p className="text-muted-foreground text-sm">Visualizações criadas</p>
            </div>
            <BarChart2 className="h-5 w-5 text-muted-foreground" />
          </div>
        </CardContent>
      </Card>

      <Card
        onClick={() => navigate("/dashboard/stats?type=recent")}
        className="cursor-pointer hover:shadow-md transition"
      >
        <CardContent className="p-4">
          <div className="flex justify-between items-center">
            <div>
              <h4 className="text-sm font-medium">Uploads Recentes</h4>
              <p className="text-2xl font-bold">{uploadsRecentes}</p>
              <p className="text-muted-foreground text-sm">Últimos 7 dias</p>
            </div>
            <Clock className="h-5 w-5 text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DashboardStats;
