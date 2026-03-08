import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useSalonData } from '@/hooks/useSalonData';
import { usePermissions } from '@/hooks/usePermissions';
import { NoPermission } from '@/components/permissions/NoPermission';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Loader2, Plus, DoorOpen, Clock, CheckCircle2, User, Trash2, Pencil } from 'lucide-react';
import { format, parseISO, isToday } from 'date-fns';
import { tr } from 'date-fns/locale';
import { toast } from 'sonner';

type Room = { id: string; salon_id: string; name: string; is_active: boolean };

const SESSION_STATUSES = [
  { value: 'waiting', label: 'Bekliyor', color: 'secondary' as const },
  { value: 'in_session', label: 'Seansta', color: 'default' as const },
  { value: 'completed', label: 'Tamamlandı', color: 'outline' as const },
];

const getStatusInfo = (s: string) => SESSION_STATUSES.find(x => x.value === s) || SESSION_STATUSES[0];

export default function SessionsPage() {
  const { hasPermission } = usePermissions();
  const { currentSalonId } = useAuth();
  const { appointments, customers, services, staff, branches, loading: salonLoading, refetch } = useSalonData();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [roomDialogOpen, setRoomDialogOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [roomName, setRoomName] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchRooms = useCallback(async () => {
    if (!currentSalonId) return;
    const { data } = await supabase.from('rooms').select('*').eq('salon_id', currentSalonId).order('name');
    setRooms((data as Room[]) || []);
    setLoadingRooms(false);
  }, [currentSalonId]);

  useEffect(() => { fetchRooms(); }, [fetchRooms]);

  // Realtime subscription for appointment changes
  useEffect(() => {
    const channel = supabase
      .channel('session-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, () => {
        refetch();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [refetch]);

  if (!hasPermission('can_manage_appointments')) return <NoPermission feature="Seans Yönetimi" />;
  if (salonLoading || loadingRooms) return (
    <div className="flex items-center justify-center py-20">
      <div className="flex flex-col items-center gap-3"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="text-sm text-muted-foreground">Yükleniyor...</p></div>
    </div>
  );

  const todayAppointments = appointments.filter(a => {
    try { return isToday(parseISO(a.start_time)) && a.status !== 'iptal'; } catch { return false; }
  });

  const getName = (list: { id: string; name: string }[], id: string) => list.find(x => x.id === id)?.name ?? '-';

  const updateSession = async (appointmentId: string, updates: Record<string, string | null>) => {
    const { error } = await supabase.from('appointments').update(updates as any).eq('id', appointmentId);
    if (error) toast.error('Güncellenemedi');
    else { toast.success('Güncellendi'); refetch(); }
  };

  // Room CRUD
  const handleSaveRoom = async () => {
    if (!roomName.trim() || !currentSalonId) return;
    setSaving(true);
    if (editingRoom) {
      await supabase.from('rooms').update({ name: roomName.trim() } as any).eq('id', editingRoom.id);
      toast.success('Oda güncellendi');
    } else {
      await supabase.from('rooms').insert({ name: roomName.trim(), salon_id: currentSalonId } as any);
      toast.success('Oda eklendi');
    }
    setSaving(false);
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

  const openAddRoom = () => { setEditingRoom(null); setRoomName(''); setRoomDialogOpen(true); };
  const openEditRoom = (r: Room) => { setEditingRoom(r); setRoomName(r.name); setRoomDialogOpen(true); };

  return (
    <div className="page-container animate-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Seans Yönetimi</h1>
          <p className="page-subtitle">Bugünkü randevular ve oda atamaları</p>
        </div>
      </div>

      {/* Room Management */}
      <Card className="shadow-soft border-border/60">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DoorOpen className="h-5 w-5 text-primary" />
              <div><CardTitle className="text-base">Odalar</CardTitle><CardDescription>Seans odalarını yönetin</CardDescription></div>
            </div>
            <Button size="sm" onClick={openAddRoom} className="gap-1.5 btn-gradient rounded-xl h-9">
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
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEditRoom(r)}><Pencil className="h-3 w-3" /></Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => deleteRoom(r.id)}><Trash2 className="h-3 w-3" /></Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Today's Sessions */}
      <Card className="shadow-soft border-border/60">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            <div><CardTitle className="text-base">Bugünkü Seanslar</CardTitle><CardDescription>{todayAppointments.length} randevu</CardDescription></div>
          </div>
        </CardHeader>
        <CardContent>
          {todayAppointments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Bugün için randevu yok</p>
          ) : (
            <div className="space-y-3">
              {todayAppointments.map(apt => {
                const status = getStatusInfo((apt as any).session_status || 'waiting');
                return (
                  <div key={apt.id} className="p-4 rounded-xl border border-border/60 bg-card hover:shadow-sm transition-shadow space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <User className="h-5 w-5 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-sm">{getName(customers, apt.customer_id)}</p>
                          <p className="text-xs text-muted-foreground">{getName(services, apt.service_id)} • {format(parseISO(apt.start_time), 'HH:mm', { locale: tr })} - {format(parseISO(apt.end_time), 'HH:mm', { locale: tr })}</p>
                        </div>
                      </div>
                      <Badge variant={status.color} className="shrink-0 text-xs">{status.label}</Badge>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {/* Staff Assignment */}
                      <div className="space-y-1">
                        <Label className="text-[10px] font-semibold text-muted-foreground uppercase">Personel</Label>
                        <Select value={apt.staff_id} onValueChange={v => updateSession(apt.id, { staff_id: v })}>
                          <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {staff.filter(s => s.is_active).map(s => (
                              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Room Assignment */}
                      <div className="space-y-1">
                        <Label className="text-[10px] font-semibold text-muted-foreground uppercase">Oda</Label>
                        <Select value={(apt as any).room_id || 'none'} onValueChange={v => updateSession(apt.id, { room_id: v === 'none' ? null : v })}>
                          <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Oda seç" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">— Atanmamış —</SelectItem>
                            {rooms.filter(r => r.is_active).map(r => (
                              <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Status */}
                      <div className="space-y-1">
                        <Label className="text-[10px] font-semibold text-muted-foreground uppercase">Durum</Label>
                        <Select value={(apt as any).session_status || 'waiting'} onValueChange={v => updateSession(apt.id, { session_status: v })}>
                          <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {SESSION_STATUSES.map(s => (
                              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Room Dialog */}
      <Dialog open={roomDialogOpen} onOpenChange={setRoomDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingRoom ? 'Oda Düzenle' : 'Yeni Oda'}</DialogTitle>
            <DialogDescription>Seans odası adını girin</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Oda Adı</Label>
              <Input value={roomName} onChange={e => setRoomName(e.target.value)} placeholder="Ör: Oda 1" className="h-10" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoomDialogOpen(false)}>İptal</Button>
            <Button onClick={handleSaveRoom} disabled={saving || !roomName.trim()} className="btn-gradient">
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Kaydet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
