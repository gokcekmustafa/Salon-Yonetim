import { useState, useMemo, useEffect } from 'react';
import { useBranchFilteredData } from '@/hooks/useBranchFilteredData';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  Calendar as CalendarIcon, BarChart3, Scissors, Banknote, CreditCard, ArrowRightLeft, FileSpreadsheet, FileText,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { exportToExcel, exportToPDF } from '@/lib/exportUtils';
import {
  format, subDays, subMonths, subWeeks, eachDayOfInterval, eachMonthOfInterval, eachWeekOfInterval,
  isSameDay, isSameMonth, isSameWeek, parseISO, startOfDay, startOfWeek, startOfYear, endOfYear,
  isWithinInterval,
} from 'date-fns';
import { tr } from 'date-fns/locale';

type DateRange = 'daily' | 'weekly' | 'monthly' | 'yearly';

const PIE_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--accent))',
  'hsl(142, 50%, 45%)',
  'hsl(340, 50%, 65%)',
  'hsl(220, 60%, 55%)',
  'hsl(160, 50%, 50%)',
];

const CASH_BOX_ICONS: Record<string, React.ElementType> = {
  cash: Banknote,
  eft: ArrowRightLeft,
  credit_card: CreditCard,
};

type CashBox = { id: string; name: string; payment_method: string; salon_id: string; is_active: boolean };
type CashTx = { id: string; cash_box_id: string | null; amount: number; type: string; description: string | null; transaction_date: string; payment_method: string; salon_id: string };

export default function ReportsPage() {
  const { appointments, payments, customers, staff, services, branches } = useSalonData();
  const { currentSalonId } = useAuth();

  const [dateRange, setDateRange] = useState<DateRange>('monthly');
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);

  // Cash box data
  const [cashBoxes, setCashBoxes] = useState<CashBox[]>([]);
  const [cashTransactions, setCashTransactions] = useState<CashTx[]>([]);

  useEffect(() => {
    if (!currentSalonId) return;
    const fetchCash = async () => {
      const [boxRes, txRes] = await Promise.all([
        supabase.from('cash_boxes').select('*').eq('salon_id', currentSalonId),
        supabase.from('cash_transactions').select('*').eq('salon_id', currentSalonId).order('transaction_date', { ascending: false }),
      ]);
      setCashBoxes((boxRes.data as CashBox[]) || []);
      setCashTransactions((txRes.data as CashTx[]) || []);
    };
    fetchCash();
  }, [currentSalonId]);

  const activeBranches = branches.filter(b => b.is_active);
  const activeStaff = selectedBranchId
    ? staff.filter(s => s.is_active && s.branch_id === selectedBranchId)
    : staff.filter(s => s.is_active);

  const { startDate, endDate } = useMemo(() => {
    const end = new Date();
    let start: Date;
    switch (dateRange) {
      case 'daily': start = subDays(end, 6); break;
      case 'weekly': start = subWeeks(end, 7); break;
      case 'monthly': start = subMonths(end, 11); break;
      case 'yearly': start = startOfYear(subMonths(end, 36)); break;
      default: start = subMonths(end, 11);
    }
    return { startDate: startOfDay(start), endDate: end };
  }, [dateRange]);

  const filteredAppointments = useMemo(() => {
    return appointments.filter(a => {
      try {
        const d = parseISO(a.start_time);
        if (!isWithinInterval(d, { start: startDate, end: endDate })) return false;
        if (selectedBranchId && a.branch_id !== selectedBranchId) return false;
        if (selectedStaffId && a.staff_id !== selectedStaffId) return false;
        return true;
      } catch { return false; }
    });
  }, [appointments, startDate, endDate, selectedBranchId, selectedStaffId]);

  const filteredPayments = useMemo(() => {
    return payments.filter(p => {
      try {
        const d = parseISO(p.payment_date);
        if (!isWithinInterval(d, { start: startDate, end: endDate })) return false;
        if (selectedBranchId || selectedStaffId) {
          const apt = appointments.find(a => a.id === p.appointment_id);
          if (!apt) return false;
          if (selectedBranchId && apt.branch_id !== selectedBranchId) return false;
          if (selectedStaffId && apt.staff_id !== selectedStaffId) return false;
        }
        return true;
      } catch { return false; }
    });
  }, [payments, appointments, startDate, endDate, selectedBranchId, selectedStaffId]);

  const filteredCashTx = useMemo(() => {
    return cashTransactions.filter(tx => {
      try {
        const d = parseISO(tx.transaction_date);
        return isWithinInterval(d, { start: startDate, end: endDate });
      } catch { return false; }
    });
  }, [cashTransactions, startDate, endDate]);

  const totalRevenue = filteredPayments.reduce((s, p) => s + Number(p.amount), 0);
  const completedCount = filteredAppointments.filter(a => a.status === 'tamamlandi').length;
  const cancelledCount = filteredAppointments.filter(a => a.status === 'iptal').length;
  const avgRevenue = completedCount > 0 ? Math.round(totalRevenue / completedCount) : 0;

  // Cash box summaries
  const cashBoxSummaries = useMemo(() => {
    return cashBoxes.map(box => {
      const txs = filteredCashTx.filter(tx => tx.cash_box_id === box.id);
      const income = txs.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
      const expense = txs.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
      return { ...box, income, expense, balance: income - expense, txCount: txs.length };
    });
  }, [cashBoxes, filteredCashTx]);

  const totalCashIncome = cashBoxSummaries.reduce((s, b) => s + b.income, 0);
  const totalCashExpense = cashBoxSummaries.reduce((s, b) => s + b.expense, 0);

  // Cash over time per box
  const cashOverTime = useMemo(() => {
    if (dateRange === 'yearly') {
      const years = [startDate.getFullYear(), startDate.getFullYear() + 1, startDate.getFullYear() + 2, new Date().getFullYear()];
      const uniqueYears = [...new Set(years)];
      return uniqueYears.map(y => {
        const row: any = { label: String(y) };
        cashBoxes.forEach(box => {
          row[box.payment_method] = filteredCashTx
            .filter(tx => tx.cash_box_id === box.id && tx.type === 'income' && parseISO(tx.transaction_date).getFullYear() === y)
            .reduce((s, t) => s + Number(t.amount), 0);
        });
        return row;
      });
    }
    if (dateRange === 'monthly') {
      const months = eachMonthOfInterval({ start: startDate, end: endDate });
      return months.map(m => {
        const row: any = { label: format(m, 'MMM yy', { locale: tr }) };
        cashBoxes.forEach(box => {
          row[box.payment_method] = filteredCashTx
            .filter(tx => tx.cash_box_id === box.id && tx.type === 'income' && isSameMonth(parseISO(tx.transaction_date), m))
            .reduce((s, t) => s + Number(t.amount), 0);
        });
        return row;
      });
    }
    if (dateRange === 'weekly') {
      const weeks = eachWeekOfInterval({ start: startDate, end: endDate }, { weekStartsOn: 1 });
      return weeks.map(w => {
        const row: any = { label: format(w, 'd MMM', { locale: tr }) };
        cashBoxes.forEach(box => {
          row[box.payment_method] = filteredCashTx
            .filter(tx => tx.cash_box_id === box.id && tx.type === 'income' && isSameWeek(parseISO(tx.transaction_date), w, { weekStartsOn: 1 }))
            .reduce((s, t) => s + Number(t.amount), 0);
        });
        return row;
      });
    }
    const days = eachDayOfInterval({ start: startDate, end: endDate });
    return days.map(d => {
      const row: any = { label: format(d, 'EEE', { locale: tr }) };
      cashBoxes.forEach(box => {
        row[box.payment_method] = filteredCashTx
          .filter(tx => tx.cash_box_id === box.id && tx.type === 'income' && isSameDay(parseISO(tx.transaction_date), d))
          .reduce((s, t) => s + Number(t.amount), 0);
      });
      return row;
    });
  }, [filteredCashTx, cashBoxes, startDate, endDate, dateRange]);

  const revenueOverTime = useMemo(() => {
    if (dateRange === 'monthly' || dateRange === 'yearly') {
      const months = eachMonthOfInterval({ start: startDate, end: endDate });
      return months.map(m => ({
        label: format(m, 'MMM yy', { locale: tr }),
        gelir: filteredPayments
          .filter(p => { try { return isSameMonth(parseISO(p.payment_date), m); } catch { return false; } })
          .reduce((s, p) => s + Number(p.amount), 0),
      }));
    }
    if (dateRange === 'weekly') {
      const weeks = eachWeekOfInterval({ start: startDate, end: endDate }, { weekStartsOn: 1 });
      return weeks.map(w => ({
        label: format(w, 'd MMM', { locale: tr }),
        gelir: filteredPayments
          .filter(p => { try { return isSameWeek(parseISO(p.payment_date), w, { weekStartsOn: 1 }); } catch { return false; } })
          .reduce((s, p) => s + Number(p.amount), 0),
      }));
    }
    const days = eachDayOfInterval({ start: startDate, end: endDate });
    return days.map(d => ({
      label: format(d, 'EEE', { locale: tr }),
      gelir: filteredPayments
        .filter(p => { try { return isSameDay(parseISO(p.payment_date), d); } catch { return false; } })
        .reduce((s, p) => s + Number(p.amount), 0),
    }));
  }, [filteredPayments, startDate, endDate, dateRange]);

  const topServices = useMemo(() => {
    const map: Record<string, { count: number; revenue: number }> = {};
    filteredAppointments.filter(a => a.status === 'tamamlandi').forEach(a => {
      const svc = services.find(s => s.id === a.service_id);
      if (!svc) return;
      if (!map[a.service_id]) map[a.service_id] = { count: 0, revenue: 0 };
      map[a.service_id].count++;
      map[a.service_id].revenue += svc.price;
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

  const topCustomers = useMemo(() => {
    const map: Record<string, number> = {};
    filteredAppointments.filter(a => a.status === 'tamamlandi').forEach(a => {
      map[a.customer_id] = (map[a.customer_id] || 0) + 1;
    });
    return Object.entries(map)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 6)
      .map(([id, count]) => ({
        name: customers.find(c => c.id === id)?.name ?? '-',
        ziyaret: count,
      }));
  }, [filteredAppointments, customers]);

  const staffPerformance = useMemo(() => {
    const map: Record<string, { completed: number; cancelled: number; revenue: number }> = {};
    filteredAppointments.forEach(a => {
      if (!map[a.staff_id]) map[a.staff_id] = { completed: 0, cancelled: 0, revenue: 0 };
      if (a.status === 'tamamlandi') {
        map[a.staff_id].completed++;
        const svc = services.find(s => s.id === a.service_id);
        if (svc) map[a.staff_id].revenue += svc.price;
      }
      if (a.status === 'iptal') map[a.staff_id].cancelled++;
    });
    return Object.entries(map)
      .sort(([, a], [, b]) => b.revenue - a.revenue)
      .map(([id, data]) => ({
        name: staff.find(s => s.id === id)?.name ?? '-',
        branch: branches.find(b => b.id === staff.find(s => s.id === id)?.branch_id)?.name ?? '-',
        ...data,
      }));
  }, [filteredAppointments, staff, services, branches]);

  const revenueChartConfig: ChartConfig = { gelir: { label: 'Gelir (₺)', color: 'hsl(var(--primary))' } };
  const serviceBarConfig: ChartConfig = { adet: { label: 'Adet', color: 'hsl(var(--accent))' } };
  const customerBarConfig: ChartConfig = { ziyaret: { label: 'Ziyaret', color: 'hsl(var(--primary))' } };
  const perfConfig: ChartConfig = {
    completed: { label: 'Tamamlanan', color: 'hsl(var(--primary))' },
    cancelled: { label: 'İptal', color: 'hsl(var(--destructive))' },
  };
  const cashChartConfig: ChartConfig = {
    cash: { label: 'Nakit', color: 'hsl(142, 50%, 45%)' },
    eft: { label: 'EFT/Havale', color: 'hsl(220, 60%, 55%)' },
    credit_card: { label: 'Kredi Kartı', color: 'hsl(340, 50%, 65%)' },
  };

  const hasData = filteredPayments.length > 0 || filteredAppointments.length > 0;

  const periodLabel = dateRange === 'daily' ? 'Günlük' : dateRange === 'weekly' ? 'Haftalık' : dateRange === 'monthly' ? 'Aylık' : 'Yıllık';

  return (
    <div className="page-container animate-in space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Raporlar</h1>
          <p className="text-muted-foreground text-sm">Detaylı analiz ve performans raporları</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => {
            const headers = ['Kasa', 'Gelir (₺)', 'Gider (₺)', 'Net (₺)', 'İşlem Sayısı'];
            const rows = cashBoxSummaries.map(b => ({
              Kasa: b.name,
              'Gelir (₺)': b.income,
              'Gider (₺)': b.expense,
              'Net (₺)': b.balance,
              'İşlem Sayısı': b.txCount,
            }));
            exportToExcel(rows, headers, `rapor-${periodLabel}`);
          }} className="gap-1.5">
            <FileSpreadsheet className="h-4 w-4" /> Excel
          </Button>
          <Button variant="outline" size="sm" onClick={() => {
            const headers = ['Kasa', 'Gelir (₺)', 'Gider (₺)', 'Net (₺)', 'İşlem'];
            const rows = cashBoxSummaries.map(b => [
              b.name,
              b.income.toLocaleString('tr-TR'),
              b.expense.toLocaleString('tr-TR'),
              b.balance.toLocaleString('tr-TR'),
              String(b.txCount),
            ]);
            const summary = [
              `Dönem: ${periodLabel}  |  Toplam Gelir: ₺${totalRevenue.toLocaleString('tr-TR')}`,
              `Tamamlanan: ${completedCount} randevu  |  İptal: ${cancelledCount}`,
            ];
            exportToPDF(rows, headers, 'Kasa & Performans Raporu', `rapor-${periodLabel}`, summary);
          }} className="gap-1.5">
            <FileText className="h-4 w-4" /> PDF
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Periyot</Label>
              <Select value={dateRange} onValueChange={v => setDateRange(v as DateRange)}>
                <SelectTrigger className="w-full sm:w-36 h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Günlük</SelectItem>
                  <SelectItem value="weekly">Haftalık</SelectItem>
                  <SelectItem value="monthly">Aylık</SelectItem>
                  <SelectItem value="yearly">Yıllık</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs flex items-center gap-1"><Building2 className="h-3 w-3" /> Şube</Label>
              <Select value={selectedBranchId || 'all'} onValueChange={v => { setSelectedBranchId(v === 'all' ? null : v); setSelectedStaffId(null); }}>
                <SelectTrigger className="w-full sm:w-40 h-9 text-sm"><SelectValue placeholder="Tüm Şubeler" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tüm Şubeler</SelectItem>
                  {activeBranches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs flex items-center gap-1"><UserCheck className="h-3 w-3" /> Personel</Label>
              <Select value={selectedStaffId || 'all'} onValueChange={v => setSelectedStaffId(v === 'all' ? null : v)}>
                <SelectTrigger className="w-full sm:w-40 h-9 text-sm"><SelectValue placeholder="Tüm Personel" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tüm Personel</SelectItem>
                  {activeStaff.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-2 sm:col-span-1 sm:ml-auto text-xs text-muted-foreground">
              {format(startDate, 'd MMM yyyy', { locale: tr })} — {format(endDate, 'd MMM yyyy', { locale: tr })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards */}
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

      {/* Cash Box Summary Cards */}
      {cashBoxSummaries.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">Kasa Özeti ({periodLabel})</h2>
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            {/* Total card */}
            <Card className="border-primary/30 bg-primary/5">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Toplam Kasa</CardTitle>
                <Wallet className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold text-primary">₺{(totalCashIncome - totalCashExpense).toLocaleString('tr-TR')}</div>
                <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                  <span className="text-green-600">+₺{totalCashIncome.toLocaleString('tr-TR')}</span>
                  <span className="text-red-500">-₺{totalCashExpense.toLocaleString('tr-TR')}</span>
                </div>
              </CardContent>
            </Card>
            {cashBoxSummaries.map(box => {
              const Icon = CASH_BOX_ICONS[box.payment_method] || Wallet;
              return (
                <Card key={box.id}>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">{box.name}</CardTitle>
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-xl font-bold">₺{box.balance.toLocaleString('tr-TR')}</div>
                    <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                      <span className="text-green-600">+₺{box.income.toLocaleString('tr-TR')}</span>
                      <span className="text-red-500">-₺{box.expense.toLocaleString('tr-TR')}</span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {!hasData && cashBoxSummaries.every(b => b.txCount === 0) ? (
        <Card>
          <CardContent className="py-16 text-center">
            <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">Bu filtreler için veri bulunamadı.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Cash Box Chart */}
          {cashBoxes.length > 0 && filteredCashTx.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Kasa Gelir Analizi</CardTitle>
                <CardDescription>{periodLabel} kasa türüne göre gelir dağılımı</CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="chart">
                  <TabsList className="mb-4">
                    <TabsTrigger value="chart">Grafik</TabsTrigger>
                    <TabsTrigger value="table">Tablo</TabsTrigger>
                  </TabsList>
                  <TabsContent value="chart">
                    <ChartContainer config={cashChartConfig} className="h-[300px] w-full">
                      <BarChart data={cashOverTime} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis dataKey="label" className="text-xs" />
                        <YAxis className="text-xs" />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        {cashBoxes.map(box => (
                          <Bar key={box.id} dataKey={box.payment_method} stackId="a" fill={`var(--color-${box.payment_method})`} radius={[2, 2, 0, 0]} />
                        ))}
                      </BarChart>
                    </ChartContainer>
                  </TabsContent>
                  <TabsContent value="table">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-2 font-medium text-muted-foreground">Kasa</th>
                            <th className="text-right py-2 font-medium text-muted-foreground">Gelir</th>
                            <th className="text-right py-2 font-medium text-muted-foreground">Gider</th>
                            <th className="text-right py-2 font-medium text-muted-foreground">Net</th>
                            <th className="text-right py-2 font-medium text-muted-foreground">İşlem</th>
                          </tr>
                        </thead>
                        <tbody>
                          {cashBoxSummaries.map(box => (
                            <tr key={box.id} className="border-b last:border-0">
                              <td className="py-2.5 font-medium">{box.name}</td>
                              <td className="py-2.5 text-right text-green-600">₺{box.income.toLocaleString('tr-TR')}</td>
                              <td className="py-2.5 text-right text-red-500">₺{box.expense.toLocaleString('tr-TR')}</td>
                              <td className="py-2.5 text-right font-semibold">₺{box.balance.toLocaleString('tr-TR')}</td>
                              <td className="py-2.5 text-right"><Badge variant="secondary">{box.txCount}</Badge></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          )}

          {/* Revenue over time */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Gelir Grafiği</CardTitle>
              <CardDescription>{periodLabel} gelir trendi</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={revenueChartConfig} className="h-[300px] w-full">
                {dateRange === 'monthly' || dateRange === 'yearly' ? (
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

          {/* Services & Customers */}
          <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
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
                            <td className="py-2.5 text-right"><Badge variant="default" className="text-xs">{sp.completed}</Badge></td>
                            <td className="py-2.5 text-right"><Badge variant={sp.cancelled > 0 ? 'destructive' : 'secondary'} className="text-xs">{sp.cancelled}</Badge></td>
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
