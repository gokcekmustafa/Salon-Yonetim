import { Calendar, Users, Wallet, TrendingUp, ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface KPIData {
  todayAppointments: number;
  dailyRevenue: number;
  monthlyTotal: number;
  totalCustomers: number;
  yesterdayRevenue?: number;
  lastMonthTotal?: number;
}

export function DashboardKPICards({ data }: { data: KPIData }) {
  const kpis = [
    {
      label: 'Bugünün Randevuları',
      value: data.todayAppointments.toString(),
      icon: Calendar,
      gradient: 'from-primary/15 to-primary/5',
      iconBg: 'bg-primary/15 text-primary',
    },
    {
      label: 'Günlük Gelir',
      value: `₺${data.dailyRevenue.toLocaleString('tr-TR')}`,
      icon: Wallet,
      gradient: 'from-success/15 to-success/5',
      iconBg: 'bg-success/15 text-success',
    },
    {
      label: 'Aylık Gelir',
      value: `₺${data.monthlyTotal.toLocaleString('tr-TR')}`,
      icon: TrendingUp,
      gradient: 'from-accent/15 to-accent/5',
      iconBg: 'bg-accent/15 text-accent',
    },
    {
      label: 'Toplam Müşteri',
      value: data.totalCustomers.toString(),
      icon: Users,
      gradient: 'from-warning/15 to-warning/5',
      iconBg: 'bg-warning/15 text-warning',
    },
  ];

  return (
    <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
      {kpis.map(kpi => (
        <div
          key={kpi.label}
          className={`relative overflow-hidden rounded-xl border border-border/40 bg-gradient-to-br ${kpi.gradient} p-4 transition-all hover:shadow-md`}
        >
          <div className="flex items-start justify-between">
            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{kpi.label}</p>
              <p className="text-xl font-bold tracking-tight tabular-nums text-foreground">{kpi.value}</p>
            </div>
            <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${kpi.iconBg}`}>
              <kpi.icon className="h-4 w-4" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
