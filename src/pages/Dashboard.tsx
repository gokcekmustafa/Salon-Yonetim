import { useSalonData } from '@/hooks/useSalonData';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, Users, Wallet, TrendingUp, Loader2, Clock, Plus, CreditCard, BarChart3, UserCheck, CircleDot } from 'lucide-react';
import { format, isToday, parseISO, isSameMonth } from 'date-fns';
import { tr } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import SuperAdminDashboard from './SuperAdminDashboard';
import { SubscriptionAlert } from '@/components/notifications/SubscriptionAlert';

export default function Dashboard() {
  const { isSuperAdmin, currentSalonId, profile } = useAuth();
  const { appointments, customers, payments, staff, services, loading, salon } = useSalonData();
  const navigate = useNavigate();

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Yükleniyor...</p>
      </div>
    </div>
  );

  if (isSuperAdmin && !currentSalonId) {
    return <SuperAdminDashboard />;
  }

  const getName = (list: { id: string; name: string }[], id: string) => list.find(x => x.id === id)?.name ?? '-';

  const todayAppointments = appointments
    .filter(a => { try { return isToday(parseISO(a.start_time)); } catch { return false; } })
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

  const dailyRevenue = payments
    .filter(p => { try { return isToday(parseISO(p.payment_date)); } catch { return false; } })
    .reduce((s, p) => s + Number(p.amount), 0);

  const monthlyTotal = payments
    .filter(p => { try { return isSameMonth(parseISO(p.payment_date), new Date()); } catch { return false; } })
    .reduce((s, p) => s + Number(p.amount), 0);

  const staffTodayCounts: Record<string, number> = {};
  todayAppointments.forEach(a => {
    staffTodayCounts[a.staff_id] = (staffTodayCounts[a.staff_id] || 0) + 1;
  });
  const activeStaffToday = Object.entries(staffTodayCounts)
    .map(([id, count]) => ({ name: getName(staff, id), count }))
    .sort((a, b) => b.count - a.count);

  const getStatusConfig = (a: any) => {
    if (a.status === 'tamamlandi' || a.session_status === 'completed') {
      return { label: 'Tamamlandı', dotClass: 'bg-success', badgeClass: 'bg-success/10 text-success border-success/20' };
    }
    if (a.session_status === 'in_session') {
      return { label: 'Şu an', dotClass: 'bg-accent', badgeClass: 'bg-accent/10 text-accent border-accent/20' };
    }
    return { label: 'Bekliyor', dotClass: 'bg-primary', badgeClass: 'bg-primary/10 text-primary border-primary/20' };
  };

  const firstName = profile?.full_name?.split(' ')[0] || 'Kullanıcı';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Günaydın' : hour < 18 ? 'İyi günler' : 'İyi akşamlar';

  const kpis = [
    { label: 'Bugünün Randevuları', value: todayAppointments.length, icon: Calendar, iconClass: 'text-primary bg-primary/10' },
    { label: 'Günlük Gelir', value: `₺${dailyRevenue.toLocaleString('tr-TR')}`, icon: Wallet, iconClass: 'text-success bg-success/10' },
    { label: 'Aylık Gelir', value: `₺${monthlyTotal.toLocaleString('tr-TR')}`, icon: TrendingUp, iconClass: 'text-accent bg-accent/10' },
    { label: 'Toplam Müşteri', value: customers.length, icon: Users, iconClass: 'text-warning bg-warning/10' },
  ];

  const quickActions = [
    { label: 'Randevu Al', icon: Calendar, onClick: () => navigate('/randevular'), color: 'text-primary bg-primary/5 hover:bg-primary/10 border-primary/20' },
    { label: 'Yeni Müşteri', icon: Plus, onClick: () => navigate('/musteriler'), color: 'text-success bg-success/5 hover:bg-success/10 border-success/20' },
    { label: 'Ödeme Al', icon: CreditCard, onClick: () => navigate('/kasa'), color: 'text-accent bg-accent/5 hover:bg-accent/10 border-accent/20' },
    { label: 'Rapor Gör', icon: BarChart3, onClick: () => navigate('/raporlar'), color: 'text-warning bg-warning/5 hover:bg-warning/10 border-warning/20' },
  ];

  // Salon-specific inline styles only for salon users
  const isSalon = !isSuperAdmin;
  const salonCard = isSalon
    ? { borderRadius: '12px', border: '0.5px solid #e8e8e8', boxShadow: 'none' } as React.CSSProperties
    : undefined;

  return (
    <div className={isSalon ? 'space-y-6 animate-in' : 'page-container animate-in'}>
      {salon && (
        <SubscriptionAlert
          expiresAt={salon.subscription_expires_at}
          plan={salon.subscription_plan || 'free'}
        />
      )}

      <div>
        <h1 className={isSalon ? 'font-bold tracking-tight' : 'page-title'} style={isSalon ? { fontSize: '22px' } : undefined}>
          Anasayfa
        </h1>
        <p className={isSalon ? 'text-muted-foreground mt-1' : 'page-subtitle mt-1'} style={isSalon ? { fontSize: '14px' } : undefined}>
          {greeting}, {firstName} 👋 · Bugün {todayAppointments.length} randevunuz var{todayAppointments.length === 0 ? '.' : ` · ${format(new Date(), 'd MMMM yyyy, EEEE', { locale: tr })}`}
        </p>
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {kpis.map(kpi => (
          <div key={kpi.label} className={isSalon ? 'bg-card p-5' : 'stat-card p-5'} style={salonCard}>
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="font-semibold text-muted-foreground uppercase tracking-wider" style={{ fontSize: isSalon ? '12px' : '11px' }}>{kpi.label}</p>
                <p className={isSalon ? 'font-bold tracking-tight tabular-nums' : 'text-2xl font-bold tracking-tight tabular-nums'} style={isSalon ? { fontSize: '22px' } : undefined}>{kpi.value}</p>
              </div>
              <div className={`h-11 w-11 rounded-xl flex items-center justify-center ${kpi.iconClass}`}>
                <kpi.icon className="h-5 w-5" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
        <Card className={isSalon ? 'lg:col-span-2' : 'lg:col-span-2 shadow-soft border-border/60'} style={salonCard}>
          <CardHeader className="pb-3">
            <CardTitle style={{ fontSize: '14px' }} className="font-semibold flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
                <Clock className="h-3.5 w-3.5 text-primary" />
              </div>
              Bugünün Randevuları
              <Badge variant="secondary" className="ml-auto text-[10px]">{todayAppointments.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {todayAppointments.length === 0 ? (
              <div className="py-10 text-center">
                <Calendar className="h-10 w-10 mx-auto text-muted-foreground/25 mb-3" />
                <p className="text-sm font-medium text-muted-foreground">Bugün randevu yok</p>
                <p className="text-xs text-muted-foreground/70 mt-1">Yeni randevu ekleyerek başlayın.</p>
              </div>
            ) : (
              todayAppointments.map(apt => {
                const status = getStatusConfig(apt);
                return (
                  <div key={apt.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/40 transition-colors">
                    <div className="w-14 text-right shrink-0">
                      <span className="text-sm font-bold tabular-nums">{format(parseISO(apt.start_time), 'HH:mm')}</span>
                    </div>
                    <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${status.dotClass}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{getName(customers, apt.customer_id)}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {getName(services, apt.service_id)} · {getName(staff, apt.staff_id)}
                      </p>
                    </div>
                    <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full border shrink-0 ${status.badgeClass}`}>
                      {status.label}
                    </span>
                  </div>
                );
              })
            )}
            <Button
              variant="outline"
              className={isSalon
                ? 'w-full mt-3 gap-2 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 border-0'
                : 'w-full mt-3 gap-2'}
              style={isSalon ? { fontSize: '14px' } : undefined}
              onClick={() => navigate('/randevular')}
            >
              <Plus className="h-4 w-4" />
              Yeni randevu ekle
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className={isSalon ? '' : 'shadow-soft border-border/60'} style={salonCard}>
            <CardHeader className="pb-3">
              <CardTitle style={{ fontSize: '14px' }} className="font-semibold">Hızlı İşlemler</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                {quickActions.map(action => (
                  <button
                    key={action.label}
                    onClick={action.onClick}
                    className={`flex flex-col items-center justify-center gap-2 p-4 border transition-all duration-200 ${action.color}`}
                    style={{ borderRadius: '12px' }}
                  >
                    <action.icon className="h-5 w-5" />
                    <span style={{ fontSize: '12px' }} className="font-semibold">{action.label}</span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className={isSalon ? '' : 'shadow-soft border-border/60'} style={salonCard}>
            <CardHeader className="pb-3">
              <CardTitle style={{ fontSize: '14px' }} className="font-semibold flex items-center gap-2">
                <div className="h-7 w-7 rounded-lg bg-success/10 flex items-center justify-center">
                  <UserCheck className="h-3.5 w-3.5 text-success" />
                </div>
                Personel Durumu
              </CardTitle>
            </CardHeader>
            <CardContent>
              {activeStaffToday.length === 0 ? (
                <p className="text-muted-foreground text-center py-4" style={{ fontSize: '13px' }}>Bugün aktif personel yok</p>
              ) : (
                <div className="space-y-2">
                  {activeStaffToday.map(s => (
                    <div key={s.name} className="flex items-center justify-between p-2.5 rounded-lg hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-xs font-bold text-primary">{s.name.charAt(0)}</span>
                        </div>
                        <span className="font-medium" style={{ fontSize: '14px' }}>{s.name}</span>
                      </div>
                      <Badge variant="secondary" className="text-[10px]">{s.count} randevu</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
