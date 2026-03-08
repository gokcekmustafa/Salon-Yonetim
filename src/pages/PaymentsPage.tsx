import { useMemo, useState } from 'react';
import { useSalonData } from '@/hooks/useSalonData';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { format, parseISO, isToday, isSameMonth } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Wallet, TrendingUp, Receipt, Loader2 } from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';
import { NoPermission } from '@/components/permissions/NoPermission';

export default function PaymentsPage() {
  const { hasPermission } = usePermissions();
  const { payments, appointments, customers, services, loading } = useSalonData();
  const [month, setMonth] = useState(format(new Date(), 'yyyy-MM'));

  const dailyRevenue = useMemo(() =>
    payments.filter(p => { try { return isToday(parseISO(p.payment_date)); } catch { return false; } }).reduce((s, p) => s + Number(p.amount), 0), [payments]);

  const monthlyRevenue = useMemo(() =>
    payments.filter(p => { try { return isSameMonth(parseISO(p.payment_date), parseISO(month + '-01')); } catch { return false; } }).reduce((s, p) => s + Number(p.amount), 0), [payments, month]);

  const monthPayments = useMemo(() =>
    payments.filter(p => { try { return isSameMonth(parseISO(p.payment_date), parseISO(month + '-01')); } catch { return false; } })
      .sort((a, b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime()), [payments, month]);

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

  const kpis = [
    { label: 'Günlük Gelir', value: `₺${dailyRevenue.toLocaleString('tr-TR')}`, icon: Wallet, color: 'text-success bg-success/10' },
    { label: 'Aylık Gelir', value: `₺${monthlyRevenue.toLocaleString('tr-TR')}`, icon: TrendingUp, color: 'text-primary bg-primary/10' },
  ];

  return (
    <div className="page-container animate-in">
      <div className="page-header"><div><h1 className="page-title">Kasa</h1><p className="page-subtitle">Ödeme geçmişi ve gelir takibi</p></div></div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
        {kpis.map(kpi => (
          <div key={kpi.label} className="stat-card p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{kpi.label}</p>
                <p className="text-2xl font-bold tracking-tight tabular-nums">{kpi.value}</p>
              </div>
              <div className={`h-11 w-11 rounded-xl flex items-center justify-center ${kpi.color}`}><kpi.icon className="h-5 w-5" /></div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2"><Input type="month" value={month} onChange={e => setMonth(e.target.value)} className="w-48 h-10" /></div>

      {/* Mobile Cards */}
      <div className="block md:hidden space-y-3">
        {monthPayments.length === 0 ? (
          <Card className="shadow-soft border-border/60"><CardContent className="empty-state"><Receipt className="empty-state-icon" /><p className="empty-state-title">Bu ay ödeme yok</p></CardContent></Card>
        ) : monthPayments.map(p => (
          <div key={p.id} className="card-interactive p-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <p className="font-semibold text-sm">{getCustomerName(p.appointment_id)}</p>
                <p className="text-xs text-muted-foreground">{getServiceName(p.appointment_id)}</p>
                <p className="text-xs text-muted-foreground">{format(parseISO(p.payment_date), 'd MMM yyyy HH:mm', { locale: tr })}</p>
              </div>
              <div className="text-right space-y-1">
                <p className="font-bold tabular-nums">₺{Number(p.amount).toLocaleString('tr-TR')}</p>
                <Badge variant="secondary" className="text-[10px] font-semibold">{p.payment_type === 'nakit' ? 'Nakit' : 'Kart'}</Badge>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop Table */}
      <Card className="hidden md:block shadow-soft border-border/60 overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow className="hover:bg-transparent"><TableHead className="font-semibold">Tarih</TableHead><TableHead className="font-semibold">Müşteri</TableHead><TableHead className="font-semibold">Hizmet</TableHead><TableHead className="font-semibold">Ödeme Türü</TableHead><TableHead className="text-right font-semibold">Tutar</TableHead></TableRow></TableHeader>
            <TableBody>
              {monthPayments.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground text-sm">Bu ay ödeme bulunmamaktadır.</TableCell></TableRow>
              ) : monthPayments.map(p => (
                <TableRow key={p.id}>
                  <TableCell className="text-muted-foreground">{format(parseISO(p.payment_date), 'd MMM yyyy HH:mm', { locale: tr })}</TableCell>
                  <TableCell className="font-medium">{getCustomerName(p.appointment_id)}</TableCell>
                  <TableCell className="text-muted-foreground">{getServiceName(p.appointment_id)}</TableCell>
                  <TableCell><Badge variant="secondary" className="text-[10px] font-semibold">{p.payment_type === 'nakit' ? 'Nakit' : 'Kart'}</Badge></TableCell>
                  <TableCell className="text-right font-bold tabular-nums">₺{Number(p.amount).toLocaleString('tr-TR')}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
