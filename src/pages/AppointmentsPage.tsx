import { useState } from 'react';
import { useSalonData, DbAppointment } from '@/hooks/useSalonData';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, ChevronLeft, ChevronRight, CalendarDays, CalendarRange, Users, Building2 } from 'lucide-react';
import { format, addMinutes, addDays, subDays, addWeeks, subWeeks } from 'date-fns';
import { tr } from 'date-fns/locale';
import { toast } from 'sonner';
import DayCalendarView from '@/components/calendar/DayCalendarView';
import WeekCalendarView from '@/components/calendar/WeekCalendarView';

type ViewMode = 'day' | 'week';

export default function AppointmentsPage() {
  const {
    appointments, customers, staff, services, branches,
    addAppointment, updateAppointment, addPayment, hasConflict,
  } = useSalonData();

  const [viewMode, setViewMode] = useState<ViewMode>('day');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [filteredStaffId, setFilteredStaffId] = useState<string | null>(null);
  const [filteredBranchId, setFilteredBranchId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailApt, setDetailApt] = useState<DbAppointment | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const [form, setForm] = useState({
    customerId: '',
    staffId: '',
    serviceId: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    time: '09:00',
  });

  const activeStaff = staff.filter(s => s.is_active);
  const activeBranches = branches.filter(b => b.is_active);

  const filteredStaffList = filteredBranchId
    ? activeStaff.filter(s => s.branch_id === filteredBranchId)
    : activeStaff;

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

  const handleSave = async () => {
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
    const error = await addAppointment({
      customer_id: form.customerId,
      staff_id: form.staffId,
      service_id: form.serviceId,
      branch_id: staffMember?.branch_id || '',
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      status: 'bekliyor',
    });
    if (error) {
      toast.error('Randevu oluşturulamadı: ' + error.message);
    } else {
      toast.success('Randevu oluşturuldu.');
      setDialogOpen(false);
    }
  };

  const handleAppointmentClick = (apt: DbAppointment) => {
    const latest = appointments.find(a => a.id === apt.id) || apt;
    setDetailApt(latest);
    setDetailOpen(true);
  };

  const handleComplete = async () => {
    if (!detailApt) return;
    await updateAppointment(detailApt.id, { status: 'tamamlandi' });
    const service = services.find(s => s.id === detailApt.service_id);
    if (service) {
      await addPayment({
        appointment_id: detailApt.id,
        amount: service.price,
        payment_type: 'nakit',
      });
    }
    toast.success('Randevu tamamlandı, ödeme kaydedildi.');
    setDetailOpen(false);
    setDetailApt(null);
  };

  const handleCancel = async () => {
    if (!detailApt) return;
    await updateAppointment(detailApt.id, { status: 'iptal' });
    toast.info('Randevu iptal edildi.');
    setDetailOpen(false);
    setDetailApt(null);
  };

  const getCustomerName = (id: string) => customers.find(c => c.id === id)?.name ?? '-';
  const getStaffName = (id: string) => staff.find(s => s.id === id)?.name ?? '-';
  const getServiceName = (id: string) => services.find(s => s.id === id)?.name ?? '-';
  const getServicePrice = (id: string) => services.find(s => s.id === id)?.price ?? 0;
  const getBranchName = (id: string) => branches.find(b => b.id === id)?.name ?? '-';

  const statusLabel: Record<string, string> = { bekliyor: 'Bekliyor', tamamlandi: 'Tamamlandı', iptal: 'İptal' };
  const statusVariant = (s: string): 'default' | 'secondary' | 'destructive' =>
    s === 'tamamlandi' ? 'default' : s === 'iptal' ? 'destructive' : 'secondary';

  const currentDetailApt = detailApt ? (appointments.find(a => a.id === detailApt.id) || detailApt) : null;

  return (
    <div className="page-container animate-in">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <div className="page-header">
          <div>
            <h1 className="page-title">Randevular</h1>
            <p className="page-subtitle">{format(currentDate, 'd MMMM yyyy', { locale: tr })}</p>
          </div>
          <Button onClick={openAdd} size="sm" className="h-9">
            <Plus className="h-4 w-4 mr-1.5" /> Yeni Randevu
          </Button>
        </div>

        {/* Controls bar */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <div className="flex items-center gap-2">
            <div className="flex border rounded-lg overflow-hidden shrink-0">
              <button
                onClick={() => setViewMode('day')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors ${
                  viewMode === 'day' ? 'bg-primary text-primary-foreground' : 'bg-card hover:bg-muted text-foreground'
                }`}
              >
                <CalendarDays className="h-3.5 w-3.5" /> <span className="hidden xs:inline">Günlük</span>
              </button>
              <button
                onClick={() => setViewMode('week')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors ${
                  viewMode === 'week' ? 'bg-primary text-primary-foreground' : 'bg-card hover:bg-muted text-foreground'
                }`}
              >
                <CalendarRange className="h-3.5 w-3.5" /> <span className="hidden xs:inline">Haftalık</span>
              </button>
            </div>

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
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2 sm:ml-auto">
            <div className="flex items-center gap-1.5">
              <Building2 className="h-4 w-4 text-muted-foreground hidden sm:block" />
              <Select
                value={filteredBranchId || 'all'}
                onValueChange={v => {
                  setFilteredBranchId(v === 'all' ? null : v);
                  setFilteredStaffId(null);
                }}
              >
                <SelectTrigger className="h-8 w-32 sm:w-36 text-xs">
                  <SelectValue placeholder="Tüm Şubeler" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tüm Şubeler</SelectItem>
                  {activeBranches.map(b => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-1.5">
              <Users className="h-4 w-4 text-muted-foreground hidden sm:block" />
              <Select
                value={filteredStaffId || 'all'}
                onValueChange={v => setFilteredStaffId(v === 'all' ? null : v)}
              >
                <SelectTrigger className="h-8 w-32 sm:w-36 text-xs">
                  <SelectValue placeholder="Tüm Personel" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tüm Personel</SelectItem>
                  {filteredStaffList.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {/* Calendar View */}
      <div className="overflow-auto max-h-[calc(100vh-240px)]">
        {viewMode === 'day' ? (
          <DayCalendarView
            date={currentDate}
            filteredStaffId={filteredStaffId}
            filteredBranchId={filteredBranchId}
            onAppointmentClick={handleAppointmentClick}
          />
        ) : (
          <WeekCalendarView
            date={currentDate}
            filteredStaffId={filteredStaffId}
            filteredBranchId={filteredBranchId}
            onAppointmentClick={handleAppointmentClick}
          />
        )}
      </div>

      {/* New Appointment Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Yeni Randevu</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Müşteri</Label>
              <Select value={form.customerId} onValueChange={v => setForm(f => ({ ...f, customerId: v }))}>
                <SelectTrigger><SelectValue placeholder="Müşteri seçin" /></SelectTrigger>
                <SelectContent>{customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Personel</Label>
              <Select value={form.staffId} onValueChange={v => setForm(f => ({ ...f, staffId: v }))}>
                <SelectTrigger><SelectValue placeholder="Personel seçin" /></SelectTrigger>
                <SelectContent>
                  {activeStaff.map(s => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} ({getBranchName(s.branch_id || '')})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Hizmet</Label>
              <Select value={form.serviceId} onValueChange={v => setForm(f => ({ ...f, serviceId: v }))}>
                <SelectTrigger><SelectValue placeholder="Hizmet seçin" /></SelectTrigger>
                <SelectContent>{services.map(s => <SelectItem key={s.id} value={s.id}>{s.name} — ₺{s.price}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Tarih</Label>
                <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Saat</Label>
                <Input type="time" value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>İptal</Button>
            <Button onClick={handleSave}>Kaydet</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Appointment Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={v => { setDetailOpen(v); if (!v) setDetailApt(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Randevu Detayı</DialogTitle></DialogHeader>
          {currentDetailApt && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                <div>
                  <p className="text-xs text-muted-foreground">Müşteri</p>
                  <p className="font-medium text-sm">{getCustomerName(currentDetailApt.customer_id)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Personel</p>
                  <p className="font-medium text-sm">{getStaffName(currentDetailApt.staff_id)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Hizmet</p>
                  <p className="font-medium text-sm">{getServiceName(currentDetailApt.service_id)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Ücret</p>
                  <p className="font-medium text-sm">₺{getServicePrice(currentDetailApt.service_id).toLocaleString('tr-TR')}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Şube</p>
                  <p className="font-medium text-sm">{getBranchName(currentDetailApt.branch_id || '')}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Tarih & Saat</p>
                  <p className="font-medium text-sm">
                    {format(new Date(currentDetailApt.start_time), 'd MMM yyyy HH:mm', { locale: tr })} — {format(new Date(currentDetailApt.end_time), 'HH:mm', { locale: tr })}
                  </p>
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Durum</p>
                <Badge variant={statusVariant(currentDetailApt.status)}>{statusLabel[currentDetailApt.status]}</Badge>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            {currentDetailApt?.status === 'bekliyor' && (
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
