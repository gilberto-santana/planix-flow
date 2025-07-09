
import { AuthPage } from "@/components/auth/AuthPage";
import { Dashboard } from "@/components/dashboard/Dashboard";
import { useAuth } from "@/hooks/useAuth";
import { useSessionTimeout } from "@/hooks/useSessionTimeout";
import { Toaster } from "@/components/ui/toaster";

const Index = () => {
  const { isAuthenticated, loading, initialized, user, session } = useAuth();
  useSessionTimeout(); // Initialize session timeout for authenticated users

  console.log('🔍 Index render:', { 
    isAuthenticated, 
    loading, 
    initialized,
    hasUser: !!user,
    hasSession: !!session
  });

  if (loading || !initialized) {
    return (
      <div className="min-h-screen bg-gradient-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground mb-2">Carregando...</p>
          <div className="text-xs text-muted-foreground">
            Loading: {loading.toString()}, Initialized: {initialized.toString()}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {!isAuthenticated ? <AuthPage /> : <Dashboard />}
      <Toaster />
    </>
  );
};

export default Index;
