import { useState } from 'react';
import { useSalon } from '@/contexts/SalonContext';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, ChevronLeft, ChevronRight, CalendarDays, CalendarRange, Users } from 'lucide-react';
import { format, parseISO, addMinutes, addDays, subDays, addWeeks, subWeeks } from 'date-fns';
import { tr } from 'date-fns/locale';
import { toast } from 'sonner';
import { Appointment } from '@/types/salon';
import DayCalendarView from '@/components/calendar/DayCalendarView';
import WeekCalendarView from '@/components/calendar/WeekCalendarView';

type ViewMode = 'day' | 'week';

export default function AppointmentsPage() {
  const { appointments, customers, staff, services, addAppointment, updateAppointment, hasConflict, addPayment } = useSalon();

  const [viewMode, setViewMode] = useState<ViewMode>('day');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [filteredStaffId, setFilteredStaffId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailApt, setDetailApt] = useState<Appointment | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const [form, setForm] = useState({
    customerId: '',
    staffId: '',
    serviceId: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    time: '09:00',
  });

  const activeStaff = staff.filter(s => s.active);

  const navigatePrev = () => {
    if (viewMode === 'day') setCurrentDate(d => subDays(d, 1));
    else setCurrentDate(d => subWeeks(d, 1));
  };

  const navigateNext = () => {
    if (viewMode === 'day') setCurrentDate(d => addDays(d, 1));
    else setCurrentDate(d => addWeeks(d, 1));
  };

  const goToday = () => setCurrentDate(new Date());

  const openAdd = () => {
    setForm({
      customerId: '',
      staffId: filteredStaffId || '',
      serviceId: '',
      date: format(currentDate, 'yyyy-MM-dd'),
      time: '09:00',
    });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.customerId || !form.staffId || !form.serviceId) {
      toast.error('Lütfen tüm alanları doldurun.');
      return;
    }
    const service = services.find(s => s.id === form.serviceId);
    if (!service) return;

    const start = new Date(`${form.date}T${form.time}`);
    const end = addMinutes(start, service.duration);

    if (hasConflict(form.staffId, start.toISOString(), end.toISOString())) {
      toast.error('Bu personelin seçilen saatte başka bir randevusu var!');
      return;
    }

    const staffMember = staff.find(s => s.id === form.staffId);
    addAppointment({
      customerId: form.customerId,
      staffId: form.staffId,
      serviceId: form.serviceId,
      branchId: staffMember?.branchId || '',
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      status: 'bekliyor',
    });
    toast.success('Randevu oluşturuldu.');
    setDialogOpen(false);
  };

  const handleAppointmentClick = (apt: Appointment) => {
    setDetailApt(apt);
    setDetailOpen(true);
  };

  const handleComplete = () => {
    if (!detailApt) return;
    updateAppointment(detailApt.id, { status: 'tamamlandi' });
    const service = services.find(s => s.id === detailApt.serviceId);
    if (service) {
      addPayment({
        appointmentId: detailApt.id,
        amount: service.price,
        type: 'nakit',
        date: new Date().toISOString(),
      });
    }
    toast.success('Randevu tamamlandı, ödeme kaydedildi.');
    setDetailOpen(false);
  };

  const handleCancel = () => {
    if (!detailApt) return;
    updateAppointment(detailApt.id, { status: 'iptal' });
    toast.info('Randevu iptal edildi.');
    setDetailOpen(false);
  };

  const getCustomerName = (id: string) => customers.find(c => c.id === id)?.name ?? '-';
  const getStaffName = (id: string) => staff.find(s => s.id === id)?.name ?? '-';
  const getServiceName = (id: string) => services.find(s => s.id === id)?.name ?? '-';
  const getServicePrice = (id: string) => services.find(s => s.id === id)?.price ?? 0;

  const statusLabel: Record<string, string> = { bekliyor: 'Bekliyor', tamamlandi: 'Tamamlandı', iptal: 'İptal' };
  const statusVariant = (s: string): 'default' | 'secondary' | 'destructive' =>
    s === 'tamamlandi' ? 'default' : s === 'iptal' ? 'destructive' : 'secondary';

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">Randevular</h1>
          <Button onClick={openAdd}>
            <Plus className="h-4 w-4 mr-1" /> Yeni Randevu
          </Button>
        </div>

        {/* Controls bar */}
        <div className="flex flex-wrap items-center gap-2">
          {/* View toggle */}
          <div className="flex border rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode('day')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors ${
                viewMode === 'day' ? 'bg-primary text-primary-foreground' : 'bg-card hover:bg-muted text-foreground'
              }`}
            >
              <CalendarDays className="h-3.5 w-3.5" /> Günlük
            </button>
            <button
              onClick={() => setViewMode('week')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors ${
                viewMode === 'week' ? 'bg-primary text-primary-foreground' : 'bg-card hover:bg-muted text-foreground'
              }`}
            >
              <CalendarRange className="h-3.5 w-3.5" /> Haftalık
            </button>
          </div>

          {/* Navigation */}
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" onClick={navigatePrev} className="h-8 w-8">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={goToday} className="h-8 text-xs">
              Bugün
            </Button>
            <Button variant="outline" size="icon" onClick={navigateNext} className="h-8 w-8">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Staff filter */}
          <div className="flex items-center gap-1.5 ml-auto">
            <Users className="h-4 w-4 text-muted-foreground" />
            <Select
              value={filteredStaffId || 'all'}
              onValueChange={v => setFilteredStaffId(v === 'all' ? null : v)}
            >
              <SelectTrigger className="h-8 w-40 text-xs">
                <SelectValue placeholder="Tüm personel" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Personel</SelectItem>
                {activeStaff.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Calendar View */}
      <div className="overflow-auto max-h-[calc(100vh-220px)]">
        {viewMode === 'day' ? (
          <DayCalendarView
            date={currentDate}
            filteredStaffId={filteredStaffId}
            onAppointmentClick={handleAppointmentClick}
          />
        ) : (
          <WeekCalendarView
            date={currentDate}
            filteredStaffId={filteredStaffId}
            onAppointmentClick={handleAppointmentClick}
          />
        )}
      </div>

      {/* New Appointment Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Yeni Randevu</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Müşteri</Label>
              <Select value={form.customerId} onValueChange={v => setForm(f => ({ ...f, customerId: v }))}>
                <SelectTrigger><SelectValue placeholder="Müşteri seçin" /></SelectTrigger>
                <SelectContent>{customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Personel</Label>
              <Select value={form.staffId} onValueChange={v => setForm(f => ({ ...f, staffId: v }))}>
                <SelectTrigger><SelectValue placeholder="Personel seçin" /></SelectTrigger>
                <SelectContent>{activeStaff.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Hizmet</Label>
              <Select value={form.serviceId} onValueChange={v => setForm(f => ({ ...f, serviceId: v }))}>
                <SelectTrigger><SelectValue placeholder="Hizmet seçin" /></SelectTrigger>
                <SelectContent>{services.map(s => <SelectItem key={s.id} value={s.id}>{s.name} — ₺{s.price}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Tarih</Label><Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} /></div>
              <div><Label>Saat</Label><Input type="time" value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>İptal</Button>
            <Button onClick={handleSave}>Kaydet</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Appointment Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Randevu Detayı</DialogTitle></DialogHeader>
          {detailApt && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Müşteri</p>
                  <p className="font-medium">{getCustomerName(detailApt.customerId)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Personel</p>
                  <p className="font-medium">{getStaffName(detailApt.staffId)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Hizmet</p>
                  <p className="font-medium">{getServiceName(detailApt.serviceId)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Ücret</p>
                  <p className="font-medium">₺{getServicePrice(detailApt.serviceId).toLocaleString('tr-TR')}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Başlangıç</p>
                  <p className="font-medium">{format(parseISO(detailApt.startTime), 'd MMM yyyy HH:mm', { locale: tr })}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Bitiş</p>
                  <p className="font-medium">{format(parseISO(detailApt.endTime), 'HH:mm', { locale: tr })}</p>
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Durum</p>
                <Badge variant={statusVariant(detailApt.status)}>{statusLabel[detailApt.status]}</Badge>
              </div>
            </div>
          )}
          <DialogFooter>
            {detailApt?.status === 'bekliyor' && (
              <>
                <Button variant="outline" onClick={handleCancel}>İptal Et</Button>
                <Button onClick={handleComplete}>Tamamla</Button>
              </>
            )}
            <Button variant="ghost" onClick={() => setDetailOpen(false)}>Kapat</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
