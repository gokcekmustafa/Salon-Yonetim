import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useSalonData, DbAppointment } from '@/hooks/useSalonData';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Plus, ChevronLeft, ChevronRight, CalendarDays, CalendarRange, Users, Building2, DoorOpen, Pencil, Trash2, Loader2 } from 'lucide-react';
import { format, addMinutes, addDays, subDays, addWeeks, subWeeks } from 'date-fns';
import { tr } from 'date-fns/locale';
import { toast } from 'sonner';
import DayCalendarView from '@/components/calendar/DayCalendarView';
import WeekCalendarView from '@/components/calendar/WeekCalendarView';
import { usePermissions } from '@/hooks/usePermissions';
import { NoPermission } from '@/components/permissions/NoPermission';

type ViewMode = 'day' | 'week';
type Room = { id: string; salon_id: string; name: string; is_active: boolean };

const SESSION_STATUSES = [
  { value: 'waiting', label: 'Bekliyor' },
  { value: 'in_session', label: 'Seansta' },
  { value: 'completed', label: 'Tamamlandı' },
];

const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120];

export default function AppointmentsPage() {
  const { hasPermission } = usePermissions();
  const { currentSalonId } = useAuth();
  const {
    appointments, customers, staff, services, branches,
    addAppointment, updateAppointment, addPayment, hasConflict, refetch,
  } = useSalonData();

  const [viewMode, setViewMode] = useState<ViewMode>('day');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [filteredStaffId, setFilteredStaffId] = useState<string | null>(null);
  const [filteredBranchId, setFilteredBranchId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailApt, setDetailApt] = useState<DbAppointment | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // Rooms
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomDialogOpen, setRoomDialogOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [roomName, setRoomName] = useState('');
  const [savingRoom, setSavingRoom] = useState(false);
  const [showRoomManager, setShowRoomManager] = useState(false);

  const [form, setForm] = useState({
    customerId: '',
    staffId: '',
    serviceId: '',
    roomId: 'none',
    date: format(new Date(), 'yyyy-MM-dd'),
    time: '09:00',
    duration: '60',
  });

  const activeStaff = staff.filter(s => s.is_active);
  const activeBranches = branches.filter(b => b.is_active);
  const activeRooms = rooms.filter(r => r.is_active);

  const filteredStaffList = filteredBranchId
    ? activeStaff.filter(s => s.branch_id === filteredBranchId)
    : activeStaff;

  // Fetch rooms
  const fetchRooms = useCallback(async () => {
    if (!currentSalonId) return;
    const { data } = await supabase.from('rooms').select('*').eq('salon_id', currentSalonId).order('name');
    setRooms((data as Room[]) || []);
  }, [currentSalonId]);

  useEffect(() => { fetchRooms(); }, [fetchRooms]);

  // Realtime for appointments
  useEffect(() => {
    const channel = supabase
      .channel('appointment-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, () => { refetch(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [refetch]);

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
      roomId: 'none',
      date: format(currentDate, 'yyyy-MM-dd'),
      time: '09:00',
      duration: '60',
    });
    setDialogOpen(true);
  };

  // Auto-set duration from service
  const selectedService = services.find(s => s.id === form.serviceId);
  useEffect(() => {
    if (selectedService) {
      setForm(f => ({ ...f, duration: String(selectedService.duration) }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedService?.id]);

  const handleSave = async () => {
    if (!form.customerId || !form.staffId || !form.serviceId) {
      toast.error('Lütfen müşteri, personel ve hizmet seçin.');
      return;
    }
    const duration = parseInt(form.duration) || 60;
    const start = new Date(`${form.date}T${form.time}`);
    const end = addMinutes(start, duration);

    if (hasConflict(form.staffId, start.toISOString(), end.toISOString())) {
      toast.error('Bu personelin seçilen saatte başka bir randevusu var!');
      return;
    }

    // Check room conflict
    if (form.roomId !== 'none') {
      const roomConflict = appointments.some(a => {
        if (a.room_id !== form.roomId || a.status === 'iptal') return false;
        return new Date(start) < new Date(a.end_time) && new Date(end) > new Date(a.start_time);
      });
      if (roomConflict) {
        toast.error('Seçilen oda bu saatte dolu!');
        return;
      }
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
      room_id: form.roomId !== 'none' ? form.roomId : null,
    });

    if (error) {
      toast.error('Randevu oluşturulamadı: ' + error.message);
    } else {
      toast.success('Randevu oluşturuldu.');
      setDialogOpen(false);
      refetch();
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
    await supabase.from('appointments').update({ session_status: 'completed' }).eq('id', detailApt.id);
    const service = services.find(s => s.id === detailApt.service_id);
    if (service) {
      await addPayment({ appointment_id: detailApt.id, amount: service.price, payment_type: 'nakit' });
    }
    toast.success('Randevu tamamlandı, ödeme kaydedildi.');
    setDetailOpen(false);
    setDetailApt(null);
    refetch();
  };

  const handleCancel = async () => {
    if (!detailApt) return;
    await updateAppointment(detailApt.id, { status: 'iptal' });
    toast.info('Randevu iptal edildi.');
    setDetailOpen(false);
    setDetailApt(null);
  };

  const updateSessionStatus = async (aptId: string, sessionStatus: string) => {
    await supabase.from('appointments').update({ session_status: sessionStatus }).eq('id', aptId);
    if (sessionStatus === 'completed') {
      await updateAppointment(aptId, { status: 'tamamlandi' });
    }
    toast.success('Durum güncellendi.');
    refetch();
    const updated = appointments.find(a => a.id === aptId);
    if (updated) setDetailApt({ ...updated, session_status: sessionStatus });
  };

  const updateRoomAssignment = async (aptId: string, roomId: string) => {
    await supabase.from('appointments').update({ room_id: roomId === 'none' ? null : roomId }).eq('id', aptId);
    toast.success('Oda güncellendi.');
    refetch();
  };

  const getCustomerName = (id: string) => customers.find(c => c.id === id)?.name ?? '-';
  const getStaffName = (id: string) => staff.find(s => s.id === id)?.name ?? '-';
  const getServiceName = (id: string) => services.find(s => s.id === id)?.name ?? '-';
  const getServicePrice = (id: string) => services.find(s => s.id === id)?.price ?? 0;
  const getBranchName = (id: string) => branches.find(b => b.id === id)?.name ?? '-';
  const getRoomName = (id: string | null) => rooms.find(r => r.id === id)?.name ?? '-';

  const statusLabel: Record<string, string> = { bekliyor: 'Bekliyor', tamamlandi: 'Tamamlandı', iptal: 'İptal' };
  const statusVariant = (s: string): 'default' | 'secondary' | 'destructive' =>
    s === 'tamamlandi' ? 'default' : s === 'iptal' ? 'destructive' : 'secondary';

  const sessionStatusLabel = (s: string) => SESSION_STATUSES.find(x => x.value === s)?.label || 'Bekliyor';

  const currentDetailApt = detailApt ? (appointments.find(a => a.id === detailApt.id) || detailApt) : null;

  // Room CRUD
  const handleSaveRoom = async () => {
    if (!roomName.trim() || !currentSalonId) return;
    setSavingRoom(true);
    if (editingRoom) {
      await supabase.from('rooms').update({ name: roomName.trim() }).eq('id', editingRoom.id);
      toast.success('Oda güncellendi');
    } else {
      await supabase.from('rooms').insert({ name: roomName.trim(), salon_id: currentSalonId });
      toast.success('Oda eklendi');
    }
    setSavingRoom(false);
    setRoomDialogOpen(false);
    setRoomName('');
    setEditingRoom(null);
    fetchRooms();
  };

  const deleteRoom = async (id: string) => {
    await supabase.from('rooms').delete().eq('id', id);
    toast.success('Oda silindi');
    fetchRooms();
  };

  if (!hasPermission('can_manage_appointments')) return <NoPermission feature="Randevu Yönetimi" />;

  return (
    <div className="page-container animate-in">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <div className="page-header">
          <div>
            <h1 className="page-title">Randevular</h1>
            <p className="page-subtitle">{format(currentDate, 'd MMMM yyyy', { locale: tr })}</p>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button variant="outline" size="sm" className="h-9 gap-1.5 flex-1 sm:flex-initial" onClick={() => setShowRoomManager(!showRoomManager)}>
              <DoorOpen className="h-4 w-4" /> <span className="hidden xs:inline">Odalar</span>
            </Button>
            <Button onClick={openAdd} size="sm" className="h-9 flex-1 sm:flex-initial">
              <Plus className="h-4 w-4 mr-1.5" /> <span className="hidden xs:inline">Yeni</span> Randevu
            </Button>
          </div>
        </div>

        {/* Room Manager (collapsible) */}
        {showRoomManager && (
          <Card className="shadow-soft border-border/60">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <DoorOpen className="h-5 w-5 text-primary" />
                  <div><CardTitle className="text-base">Seans Odaları</CardTitle><CardDescription>Seans odalarını yönetin</CardDescription></div>
                </div>
                <Button size="sm" onClick={() => { setEditingRoom(null); setRoomName(''); setRoomDialogOpen(true); }} className="gap-1.5 h-8">
                  <Plus className="h-3.5 w-3.5" /> Oda Ekle
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {rooms.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Henüz oda eklenmemiş</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {rooms.map(r => (
                    <div key={r.id} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border/60 bg-muted/30">
                      <DoorOpen className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium">{r.name}</span>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setEditingRoom(r); setRoomName(r.name); setRoomDialogOpen(true); }}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => deleteRoom(r.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

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
      <div className="overflow-auto max-h-[calc(100vh-280px)] sm:max-h-[calc(100vh-240px)]">
        {viewMode === 'day' ? (
          <DayCalendarView
            date={currentDate}
            filteredStaffId={filteredStaffId}
            filteredBranchId={filteredBranchId}
            onAppointmentClick={handleAppointmentClick}
            rooms={rooms}
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
          <DialogHeader><DialogTitle>Yeni Randevu</DialogTitle><DialogDescription>Randevu bilgilerini girin</DialogDescription></DialogHeader>
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
                <SelectContent>{services.filter(s => s.is_active).map(s => <SelectItem key={s.id} value={s.id}>{s.name} — ₺{s.price} ({s.duration} dk)</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Oda</Label>
              <Select value={form.roomId} onValueChange={v => setForm(f => ({ ...f, roomId: v }))}>
                <SelectTrigger><SelectValue placeholder="Oda seçin" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Oda seçilmedi —</SelectItem>
                  {activeRooms.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Tarih</Label>
                <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Saat</Label>
                <Input type="time" value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))} />
              </div>
              <div className="space-y-1.5 col-span-2 sm:col-span-1">
                <Label>Süre (dk)</Label>
                <Select value={form.duration} onValueChange={v => setForm(f => ({ ...f, duration: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DURATION_OPTIONS.map(d => <SelectItem key={d} value={String(d)}>{d} dk</SelectItem>)}
                  </SelectContent>
                </Select>
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
          <DialogHeader><DialogTitle>Randevu Detayı</DialogTitle><DialogDescription>Randevu bilgilerini görüntüleyin ve yönetin</DialogDescription></DialogHeader>
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

              {/* Room Assignment */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase">Oda</Label>
                <Select
                  value={currentDetailApt.room_id || 'none'}
                  onValueChange={v => updateRoomAssignment(currentDetailApt.id, v)}
                >
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Atanmamış —</SelectItem>
                    {activeRooms.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Session Status */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase">Seans Durumu</Label>
                <div className="flex gap-2">
                  {SESSION_STATUSES.map(s => (
                    <Button
                      key={s.value}
                      size="sm"
                      variant={(currentDetailApt.session_status || 'waiting') === s.value ? 'default' : 'outline'}
                      className="text-xs flex-1"
                      onClick={() => updateSessionStatus(currentDetailApt.id, s.value)}
                    >
                      {s.label}
                    </Button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-1">Randevu Durumu</p>
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

      {/* Room Dialog */}
      <Dialog open={roomDialogOpen} onOpenChange={setRoomDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingRoom ? 'Oda Düzenle' : 'Yeni Oda'}</DialogTitle>
            <DialogDescription>Seans odası adını girin</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label className="text-xs font-semibold">Oda Adı</Label>
            <Input value={roomName} onChange={e => setRoomName(e.target.value)} placeholder="Ör: Oda 1" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoomDialogOpen(false)}>İptal</Button>
            <Button onClick={handleSaveRoom} disabled={savingRoom || !roomName.trim()}>
              {savingRoom && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Kaydet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
