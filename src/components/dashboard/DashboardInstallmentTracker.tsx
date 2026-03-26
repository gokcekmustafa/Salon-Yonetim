import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CalendarClock, AlertTriangle, Clock, CheckCircle2 } from 'lucide-react';
import { format, parseISO, isBefore, isToday, addDays, startOfDay } from 'date-fns';
import { tr } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';

interface Props {
  customers: { id: string; name: string }[];
}

export function DashboardInstallmentTracker({ customers }: Props) {
  const navigate = useNavigate();
  const { currentSalonId } = useAuth();

  const { data: installments = [] } = useQuery({
    queryKey: ['dashboard_installment_tracker', currentSalonId],
    queryFn: async () => {
      if (!currentSalonId) return [];
      const today = startOfDay(new Date());
      const futureLimit = format(addDays(today, 14), 'yyyy-MM-dd');

      const { data } = await supabase
        .from('installment_payments')
        .select('*, installments(customer_id)')
        .eq('salon_id', currentSalonId)
        .eq('is_paid', false)
        .lte('due_date', futureLimit)
        .order('due_date')
        .limit(10);
      return data || [];
    },
    enabled: !!currentSalonId,
  });

  const getCustomerName = (custId: string | undefined) =>
    custId ? customers.find(c => c.id === custId)?.name || '-' : '-';

  const getStatus = (dueDate: string) => {
    const due = parseISO(dueDate);
    const today = startOfDay(new Date());
    if (isBefore(due, today)) return 'overdue';
    if (isToday(due)) return 'today';
    return 'upcoming';
  };

  const statusConfig = {
    overdue: { label: 'Gecikmiş', icon: AlertTriangle, color: 'text-destructive', bg: 'bg-destructive/10 border-destructive/20' },
    today: { label: 'Bugün', icon: Clock, color: 'text-warning', bg: 'bg-warning/10 border-warning/20' },
    upcoming: { label: 'Yaklaşan', icon: CalendarClock, color: 'text-info', bg: 'bg-info/10 border-info/20' },
  };

  const overdueCount = installments.filter(i => getStatus(i.due_date) === 'overdue').length;
  const todayCount = installments.filter(i => getStatus(i.due_date) === 'today').length;

  return (
    <Card className="border-border/40">
      <CardHeader className="pb-1 px-4 pt-4">
        <CardTitle className="text-[13px] font-semibold flex items-center gap-2">
          <div className="h-6 w-6 rounded-md bg-warning/10 flex items-center justify-center">
            <CalendarClock className="h-3 w-3 text-warning" />
          </div>
          Taksit Takibi
          {(overdueCount > 0 || todayCount > 0) && (
            <div className="flex gap-1 ml-auto">
              {overdueCount > 0 && (
                <span className="text-[10px] font-bold text-destructive bg-destructive/10 px-1.5 py-0.5 rounded-full">
                  {overdueCount} gecikmiş
                </span>
              )}
              {todayCount > 0 && (
                <span className="text-[10px] font-bold text-warning bg-warning/10 px-1.5 py-0.5 rounded-full">
                  {todayCount} bugün
                </span>
              )}
            </div>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 pb-3">
        {installments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <CheckCircle2 className="h-8 w-8 text-success/40 mb-2" />
            <p className="text-xs text-muted-foreground">Yaklaşan taksit yok</p>
          </div>
        ) : (
          <div className="space-y-1.5 max-h-[280px] overflow-y-auto">
            {installments.map((p: any) => {
              const status = getStatus(p.due_date);
              const config = statusConfig[status];
              const custId = p.installments?.customer_id;
              return (
                <div
                  key={p.id}
                  className={`flex items-center justify-between p-2 rounded-md border text-xs ${config.bg}`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <config.icon className={`h-3.5 w-3.5 shrink-0 ${config.color}`} />
                    <div className="min-w-0">
                      <p className="font-medium truncate">{getCustomerName(custId)}</p>
                      <p className="text-[10px] text-muted-foreground">
                        Taksit {p.installment_number} · {format(parseISO(p.due_date), 'd MMM', { locale: tr })}
                      </p>
                    </div>
                  </div>
                  <span className={`font-bold shrink-0 ml-2 ${config.color}`}>
                    ₺{Number(p.amount).toLocaleString('tr-TR')}
                  </span>
                </div>
              );
            })}
          </div>
        )}
        <Button
          variant="outline"
          size="sm"
          className="w-full text-[11px] h-7 mt-2"
          onClick={() => navigate('/taksitler')}
        >
          Tüm Taksitleri Gör
        </Button>
      </CardContent>
    </Card>
  );
}
