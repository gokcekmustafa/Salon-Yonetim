import React, { useRef, useState, useCallback, useMemo } from 'react';
import { format, parseISO, isSameDay, setHours, setMinutes, differenceInMinutes, addMinutes } from 'date-fns';
import { tr } from 'date-fns/locale';
import { useSalon } from '@/contexts/SalonContext';
import { Appointment } from '@/types/salon';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const HOUR_HEIGHT = 72; // px per hour
const START_HOUR = 8;
const END_HOUR = 21;
const HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);

// Staff color palette
const STAFF_COLORS = [
  'bg-primary/20 border-primary text-primary',
  'bg-accent/20 border-accent text-accent-foreground',
  'bg-success/20 border-success text-success-foreground',
  'bg-destructive/20 border-destructive text-destructive-foreground',
  'bg-secondary border-secondary-foreground/30 text-secondary-foreground',
];

interface DayCalendarViewProps {
  date: Date;
  filteredStaffId: string | null;
  onAppointmentClick: (apt: Appointment) => void;
}

export default function DayCalendarView({ date, filteredStaffId, onAppointmentClick }: DayCalendarViewProps) {
  const { appointments, staff, customers, services, updateAppointment, hasConflict } = useSalon();
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragPreview, setDragPreview] = useState<{ top: number } | null>(null);

  const activeStaff = useMemo(() => {
    const filtered = staff.filter(s => s.active);
    if (filteredStaffId) return filtered.filter(s => s.id === filteredStaffId);
    return filtered;
  }, [staff, filteredStaffId]);

  const dayAppointments = useMemo(() =>
    appointments.filter(a => {
      try {
        if (!isSameDay(parseISO(a.startTime), date)) return false;
        if (a.status === 'iptal') return false;
        if (filteredStaffId && a.staffId !== filteredStaffId) return false;
        return true;
      } catch { return false; }
    }), [appointments, date, filteredStaffId]);

  const getStaffColor = (staffId: string) => {
    const idx = staff.findIndex(s => s.id === staffId);
    return STAFF_COLORS[idx % STAFF_COLORS.length];
  };

  const getCustomerName = (id: string) => customers.find(c => c.id === id)?.name ?? '-';
  const getServiceName = (id: string) => services.find(s => s.id === id)?.name ?? '-';
  const getStaffName = (id: string) => staff.find(s => s.id === id)?.name ?? '-';

  const getAppointmentStyle = (apt: Appointment) => {
    const start = parseISO(apt.startTime);
    const end = parseISO(apt.endTime);
    const startMinutes = start.getHours() * 60 + start.getMinutes();
    const duration = differenceInMinutes(end, start);
    const top = ((startMinutes - START_HOUR * 60) / 60) * HOUR_HEIGHT;
    const height = Math.max((duration / 60) * HOUR_HEIGHT - 2, 24);
    return { top, height };
  };

  const getStaffAppointments = (staffId: string) =>
    dayAppointments.filter(a => a.staffId === staffId);

  const handleDragStart = (e: React.DragEvent, aptId: string) => {
    e.dataTransfer.setData('appointmentId', aptId);
    e.dataTransfer.effectAllowed = 'move';
    setDragging(aptId);
  };

  const handleDragEnd = () => {
    setDragging(null);
    setDragPreview(null);
  };

  const snapToGrid = (minutes: number) => Math.round(minutes / 15) * 15;

  const handleDrop = (e: React.DragEvent, targetStaffId: string) => {
    e.preventDefault();
    const aptId = e.dataTransfer.getData('appointmentId');
    const apt = appointments.find(a => a.id === aptId);
    if (!apt) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const rawMinutes = START_HOUR * 60 + (y / HOUR_HEIGHT) * 60;
    const snappedMinutes = snapToGrid(rawMinutes);

    const duration = differenceInMinutes(parseISO(apt.endTime), parseISO(apt.startTime));
    const newStart = setMinutes(setHours(date, Math.floor(snappedMinutes / 60)), snappedMinutes % 60);
    const newEnd = addMinutes(newStart, duration);

    if (hasConflict(targetStaffId, newStart.toISOString(), newEnd.toISOString(), aptId)) {
      toast.error('Çakışan randevu! Bu saatte personelin başka bir randevusu var.');
      setDragging(null);
      setDragPreview(null);
      return;
    }

    updateAppointment(aptId, {
      staffId: targetStaffId,
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

  return (
    <div className="border rounded-lg bg-card overflow-hidden">
      {/* Header */}
      <div className="border-b bg-muted/30 px-4 py-3">
        <h3 className="font-semibold">
          {format(date, 'd MMMM yyyy, EEEE', { locale: tr })}
        </h3>
        <p className="text-xs text-muted-foreground">{dayAppointments.length} randevu</p>
      </div>

      <div className="overflow-x-auto">
        <div className="flex min-w-[600px]">
          {/* Time gutter */}
          <div className="w-16 flex-shrink-0 border-r bg-muted/20">
            {HOURS.map(hour => (
              <div
                key={hour}
                className="border-b text-xs text-muted-foreground flex items-start justify-end pr-2 pt-1"
                style={{ height: HOUR_HEIGHT }}
              >
                {String(hour).padStart(2, '0')}:00
              </div>
            ))}
          </div>

          {/* Staff columns */}
          {activeStaff.map((s, colIdx) => (
            <div key={s.id} className="flex-1 min-w-[180px] border-r last:border-r-0">
              {/* Staff header */}
              <div className="border-b px-2 py-1.5 bg-muted/10 sticky top-0 z-10">
                <p className="text-xs font-medium truncate">{s.name}</p>
              </div>

              {/* Time grid */}
              <div
                className="relative"
                style={{ height: totalHeight }}
                onDrop={e => handleDrop(e, s.id)}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
              >
                {/* Hour lines */}
                {HOURS.map((hour, i) => (
                  <div
                    key={hour}
                    className="absolute w-full border-b border-dashed border-border/50"
                    style={{ top: i * HOUR_HEIGHT, height: HOUR_HEIGHT }}
                  >
                    {/* 30-min line */}
                    <div className="absolute w-full border-b border-dotted border-border/25" style={{ top: HOUR_HEIGHT / 2 }} />
                  </div>
                ))}

                {/* Drop preview */}
                {dragging && dragPreview && (
                  <div
                    className="absolute left-1 right-1 rounded bg-primary/10 border-2 border-dashed border-primary/40 pointer-events-none z-10"
                    style={{ top: dragPreview.top, height: 36 }}
                  />
                )}

                {/* Appointments */}
                {getStaffAppointments(s.id).map(apt => {
                  const style = getAppointmentStyle(apt);
                  return (
                    <div
                      key={apt.id}
                      draggable
                      onDragStart={e => handleDragStart(e, apt.id)}
                      onDragEnd={handleDragEnd}
                      onClick={() => onAppointmentClick(apt)}
                      className={cn(
                        'absolute left-1 right-1 rounded-md border px-2 py-1 cursor-grab active:cursor-grabbing overflow-hidden transition-shadow hover:shadow-md z-20',
                        getStaffColor(apt.staffId),
                        dragging === apt.id && 'opacity-40',
                        apt.status === 'tamamlandi' && 'opacity-60'
                      )}
                      style={{ top: style.top, height: style.height }}
                    >
                      <p className="text-xs font-semibold truncate leading-tight">{getCustomerName(apt.customerId)}</p>
                      {style.height > 36 && (
                        <p className="text-[10px] truncate opacity-80">{getServiceName(apt.serviceId)}</p>
                      )}
                      {style.height > 52 && (
                        <p className="text-[10px] opacity-60">
                          {format(parseISO(apt.startTime), 'HH:mm')} - {format(parseISO(apt.endTime), 'HH:mm')}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
