import { useState, useMemo } from 'react';
import { useSalon } from '@/contexts/SalonContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import {
  Building2, Users, UserCheck, TrendingUp, Wallet,
  Calendar as CalendarIcon, BarChart3, Scissors,
} from 'lucide-react';
import {
  format, subDays, subMonths, eachDayOfInterval, eachMonthOfInterval,
  isSameDay, isSameMonth, parseISO, startOfMonth, endOfMonth,
  startOfDay, isWithinInterval,
} from 'date-fns';
import { tr } from 'date-fns/locale';

type DateRange = '7d' | '30d' | '90d' | '12m';

const PIE_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--accent))',
  'hsl(var(--success))',
  'hsl(340, 50%, 65%)',
  'hsl(220, 60%, 55%)',
  'hsl(160, 50%, 50%)',
];

export default function ReportsPage() {
  const { appointments, payments, customers, staff, services, branches } = useSalon();

  const [dateRange, setDateRange] = useState<DateRange>('30d');
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);

  const activeBranches = branches.filter(b => b.active);
  const activeStaff = selectedBranchId
    ? staff.filter(s => s.active && s.branchId === selectedBranchId)
    : staff.filter(s => s.active);

  // Date range calculation
  const { startDate, endDate } = useMemo(() => {
    const end = new Date();
    let start: Date;
    switch (dateRange) {
      case '7d': start = subDays(end, 6); break;
      case '30d': start = subDays(end, 29); break;
      case '90d': start = subDays(end, 89); break;
      case '12m': start = subMonths(end, 11); break;
      default: start = subDays(end, 29);
    }
    return { startDate: startOfDay(start), endDate: end };
  }, [dateRange]);

  // Filtered data
  const filteredAppointments = useMemo(() => {
    return appointments.filter(a => {
      try {
        const d = parseISO(a.startTime);
        if (!isWithinInterval(d, { start: startDate, end: endDate })) return false;
        if (selectedBranchId && a.branchId !== selectedBranchId) return false;
        if (selectedStaffId && a.staffId !== selectedStaffId) return false;
        return true;
      } catch { return false; }
    });
  }, [appointments, startDate, endDate, selectedBranchId, selectedStaffId]);

  const filteredPayments = useMemo(() => {
    return payments.filter(p => {
      try {
        const d = parseISO(p.date);
        if (!isWithinInterval(d, { start: startDate, end: endDate })) return false;
        if (selectedBranchId || selectedStaffId) {
          const apt = appointments.find(a => a.id === p.appointmentId);
          if (!apt) return false;
          if (selectedBranchId && apt.branchId !== selectedBranchId) return false;
          if (selectedStaffId && apt.staffId !== selectedStaffId) return false;
        }
        return true;
      } catch { return false; }
    });
  }, [payments, appointments, startDate, endDate, selectedBranchId, selectedStaffId]);

  // KPIs
  const totalRevenue = filteredPayments.reduce((s, p) => s + p.amount, 0);
  const completedCount = filteredAppointments.filter(a => a.status === 'tamamlandi').length;
  const cancelledCount = filteredAppointments.filter(a => a.status === 'iptal').length;
  const avgRevenue = completedCount > 0 ? Math.round(totalRevenue / completedCount) : 0;

  // Revenue over time
  const revenueOverTime = useMemo(() => {
    if (dateRange === '12m') {
      const months = eachMonthOfInterval({ start: startDate, end: endDate });
      return months.map(m => ({
        label: format(m, 'MMM yy', { locale: tr }),
        gelir: filteredPayments
          .filter(p => { try { return isSameMonth(parseISO(p.date), m); } catch { return false; } })
          .reduce((s, p) => s + p.amount, 0),
      }));
    }
    const days = eachDayOfInterval({ start: startDate, end: endDate });
    return days.map(d => ({
      label: dateRange === '7d' ? format(d, 'EEE', { locale: tr }) : format(d, 'd MMM', { locale: tr }),
      gelir: filteredPayments
        .filter(p => { try { return isSameDay(parseISO(p.date), d); } catch { return false; } })
        .reduce((s, p) => s + p.amount, 0),
    }));
  }, [filteredPayments, startDate, endDate, dateRange]);

  // Top services
  const topServices = useMemo(() => {
    const map: Record<string, { count: number; revenue: number }> = {};
    filteredAppointments.filter(a => a.status === 'tamamlandi').forEach(a => {
      const svc = services.find(s => s.id === a.serviceId);
      if (!svc) return;
      if (!map[a.serviceId]) map[a.serviceId] = { count: 0, revenue: 0 };
      map[a.serviceId].count++;
      map[a.serviceId].revenue += svc.price;
    });
    return Object.entries(map)
      .sort(([, a], [, b]) => b.count - a.count)
      .slice(0, 6)
      .map(([id, data]) => ({
        name: services.find(s => s.id === id)?.name ?? '-',
        adet: data.count,
        gelir: data.revenue,
      }));
  }, [filteredAppointments, services]);

  // Top customers
  const topCustomers = useMemo(() => {
    const map: Record<string, number> = {};
    filteredAppointments.filter(a => a.status === 'tamamlandi').forEach(a => {
      map[a.customerId] = (map[a.customerId] || 0) + 1;
    });
    return Object.entries(map)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 6)
      .map(([id, count]) => ({
        name: customers.find(c => c.id === id)?.name ?? '-',
        ziyaret: count,
      }));
  }, [filteredAppointments, customers]);

  // Staff performance
  const staffPerformance = useMemo(() => {
    const map: Record<string, { completed: number; cancelled: number; revenue: number }> = {};
    filteredAppointments.forEach(a => {
      if (!map[a.staffId]) map[a.staffId] = { completed: 0, cancelled: 0, revenue: 0 };
      if (a.status === 'tamamlandi') {
        map[a.staffId].completed++;
        const svc = services.find(s => s.id === a.serviceId);
        if (svc) map[a.staffId].revenue += svc.price;
      }
      if (a.status === 'iptal') map[a.staffId].cancelled++;
    });
    return Object.entries(map)
      .sort(([, a], [, b]) => b.revenue - a.revenue)
      .map(([id, data]) => ({
        name: staff.find(s => s.id === id)?.name ?? '-',
        branch: branches.find(b => b.id === staff.find(s => s.id === id)?.branchId)?.name ?? '-',
        ...data,
      }));
  }, [filteredAppointments, staff, services, branches]);

  // Service distribution for pie chart
  const serviceDistribution = useMemo(() => {
    return topServices.map((s, i) => ({
      ...s,
      fill: PIE_COLORS[i % PIE_COLORS.length],
    }));
  }, [topServices]);

  const revenueChartConfig: ChartConfig = { gelir: { label: 'Gelir (₺)', color: 'hsl(var(--primary))' } };
  const serviceBarConfig: ChartConfig = { adet: { label: 'Adet', color: 'hsl(var(--accent))' } };
  const customerBarConfig: ChartConfig = { ziyaret: { label: 'Ziyaret', color: 'hsl(var(--primary))' } };
  const perfConfig: ChartConfig = {
    completed: { label: 'Tamamlanan', color: 'hsl(var(--primary))' },
    cancelled: { label: 'İptal', color: 'hsl(var(--destructive))' },
  };

  const hasData = filteredPayments.length > 0 || filteredAppointments.length > 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Raporlar</h1>
          <p className="text-muted-foreground text-sm">Detaylı analiz ve performans raporları</p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1">
              <Label className="text-xs">Tarih Aralığı</Label>
              <Select value={dateRange} onValueChange={v => setDateRange(v as DateRange)}>
                <SelectTrigger className="w-36 h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7d">Son 7 Gün</SelectItem>
                  <SelectItem value="30d">Son 30 Gün</SelectItem>
                  <SelectItem value="90d">Son 90 Gün</SelectItem>
                  <SelectItem value="12m">Son 12 Ay</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs flex items-center gap-1"><Building2 className="h-3 w-3" /> Şube</Label>
              <Select
                value={selectedBranchId || 'all'}
                onValueChange={v => { setSelectedBranchId(v === 'all' ? null : v); setSelectedStaffId(null); }}
              >
                <SelectTrigger className="w-40 h-9 text-sm">
                  <SelectValue placeholder="Tüm Şubeler" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tüm Şubeler</SelectItem>
                  {activeBranches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs flex items-center gap-1"><UserCheck className="h-3 w-3" /> Personel</Label>
              <Select
                value={selectedStaffId || 'all'}
                onValueChange={v => setSelectedStaffId(v === 'all' ? null : v)}
              >
                <SelectTrigger className="w-40 h-9 text-sm">
                  <SelectValue placeholder="Tüm Personel" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tüm Personel</SelectItem>
                  {activeStaff.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="ml-auto text-xs text-muted-foreground">
              {format(startDate, 'd MMM yyyy', { locale: tr })} — {format(endDate, 'd MMM yyyy', { locale: tr })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Toplam Gelir</CardTitle>
            <Wallet className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">₺{totalRevenue.toLocaleString('tr-TR')}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Tamamlanan</CardTitle>
            <CalendarIcon className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{completedCount} <span className="text-sm font-normal text-muted-foreground">randevu</span></div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">İptal Oranı</CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {filteredAppointments.length > 0 ? Math.round((cancelledCount / filteredAppointments.length) * 100) : 0}%
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Ort. Randevu Geliri</CardTitle>
            <BarChart3 className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">₺{avgRevenue.toLocaleString('tr-TR')}</div></CardContent>
        </Card>
      </div>

      {!hasData ? (
        <Card>
          <CardContent className="py-16 text-center">
            <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">Bu filtreler için veri bulunamadı.</p>
            <p className="text-xs text-muted-foreground mt-1">Randevu oluşturup tamamladığınızda raporlar burada görünecek.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Revenue Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Gelir Grafiği</CardTitle>
              <CardDescription>{dateRange === '12m' ? 'Aylık' : 'Günlük'} gelir trendi</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={revenueChartConfig} className="h-[300px] w-full">
                {dateRange === '12m' || dateRange === '90d' ? (
                  <LineChart data={revenueOverTime} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="label" className="text-xs" />
                    <YAxis className="text-xs" />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Line type="monotone" dataKey="gelir" stroke="var(--color-gelir)" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                ) : (
                  <BarChart data={revenueOverTime} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="label" className="text-xs" />
                    <YAxis className="text-xs" />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="gelir" fill="var(--color-gelir)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                )}
              </ChartContainer>
            </CardContent>
          </Card>

          <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
            {/* Top Services */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><Scissors className="h-4 w-4" /> En Çok Yapılan Hizmetler</CardTitle>
              </CardHeader>
              <CardContent>
                {topServices.length === 0 ? (
                  <p className="text-muted-foreground text-sm py-8 text-center">Veri yok.</p>
                ) : (
                  <>
                    <ChartContainer config={serviceBarConfig} className="h-[220px] w-full">
                      <BarChart data={topServices} layout="vertical" margin={{ top: 5, right: 10, left: 80, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis type="number" className="text-xs" />
                        <YAxis dataKey="name" type="category" className="text-xs" width={75} />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Bar dataKey="adet" fill="var(--color-adet)" radius={[0, 6, 6, 0]} />
                      </BarChart>
                    </ChartContainer>
                    <Separator className="my-3" />
                    <div className="space-y-2">
                      {topServices.map((s, i) => (
                        <div key={i} className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">{s.name}</span>
                          <span className="font-medium">₺{s.gelir.toLocaleString('tr-TR')}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Top Customers */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4" /> En Çok Gelen Müşteriler</CardTitle>
              </CardHeader>
              <CardContent>
                {topCustomers.length === 0 ? (
                  <p className="text-muted-foreground text-sm py-8 text-center">Veri yok.</p>
                ) : (
                  <>
                    <ChartContainer config={customerBarConfig} className="h-[220px] w-full">
                      <BarChart data={topCustomers} layout="vertical" margin={{ top: 5, right: 10, left: 80, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis type="number" className="text-xs" />
                        <YAxis dataKey="name" type="category" className="text-xs" width={75} />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Bar dataKey="ziyaret" fill="var(--color-ziyaret)" radius={[0, 6, 6, 0]} />
                      </BarChart>
                    </ChartContainer>
                    <Separator className="my-3" />
                    <div className="space-y-2">
                      {topCustomers.map((c, i) => (
                        <div key={i} className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">{c.name}</span>
                          <Badge variant="secondary">{c.ziyaret} ziyaret</Badge>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Staff Performance */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><UserCheck className="h-4 w-4" /> Personel Performans Raporu</CardTitle>
              <CardDescription>Personel bazlı randevu ve gelir karşılaştırması</CardDescription>
            </CardHeader>
            <CardContent>
              {staffPerformance.length === 0 ? (
                <p className="text-muted-foreground text-sm py-8 text-center">Veri yok.</p>
              ) : (
                <>
                  <ChartContainer config={perfConfig} className="h-[280px] w-full">
                    <BarChart data={staffPerformance} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="name" className="text-xs" />
                      <YAxis className="text-xs" />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="completed" fill="var(--color-completed)" radius={[6, 6, 0, 0]} name="Tamamlanan" />
                      <Bar dataKey="cancelled" fill="var(--color-cancelled)" radius={[6, 6, 0, 0]} name="İptal" />
                    </BarChart>
                  </ChartContainer>

                  <Separator className="my-4" />

                  {/* Performance table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 font-medium text-muted-foreground">Personel</th>
                          <th className="text-left py-2 font-medium text-muted-foreground">Şube</th>
                          <th className="text-right py-2 font-medium text-muted-foreground">Tamamlanan</th>
                          <th className="text-right py-2 font-medium text-muted-foreground">İptal</th>
                          <th className="text-right py-2 font-medium text-muted-foreground">Gelir</th>
                        </tr>
                      </thead>
                      <tbody>
                        {staffPerformance.map((sp, i) => (
                          <tr key={i} className="border-b last:border-0">
                            <td className="py-2.5 font-medium">{sp.name}</td>
                            <td className="py-2.5 text-muted-foreground">{sp.branch}</td>
                            <td className="py-2.5 text-right">
                              <Badge variant="default" className="text-xs">{sp.completed}</Badge>
                            </td>
                            <td className="py-2.5 text-right">
                              <Badge variant={sp.cancelled > 0 ? 'destructive' : 'secondary'} className="text-xs">{sp.cancelled}</Badge>
                            </td>
                            <td className="py-2.5 text-right font-semibold">₺{sp.revenue.toLocaleString('tr-TR')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
