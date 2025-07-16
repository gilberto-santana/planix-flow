// src/components/dashboard/DashboardStats.tsx
import { useNavigate } from 'react-router-dom';

export default function DashboardStats({ stats }: { stats: any }) {
  const navigate = useNavigate();

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
      <div
        className="rounded-xl border bg-card text-card-foreground shadow p-6 cursor-pointer hover:bg-muted/30"
        onClick={() => navigate('/dashboard/stats?type=all-files')}
      >
        <div className="text-sm text-muted-foreground">Total de Planilhas</div>
        <div className="text-2xl font-bold">{stats.totalSpreadsheets}</div>
        <div className="text-xs text-muted-foreground">Planilhas carregadas</div>
      </div>

      <div className="rounded-xl border bg-card text-card-foreground shadow p-6">
        <div className="text-sm text-muted-foreground">Abas Processadas</div>
        <div className="text-2xl font-bold">{stats.totalSheets}</div>
        <div className="text-xs text-muted-foreground">Abas de planilhas</div>
      </div>

      <div
        className="rounded-xl border bg-card text-card-foreground shadow p-6 cursor-pointer hover:bg-muted/30"
        onClick={() => navigate('/dashboard/stats?type=charts')}
      >
        <div className="text-sm text-muted-foreground">Gráficos Gerados</div>
        <div className="text-2xl font-bold">{stats.totalCharts}</div>
        <div className="text-xs text-muted-foreground">Visualizações criadas</div>
      </div>

      <div
        className="rounded-xl border bg-card text-card-foreground shadow p-6 cursor-pointer hover:bg-muted/30"
        onClick={() => navigate('/dashboard/stats?type=recent-files')}
      >
        <div className="text-sm text-muted-foreground">Uploads Recentes</div>
        <div className="text-2xl font-bold">{stats.totalRecentUploads}</div>
        <div className="text-xs text-muted-foreground">Últimos 7 dias
        </div>
      </div>
    </div>
  );
}
