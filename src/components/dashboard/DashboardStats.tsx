
import { useState, useEffect } from "react";
import { FileSpreadsheet, BarChart3, Upload, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

interface DashboardStatsData {
  totalSpreadsheets: number;
  totalSheets: number;
  totalCharts: number;
  recentUploads: number;
}

export function DashboardStats() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStatsData>({
    totalSpreadsheets: 0,
    totalSheets: 0,
    totalCharts: 0,
    recentUploads: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchStats();
    }
  }, [user]);

  const fetchStats = async () => {
    try {
      setLoading(true);

      // Fetch total spreadsheets
      const { count: spreadsheetCount } = await supabase
        .from("spreadsheets")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user?.id);

      // Fetch total sheets
      const { count: sheetCount } = await supabase
        .from("sheets")
        .select(`
          *,
          spreadsheets!inner(user_id)
        `, { count: "exact", head: true })
        .eq("spreadsheets.user_id", user?.id);

      // Fetch total charts
      const { count: chartCount } = await supabase
        .from("charts")
        .select(`
          *,
          sheets!inner(
            spreadsheet_id,
            spreadsheets!inner(user_id)
          )
        `, { count: "exact", head: true })
        .eq("sheets.spreadsheets.user_id", user?.id);

      // Fetch recent uploads (last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const { count: recentCount } = await supabase
        .from("spreadsheets")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user?.id)
        .gte("created_at", sevenDaysAgo.toISOString());

      setStats({
        totalSpreadsheets: spreadsheetCount || 0,
        totalSheets: sheetCount || 0,
        totalCharts: chartCount || 0,
        recentUploads: recentCount || 0,
      });
    } catch (error) {
      console.error("Erro ao buscar estatísticas:", error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      title: "Total de Planilhas",
      value: stats.totalSpreadsheets,
      icon: FileSpreadsheet,
      description: "Planilhas carregadas"
    },
    {
      title: "Abas Processadas", 
      value: stats.totalSheets,
      icon: Upload,
      description: "Abas de planilhas"
    },
    {
      title: "Gráficos Gerados",
      value: stats.totalCharts,
      icon: BarChart3,
      description: "Visualizações criadas"
    },
    {
      title: "Uploads Recentes",
      value: stats.recentUploads,
      icon: Clock,
      description: "Últimos 7 dias"
    }
  ];

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Carregando...</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-8 w-16 bg-muted animate-pulse rounded"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {statCards.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground">{stat.description}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
