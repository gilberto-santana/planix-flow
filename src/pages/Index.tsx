
// src/pages/Index.tsx

import { AuthPage } from "@/components/auth/AuthPage";
import { Dashboard } from "@/components/dashboard/Dashboard";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useAuth } from "@/hooks/useAuth";
import { useSessionTimeout } from "@/hooks/useSessionTimeout";
import { Toaster } from "@/components/ui/toaster";

const Index = () => {
  const { isAuthenticated, loading, initialized, user, session } = useAuth();
  useSessionTimeout();

  console.log("🔍 Index render:", {
    isAuthenticated,
    loading,
    initialized,
    hasUser: !!user,
    hasSession: !!session,
  });

  // Show loading only while loading or not initialized
  if (loading || !initialized) {
    return (
      <div className="min-h-screen bg-gradient-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Verificando autenticação...</p>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      {!isAuthenticated ? <AuthPage /> : <Dashboard />}
      <Toaster />
    </ErrorBoundary>
  );
};

export default Index;
