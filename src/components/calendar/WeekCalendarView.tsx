import React, { useMemo, useState, useRef } from 'react';
import { format, parseISO, isSameDay, addDays, startOfWeek, setHours, setMinutes, differenceInMinutes, addMinutes } from 'date-fns';
import { tr } from 'date-fns/locale';
import { useSalon } from '@/contexts/SalonContext';
import { Appointment } from '@/types/salon';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const HOUR_HEIGHT = 64;
const START_HOUR = 8;
const END_HOUR = 21;
const HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);

const STAFF_COLORS = [
  'bg-primary/20 border-primary text-primary',
  'bg-accent/20 border-accent text-accent-foreground',
  'bg-success/20 border-success text-success-foreground',
  'bg-destructive/20 border-destructive text-destructive-foreground',
  'bg-secondary border-secondary-foreground/30 text-secondary-foreground',
];

interface WeekCalendarViewProps {
  date: Date;
  filteredStaffId: string | null;
  onAppointmentClick: (apt: Appointment) => void;
}

export default function WeekCalendarView({ date, filteredStaffId, onAppointmentClick }: WeekCalendarViewProps) {
  const { appointments, staff, customers, services, updateAppointment, hasConflict } = useSalon();
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragPreview, setDragPreview] = useState<{ top: number } | null>(null);

  const weekStart = startOfWeek(date, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const getStaffColor = (staffId: string) => {
    const idx = staff.findIndex(s => s.id === staffId);
    return STAFF_COLORS[idx % STAFF_COLORS.length];
  };

  const getCustomerName = (id: string) => customers.find(c => c.id === id)?.name ?? '-';
  const getServiceName = (id: string) => services.find(s => s.id === id)?.name ?? '-';
  const getStaffName = (id: string) => staff.find(s => s.id === id)?.name ?? '-';

  const getAppointmentsForDay = (day: Date) =>
    appointments.filter(a => {
      try {
        if (!isSameDay(parseISO(a.startTime), day)) return false;
        if (a.status === 'iptal') return false;
        if (filteredStaffId && a.staffId !== filteredStaffId) return false;
        return true;
      } catch { return false; }
    });

  const getAppointmentStyle = (apt: Appointment) => {
    const start = parseISO(apt.startTime);
    const end = parseISO(apt.endTime);
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

  const handleDrop = (e: React.DragEvent, targetDay: Date) => {
    e.preventDefault();
    const aptId = e.dataTransfer.getData('appointmentId');
    const apt = appointments.find(a => a.id === aptId);
    if (!apt) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const rawMinutes = START_HOUR * 60 + (y / HOUR_HEIGHT) * 60;
    const snappedMinutes = snapToGrid(rawMinutes);

    const duration = differenceInMinutes(parseISO(apt.endTime), parseISO(apt.startTime));
    const newStart = setMinutes(setHours(targetDay, Math.floor(snappedMinutes / 60)), snappedMinutes % 60);
    const newEnd = addMinutes(newStart, duration);

    if (hasConflict(apt.staffId, newStart.toISOString(), newEnd.toISOString(), aptId)) {
      toast.error('Çakışan randevu! Bu saatte personelin başka bir randevusu var.');
      setDragging(null);
      setDragPreview(null);
      return;
    }

    updateAppointment(aptId, {
      startTime: newStart.toISOString(),
      endTime: newEnd.toISOString(),
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
  const isToday = (d: Date) => isSameDay(d, new Date());

  return (
    <div className="border rounded-lg bg-card overflow-hidden">
      <div className="overflow-x-auto">
        <div className="flex min-w-[800px]">
          {/* Time gutter */}
          <div className="w-14 flex-shrink-0 border-r bg-muted/20">
            {/* header spacer */}
            <div className="h-14 border-b" />
            {HOURS.map(hour => (
              <div
                key={hour}
                className="border-b text-[10px] text-muted-foreground flex items-start justify-end pr-1.5 pt-0.5"
                style={{ height: HOUR_HEIGHT }}
              >
                {String(hour).padStart(2, '0')}:00
              </div>
            ))}
          </div>

          {/* Day columns */}
          {weekDays.map(day => {
            const dayApts = getAppointmentsForDay(day);
            return (
              <div key={day.toISOString()} className="flex-1 min-w-[100px] border-r last:border-r-0">
                {/* Day header */}
                <div className={cn(
                  'h-14 border-b px-1 py-1.5 text-center',
                  isToday(day) && 'bg-primary/5'
                )}>
                  <p className="text-[10px] text-muted-foreground uppercase">
                    {format(day, 'EEE', { locale: tr })}
                  </p>
                  <p className={cn(
                    'text-lg font-bold leading-tight',
                    isToday(day) && 'text-primary'
                  )}>
                    {format(day, 'd')}
                  </p>
                </div>

                {/* Time grid */}
                <div
                  className={cn('relative', isToday(day) && 'bg-primary/[0.02]')}
                  style={{ height: totalHeight }}
                  onDrop={e => handleDrop(e, day)}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                >
                  {HOURS.map((hour, i) => (
                    <div
                      key={hour}
                      className="absolute w-full border-b border-dashed border-border/40"
                      style={{ top: i * HOUR_HEIGHT, height: HOUR_HEIGHT }}
                    >
                      <div className="absolute w-full border-b border-dotted border-border/20" style={{ top: HOUR_HEIGHT / 2 }} />
                    </div>
                  ))}

                  {/* Drop preview */}
                  {dragging && dragPreview && (
                    <div
                      className="absolute left-0.5 right-0.5 rounded bg-primary/10 border-2 border-dashed border-primary/40 pointer-events-none z-10"
                      style={{ top: dragPreview.top, height: 28 }}
                    />
                  )}

                  {/* Appointments */}
                  {dayApts.map(apt => {
                    const style = getAppointmentStyle(apt);
                    return (
                      <div
                        key={apt.id}
                        draggable
                        onDragStart={e => handleDragStart(e, apt.id)}
                        onDragEnd={handleDragEnd}
                        onClick={() => onAppointmentClick(apt)}
                        className={cn(
                          'absolute left-0.5 right-0.5 rounded border px-1 py-0.5 cursor-grab active:cursor-grabbing overflow-hidden transition-shadow hover:shadow-md z-20 text-[10px]',
                          getStaffColor(apt.staffId),
                          dragging === apt.id && 'opacity-40',
                          apt.status === 'tamamlandi' && 'opacity-60'
                        )}
                        style={{ top: style.top, height: style.height }}
                      >
                        <p className="font-semibold truncate leading-tight">{getCustomerName(apt.customerId)}</p>
                        {style.height > 28 && (
                          <p className="truncate opacity-70">{getServiceName(apt.serviceId)}</p>
                        )}
                        {style.height > 44 && (
                          <p className="opacity-50">{getStaffName(apt.staffId)}</p>
                        )}
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
