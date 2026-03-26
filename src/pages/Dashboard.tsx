import { useBranchFilteredData } from '@/hooks/useBranchFilteredData';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';
import { format, isToday, parseISO, isSameMonth, startOfDay } from 'date-fns';
import { tr } from 'date-fns/locale';
import { useQuery } from '@tanstack/react-query';
import SuperAdminDashboard from './SuperAdminDashboard';
import { SubscriptionAlert } from '@/components/notifications/SubscriptionAlert';
import { DashboardKPICards } from '@/components/dashboard/DashboardKPICards';
import { DashboardWeeklyChart } from '@/components/dashboard/DashboardWeeklyChart';
import { DashboardTodayTimeline } from '@/components/dashboard/DashboardTodayTimeline';
import { DashboardStaffPerformance } from '@/components/dashboard/DashboardStaffPerformance';
import { DashboardOccupancy } from '@/components/dashboard/DashboardOccupancy';
import { DashboardQuickActions } from '@/components/dashboard/DashboardQuickActions';
import { DashboardOverdueAlert } from '@/components/dashboard/DashboardOverdueAlert';
import { DashboardBirthdays } from '@/components/dashboard/DashboardBirthdays';

export default function Dashboard() {
  const { isSuperAdmin, currentSalonId, profile } = useAuth();
  const { appointments, customers, payments, staff, services, loading, salon } = useBranchFilteredData();

  const { data: overdueInstallments = [] } = useQuery({
    queryKey: ['overdue_installments_dashboard', currentSalonId],
    queryFn: async () => {
      if (!currentSalonId) return [];
      const today = format(startOfDay(new Date()), 'yyyy-MM-dd');
      const { data } = await supabase
        .from('installment_payments')
        .select('*, installments(customer_id)')
        .eq('salon_id', currentSalonId)
        .eq('is_paid', false)
        .lt('due_date', today)
        .order('due_date')
        .limit(5);
      return data || [];
    },
    enabled: !!currentSalonId,
  });

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

  // Occupancy stats
  const completed = todayAppointments.filter(a => a.status === 'tamamlandi' || a.session_status === 'completed').length;
  const inSession = todayAppointments.filter(a => a.session_status === 'in_session').length;
  const waiting = todayAppointments.length - completed - inSession;

  const firstName = profile?.full_name?.split(' ')[0] || 'Kullanıcı';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Günaydın' : hour < 18 ? 'İyi günler' : 'İyi akşamlar';

  return (
    <div className="space-y-4 animate-in">
      {salon && (
        <SubscriptionAlert
          expiresAt={salon.subscription_expires_at}
          plan={salon.subscription_plan || 'free'}
        />
      )}

      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-lg font-bold tracking-tight">{greeting}, {firstName} 👋</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {format(new Date(), 'd MMMM yyyy, EEEE', { locale: tr })} · {todayAppointments.length} randevu
          </p>
        </div>
      </div>

      {/* KPIs */}
      <DashboardKPICards data={{
        todayAppointments: todayAppointments.length,
        dailyRevenue,
        monthlyTotal,
        totalCustomers: customers.length,
      }} />

      {/* Overdue Alert */}
      <DashboardOverdueAlert overdueInstallments={overdueInstallments} customers={customers} />

      {/* Main Grid: Chart + Timeline */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-5">
        <div className="lg:col-span-3 space-y-4">
          <DashboardWeeklyChart payments={payments} />
          <DashboardStaffPerformance staffCounts={activeStaffToday} />
        </div>
        <div className="lg:col-span-2 space-y-4">
          <DashboardTodayTimeline
            appointments={todayAppointments}
            getName={getName}
            customers={customers}
            services={services}
            staff={staff}
          />
          <DashboardOccupancy completed={completed} inSession={inSession} waiting={waiting} total={todayAppointments.length} />
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        <DashboardBirthdays customers={customers} />
        <div>
          <p className="text-[12px] font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Hızlı İşlemler</p>
          <DashboardQuickActions />
        </div>
      </div>
    </div>
  );
}
