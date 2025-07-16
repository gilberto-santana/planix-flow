// src/components/dashboard/AbasProcessadas.tsx

import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const AbasProcessadas = () => {
  const navigate = useNavigate();

  const handleBack = () => {
    navigate("/dashboard/stats?type=home");
  };

  return (
    <div className="p-4 space-y-6">
      <div className="flex justify-between items-center">
        <Button onClick={handleBack}>← Voltar</Button>
      </div>

      <h2 className="text-xl font-bold">Abas Processadas</h2>

      <p className="text-muted-foreground">Em breve você poderá ver as abas processadas aqui.</p>
    </div>
  );
};

export default AbasProcessadas;
