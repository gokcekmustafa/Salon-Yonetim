import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Ticket, CalendarDays, Clock, User, DoorOpen } from 'lucide-react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface Props {
  customerId: string;
  sessionCredits: any[];
  appointments: any[];
  services: any[];
  staff: any[];
}

export function SessionCreditsDetail({ customerId, sessionCredits, appointments, services, staff }: Props) {
  const { currentSalonId } = useAuth();

  const { data: rooms = [] } = useQuery({
    queryKey: ['rooms_for_credits', currentSalonId],
    queryFn: async () => {
      if (!currentSalonId) return [];
      const { data } = await supabase.from('rooms').select('id, name').eq('salon_id', currentSalonId);
      return data || [];
    },
    enabled: !!currentSalonId,
  });

  const credits = useMemo(() => sessionCredits.filter((sc: any) => sc.customer_id === customerId), [sessionCredits, customerId]);

  // Completed appointments for this customer (used sessions)
  const completedAppointments = useMemo(() =>
    appointments.filter((a: any) => a.customer_id === customerId && (a.status === 'tamamlandi')),
    [appointments, customerId]
  );

  const getRoomName = (id: string | null) => rooms.find((r: any) => r.id === id)?.name || '-';
  const getStaffName = (id: string) => staff.find((s: any) => s.id === id)?.name || '-';
  const getServiceName = (id: string) => services.find((s: any) => s.id === id)?.name || '-';

  if (credits.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Ticket className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">Seans hakkı bulunamadı</p>
      </div>
    );
  }

  return (
    <Accordion type="multiple" className="space-y-2">
      {credits.map((sc: any) => {
        const serviceAppts = completedAppointments.filter((a: any) => a.service_id === sc.service_id);

        return (
          <AccordionItem key={sc.id} value={sc.id} className="border rounded-xl px-3">
            <AccordionTrigger className="py-3 hover:no-underline">
              <div className="flex items-center justify-between w-full pr-2">
                <div className="text-left">
                  <p className="text-sm font-medium">{sc.services?.name || 'Bilinmeyen Hizmet'}</p>
                  <p className="text-xs text-muted-foreground">Toplam: {sc.total_sessions} seans</p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="text-xs">
                    {sc.used_sessions} kullanıldı
                  </Badge>
                  <Badge variant={sc.remaining_sessions > 0 ? 'default' : 'secondary'} className="text-xs">
                    {sc.remaining_sessions} kalan
                  </Badge>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              {serviceAppts.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2 text-center">Henüz kullanılan seans yok</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Tarih</TableHead>
                        <TableHead className="text-xs">Saat</TableHead>
                        <TableHead className="text-xs">Süre</TableHead>
                        <TableHead className="text-xs">Hizmet</TableHead>
                        <TableHead className="text-xs">Personel</TableHead>
                        <TableHead className="text-xs">Oda</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {serviceAppts
                        .sort((a: any, b: any) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime())
                        .map((apt: any) => {
                          const start = new Date(apt.start_time);
                          const end = new Date(apt.end_time);
                          const durationMin = Math.round((end.getTime() - start.getTime()) / 60000);
                          return (
                            <TableRow key={apt.id}>
                              <TableCell className="text-xs whitespace-nowrap">
                                {format(start, 'dd MMM yyyy', { locale: tr })}
                              </TableCell>
                              <TableCell className="text-xs whitespace-nowrap">
                                {format(start, 'HH:mm')}
                              </TableCell>
                              <TableCell className="text-xs">{durationMin} dk</TableCell>
                              <TableCell className="text-xs">{getServiceName(apt.service_id)}</TableCell>
                              <TableCell className="text-xs">{getStaffName(apt.staff_id)}</TableCell>
                              <TableCell className="text-xs">{getRoomName(apt.room_id)}</TableCell>
                            </TableRow>
                          );
                        })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
}
