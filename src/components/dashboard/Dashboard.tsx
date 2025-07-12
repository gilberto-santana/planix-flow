
import { DashboardHeader } from "./DashboardHeader";
import { DashboardStats } from "./DashboardStats";
import { FileUpload } from "./FileUpload";
import { ChartsSection } from "./ChartsSection";
import { useFileProcessing } from "@/hooks/useFileProcessing";

export function Dashboard() {
  const { loading, charts, fileName } = useFileProcessing();

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader />
      
      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* Welcome Section */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold gradient-text">
            Bem-vindo ao seu Dashboard
          </h1>
          <p className="text-muted-foreground text-lg">
            Faça upload de suas planilhas e visualize dados através de gráficos interativos
          </p>
        </div>

        {/* Statistics Cards */}
        <DashboardStats />

        {/* File Upload Section */}
        <div className="space-y-4">
          <h2 className="text-2xl font-semibold">Upload de Planilha</h2>
          <FileUpload />
        </div>

        {/* Charts Section */}
        <ChartsSection charts={charts} fileName={fileName} loading={loading} />
      </main>
    </div>
  );
}
