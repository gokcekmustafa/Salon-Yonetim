import { useSalon } from '@/contexts/SalonContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Users, Wallet, Clock } from 'lucide-react';
import { format, isToday, isFuture, parseISO } from 'date-fns';
import { tr } from 'date-fns/locale';

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

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground text-sm">
          {format(new Date(), "d MMMM yyyy, EEEE", { locale: tr })}
        </p>
      </div>

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
            <CardTitle className="text-sm font-medium text-muted-foreground">Toplam Müşteri</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{customers.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Yaklaşan Randevu</CardTitle>
            <Clock className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{upcomingAppointments.length}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Yaklaşan Randevular</CardTitle>
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
