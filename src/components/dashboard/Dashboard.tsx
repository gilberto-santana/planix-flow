import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileUpload } from "./FileUpload";
import { ChartGrid } from "./ChartGrid";
import { BarChart3, FileSpreadsheet, User, LogOut, Zap, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";

interface DashboardData {
  fileName: string;
  sheets: Array<{
    name: string;
    charts: Array<{
      type: 'bar' | 'line' | 'pie';
      title: string;
      data: any[];
    }>;
  }>;
}

export function Dashboard() {
  const { user, signOut } = useAuth();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [currentSheet, setCurrentSheet] = useState(0);

  const handleFileUpload = (file: File) => {
    // TODO: Integrar com Supabase para processamento
    // Simulando dados para demonstração
    setTimeout(() => {
      setDashboardData({
        fileName: file.name,
        sheets: [
          {
            name: "Vendas",
            charts: [
              {
                type: 'bar',
                title: 'Vendas por Mês',
                data: [
                  { name: 'Jan', value: 4000 },
                  { name: 'Fev', value: 3000 },
                  { name: 'Mar', value: 5000 },
                  { name: 'Abr', value: 4500 },
                ]
              },
              {
                type: 'pie',
                title: 'Vendas por Categoria',
                data: [
                  { name: 'Eletrônicos', value: 400 },
                  { name: 'Roupas', value: 300 },
                  { name: 'Casa', value: 200 },
                ]
              }
            ]
          }
        ]
      });
    }, 3000);
  };

  const handleLogout = () => {
    signOut();
  };

  return (
    <div className="min-h-screen bg-gradient-background">
      {/* Header */}
      <header className="border-b border-border/50 glass">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <BarChart3 className="h-8 w-8 text-primary glow-primary" />
              <Zap className="h-4 w-4 text-accent absolute -top-1 -right-1" />
            </div>
            <h1 className="text-2xl font-bold gradient-text">Planix</h1>
          </div>
          
          <div className="flex items-center gap-4">
            <Badge variant="secondary" className="hidden sm:flex">
              <TrendingUp className="h-3 w-3 mr-1" />
              Auto-Dashboard
            </Badge>
            <Button variant="ghost" size="sm" className="gap-2">
              <User className="h-4 w-4" />
              {user?.email?.split('@')[0] || 'Usuário'}
            </Button>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {!dashboardData ? (
          /* Upload Section */
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-8 animate-fade-in">
              <h2 className="text-3xl font-bold mb-4">
                Transforme suas <span className="gradient-text">planilhas</span> em dashboards
              </h2>
              <p className="text-muted-foreground text-lg">
                Upload automático • Gráficos inteligentes • Visualização instantânea
              </p>
            </div>
            
            <FileUpload onFileUpload={handleFileUpload} className="animate-fade-in" />
            
            {/* Features */}
            <div className="grid md:grid-cols-3 gap-6 mt-12 animate-fade-in" style={{ animationDelay: '0.2s' }}>
              <Card className="glass text-center">
                <CardContent className="p-6">
                  <div className="text-4xl mb-4">⚡</div>
                  <h3 className="font-semibold mb-2">Processamento Instantâneo</h3>
                  <p className="text-sm text-muted-foreground">
                    Seus dados são analisados e transformados em gráficos automaticamente
                  </p>
                </CardContent>
              </Card>
              
              <Card className="glass text-center">
                <CardContent className="p-6">
                  <div className="text-4xl mb-4">🧠</div>
                  <h3 className="font-semibold mb-2">IA Inteligente</h3>
                  <p className="text-sm text-muted-foreground">
                    Detecção automática de tipos de dados e sugestão dos melhores gráficos
                  </p>
                </CardContent>
              </Card>
              
              <Card className="glass text-center">
                <CardContent className="p-6">
                  <div className="text-4xl mb-4">📊</div>
                  <h3 className="font-semibold mb-2">Múltiplos Formatos</h3>
                  <p className="text-sm text-muted-foreground">
                    Suporte para Excel (.xls, .xlsx) e CSV com múltiplas abas
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        ) : (
          /* Dashboard Section */
          <div className="animate-fade-in">
            {/* File Info */}
            <Card className="glass glow-primary mb-8">
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <FileSpreadsheet className="h-6 w-6 text-primary" />
                  <span>{dashboardData.fileName}</span>
                  <Badge className="bg-gradient-primary">
                    {dashboardData.sheets.length} aba{dashboardData.sheets.length > 1 ? 's' : ''}
                  </Badge>
                </CardTitle>
              </CardHeader>
            </Card>

            {/* Sheet Tabs */}
            {dashboardData.sheets.length > 1 && (
              <div className="flex gap-2 mb-6">
                {dashboardData.sheets.map((sheet, index) => (
                  <Button
                    key={index}
                    variant={currentSheet === index ? "default" : "outline"}
                    onClick={() => setCurrentSheet(index)}
                    className={currentSheet === index ? "bg-gradient-primary glow-primary" : ""}
                  >
                    {sheet.name}
                  </Button>
                ))}
              </div>
            )}

            {/* Charts */}
            <ChartGrid charts={dashboardData.sheets[currentSheet].charts} />
          </div>
        )}
      </main>
    </div>
  );
}