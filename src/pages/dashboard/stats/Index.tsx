// src/pages/dashboard/stats/Index.tsx

import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { BarChart3, FileText, Clock4, Layers3 } from "lucide-react";

const StatsIndex = () => {
  const navigate = useNavigate();

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">Estatísticas</h1>

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
