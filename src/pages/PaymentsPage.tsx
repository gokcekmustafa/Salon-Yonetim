import { useMemo, useState } from 'react';
import { useSalon } from '@/contexts/SalonContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { format, parseISO, isToday, isSameMonth } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Wallet, TrendingUp, Receipt } from 'lucide-react';

export default function PaymentsPage() {
  const { payments, appointments, customers, services } = useSalon();
  const [month, setMonth] = useState(format(new Date(), 'yyyy-MM'));

  const dailyRevenue = useMemo(() =>
    payments.filter(p => { try { return isToday(parseISO(p.date)); } catch { return false; } })
      .reduce((s, p) => s + p.amount, 0), [payments]);

  const monthlyRevenue = useMemo(() =>
    payments.filter(p => { try { return isSameMonth(parseISO(p.date), parseISO(month + '-01')); } catch { return false; } })
      .reduce((s, p) => s + p.amount, 0), [payments, month]);

  const monthPayments = useMemo(() =>
    payments.filter(p => { try { return isSameMonth(parseISO(p.date), parseISO(month + '-01')); } catch { return false; } })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()), [payments, month]);

  const getCustomerName = (aptId: string) => {
    const apt = appointments.find(a => a.id === aptId);
    if (!apt) return '-';
    return customers.find(c => c.id === apt.customerId)?.name ?? '-';
  };

  const getServiceName = (aptId: string) => {
    const apt = appointments.find(a => a.id === aptId);
    if (!apt) return '-';
    return services.find(s => s.id === apt.serviceId)?.name ?? '-';
  };

  const kpis = [
    { label: 'Günlük Gelir', value: `₺${dailyRevenue.toLocaleString('tr-TR')}`, icon: Wallet, color: 'text-success bg-success/8' },
    { label: 'Aylık Gelir', value: `₺${monthlyRevenue.toLocaleString('tr-TR')}`, icon: TrendingUp, color: 'text-primary bg-primary/8' },
  ];

  return (
    <div className="page-container animate-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Kasa</h1>
          <p className="page-subtitle">Ödeme geçmişi ve gelir takibi</p>
        </div>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
        {kpis.map(kpi => (
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

      <div className="flex items-center gap-2">
        <Input type="month" value={month} onChange={e => setMonth(e.target.value)} className="w-48 h-9" />
      </div>

      {/* Mobile card view */}
      <div className="block md:hidden space-y-3">
        {monthPayments.length === 0 ? (
          <Card className="shadow-card border-border/60">
            <CardContent className="empty-state">
              <Receipt className="empty-state-icon" />
              <p className="empty-state-title">Bu ay ödeme yok</p>
              <p className="empty-state-description">Randevular tamamlandığında ödemeler burada görünecek.</p>
            </CardContent>
          </Card>
        ) : monthPayments.map(p => (
          <Card key={p.id} className="shadow-soft border-border/60">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <p className="font-medium text-sm">{getCustomerName(p.appointmentId)}</p>
                  <p className="text-xs text-muted-foreground">{getServiceName(p.appointmentId)}</p>
                  <p className="text-xs text-muted-foreground">{format(parseISO(p.date), 'd MMM yyyy HH:mm', { locale: tr })}</p>
                </div>
                <div className="text-right space-y-1">
                  <p className="font-bold">₺{p.amount.toLocaleString('tr-TR')}</p>
                  <Badge variant="secondary" className="text-[10px]">{p.type === 'nakit' ? 'Nakit' : 'Kart'}</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Desktop table */}
      <Card className="hidden md:block shadow-card border-border/60">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="font-semibold">Tarih</TableHead>
                <TableHead className="font-semibold">Müşteri</TableHead>
                <TableHead className="font-semibold">Hizmet</TableHead>
                <TableHead className="font-semibold">Ödeme Türü</TableHead>
                <TableHead className="text-right font-semibold">Tutar</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {monthPayments.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground text-sm">Bu ay ödeme bulunmamaktadır.</TableCell></TableRow>
              ) : monthPayments.map(p => (
                <TableRow key={p.id}>
                  <TableCell className="text-muted-foreground">{format(parseISO(p.date), 'd MMM yyyy HH:mm', { locale: tr })}</TableCell>
                  <TableCell className="font-medium">{getCustomerName(p.appointmentId)}</TableCell>
                  <TableCell className="text-muted-foreground">{getServiceName(p.appointmentId)}</TableCell>
                  <TableCell><Badge variant="secondary" className="text-[10px]">{p.type === 'nakit' ? 'Nakit' : 'Kart'}</Badge></TableCell>
                  <TableCell className="text-right font-semibold">₺{p.amount.toLocaleString('tr-TR')}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
