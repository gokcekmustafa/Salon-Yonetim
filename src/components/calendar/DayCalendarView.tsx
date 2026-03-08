import React, { useState, useMemo } from 'react';
import { format, parseISO, isSameDay, setHours, setMinutes, differenceInMinutes, addMinutes } from 'date-fns';
import { tr } from 'date-fns/locale';
import { useSalonData, DbAppointment } from '@/hooks/useSalonData';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const HOUR_HEIGHT = 72;
const START_HOUR = 8;
const END_HOUR = 21;
const HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);

const STATUS_COLORS: Record<string, string> = {
  bekliyor: 'bg-primary/15 border-primary/60 text-primary',
  tamamlandi: 'bg-muted border-muted-foreground/30 text-muted-foreground',
  iptal: 'bg-destructive/10 border-destructive/40 text-destructive',
};

const STAFF_ACCENTS = [
  'border-l-primary',
  'border-l-accent',
  'border-l-[hsl(var(--success))]',
  'border-l-destructive',
  'border-l-secondary-foreground',
];

interface DayCalendarViewProps {
  date: Date;
  filteredStaffId: string | null;
  filteredBranchId?: string | null;
  onAppointmentClick: (apt: DbAppointment) => void;
  rooms?: { id: string; name: string }[];
}

export default function DayCalendarView({ date, filteredStaffId, filteredBranchId, onAppointmentClick, rooms = [] }: DayCalendarViewProps) {
  const { appointments, staff, customers, services, updateAppointment, hasConflict, branches } = useSalonData();
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragPreview, setDragPreview] = useState<{ top: number } | null>(null);

  const activeStaff = useMemo(() => {
    let filtered = staff.filter(s => s.is_active);
    if (filteredBranchId) filtered = filtered.filter(s => s.branch_id === filteredBranchId);
    if (filteredStaffId) filtered = filtered.filter(s => s.id === filteredStaffId);
    return filtered;
  }, [staff, filteredStaffId, filteredBranchId]);

  const dayAppointments = useMemo(() =>
    appointments.filter(a => {
      try {
        if (!isSameDay(parseISO(a.start_time), date)) return false;
        if (filteredStaffId && a.staff_id !== filteredStaffId) return false;
        if (filteredBranchId && a.branch_id !== filteredBranchId) return false;
        return true;
      } catch { return false; }
    }), [appointments, date, filteredStaffId, filteredBranchId]);

  const getStaffAccent = (staffId: string) => {
    const idx = staff.findIndex(s => s.id === staffId);
    return STAFF_ACCENTS[idx % STAFF_ACCENTS.length];
  };

  const getCustomerName = (id: string) => customers.find(c => c.id === id)?.name ?? '-';
  const getServiceName = (id: string) => services.find(s => s.id === id)?.name ?? '-';
  const getRoomName = (id: string | null) => rooms.find(r => r.id === id)?.name ?? '';

  const getAppointmentStyle = (apt: DbAppointment) => {
    const start = parseISO(apt.start_time);
    const end = parseISO(apt.end_time);
    const startMinutes = start.getHours() * 60 + start.getMinutes();
    const duration = differenceInMinutes(end, start);
    const top = ((startMinutes - START_HOUR * 60) / 60) * HOUR_HEIGHT;
    const height = Math.max((duration / 60) * HOUR_HEIGHT - 2, 24);
    return { top, height };
  };

  const getStaffAppointments = (staffId: string) =>
    dayAppointments.filter(a => a.staff_id === staffId);

  const handleDragStart = (e: React.DragEvent, aptId: string) => {
    e.dataTransfer.setData('appointmentId', aptId);
    e.dataTransfer.effectAllowed = 'move';
    setDragging(aptId);
  };

  const handleDragEnd = () => { setDragging(null); setDragPreview(null); };

  const snapToGrid = (minutes: number) => Math.round(minutes / 15) * 15;

  const handleDrop = async (e: React.DragEvent, targetStaffId: string) => {
    e.preventDefault();
    const aptId = e.dataTransfer.getData('appointmentId');
    const apt = appointments.find(a => a.id === aptId);
    if (!apt) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const rawMinutes = START_HOUR * 60 + (y / HOUR_HEIGHT) * 60;
    const snappedMinutes = snapToGrid(rawMinutes);

    const duration = differenceInMinutes(parseISO(apt.end_time), parseISO(apt.start_time));
    const newStart = setMinutes(setHours(date, Math.floor(snappedMinutes / 60)), snappedMinutes % 60);
    const newEnd = addMinutes(newStart, duration);

    if (hasConflict(targetStaffId, newStart.toISOString(), newEnd.toISOString(), aptId)) {
      toast.error('Çakışan randevu! Bu saatte personelin başka bir randevusu var.');
      setDragging(null);
      setDragPreview(null);
      return;
    }

    const targetStaff = staff.find(s => s.id === targetStaffId);
    await updateAppointment(aptId, {
      staff_id: targetStaffId,
      branch_id: targetStaff?.branch_id || apt.branch_id,
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
  const isToday = isSameDay(date, now);
  const currentTimeTop = isToday
    ? ((now.getHours() * 60 + now.getMinutes() - START_HOUR * 60) / 60) * HOUR_HEIGHT
    : -1;

  return (
    <div className="border rounded-lg bg-card overflow-hidden shadow-sm">
      <div className="border-b bg-muted/30 px-4 py-3 flex items-center justify-between">
        <div>
          <h3 className="font-semibold">{format(date, 'd MMMM yyyy, EEEE', { locale: tr })}</h3>
          <p className="text-xs text-muted-foreground">{dayAppointments.length} randevu • {activeStaff.length} personel</p>
        </div>
        <div className="hidden sm:flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-primary/40" /> Bekliyor</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-muted-foreground/30" /> Tamamlandı</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-destructive/30" /> İptal</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="flex min-w-[600px]">
          <div className="w-16 flex-shrink-0 border-r bg-muted/10">
            {HOURS.map(hour => (
              <div key={hour} className="border-b text-xs text-muted-foreground flex items-start justify-end pr-2 pt-1" style={{ height: HOUR_HEIGHT }}>
                {String(hour).padStart(2, '0')}:00
              </div>
            ))}
          </div>

          {activeStaff.map(s => {
            const branchName = branches.find(b => b.id === s.branch_id)?.name;
            return (
              <div key={s.id} className="flex-1 min-w-[180px] border-r last:border-r-0">
                <div className="border-b px-2 py-1.5 bg-muted/10 sticky top-0 z-10">
                  <p className="text-xs font-semibold truncate">{s.name}</p>
                  {branchName && <p className="text-[10px] text-muted-foreground truncate">{branchName}</p>}
                </div>

                <div
                  className="relative"
                  style={{ height: totalHeight }}
                  onDrop={e => handleDrop(e, s.id)}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                >
                  {HOURS.map((hour, i) => (
                    <div key={hour} className="absolute w-full border-b border-dashed border-border/40" style={{ top: i * HOUR_HEIGHT, height: HOUR_HEIGHT }}>
                      <div className="absolute w-full border-b border-dotted border-border/20" style={{ top: HOUR_HEIGHT / 2 }} />
                    </div>
                  ))}

                  {isToday && currentTimeTop >= 0 && currentTimeTop <= totalHeight && (
                    <div className="absolute left-0 right-0 z-30 pointer-events-none" style={{ top: currentTimeTop }}>
                      <div className="flex items-center">
                        <div className="w-2 h-2 rounded-full bg-destructive -ml-1" />
                        <div className="flex-1 h-[2px] bg-destructive/70" />
                      </div>
                    </div>
                  )}

                  {dragging && dragPreview && (
                    <div className="absolute left-1 right-1 rounded bg-primary/10 border-2 border-dashed border-primary/40 pointer-events-none z-10" style={{ top: dragPreview.top, height: 36 }} />
                  )}

                  {getStaffAppointments(s.id).map(apt => {
                    const style = getAppointmentStyle(apt);
                    const statusColor = STATUS_COLORS[apt.status] || STATUS_COLORS.bekliyor;
                    return (
                      <div
                        key={apt.id}
                        draggable={apt.status === 'bekliyor'}
                        onDragStart={e => handleDragStart(e, apt.id)}
                        onDragEnd={handleDragEnd}
                        onClick={() => onAppointmentClick(apt)}
                        className={cn(
                          'absolute left-1 right-1 rounded-md border border-l-[3px] px-2 py-1 overflow-hidden transition-all hover:shadow-md z-20',
                          statusColor,
                          getStaffAccent(apt.staff_id),
                          apt.status === 'bekliyor' ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer',
                          dragging === apt.id && 'opacity-40 scale-95',
                        )}
                        style={{ top: style.top, height: style.height }}
                      >
                        <p className="text-xs font-semibold truncate leading-tight">{getCustomerName(apt.customer_id)}</p>
                        {style.height > 36 && (
                          <p className="text-[10px] truncate opacity-80">{getServiceName(apt.service_id)}</p>
                        )}
                        {style.height > 52 && (
                          <p className="text-[10px] opacity-60">
                            {format(parseISO(apt.start_time), 'HH:mm')} - {format(parseISO(apt.end_time), 'HH:mm')}
                            {apt.room_id && getRoomName(apt.room_id) ? ` · ${getRoomName(apt.room_id)}` : ''}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {activeStaff.length === 0 && (
            <div className="flex-1 flex items-center justify-center py-20 text-muted-foreground text-sm">
              Bu filtreler için personel bulunamadı.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
