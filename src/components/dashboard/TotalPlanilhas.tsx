// src/components/dashboard/TotalPlanilhas.tsx

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";

interface Spreadsheet {
  id: string;
  file_name: string;
  created_at: string;
}

const TotalPlanilhas = () => {
  const [planilhas, setPlanilhas] = useState<Spreadsheet[]>([]);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;

    const fetchPlanilhas = async () => {
      const { data, error } = await supabase
        .from("spreadsheets")
        .select("id, file_name, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (!error && data) {
        setPlanilhas(data);
      }
    };

    fetchPlanilhas();
  }, [user]);

  const handleBack = () => {
    navigate("/dashboard/stats?type=home");
  };

  return (
    <div className="p-4">
      <div className="flex justify-between mb-4">
        <Button onClick={handleBack}>← Voltar</Button>
      </div>

      {planilhas.length === 0 ? (
        <p className="text-muted-foreground text-center">Nenhuma planilha encontrada.</p>
      ) : (
        <div className="space-y-4">
          {planilhas.map((planilha) => (
            <Card key={planilha.id} className="p-4">
              <p className="font-medium">📄 {planilha.file_name}</p>
              <p className="text-sm text-muted-foreground">
                Enviado em {new Date(planilha.created_at).toLocaleString()}
              </p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default TotalPlanilhas;
