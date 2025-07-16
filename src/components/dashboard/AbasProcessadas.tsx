// src/components/dashboard/AbasProcessadas.tsx

import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const AbasProcessadas = () => {
  const navigate = useNavigate();

  const handleBack = () => {
    navigate("/dashboard/stats?type=home");
  };

  return (
    <div className="p-4">
      <div className="flex justify-between mb-4">
        <Button onClick={handleBack}>← Voltar</Button>
      </div>

      <p className="text-muted-foreground text-center">Nenhuma função ativa no momento para esta aba.</p>
    </div>
  );
};

export default AbasProcessadas;
