import { useMemo, useState, useEffect } from 'react';
import { useBranchFilteredData } from '@/hooks/useBranchFilteredData';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { format, parseISO, isToday, isSameMonth, isSameWeek, startOfDay, subDays, subWeeks, subMonths, startOfYear, isWithinInterval, eachDayOfInterval, eachMonthOfInterval, isSameDay } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Wallet, TrendingUp, Receipt, Loader2, Banknote, ArrowRightLeft, CreditCard, FileSpreadsheet, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { exportToExcel, exportToPDF } from '@/lib/exportUtils';
import { usePermissions } from '@/hooks/usePermissions';
import { NoPermission } from '@/components/permissions/NoPermission';
import { StaffPageGuard } from '@/components/permissions/StaffPageGuard';

type DateRange = 'daily' | 'weekly' | 'monthly' | 'yearly';
type CashBox = { id: string; name: string; payment_method: string; salon_id: string; is_active: boolean };
type CashTx = { id: string; cash_box_id: string | null; amount: number; type: string; description: string | null; transaction_date: string; payment_method: string; salon_id: string };

const BOX_ICONS: Record<string, React.ElementType> = {
  cash: Banknote,
  eft: ArrowRightLeft,
  credit_card: CreditCard,
};

export default function PaymentsPage() {
  const { hasPermission } = usePermissions();
  const { payments, appointments, customers, services, loading } = useBranchFilteredData();
  const { currentSalonId } = useAuth();
  const [dateRange, setDateRange] = useState<DateRange>('monthly');
  const [cashBoxes, setCashBoxes] = useState<CashBox[]>([]);
  const [cashTransactions, setCashTransactions] = useState<CashTx[]>([]);

  useEffect(() => {
    if (!currentSalonId) return;
    const fetch = async () => {
      const [boxRes, txRes] = await Promise.all([
        supabase.from('cash_boxes').select('*').eq('salon_id', currentSalonId),
        supabase.from('cash_transactions').select('*').eq('salon_id', currentSalonId).order('transaction_date', { ascending: false }),
      ]);
      setCashBoxes((boxRes.data as CashBox[]) || []);
      setCashTransactions((txRes.data as CashTx[]) || []);
    };
    fetch();
  }, [currentSalonId]);

  const { startDate, endDate } = useMemo(() => {
    const end = new Date();
    let start: Date;
    switch (dateRange) {
      case 'daily': start = startOfDay(end); break;
      case 'weekly': start = subWeeks(end, 0); break;
      case 'monthly': start = subMonths(end, 0); break;
      case 'yearly': start = startOfYear(end); break;
      default: start = subMonths(end, 0);
    }
    // For daily, show today. For weekly current week. For monthly current month. For yearly current year.
    if (dateRange === 'daily') start = startOfDay(end);
    else if (dateRange === 'weekly') start = subDays(end, end.getDay() === 0 ? 6 : end.getDay() - 1);
    else if (dateRange === 'monthly') start = new Date(end.getFullYear(), end.getMonth(), 1);
    else start = startOfYear(end);
    return { startDate: startOfDay(start), endDate: end };
  }, [dateRange]);

  const filteredPayments = useMemo(() => {
    return payments.filter(p => {
      try {
        const d = parseISO(p.payment_date);
        return isWithinInterval(d, { start: startDate, end: endDate });
      } catch { return false; }
    }).sort((a, b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime());
  }, [payments, startDate, endDate]);

  const filteredCashTx = useMemo(() => {
    return cashTransactions.filter(tx => {
      try {
        const d = parseISO(tx.transaction_date);
        return isWithinInterval(d, { start: startDate, end: endDate });
      } catch { return false; }
    });
  }, [cashTransactions, startDate, endDate]);

  const totalRevenue = filteredPayments.reduce((s, p) => s + Number(p.amount), 0);

  // Per cash box summaries
  const boxSummaries = useMemo(() => {
    return cashBoxes.map(box => {
      const txs = filteredCashTx.filter(tx => tx.cash_box_id === box.id);
      const income = txs.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
      const expense = txs.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
      return { ...box, income, expense, balance: income - expense, txs };
    });
  }, [cashBoxes, filteredCashTx]);

  if (!hasPermission('can_manage_payments')) return <NoPermission feature="Kasa / Ödemeler" />;
  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="flex flex-col items-center gap-3"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="text-sm text-muted-foreground">Yükleniyor...</p></div>
    </div>
  );

  const getCustomerName = (aptId: string | null) => {
    if (!aptId) return '-';
    const apt = appointments.find(a => a.id === aptId);
    return apt ? (customers.find(c => c.id === apt.customer_id)?.name ?? '-') : '-';
  };

  const getServiceName = (aptId: string | null) => {
    if (!aptId) return '-';
    const apt = appointments.find(a => a.id === aptId);
    return apt ? (services.find(s => s.id === apt.service_id)?.name ?? '-') : '-';
  };

  const periodLabel = dateRange === 'daily' ? 'Bugün' : dateRange === 'weekly' ? 'Bu Hafta' : dateRange === 'monthly' ? 'Bu Ay' : 'Bu Yıl';

  return (
    <StaffPageGuard permissionKey="page_cash" featureLabel="Ödemeler">
    <div className="page-container animate-in space-y-5">
      <div className="page-header">
        <div><h1 className="page-title">Kasa & Ödemeler</h1><p className="page-subtitle">Ödeme geçmişi ve kasa bazlı gelir takibi</p></div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => {
            const headers = ['Tarih', 'Müşteri', 'Hizmet', 'Ödeme Türü', 'Tutar (₺)'];
            const rows = filteredPayments.map(p => ({
              Tarih: format(parseISO(p.payment_date), 'd MMM yyyy HH:mm', { locale: tr }),
              Müşteri: getCustomerName(p.appointment_id),
              Hizmet: getServiceName(p.appointment_id),
              'Ödeme Türü': p.payment_type === 'nakit' ? 'Nakit' : p.payment_type === 'eft' ? 'EFT' : 'Kart',
              'Tutar (₺)': Number(p.amount),
            }));
            exportToExcel(rows, headers, `odemeler-${periodLabel}`);
          }}>
            <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => {
            const headers = ['Tarih', 'Müşteri', 'Hizmet', 'Ödeme Türü', 'Tutar (₺)'];
            const rows = filteredPayments.map(p => [
              format(parseISO(p.payment_date), 'd MMM yyyy HH:mm', { locale: tr }),
              getCustomerName(p.appointment_id),
              getServiceName(p.appointment_id),
              p.payment_type === 'nakit' ? 'Nakit' : p.payment_type === 'eft' ? 'EFT' : 'Kart',
              Number(p.amount).toLocaleString('tr-TR'),
            ]);
            const summary = [`Toplam Gelir: ₺${totalRevenue.toLocaleString('tr-TR')}  |  Dönem: ${periodLabel}`];
            exportToPDF(rows, headers, 'Ödeme Raporu', `odemeler-${periodLabel}`, summary);
          }}>
            <FileText className="h-3.5 w-3.5" /> PDF
          </Button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <div className="flex items-center gap-3">
          <Label className="text-xs whitespace-nowrap">Periyot</Label>
          <Select value={dateRange} onValueChange={v => setDateRange(v as DateRange)}>
            <SelectTrigger className="w-28 sm:w-36 h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Günlük</SelectItem>
              <SelectItem value="weekly">Haftalık</SelectItem>
              <SelectItem value="monthly">Aylık</SelectItem>
              <SelectItem value="yearly">Yıllık</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <span className="text-xs text-muted-foreground sm:ml-auto">
          {format(startDate, 'd MMM yyyy', { locale: tr })} — {format(endDate, 'd MMM yyyy', { locale: tr })}
        </span>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <div className="stat-card p-5 border-primary/30 bg-primary/5">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Toplam Gelir ({periodLabel})</p>
              <p className="text-2xl font-bold tracking-tight tabular-nums text-primary">₺{totalRevenue.toLocaleString('tr-TR')}</p>
            </div>
            <div className="h-11 w-11 rounded-xl flex items-center justify-center text-primary bg-primary/10"><Wallet className="h-5 w-5" /></div>
          </div>
        </div>
        {boxSummaries.map(box => {
          const Icon = BOX_ICONS[box.payment_method] || Wallet;
          return (
    <StaffPageGuard permissionKey="page_cash" featureLabel="Kasa">
            <div key={box.id} className="stat-card p-5">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{box.name}</p>
                  <p className="text-2xl font-bold tracking-tight tabular-nums">₺{box.balance.toLocaleString('tr-TR')}</p>
                  <div className="flex gap-2 text-xs">
                    <span className="text-green-600">+₺{box.income.toLocaleString('tr-TR')}</span>
                    <span className="text-red-500">-₺{box.expense.toLocaleString('tr-TR')}</span>
                  </div>
                </div>
                <div className="h-11 w-11 rounded-xl flex items-center justify-center text-muted-foreground bg-muted"><Icon className="h-5 w-5" /></div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Tabs: Toplu + Per-box */}
      <Tabs defaultValue="all">
        <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
          <TabsList className="w-max">
            <TabsTrigger value="all">Tümü</TabsTrigger>
            {cashBoxes.map(box => (
              <TabsTrigger key={box.id} value={box.id}>{box.name}</TabsTrigger>
            ))}
          </TabsList>
        </div>

        {/* All payments tab */}
        <TabsContent value="all">
          <Card className="shadow-soft border-border/60 overflow-hidden overflow-x-auto">
            <CardContent className="p-0">
              {filteredPayments.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground text-sm"><Receipt className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />Bu dönemde ödeme yok</div>
              ) : (
                <Table className="min-w-[600px]">
                  <TableHeader><TableRow className="hover:bg-transparent"><TableHead className="font-semibold">Tarih</TableHead><TableHead className="font-semibold">Müşteri</TableHead><TableHead className="font-semibold">Hizmet</TableHead><TableHead className="font-semibold">Ödeme Türü</TableHead><TableHead className="text-right font-semibold">Tutar</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {filteredPayments.map(p => (
                      <TableRow key={p.id}>
                        <TableCell className="text-muted-foreground">{format(parseISO(p.payment_date), 'd MMM yyyy HH:mm', { locale: tr })}</TableCell>
                        <TableCell className="font-medium">{getCustomerName(p.appointment_id)}</TableCell>
                        <TableCell className="text-muted-foreground">{getServiceName(p.appointment_id)}</TableCell>
                        <TableCell><Badge variant="secondary" className="text-[10px] font-semibold">{p.payment_type === 'nakit' ? 'Nakit' : p.payment_type === 'eft' ? 'EFT' : 'Kart'}</Badge></TableCell>
                        <TableCell className="text-right font-bold tabular-nums">₺{Number(p.amount).toLocaleString('tr-TR')}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Per cash box tabs */}
        {boxSummaries.map(box => (
          <TabsContent key={box.id} value={box.id}>
            <Card className="shadow-soft border-border/60 overflow-hidden overflow-x-auto">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{box.name} — İşlem Geçmişi</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {box.txs.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground text-sm">Bu dönemde işlem yok</div>
                ) : (
                  <Table className="min-w-[500px]">
                    <TableHeader><TableRow className="hover:bg-transparent"><TableHead className="font-semibold">Tarih</TableHead><TableHead className="font-semibold">Tür</TableHead><TableHead className="font-semibold">Açıklama</TableHead><TableHead className="text-right font-semibold">Tutar</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {box.txs.map(tx => (
                        <TableRow key={tx.id}>
                          <TableCell className="text-muted-foreground">{format(parseISO(tx.transaction_date), 'd MMM yyyy HH:mm', { locale: tr })}</TableCell>
                          <TableCell>
                            <Badge variant={tx.type === 'income' ? 'default' : 'destructive'} className="text-[10px]">
                              {tx.type === 'income' ? 'Gelir' : 'Gider'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{tx.description || '-'}</TableCell>
                          <TableCell className={`text-right font-bold tabular-nums ${tx.type === 'income' ? 'text-green-600' : 'text-red-500'}`}>
                            {tx.type === 'income' ? '+' : '-'}₺{Number(tx.amount).toLocaleString('tr-TR')}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
    </StaffPageGuard>
  );
}
