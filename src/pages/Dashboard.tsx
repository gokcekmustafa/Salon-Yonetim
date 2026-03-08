import { useSalonData } from '@/hooks/useSalonData';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, Users, Wallet, TrendingUp, Building2, ArrowUpRight, Clock, Loader2, Shield, Sparkles } from 'lucide-react';
import { format, isToday, isFuture, parseISO, subDays, eachDayOfInterval, isSameDay, isSameMonth } from 'date-fns';
import { tr } from 'date-fns/locale';
import { useState } from 'react';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { useNavigate } from 'react-router-dom';
import SuperAdminDashboard from './SuperAdminDashboard';

export default function Dashboard() {
  const { isSuperAdmin, currentSalonId } = useAuth();
  const { appointments, customers, payments, staff, services, branches, loading, salon } = useSalonData();
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const navigate = useNavigate();

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Yükleniyor...</p>
      </div>
    </div>
  );

  // Super admin without selected salon: show platform dashboard
  if (isSuperAdmin && !currentSalonId) {
    return <SuperAdminDashboard />;
  }

  const filteredAppointments = appointments.filter(a => selectedBranchId ? a.branch_id === selectedBranchId : true);
  const filteredPayments = payments.filter(p => {
    if (!selectedBranchId) return true;
    const apt = appointments.find(a => a.id === p.appointment_id);
    return apt ? apt.branch_id === selectedBranchId : true;
  });

  const todayAppointments = filteredAppointments.filter(a => { try { return isToday(parseISO(a.start_time)); } catch { return false; } });
  const dailyRevenue = filteredPayments.filter(p => { try { return isToday(parseISO(p.payment_date)); } catch { return false; } }).reduce((s, p) => s + Number(p.amount), 0);

  const upcomingAppointments = filteredAppointments
    .filter(a => { try { return isFuture(parseISO(a.start_time)) && a.status === 'bekliyor'; } catch { return false; } })
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()).slice(0, 5);

  const getName = (list: { id: string; name: string }[], id: string) => list.find(x => x.id === id)?.name ?? '-';

  const statusMap: Record<string, string> = { bekliyor: 'Bekliyor', tamamlandi: 'Tamamlandı', iptal: 'İptal' };
  const statusVariant = (s: string): 'default' | 'secondary' | 'destructive' => s === 'tamamlandi' ? 'default' : s === 'iptal' ? 'destructive' : 'secondary';

  const now = new Date();
  const last7Days = eachDayOfInterval({ start: subDays(now, 6), end: now });
  const dailyRevenueData = last7Days.map(day => ({
    day: format(day, 'EEE', { locale: tr }),
    gelir: filteredPayments.filter(p => { try { return isSameDay(parseISO(p.payment_date), day); } catch { return false; } }).reduce((s, p) => s + Number(p.amount), 0),
  }));

  const monthlyTotal = filteredPayments.filter(p => { try { return isSameMonth(parseISO(p.payment_date), now); } catch { return false; } }).reduce((s, p) => s + Number(p.amount), 0);

  const topCustomers = (() => {
    const map: Record<string, number> = {};
    filteredAppointments.filter(a => a.status === 'tamamlandi').forEach(a => { map[a.customer_id] = (map[a.customer_id] || 0) + 1; });
    return Object.entries(map).sort(([, a], [, b]) => b - a).slice(0, 5).map(([id, count]) => ({ name: getName(customers, id), ziyaret: count }));
  })();

  const dailyChartConfig: ChartConfig = { gelir: { label: 'Gelir (₺)', color: 'hsl(var(--primary))' } };
  const customerChartConfig: ChartConfig = { ziyaret: { label: 'Ziyaret', color: 'hsl(var(--primary))' } };
  const hasAnalyticsData = filteredPayments.length > 0 || filteredAppointments.some(a => a.status === 'tamamlandi');

  const kpis = [
    { label: 'Bugünün Randevuları', value: todayAppointments.length, icon: Calendar, color: 'text-primary bg-primary/10' },
    { label: 'Günlük Gelir', value: `₺${dailyRevenue.toLocaleString('tr-TR')}`, icon: Wallet, color: 'text-success bg-success/10' },
    { label: 'Aylık Gelir', value: `₺${monthlyTotal.toLocaleString('tr-TR')}`, icon: TrendingUp, color: 'text-info bg-info/10' },
    { label: 'Toplam Müşteri', value: customers.length, icon: Users, color: 'text-warning bg-warning/10' },
  ];

  return (
    <div className="page-container animate-in">
      {/* Hero Header */}
      <div className="rounded-2xl p-6 lg:p-8 border border-border/40" style={{ background: 'var(--gradient-hero)' }}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl btn-gradient flex items-center justify-center">
              <Sparkles className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{salon?.name || 'Panel'}</h1>
              <p className="text-sm text-muted-foreground mt-0.5">{format(new Date(), "d MMMM yyyy, EEEE", { locale: tr })}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <Select value={selectedBranchId || 'all'} onValueChange={v => setSelectedBranchId(v === 'all' ? null : v)}>
              <SelectTrigger className="w-48 h-9 text-sm bg-card/80 backdrop-blur-sm"><SelectValue placeholder="Tüm Şubeler" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Şubeler</SelectItem>
                {branches.filter(b => b.is_active).map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map(kpi => (
          <div key={kpi.label} className="stat-card p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{kpi.label}</p>
                <p className="text-2xl font-bold tracking-tight tabular-nums">{kpi.value}</p>
              </div>
              <div className={`h-11 w-11 rounded-xl flex items-center justify-center ${kpi.color}`}>
                <kpi.icon className="h-5 w-5" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts */}
      {hasAnalyticsData ? (
        <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
          <Card className="shadow-soft border-border/60 overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center"><ArrowUpRight className="h-3.5 w-3.5 text-primary" /></div>
                Son 7 Gün Gelir
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={dailyChartConfig} className="h-[240px] w-full">
                <BarChart data={dailyRevenueData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                  <XAxis dataKey="day" className="text-xs" />
                  <YAxis className="text-xs" />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="gelir" fill="var(--color-gelir)" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
          <Card className="shadow-soft border-border/60 overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center"><Users className="h-3.5 w-3.5 text-primary" /></div>
                En Çok Gelen Müşteriler
              </CardTitle>
            </CardHeader>
            <CardContent>
              {topCustomers.length === 0 ? (
                <div className="empty-state"><Users className="empty-state-icon" /><p className="empty-state-title">Henüz tamamlanmış randevu yok</p></div>
              ) : (
                <ChartContainer config={customerChartConfig} className="h-[240px] w-full">
                  <BarChart data={topCustomers} layout="vertical" margin={{ top: 5, right: 10, left: 80, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                    <XAxis type="number" className="text-xs" />
                    <YAxis dataKey="name" type="category" className="text-xs" width={75} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="ziyaret" fill="var(--color-ziyaret)" radius={[0, 8, 8, 0]} />
                  </BarChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card className="shadow-soft border-border/60">
          <CardContent className="empty-state">
            <TrendingUp className="empty-state-icon" />
            <p className="empty-state-title">Henüz veri yok</p>
            <p className="empty-state-description">Randevu tamamlayıp ödeme aldığınızda grafikler burada görünecek.</p>
          </CardContent>
        </Card>
      )}

      {/* Upcoming Appointments */}
      <Card className="shadow-soft border-border/60 overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center"><Clock className="h-3.5 w-3.5 text-primary" /></div>
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
                <div key={apt.id} className="flex items-center justify-between p-3.5 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors border border-transparent hover:border-border/40">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-primary">{getName(customers, apt.customer_id).charAt(0)}</span>
                    </div>
                    <div className="space-y-0.5">
                      <p className="font-medium text-sm">{getName(customers, apt.customer_id)}</p>
                      <p className="text-xs text-muted-foreground">{getName(services, apt.service_id)} · {getName(staff, apt.staff_id)}{apt.branch_id && ` · ${getName(branches, apt.branch_id)}`}</p>
                    </div>
                  </div>
                  <div className="text-right space-y-0.5">
                    <p className="text-sm font-bold tabular-nums">{format(parseISO(apt.start_time), 'HH:mm')}</p>
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
