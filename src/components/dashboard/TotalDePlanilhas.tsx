
// src/components/dashboard/TotalDePlanilhas.tsx

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { ptBR } from "date-fns/locale/pt-BR";
import { formatDistanceToNow } from "date-fns";

interface Planilha {
  id: string;
  file_name: string;
  created_at: string;
  processing_status: string;
  sheet_count: number | null;
}

const TotalDePlanilhas = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [planilhas, setPlanilhas] = useState<Planilha[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchPlanilhas = async () => {
      const { data, error } = await supabase
        .from("spreadsheets")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (!error && data) {
        setPlanilhas(data);
      }
      setLoading(false);
    };

    fetchPlanilhas();
  }, [user]);

  const handleBack = () => {
    navigate("/dashboard/stats?type=home");
  };

  const handleViewPlanilha = (id: string) => {
    navigate(`/dashboard/stats?type=sheet&id=${id}`);
  };

  if (loading) {
    return <div className="p-4">Carregando...</div>;
  }

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Total de Planilhas</h1>
        <Button onClick={handleBack}>← Voltar</Button>
      </div>

      <div className="grid gap-4">
        {planilhas.length === 0 ? (
          <p className="text-muted-foreground">Nenhuma planilha encontrada.</p>
        ) : (
          planilhas.map((planilha) => (
            <Card key={planilha.id} className="cursor-pointer hover:shadow-md transition-shadow">
              <CardHeader>
                <CardTitle className="text-lg">{planilha.file_name}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex justify-between items-center">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">
                      Enviado {formatDistanceToNow(new Date(planilha.created_at), { 
                        addSuffix: true, 
                        locale: ptBR 
                      })}
                    </p>
                    <p className="text-sm">
                      Status: <span className="font-medium">{planilha.processing_status}</span>
                    </p>
                    <p className="text-sm">
                      Abas: {planilha.sheet_count || 0}
                    </p>
                  </div>
                  <Button 
                    onClick={() => handleViewPlanilha(planilha.id)}
                    variant="outline"
                  >
                    Ver Detalhes
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default TotalDePlanilhas;
