import { useSalon } from '@/contexts/SalonContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, Users, Wallet, TrendingUp, Building2, ArrowUpRight, Clock } from 'lucide-react';
import { format, isToday, isFuture, parseISO, subDays, eachDayOfInterval, isSameDay, isSameMonth } from 'date-fns';
import { tr } from 'date-fns/locale';
import { useState } from 'react';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

export default function Dashboard() {
  const { appointments, customers, payments, staff, services, branches } = useSalon();
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);

  const filteredAppointments = appointments.filter(a =>
    selectedBranchId ? a.branchId === selectedBranchId : true
  );

  const filteredPayments = payments.filter(p => {
    if (!selectedBranchId) return true;
    const apt = appointments.find(a => a.id === p.appointmentId);
    return apt ? apt.branchId === selectedBranchId : true;
  });

  const todayAppointments = filteredAppointments.filter(a => {
    try { return isToday(parseISO(a.startTime)); } catch { return false; }
  });

  const dailyRevenue = filteredPayments
    .filter(p => { try { return isToday(parseISO(p.date)); } catch { return false; } })
    .reduce((sum, p) => sum + p.amount, 0);

  const upcomingAppointments = filteredAppointments
    .filter(a => {
      try { return isFuture(parseISO(a.startTime)) && a.status === 'bekliyor'; } catch { return false; }
    })
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
    .slice(0, 5);

  const getCustomerName = (id: string) => customers.find(c => c.id === id)?.name ?? 'Bilinmiyor';
  const getStaffName = (id: string) => staff.find(s => s.id === id)?.name ?? 'Bilinmiyor';
  const getServiceName = (id: string) => services.find(s => s.id === id)?.name ?? 'Bilinmiyor';
  const getBranchName = (id: string) => branches.find(b => b.id === id)?.name ?? '';

  const statusMap: Record<string, string> = { bekliyor: 'Bekliyor', tamamlandi: 'Tamamlandı', iptal: 'İptal' };
  const statusVariant = (s: string): 'default' | 'secondary' | 'destructive' => {
    if (s === 'tamamlandi') return 'default';
    if (s === 'iptal') return 'destructive';
    return 'secondary';
  };

  const now = new Date();
  const last7Days = eachDayOfInterval({ start: subDays(now, 6), end: now });
  const dailyRevenueData = last7Days.map(day => ({
    day: format(day, 'EEE', { locale: tr }),
    gelir: filteredPayments
      .filter(p => { try { return isSameDay(parseISO(p.date), day); } catch { return false; } })
      .reduce((sum, p) => sum + p.amount, 0),
  }));

  const monthlyTotal = filteredPayments
    .filter(p => { try { return isSameMonth(parseISO(p.date), now); } catch { return false; } })
    .reduce((sum, p) => sum + p.amount, 0);

  const topCustomers = (() => {
    const map: Record<string, number> = {};
    filteredAppointments.filter(a => a.status === 'tamamlandi').forEach(a => {
      map[a.customerId] = (map[a.customerId] || 0) + 1;
    });
    return Object.entries(map).sort(([, a], [, b]) => b - a).slice(0, 5)
      .map(([id, count]) => ({ name: getCustomerName(id), ziyaret: count }));
  })();

  const dailyChartConfig: ChartConfig = { gelir: { label: 'Gelir (₺)', color: 'hsl(var(--primary))' } };
  const customerChartConfig: ChartConfig = { ziyaret: { label: 'Ziyaret', color: 'hsl(var(--primary))' } };

  const hasAnalyticsData = filteredPayments.length > 0 || filteredAppointments.some(a => a.status === 'tamamlandi');

  const kpis = [
    { label: 'Bugünün Randevuları', value: todayAppointments.length, icon: Calendar, color: 'text-primary bg-primary/8' },
    { label: 'Günlük Gelir', value: `₺${dailyRevenue.toLocaleString('tr-TR')}`, icon: Wallet, color: 'text-success bg-success/8' },
    { label: 'Aylık Gelir', value: `₺${monthlyTotal.toLocaleString('tr-TR')}`, icon: TrendingUp, color: 'text-info bg-info/8' },
    { label: 'Toplam Müşteri', value: customers.length, icon: Users, color: 'text-warning bg-warning/8' },
  ];

  return (
    <div className="page-container animate-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Panel</h1>
          <p className="page-subtitle">
            {format(new Date(), "d MMMM yyyy, EEEE", { locale: tr })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <Select value={selectedBranchId || 'all'} onValueChange={v => setSelectedBranchId(v === 'all' ? null : v)}>
            <SelectTrigger className="w-48 h-9 text-sm">
              <SelectValue placeholder="Tüm Şubeler" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tüm Şubeler</SelectItem>
              {branches.filter(b => b.active).map(b => (
                <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="stat-card p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{kpi.label}</p>
                <p className="text-2xl font-bold tracking-tight">{kpi.value}</p>
              </div>
              <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${kpi.color}`}>
                <kpi.icon className="h-5 w-5" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts */}
      {hasAnalyticsData ? (
        <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
          <Card className="shadow-card border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <ArrowUpRight className="h-4 w-4 text-primary" />
                Son 7 Gün Gelir
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={dailyChartConfig} className="h-[240px] w-full">
                <BarChart data={dailyRevenueData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                  <XAxis dataKey="day" className="text-xs" />
                  <YAxis className="text-xs" />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="gelir" fill="var(--color-gelir)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>

          <Card className="shadow-card border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                En Çok Gelen Müşteriler
              </CardTitle>
            </CardHeader>
            <CardContent>
              {topCustomers.length === 0 ? (
                <div className="empty-state">
                  <Users className="empty-state-icon" />
                  <p className="empty-state-title">Henüz tamamlanmış randevu yok</p>
                </div>
              ) : (
                <ChartContainer config={customerChartConfig} className="h-[240px] w-full">
                  <BarChart data={topCustomers} layout="vertical" margin={{ top: 5, right: 10, left: 80, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                    <XAxis type="number" className="text-xs" />
                    <YAxis dataKey="name" type="category" className="text-xs" width={75} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="ziyaret" fill="var(--color-ziyaret)" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card className="shadow-card border-border/60">
          <CardContent className="empty-state">
            <TrendingUp className="empty-state-icon" />
            <p className="empty-state-title">Henüz veri yok</p>
            <p className="empty-state-description">Randevu tamamlayıp ödeme aldığınızda grafikler burada görünecek.</p>
          </CardContent>
        </Card>
      )}

      {/* Upcoming Appointments */}
      <Card className="shadow-card border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            Yaklaşan Randevular
          </CardTitle>
        </CardHeader>
        <CardContent>
          {upcomingAppointments.length === 0 ? (
            <div className="empty-state py-8">
              <Calendar className="empty-state-icon !h-8 !w-8" />
              <p className="empty-state-title">Yaklaşan randevu yok</p>
              <p className="empty-state-description">Yeni randevu oluşturduğunuzda burada görünecek.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {upcomingAppointments.map(apt => (
                <div key={apt.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/40 hover:bg-muted/60 transition-colors">
                  <div className="space-y-0.5">
                    <p className="font-medium text-sm">{getCustomerName(apt.customerId)}</p>
                    <p className="text-xs text-muted-foreground">
                      {getServiceName(apt.serviceId)} · {getStaffName(apt.staffId)}
                      {apt.branchId && ` · ${getBranchName(apt.branchId)}`}
                    </p>
                  </div>
                  <div className="text-right space-y-0.5">
                    <p className="text-sm font-semibold tabular-nums">{format(parseISO(apt.startTime), 'HH:mm')}</p>
                    <Badge variant={statusVariant(apt.status)} className="text-[10px]">{statusMap[apt.status]}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
