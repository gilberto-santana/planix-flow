// src/pages/dashboard/stats/Planilhas.tsx

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface Spreadsheet {
  id: string;
  file_name: string;
  created_at: string;
}

const PlanilhasPage = () => {
  const [planilhas, setPlanilhas] = useState<Spreadsheet[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchPlanilhas = async () => {
      const { data, error } = await supabase
        .from("spreadsheets")
        .select("id, file_name, created_at")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Erro ao buscar planilhas:", error.message);
      } else {
        setPlanilhas(data || []);
      }
      setLoading(false);
    };

    fetchPlanilhas();
  }, []);

  return (
    <div className="p-4 space-y-6">
      <Button onClick={() => navigate("/dashboard")}>← Voltar</Button>

      <h1 className="text-2xl font-bold">Total de Planilhas</h1>

      {loading ? (
        <p>Carregando...</p>
      ) : planilhas.length === 0 ? (
        <p>Nenhuma planilha encontrada.</p>
      ) : (
        <ul className="space-y-2">
          {planilhas.map((p) => (
            <li key={p.id} className="border p-2 rounded">
              <strong>{p.file_name}</strong> <br />
              <span className="text-sm text-muted-foreground">
                Enviada em {new Date(p.created_at).toLocaleString()}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default PlanilhasPage;
