// src/pages/dashboard/stats/Index.tsx

import { useLocation, useNavigate } from "react-router-dom";
import AllFiles from "@/components/dashboard/AllFiles";
import UploadsRecentes from "@/components/dashboard/UploadsRecentes";
import GraficosGerados from "@/components/dashboard/GraficosGerados";
import PlanilhaDetalhada from "@/pages/dashboard/PlanilhaDetalhada";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FileText, BarChart3, Clock4, Layers3 } from "lucide-react";

const StatsIndex = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const searchParams = new URLSearchParams(useLocation().search);
  const type = searchParams.get("type");

  if (type === "all-files" || type === "planilhas") return <AllFiles />;
  if (type === "recent" || type === "recentes") return <UploadsRecentes />;
  if (type === "charts" || type === "graficos") return <GraficosGerados />;
  if (type === "sheet") return <PlanilhaDetalhada />;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard de Planilhas</h1>
          <p className="text-muted-foreground">
            Faça upload de suas planilhas e visualize dados através de gráficos interativos
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm">{user?.email}</p>
          <Button variant="outline" size="sm" onClick={() => navigate("/")}>
            Sair
          </Button>
        </div>
      </div>

      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-4">
        <Card
          onClick={() => navigate("/dashboard/stats?type=planilhas")}
          className="p-4 hover:bg-muted cursor-pointer"
        >
          <div className="flex items-center space-x-4">
            <FileText className="w-6 h-6" />
            <div>
              <h2 className="font-medium">Total de Planilhas</h2>
              <p className="text-sm text-muted-foreground">Ver uploads feitos</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 opacity-50 cursor-not-allowed">
          <div className="flex items-center space-x-4">
            <Layers3 className="w-6 h-6" />
            <div>
              <h2 className="font-medium">Abas Processadas</h2>
              <p className="text-sm text-muted-foreground">Em breve</p>
            </div>
          </div>
        </Card>

        <Card
          onClick={() => navigate("/dashboard/stats?type=graficos")}
          className="p-4 hover:bg-muted cursor-pointer"
        >
          <div className="flex items-center space-x-4">
            <BarChart3 className="w-6 h-6" />
            <div>
              <h2 className="font-medium">Gráficos Gerados</h2>
              <p className="text-sm text-muted-foreground">Ver visualizações</p>
            </div>
          </div>
        </Card>

        <Card
          onClick={() => navigate("/dashboard/stats?type=recentes")}
          className="p-4 hover:bg-muted cursor-pointer"
        >
          <div className="flex items-center space-x-4">
            <Clock4 className="w-6 h-6" />
            <div>
              <h2 className="font-medium">Uploads Recentes</h2>
              <p className="text-sm text-muted-foreground">Últimos arquivos enviados</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default StatsIndex;
