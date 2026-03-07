import { useMemo, useState } from 'react';
import { useSalon } from '@/contexts/SalonContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { format, parseISO, isToday, isSameMonth } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Wallet, TrendingUp } from 'lucide-react';

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

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-2xl font-bold">Kasa</h1>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Günlük Gelir</CardTitle>
            <Wallet className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent><div className="text-3xl font-bold">₺{dailyRevenue.toLocaleString('tr-TR')}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Aylık Gelir</CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent><div className="text-3xl font-bold">₺{monthlyRevenue.toLocaleString('tr-TR')}</div></CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-2">
        <Input type="month" value={month} onChange={e => setMonth(e.target.value)} className="w-48" />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tarih</TableHead>
                <TableHead>Müşteri</TableHead>
                <TableHead>Hizmet</TableHead>
                <TableHead>Ödeme Türü</TableHead>
                <TableHead className="text-right">Tutar</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {monthPayments.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Bu ay ödeme bulunmamaktadır.</TableCell></TableRow>
              ) : monthPayments.map(p => (
                <TableRow key={p.id}>
                  <TableCell>{format(parseISO(p.date), 'd MMM yyyy HH:mm', { locale: tr })}</TableCell>
                  <TableCell>{getCustomerName(p.appointmentId)}</TableCell>
                  <TableCell>{getServiceName(p.appointmentId)}</TableCell>
                  <TableCell><Badge variant="secondary">{p.type === 'nakit' ? 'Nakit' : 'Kart'}</Badge></TableCell>
                  <TableCell className="text-right font-medium">₺{p.amount.toLocaleString('tr-TR')}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
