import { useState } from "react";
import { AuthPage } from "@/components/auth/AuthPage";
import { Dashboard } from "@/components/dashboard/Dashboard";

const Index = () => {
  // TODO: Integrar com Supabase Auth para verificar se usuário está logado
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  if (!isAuthenticated) {
    return <AuthPage />;
  }

  return <Dashboard />;
};

export default Index;
