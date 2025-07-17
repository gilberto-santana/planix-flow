// src/components/dashboard/AllFiles.tsx

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface Spreadsheet {
  id: string;
  file_name: string;
  created_at: string;
}

const AllFiles = () => {
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
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold">Todas as Planilhas</h1>
        <Button onClick={() => navigate(-1)}>← Voltar</Button>
      </div>

      {loading ? (
        <p>Carregando...</p>
      ) : planilhas.length === 0 ? (
        <p>Nenhuma planilha encontrada.</p>
      ) : (
        <ul className="space-y-4">
          {planilhas.map((planilha) => (
            <li
              key={planilha.id}
              className="border rounded-xl p-4 shadow-sm hover:shadow-md transition"
            >
              <div className="text-base font-medium">{planilha.file_name}</div>
              <div className="text-sm text-muted-foreground">
                Enviado em {new Date(planilha.created_at).toLocaleString()}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default AllFiles;
