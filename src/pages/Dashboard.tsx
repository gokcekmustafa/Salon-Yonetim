import { useSalon } from '@/contexts/SalonContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Users, Wallet, Clock, TrendingUp } from 'lucide-react';
import { format, isToday, isFuture, parseISO, subDays, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth } from 'date-fns';
import { tr } from 'date-fns/locale';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

export default function Dashboard() {
  const { appointments, customers, payments, staff, services } = useSalon();

  const todayAppointments = appointments.filter(a => {
    try { return isToday(parseISO(a.startTime)); } catch { return false; }
  });

  const dailyRevenue = payments
    .filter(p => { try { return isToday(parseISO(p.date)); } catch { return false; } })
    .reduce((sum, p) => sum + p.amount, 0);

  const upcomingAppointments = appointments
    .filter(a => {
      try { return isFuture(parseISO(a.startTime)) && a.status === 'bekliyor'; } catch { return false; }
    })
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
    .slice(0, 5);

  const getCustomerName = (id: string) => customers.find(c => c.id === id)?.name ?? 'Bilinmiyor';
  const getStaffName = (id: string) => staff.find(s => s.id === id)?.name ?? 'Bilinmiyor';
  const getServiceName = (id: string) => services.find(s => s.id === id)?.name ?? 'Bilinmiyor';

  const statusMap: Record<string, string> = {
    bekliyor: 'Bekliyor',
    tamamlandi: 'Tamamlandı',
    iptal: 'İptal',
  };

  const statusVariant = (s: string): 'default' | 'secondary' | 'destructive' => {
    if (s === 'tamamlandi') return 'default';
    if (s === 'iptal') return 'destructive';
    return 'secondary';
  };

  // --- Analytics Data ---

  // Son 7 gün gelir
  const last7Days = eachDayOfInterval({ start: subDays(new Date(), 6), end: new Date() });
  const dailyRevenueData = last7Days.map(day => {
    const dayTotal = payments
      .filter(p => { try { return isSameDay(parseISO(p.date), day); } catch { return false; } })
      .reduce((sum, p) => sum + p.amount, 0);
    return {
      day: format(day, 'EEE', { locale: tr }),
      gelir: dayTotal,
    };
  });

  // Aylık gelir (bu ayın günleri)
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const monthDays = eachDayOfInterval({ start: monthStart, end: now > monthEnd ? monthEnd : now });
  const monthlyRevenueData = monthDays.map(day => {
    const dayTotal = payments
      .filter(p => { try { return isSameDay(parseISO(p.date), day); } catch { return false; } })
      .reduce((sum, p) => sum + p.amount, 0);
    return {
      day: format(day, 'd', { locale: tr }),
      gelir: dayTotal,
    };
  });

  const monthlyTotal = payments
    .filter(p => { try { return isSameMonth(parseISO(p.date), now); } catch { return false; } })
    .reduce((sum, p) => sum + p.amount, 0);

  // En çok gelen müşteriler
  const customerVisitMap: Record<string, number> = {};
  appointments.filter(a => a.status === 'tamamlandi').forEach(a => {
    customerVisitMap[a.customerId] = (customerVisitMap[a.customerId] || 0) + 1;
  });
  const topCustomers = Object.entries(customerVisitMap)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([id, count]) => ({ name: getCustomerName(id), ziyaret: count }));

  // En çok yapılan hizmetler
  const serviceCountMap: Record<string, number> = {};
  appointments.filter(a => a.status === 'tamamlandi').forEach(a => {
    serviceCountMap[a.serviceId] = (serviceCountMap[a.serviceId] || 0) + 1;
  });
  const topServices = Object.entries(serviceCountMap)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([id, count]) => ({ name: getServiceName(id), adet: count }));

  const CHART_COLORS = [
    'hsl(var(--primary))',
    'hsl(var(--accent))',
    'hsl(var(--success))',
    'hsl(340, 50%, 65%)',
    'hsl(220, 60%, 55%)',
  ];

  const dailyChartConfig: ChartConfig = {
    gelir: { label: 'Gelir (₺)', color: 'hsl(var(--primary))' },
  };

  const monthlyChartConfig: ChartConfig = {
    gelir: { label: 'Gelir (₺)', color: 'hsl(var(--accent))' },
  };

  const customerChartConfig: ChartConfig = {
    ziyaret: { label: 'Ziyaret', color: 'hsl(var(--primary))' },
  };

  const serviceChartConfig: ChartConfig = {
    adet: { label: 'Adet', color: 'hsl(var(--accent))' },
  };

  const hasAnalyticsData = payments.length > 0 || appointments.some(a => a.status === 'tamamlandi');

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground text-sm">
          {format(new Date(), "d MMMM yyyy, EEEE", { locale: tr })}
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Bugünün Randevuları</CardTitle>
            <Calendar className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{todayAppointments.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Günlük Gelir</CardTitle>
            <Wallet className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">₺{dailyRevenue.toLocaleString('tr-TR')}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Aylık Gelir</CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">₺{monthlyTotal.toLocaleString('tr-TR')}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Toplam Müşteri</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{customers.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      {hasAnalyticsData ? (
        <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
          {/* Günlük Gelir */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Son 7 Gün Gelir</CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={dailyChartConfig} className="h-[250px] w-full">
                <BarChart data={dailyRevenueData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="day" className="text-xs" />
                  <YAxis className="text-xs" />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="gelir" fill="var(--color-gelir)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>

          {/* Aylık Gelir */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Bu Ay Gelir</CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={monthlyChartConfig} className="h-[250px] w-full">
                <BarChart data={monthlyRevenueData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="day" className="text-xs" />
                  <YAxis className="text-xs" />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="gelir" fill="var(--color-gelir)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>

          {/* En Çok Gelen Müşteriler */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">En Çok Gelen Müşteriler</CardTitle>
            </CardHeader>
            <CardContent>
              {topCustomers.length === 0 ? (
                <p className="text-muted-foreground text-sm py-8 text-center">Henüz tamamlanmış randevu yok.</p>
              ) : (
                <ChartContainer config={customerChartConfig} className="h-[250px] w-full">
                  <BarChart data={topCustomers} layout="vertical" margin={{ top: 5, right: 10, left: 80, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis type="number" className="text-xs" />
                    <YAxis dataKey="name" type="category" className="text-xs" width={75} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="ziyaret" fill="var(--color-ziyaret)" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>

          {/* En Çok Yapılan Hizmetler */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">En Çok Yapılan Hizmetler</CardTitle>
            </CardHeader>
            <CardContent>
              {topServices.length === 0 ? (
                <p className="text-muted-foreground text-sm py-8 text-center">Henüz tamamlanmış randevu yok.</p>
              ) : (
                <ChartContainer config={serviceChartConfig} className="h-[250px] w-full">
                  <BarChart data={topServices} layout="vertical" margin={{ top: 5, right: 10, left: 80, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis type="number" className="text-xs" />
                    <YAxis dataKey="name" type="category" className="text-xs" width={75} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="adet" fill="var(--color-adet)" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <TrendingUp className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground text-sm">Randevu tamamlayıp ödeme aldığınızda grafikler burada görünecek.</p>
          </CardContent>
        </Card>
      )}

      {/* Yaklaşan Randevular */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Yaklaşan Randevular</CardTitle>
        </CardHeader>
        <CardContent>
          {upcomingAppointments.length === 0 ? (
            <p className="text-muted-foreground text-sm py-4 text-center">Yaklaşan randevu bulunmamaktadır.</p>
          ) : (
            <div className="space-y-3">
              {upcomingAppointments.map(apt => (
                <div key={apt.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="space-y-1">
                    <p className="font-medium text-sm">{getCustomerName(apt.customerId)}</p>
                    <p className="text-xs text-muted-foreground">
                      {getServiceName(apt.serviceId)} • {getStaffName(apt.staffId)}
                    </p>
                  </div>
                  <div className="text-right space-y-1">
                    <p className="text-sm font-medium">
                      {format(parseISO(apt.startTime), 'HH:mm', { locale: tr })}
                    </p>
                    <Badge variant={statusVariant(apt.status)}>{statusMap[apt.status]}</Badge>
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
