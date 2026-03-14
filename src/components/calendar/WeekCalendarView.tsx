import React, { useState } from 'react';
import { format, parseISO, isSameDay, addDays, startOfWeek, setHours, setMinutes, differenceInMinutes, addMinutes } from 'date-fns';
import { tr } from 'date-fns/locale';
import { useSalonData, DbAppointment } from '@/hooks/useSalonData';
import { getEffectiveAppointmentStatus, type AppointmentUiStatus } from '@/lib/appointmentStatus';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const HOUR_HEIGHT = 64;
const START_HOUR = 8;
const END_HOUR = 21;
const HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);

const STATUS_COLORS: Record<string, string> = {
  bekliyor: 'bg-red-200 border-red-500 text-red-800 dark:bg-red-900/40 dark:border-red-500 dark:text-red-200',
  in_session: 'bg-yellow-200 border-yellow-500 text-yellow-800 dark:bg-yellow-900/40 dark:border-yellow-500 dark:text-yellow-200',
  tamamlandi: 'bg-green-200 border-green-500 text-green-800 dark:bg-green-900/40 dark:border-green-500 dark:text-green-200',
  iptal: 'bg-destructive/10 border-destructive/40 text-destructive',
};

const STAFF_ACCENTS = [
  'border-l-primary',
  'border-l-accent',
  'border-l-[hsl(var(--success))]',
  'border-l-destructive',
  'border-l-secondary-foreground',
];

interface WeekCalendarViewProps {
  date: Date;
  filteredStaffId: string | null;
  filteredBranchId?: string | null;
  onAppointmentClick: (apt: DbAppointment) => void;
}

export default function WeekCalendarView({ date, filteredStaffId, filteredBranchId, onAppointmentClick }: WeekCalendarViewProps) {
  const { appointments, staff, customers, services, updateAppointment, hasConflict } = useSalonData();
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragPreview, setDragPreview] = useState<{ top: number } | null>(null);

  const weekStart = startOfWeek(date, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const getStaffAccent = (staffId: string) => {
    const idx = staff.findIndex(s => s.id === staffId);
    return STAFF_ACCENTS[idx % STAFF_ACCENTS.length];
  };

  const getCustomerName = (id: string) => customers.find(c => c.id === id)?.name ?? '-';
  const getServiceName = (id: string) => services.find(s => s.id === id)?.name ?? '-';
  const getStaffName = (id: string) => staff.find(s => s.id === id)?.name ?? '-';

  const getAppointmentsForDay = (day: Date) =>
    appointments.filter(a => {
      try {
        if (!isSameDay(parseISO(a.start_time), day)) return false;
        if (filteredStaffId && a.staff_id !== filteredStaffId) return false;
        if (filteredBranchId && a.branch_id !== filteredBranchId) return false;
        return true;
      } catch { return false; }
    });

  const getAppointmentStyle = (apt: DbAppointment) => {
    const start = parseISO(apt.start_time);
    const end = parseISO(apt.end_time);
    const startMinutes = start.getHours() * 60 + start.getMinutes();
    const duration = differenceInMinutes(end, start);
    const top = ((startMinutes - START_HOUR * 60) / 60) * HOUR_HEIGHT;
    const height = Math.max((duration / 60) * HOUR_HEIGHT - 2, 20);
    return { top, height };
  };

  const snapToGrid = (minutes: number) => Math.round(minutes / 15) * 15;

  const handleDragStart = (e: React.DragEvent, aptId: string) => {
    e.dataTransfer.setData('appointmentId', aptId);
    e.dataTransfer.effectAllowed = 'move';
    setDragging(aptId);
  };

  const handleDragEnd = () => { setDragging(null); setDragPreview(null); };

  const handleDrop = async (e: React.DragEvent, targetDay: Date) => {
    e.preventDefault();
    const aptId = e.dataTransfer.getData('appointmentId');
    const apt = appointments.find(a => a.id === aptId);
    if (!apt) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const rawMinutes = START_HOUR * 60 + (y / HOUR_HEIGHT) * 60;
    const snappedMinutes = snapToGrid(rawMinutes);

    const duration = differenceInMinutes(parseISO(apt.end_time), parseISO(apt.start_time));
    const newStart = setMinutes(setHours(targetDay, Math.floor(snappedMinutes / 60)), snappedMinutes % 60);
    const newEnd = addMinutes(newStart, duration);

    if (hasConflict(apt.staff_id, newStart.toISOString(), newEnd.toISOString(), aptId)) {
      toast.error('Çakışan randevu! Bu saatte personelin başka bir randevusu var.');
      setDragging(null);
      setDragPreview(null);
      return;
    }

    await updateAppointment(aptId, {
      start_time: newStart.toISOString(),
      end_time: newEnd.toISOString(),
    });
    toast.success('Randevu taşındı.');
    setDragging(null);
    setDragPreview(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const rawMinutes = START_HOUR * 60 + (y / HOUR_HEIGHT) * 60;
    const snappedMinutes = snapToGrid(rawMinutes);
    const top = ((snappedMinutes - START_HOUR * 60) / 60) * HOUR_HEIGHT;
    setDragPreview({ top });
  };

  const handleDragLeave = () => setDragPreview(null);

  const totalHeight = HOURS.length * HOUR_HEIGHT;
  const now = new Date();
  const todayCheck = (d: Date) => isSameDay(d, now);

  return (
    <div className="border rounded-lg bg-card overflow-hidden shadow-sm">
      <div className="border-b bg-muted/30 px-4 py-2 flex items-center justify-between">
        <p className="text-xs text-muted-foreground font-medium">
          {format(weekDays[0], 'd MMM', { locale: tr })} — {format(weekDays[6], 'd MMM yyyy', { locale: tr })}
        </p>
        <div className="hidden sm:flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-red-400" /> Bekliyor</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-yellow-400" /> Seansta</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-green-400" /> Tamamlandı</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-destructive/30" /> İptal</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="flex min-w-[800px]">
          <div className="w-14 flex-shrink-0 border-r bg-muted/10">
            <div className="h-14 border-b" />
            {HOURS.map(hour => (
              <div key={hour} className="border-b text-[10px] text-muted-foreground flex items-start justify-end pr-1.5 pt-0.5" style={{ height: HOUR_HEIGHT }}>
                {String(hour).padStart(2, '0')}:00
              </div>
            ))}
          </div>

          {weekDays.map(day => {
            const dayApts = getAppointmentsForDay(day);
            const isTodayCol = todayCheck(day);
            const currentTimeTop = isTodayCol
              ? ((now.getHours() * 60 + now.getMinutes() - START_HOUR * 60) / 60) * HOUR_HEIGHT
              : -1;

            return (
              <div key={day.toISOString()} className="flex-1 min-w-[100px] border-r last:border-r-0">
                <div className={cn('h-14 border-b px-1 py-1.5 text-center', isTodayCol && 'bg-primary/5')}>
                  <p className="text-[10px] text-muted-foreground uppercase">{format(day, 'EEE', { locale: tr })}</p>
                  <p className={cn('text-lg font-bold leading-tight', isTodayCol && 'text-primary')}>{format(day, 'd')}</p>
                </div>

                <div
                  className={cn('relative', isTodayCol && 'bg-primary/[0.02]')}
                  style={{ height: totalHeight }}
                  onDrop={e => handleDrop(e, day)}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                >
                  {HOURS.map((hour, i) => (
                    <div key={hour} className="absolute w-full border-b border-dashed border-border/40" style={{ top: i * HOUR_HEIGHT, height: HOUR_HEIGHT }}>
                      <div className="absolute w-full border-b border-dotted border-border/20" style={{ top: HOUR_HEIGHT / 2 }} />
                    </div>
                  ))}

                  {isTodayCol && currentTimeTop >= 0 && currentTimeTop <= totalHeight && (
                    <div className="absolute left-0 right-0 z-30 pointer-events-none" style={{ top: currentTimeTop }}>
                      <div className="flex items-center">
                        <div className="w-2 h-2 rounded-full bg-destructive -ml-1" />
                        <div className="flex-1 h-[2px] bg-destructive/70" />
                      </div>
                    </div>
                  )}

                  {dragging && dragPreview && (
                    <div className="absolute left-0.5 right-0.5 rounded bg-primary/10 border-2 border-dashed border-primary/40 pointer-events-none z-10" style={{ top: dragPreview.top, height: 28 }} />
                  )}

                  {dayApts.map(apt => {
                    const style = getAppointmentStyle(apt);
                    const effectiveStatus = apt.session_status === 'in_session' ? 'in_session' : apt.status;
                    const statusColor = STATUS_COLORS[effectiveStatus] || STATUS_COLORS.bekliyor;
                    return (
                      <div
                        key={apt.id}
                        draggable={apt.status === 'bekliyor'}
                        onDragStart={e => handleDragStart(e, apt.id)}
                        onDragEnd={handleDragEnd}
                        onClick={() => onAppointmentClick(apt)}
                        className={cn(
                          'absolute left-0.5 right-0.5 rounded border border-l-[3px] px-1 py-0.5 overflow-hidden transition-all hover:shadow-md z-20 text-[10px]',
                          statusColor,
                          getStaffAccent(apt.staff_id),
                          apt.status === 'bekliyor' ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer',
                          dragging === apt.id && 'opacity-40 scale-95',
                        )}
                        style={{ top: style.top, height: style.height }}
                      >
                        <p className="font-semibold truncate leading-tight">{getCustomerName(apt.customer_id)}</p>
                        {style.height > 28 && <p className="truncate opacity-70">{getServiceName(apt.service_id)}</p>}
                        {style.height > 44 && <p className="opacity-50">{getStaffName(apt.staff_id)}</p>}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
