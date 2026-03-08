import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Building2, Users, Calendar, Wallet, TrendingUp, Shield, Sparkles,
  UserCheck, Scissors, Loader2, ArrowUpRight,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { format, subDays, eachDayOfInterval, isSameDay, parseISO, isSameMonth } from 'date-fns';
import { tr } from 'date-fns/locale';

interface PlatformStats {
  totalSalons: number;
  activeSalons: number;
  totalUsers: number;
  totalCustomers: number;
  totalStaff: number;
  totalServices: number;
  totalAppointments: number;
  todayAppointments: number;
  totalRevenue: number;
  monthlyRevenue: number;
  recentPayments: { payment_date: string; amount: number }[];
  salonBreakdown: { name: string; customers: number; appointments: number; revenue: number }[];
}

export default function SuperAdminDashboard() {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchPlatformStats();
  }, []);

  const fetchPlatformStats = async () => {
    setLoading(true);
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();

    const [
      salonsRes, customersRes, staffRes, servicesRes,
      appointmentsRes, todayAptRes, paymentsRes, usersCountRes,
    ] = await Promise.all([
      supabase.from('salons').select('id, name, is_active'),
      supabase.from('customers').select('id, salon_id', { count: 'exact', head: false }),
      supabase.from('staff').select('id', { count: 'exact', head: true }),
      supabase.from('services').select('id', { count: 'exact', head: true }),
      supabase.from('appointments').select('id, salon_id, status, start_time', { count: 'exact', head: false }),
      supabase.from('appointments').select('id', { count: 'exact', head: true })
        .gte('start_time', todayStart).lt('start_time', todayEnd),
      supabase.from('payments').select('amount, payment_date, salon_id'),
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
    ]);

    const salons = salonsRes.data || [];
    const customers = customersRes.data || [];
    const appointments = appointmentsRes.data || [];
    const payments = paymentsRes.data || [];

    const totalRevenue = payments.reduce((s, p) => s + Number(p.amount), 0);
    const monthlyRevenue = payments
      .filter(p => { try { return isSameMonth(parseISO(p.payment_date), now); } catch { return false; } })
      .reduce((s, p) => s + Number(p.amount), 0);

    const salonBreakdown = salons.map(salon => {
      const salonCustomers = customers.filter(c => c.salon_id === salon.id).length;
      const salonApts = appointments.filter(a => a.salon_id === salon.id).length;
      const salonRevenue = payments.filter(p => p.salon_id === salon.id).reduce((s, p) => s + Number(p.amount), 0);
      return { name: salon.name, customers: salonCustomers, appointments: salonApts, revenue: salonRevenue };
    }).sort((a, b) => b.revenue - a.revenue);

    setStats({
      totalSalons: salons.length,
      activeSalons: salons.filter(s => s.is_active).length,
      totalUsers: usersCountRes.count || 0,
      totalCustomers: customers.length,
      totalStaff: staffRes.count || 0,
      totalServices: servicesRes.count || 0,
      totalAppointments: appointmentsRes.count || 0,
      todayAppointments: todayAptRes.count || 0,
      totalRevenue,
      monthlyRevenue,
      recentPayments: payments.map(p => ({ payment_date: p.payment_date, amount: Number(p.amount) })),
      salonBreakdown,
    });
    setLoading(false);
  };

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );

  if (!stats) return null;

  const now = new Date();
  const last7Days = eachDayOfInterval({ start: subDays(now, 6), end: now });
  const dailyRevenueData = last7Days.map(day => ({
    day: format(day, 'EEE', { locale: tr }),
    gelir: stats.recentPayments
      .filter(p => { try { return isSameDay(parseISO(p.payment_date), day); } catch { return false; } })
      .reduce((s, p) => s + p.amount, 0),
  }));

  const chartConfig: ChartConfig = { gelir: { label: 'Gelir (₺)', color: 'hsl(var(--primary))' } };

  const kpis = [
    { label: 'Toplam Salon', value: stats.totalSalons, sub: `${stats.activeSalons} aktif`, icon: Building2, color: 'text-primary bg-primary/10' },
    { label: 'Toplam Kullanıcı', value: stats.totalUsers, sub: `${stats.totalStaff} personel`, icon: Users, color: 'text-info bg-info/10' },
    { label: 'Toplam Müşteri', value: stats.totalCustomers, sub: `${stats.totalServices} hizmet`, icon: UserCheck, color: 'text-warning bg-warning/10' },
    { label: 'Bugünün Randevuları', value: stats.todayAppointments, sub: `${stats.totalAppointments} toplam`, icon: Calendar, color: 'text-success bg-success/10' },
    { label: 'Aylık Gelir', value: `₺${stats.monthlyRevenue.toLocaleString('tr-TR')}`, sub: format(now, 'MMMM yyyy', { locale: tr }), icon: TrendingUp, color: 'text-primary bg-primary/10' },
    { label: 'Toplam Gelir', value: `₺${stats.totalRevenue.toLocaleString('tr-TR')}`, sub: 'Tüm zamanlar', icon: Wallet, color: 'text-success bg-success/10' },
  ];

  return (
    <div className="page-container animate-in">
      {/* Hero */}
      <div className="rounded-2xl p-6 lg:p-8 border border-border/40" style={{ background: 'var(--gradient-hero)' }}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl btn-gradient flex items-center justify-center">
              <Shield className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Platform Kontrol Paneli</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {format(now, "d MMMM yyyy, EEEE", { locale: tr })} · Tüm salonların özet verileri
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => navigate('/admin/salonlar')} variant="outline" className="gap-2 h-10">
              <Building2 className="h-4 w-4" /> Salonlar
            </Button>
            <Button onClick={() => navigate('/admin/veriler')} className="gap-2 btn-gradient h-10 px-5 rounded-xl">
              <Sparkles className="h-4 w-4" /> Tüm Veriler
            </Button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
        {kpis.map(kpi => (
          <div key={kpi.label} className="stat-card p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{kpi.label}</p>
                <p className="text-2xl font-bold tracking-tight tabular-nums">{kpi.value}</p>
                <p className="text-xs text-muted-foreground">{kpi.sub}</p>
              </div>
              <div className={`h-11 w-11 rounded-xl flex items-center justify-center ${kpi.color}`}>
                <kpi.icon className="h-5 w-5" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        {/* Revenue Chart */}
        <Card className="shadow-soft border-border/60 overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
                <ArrowUpRight className="h-3.5 w-3.5 text-primary" />
              </div>
              Platform Gelir — Son 7 Gün
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[240px] w-full">
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

        {/* Salon Breakdown */}
        <Card className="shadow-soft border-border/60 overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
                <Building2 className="h-3.5 w-3.5 text-primary" />
              </div>
              Salon Bazlı Dağılım
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.salonBreakdown.length === 0 ? (
              <div className="empty-state py-8">
                <Building2 className="empty-state-icon !h-8 !w-8" />
                <p className="empty-state-title">Henüz salon yok</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[240px] overflow-auto">
                {stats.salonBreakdown.map((s, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors border border-transparent hover:border-border/40">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <Building2 className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{s.name}</p>
                        <p className="text-xs text-muted-foreground">{s.customers} müşteri · {s.appointments} randevu</p>
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-xs font-bold tabular-nums">
                      ₺{s.revenue.toLocaleString('tr-TR')}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
