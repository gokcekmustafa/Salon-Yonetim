import { useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useBranchFilteredData } from '@/hooks/useBranchFilteredData';
import { usePermissions } from '@/hooks/usePermissions';
import { NoPermission } from '@/components/permissions/NoPermission';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, Users, TrendingUp, Calendar, DollarSign, Target, UserCheck } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { startOfDay, startOfWeek, startOfMonth, startOfYear, endOfDay, format, isWithinInterval } from 'date-fns';
import { tr } from 'date-fns/locale';
import { useQuery } from '@tanstack/react-query';
import { StaffPageGuard } from '@/components/permissions/StaffPageGuard';

type TimeRange = 'daily' | 'weekly' | 'monthly' | 'yearly';

const TIME_LABELS: Record<TimeRange, string> = {
  daily: 'Günlük',
  weekly: 'Haftalık',
  monthly: 'Aylık',
  yearly: 'Yıllık',
};

const CHART_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--chart-2, 160 60% 45%))',
  'hsl(var(--chart-3, 30 80% 55%))',
  'hsl(var(--chart-4, 280 65% 60%))',
  'hsl(var(--chart-5, 340 75% 55%))',
];

function getDateRange(range: TimeRange): { start: Date; end: Date } {
  const now = new Date();
  const end = endOfDay(now);
  switch (range) {
    case 'daily': return { start: startOfDay(now), end };
    case 'weekly': return { start: startOfWeek(now, { weekStartsOn: 1 }), end };
    case 'monthly': return { start: startOfMonth(now), end };
    case 'yearly': return { start: startOfYear(now), end };
  }
}

export default function StaffPerformancePage() {
  const { hasPermission } = usePermissions();
  const { currentSalonId, isSuperAdmin } = useAuth();
  const { staff, appointments, payments, loading: salonLoading } = useBranchFilteredData();

  const [timeRange, setTimeRange] = useState<TimeRange>('monthly');
  const [selectedStaffId, setSelectedStaffId] = useState<string>('all');

  const salonId = currentSalonId;

  // Fetch leads for the salon
  const { data: leads = [], isLoading: leadsLoading } = useQuery({
    queryKey: ['leads-perf', salonId],
    queryFn: async () => {
      if (!salonId) return [];
      const { data } = await supabase.from('leads').select('id, assigned_staff_id, status, created_at').eq('salon_id', salonId);
      return data || [];
    },
    enabled: !!salonId,
  });

  if (!hasPermission('can_manage_staff')) return <NoPermission feature="Personel Performansı" />;
  if (salonLoading || leadsLoading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );

  const activeStaff = staff.filter(s => s.is_active);
  const { start, end } = getDateRange(timeRange);
  const interval = { start, end };

  const inRange = (dateStr: string) => {
    try { return isWithinInterval(new Date(dateStr), interval); } catch { return false; }
  };

  const filteredAppointments = appointments.filter(a => inRange(a.start_time));
  const filteredPayments = payments.filter(p => inRange(p.payment_date));
  const filteredLeads = leads.filter(l => inRange(l.created_at));

  // Compute per-staff metrics
  const staffMetrics = activeStaff.map(s => {
    const staffAppts = filteredAppointments.filter(a => a.staff_id === s.id);
    const completed = staffAppts.filter(a => a.status === 'tamamlandi').length;
    const total = staffAppts.length;
    const cancelled = staffAppts.filter(a => a.status === 'iptal').length;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    const staffPayments = filteredPayments.filter(p => {
      if (!p.appointment_id) return false;
      const appt = appointments.find(a => a.id === p.appointment_id);
      return appt?.staff_id === s.id;
    });
    const totalSales = staffPayments.reduce((sum, p) => sum + Number(p.amount), 0);

    const leadsContacted = filteredLeads.filter(l => l.assigned_staff_id === s.id).length;
    const leadsWon = filteredLeads.filter(l => l.assigned_staff_id === s.id && l.status === 'won').length;

    const sessions = staffAppts.filter(a => (a as any).session_status === 'completed').length;

    return {
      id: s.id,
      name: s.name,
      totalAppointments: total,
      completed,
      cancelled,
      completionRate,
      totalSales,
      leadsContacted,
      leadsWon,
      sessions,
    };
  });

  const displayMetrics = selectedStaffId === 'all'
    ? staffMetrics
    : staffMetrics.filter(m => m.id === selectedStaffId);

  // Aggregate totals
  const totals = displayMetrics.reduce((acc, m) => ({
    appointments: acc.appointments + m.totalAppointments,
    completed: acc.completed + m.completed,
    sales: acc.sales + m.totalSales,
    leads: acc.leads + m.leadsContacted,
  }), { appointments: 0, completed: 0, sales: 0, leads: 0 });

  const overallRate = totals.appointments > 0 ? Math.round((totals.completed / totals.appointments) * 100) : 0;

  // Chart data
  const barData = displayMetrics.map(m => ({
    name: m.name.length > 10 ? m.name.slice(0, 10) + '…' : m.name,
    Randevu: m.totalAppointments,
    Tamamlanan: m.completed,
    Satış: Math.round(m.totalSales),
  }));

  const pieData = displayMetrics
    .filter(m => m.totalSales > 0)
    .map(m => ({ name: m.name, value: Math.round(m.totalSales) }));

  return (
    <StaffPageGuard permissionKey="page_performance" featureLabel="Performans">
    <div className="page-container animate-in space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Personel Performansı</h1>
          <p className="page-subtitle">Personel bazlı performans analizi ve karşılaştırma</p>
        </div>
        <div className="flex gap-2">
          <Select value={timeRange} onValueChange={v => setTimeRange(v as TimeRange)}>
            <SelectTrigger className="h-10 w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(TIME_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedStaffId} onValueChange={setSelectedStaffId}>
            <SelectTrigger className="h-10 w-44"><SelectValue placeholder="Tüm Personel" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tüm Personel</SelectItem>
              {activeStaff.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Date Range Info */}
      <p className="text-xs text-muted-foreground">
        {format(start, 'd MMMM yyyy', { locale: tr })} — {format(end, 'd MMMM yyyy', { locale: tr })}
      </p>

      {/* KPI Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card className="shadow-soft border-border/60">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Toplam Randevu</p>
                <p className="text-2xl font-bold tabular-nums">{totals.appointments}</p>
              </div>
              <div className="h-11 w-11 rounded-xl flex items-center justify-center text-primary bg-primary/10">
                <Calendar className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-soft border-border/60">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Tamamlanma</p>
                <p className="text-2xl font-bold tabular-nums">{overallRate}%</p>
              </div>
              <div className="h-11 w-11 rounded-xl flex items-center justify-center text-primary bg-primary/10">
                <Target className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-soft border-border/60">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Toplam Satış</p>
                <p className="text-2xl font-bold tabular-nums">₺{totals.sales.toLocaleString('tr-TR')}</p>
              </div>
              <div className="h-11 w-11 rounded-xl flex items-center justify-center text-primary bg-primary/10">
                <DollarSign className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-soft border-border/60">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Adaylar</p>
                <p className="text-2xl font-bold tabular-nums">{totals.leads}</p>
              </div>
              <div className="h-11 w-11 rounded-xl flex items-center justify-center text-primary bg-primary/10">
                <Users className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      {displayMetrics.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Bar Chart */}
          <Card className="shadow-soft border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" /> Randevu & Satış Karşılaştırması
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                    <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                    <Tooltip
                      contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }}
                      labelStyle={{ fontWeight: 600 }}
                    />
                    <Bar dataKey="Randevu" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Tamamlanan" fill="hsl(var(--chart-2, 160 60% 45%))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Pie Chart - Sales Distribution */}
          <Card className="shadow-soft border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-primary" /> Satış Dağılımı
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                {pieData.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                    Bu dönemde satış verisi yok
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={3}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {pieData.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number) => `₺${value.toLocaleString('tr-TR')}`}
                        contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Detail Table */}
      <Card className="shadow-soft border-border/60 overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <UserCheck className="h-4 w-4 text-primary" /> Personel Detay Tablosu
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="font-semibold">Personel</TableHead>
                <TableHead className="font-semibold text-center">Randevu</TableHead>
                <TableHead className="font-semibold text-center">Tamamlanan</TableHead>
                <TableHead className="font-semibold text-center hidden md:table-cell">İptal</TableHead>
                <TableHead className="font-semibold text-center">Oran</TableHead>
                <TableHead className="font-semibold text-center hidden md:table-cell">Seans</TableHead>
                <TableHead className="font-semibold text-center hidden lg:table-cell">Aday</TableHead>
                <TableHead className="font-semibold text-center hidden lg:table-cell">Kazanılan</TableHead>
                <TableHead className="font-semibold text-right">Satış</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayMetrics.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                    Aktif personel bulunamadı
                  </TableCell>
                </TableRow>
              ) : displayMetrics.map(m => (
                <TableRow key={m.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="text-xs font-bold text-primary">{m.name.charAt(0)}</span>
                      </div>
                      <span className="font-medium text-sm">{m.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center tabular-nums">{m.totalAppointments}</TableCell>
                  <TableCell className="text-center tabular-nums">{m.completed}</TableCell>
                  <TableCell className="text-center tabular-nums hidden md:table-cell">{m.cancelled}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant={m.completionRate >= 80 ? 'default' : m.completionRate >= 50 ? 'secondary' : 'destructive'} className="text-[10px]">
                      {m.completionRate}%
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center tabular-nums hidden md:table-cell">{m.sessions}</TableCell>
                  <TableCell className="text-center tabular-nums hidden lg:table-cell">{m.leadsContacted}</TableCell>
                  <TableCell className="text-center tabular-nums hidden lg:table-cell">{m.leadsWon}</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">₺{m.totalSales.toLocaleString('tr-TR')}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
    </StaffPageGuard>
}
