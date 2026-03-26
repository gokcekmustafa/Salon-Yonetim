import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Clock, Calendar, Plus } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useNavigate } from 'react-router-dom';

interface Props {
  appointments: any[];
  getName: (list: any[], id: string) => string;
  customers: any[];
  services: any[];
  staff: any[];
}

const getStatusConfig = (a: any) => {
  if (a.status === 'tamamlandi' || a.session_status === 'completed')
    return { label: 'Tamamlandı', dotClass: 'bg-success', badgeClass: 'bg-success/10 text-success border-success/20' };
  if (a.session_status === 'in_session')
    return { label: 'Şu an', dotClass: 'bg-accent animate-pulse', badgeClass: 'bg-accent/10 text-accent border-accent/20' };
  return { label: 'Bekliyor', dotClass: 'bg-primary', badgeClass: 'bg-primary/10 text-primary border-primary/20' };
};

export function DashboardTodayTimeline({ appointments, getName, customers, services, staff }: Props) {
  const navigate = useNavigate();

  return (
    <Card className="border-border/40">
      <CardHeader className="pb-2 px-4 pt-4">
        <CardTitle className="text-[13px] font-semibold flex items-center gap-2">
          <div className="h-6 w-6 rounded-md bg-primary/10 flex items-center justify-center">
            <Clock className="h-3 w-3 text-primary" />
          </div>
          Bugünün Randevuları
          <Badge variant="secondary" className="ml-auto text-[10px] h-5">{appointments.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 pb-3 space-y-1">
        {appointments.length === 0 ? (
          <div className="py-8 text-center">
            <Calendar className="h-8 w-8 mx-auto text-muted-foreground/20 mb-2" />
            <p className="text-xs text-muted-foreground">Bugün randevu yok</p>
          </div>
        ) : (
          <div className="max-h-[260px] overflow-y-auto space-y-1 pr-1">
            {appointments.map(apt => {
              const status = getStatusConfig(apt);
              return (
                <div key={apt.id} className="flex items-center gap-2.5 p-2.5 rounded-lg hover:bg-muted/40 transition-colors">
                  <div className="w-12 text-right shrink-0">
                    <span className="text-xs font-bold tabular-nums">{format(parseISO(apt.start_time), 'HH:mm')}</span>
                  </div>
                  <div className={`h-2 w-2 rounded-full shrink-0 ${status.dotClass}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{getName(customers, apt.customer_id)}</p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {getName(services, apt.service_id)} · {getName(staff, apt.staff_id)}
                    </p>
                  </div>
                  <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${status.badgeClass}`}>
                    {status.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}
        <Button
          variant="outline"
          size="sm"
          className="w-full mt-2 gap-1.5 text-xs rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 border-0"
          onClick={() => navigate('/randevular?yeniRandevu=1')}
        >
          <Plus className="h-3.5 w-3.5" />
          Yeni randevu ekle
        </Button>
      </CardContent>
    </Card>
  );
}
