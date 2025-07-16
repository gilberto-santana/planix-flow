// src/components/dashboard/TotalDePlanilhas.tsx

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import ptBR from "date-fns/locale/pt-BR";

interface Spreadsheet {
  id: string;
  file_name: string;
  created_at: string;
}

const TotalDePlanilhas = () => {
  const navigate = useNavigate();
  const [spreadsheets, setSpreadsheets] = useState<Spreadsheet[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSpreadsheets = async () => {
    const { data, error } = await supabase
      .from("spreadsheets")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setSpreadsheets(data);
    }

    setLoading(false);
  };

  const handleBack = () => {
    navigate("/dashboard/stats?type=home");
  };

  useEffect(() => {
    fetchSpreadsheets();
  }, []);

  return (
    <div className="p-4 space-y-6">
      <div className="flex justify-between items-center">
        <Button onClick={handleBack}>← Voltar</Button>
      </div>

      <h2 className="text-xl font-bold">Total de Planilhas</h2>

      {loading ? (
        <p>Carregando arquivos...</p>
      ) : spreadsheets.length === 0 ? (
        <p className="text-muted-foreground">Nenhum arquivo enviado ainda.</p>
      ) : (
        <ul className="space-y-3">
          {spreadsheets.map((spreadsheet) => (
            <li
              key={spreadsheet.id}
              className="border rounded-lg p-4 shadow-sm flex justify-between items-center"
            >
              <span className="font-medium">{spreadsheet.file_name}</span>
              <span className="text-sm text-muted-foreground">
                {format(new Date(spreadsheet.created_at), "dd 'de' MMMM 'de' yyyy - HH:mm", {
                  locale: ptBR,
                })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default TotalDePlanilhas;
