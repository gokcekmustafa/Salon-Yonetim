import { useState, useEffect, useCallback } from 'react';
import { useFormGuard } from '@/hooks/useFormGuard';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, DoorOpen, Pencil, Trash2, Loader2, Users, ListPlus } from 'lucide-react';
import { toast } from 'sonner';
import { StaffPageGuard } from '@/components/permissions/StaffPageGuard';

interface Room {
  id: string;
  salon_id: string;
  name: string;
  room_number: string | null;
  capacity: number | null;
  description: string | null;
  is_active: boolean;
  created_at: string;
}

interface StandardRoom {
  id: string;
  name: string;
  room_number: string | null;
  capacity: number | null;
  description: string | null;
}

export default function RoomsPage() {
  const { currentSalonId } = useAuth();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [deleteRoom, setDeleteRoom] = useState<Room | null>(null);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [roomNumber, setRoomNumber] = useState('');
  const [capacity, setCapacity] = useState('1');
  const [description, setDescription] = useState('');

  // Standard room import state
  const [stdDialogOpen, setStdDialogOpen] = useState(false);
  const [stdRooms, setStdRooms] = useState<StandardRoom[]>([]);
  const [stdLoading, setStdLoading] = useState(false);
  const [stdSelected, setStdSelected] = useState<Set<string>>(new Set());
  const [stdImporting, setStdImporting] = useState(false);

  useFormGuard(dialogOpen || stdDialogOpen);

  const fetchRooms = useCallback(async () => {
    if (!currentSalonId) return;
    const { data } = await supabase
      .from('rooms')
      .select('*')
      .eq('salon_id', currentSalonId)
      .order('name');
    setRooms((data as Room[]) || []);
    setLoading(false);
  }, [currentSalonId]);

  useEffect(() => { fetchRooms(); }, [fetchRooms]);

  const openAdd = () => {
    setEditingRoom(null);
    setName('');
    setRoomNumber('');
    setCapacity('1');
    setDescription('');
    setDialogOpen(true);
  };

  const openEdit = (room: Room) => {
    setEditingRoom(room);
    setName(room.name);
    setRoomNumber(room.room_number || '');
    setCapacity(String(room.capacity || 1));
    setDescription(room.description || '');
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim() || !currentSalonId) return;
    setSaving(true);

    const payload = {
      name: name.trim(),
      room_number: roomNumber.trim() || null,
      capacity: parseInt(capacity) || 1,
      description: description.trim() || null,
    };

    if (editingRoom) {
      await supabase.from('rooms').update(payload as any).eq('id', editingRoom.id);
      toast.success('Oda güncellendi');
    } else {
      await supabase.from('rooms').insert({ ...payload, salon_id: currentSalonId } as any);
      toast.success('Oda eklendi');
    }

    setSaving(false);
    setDialogOpen(false);
    fetchRooms();
  };

  const handleDelete = async () => {
    if (!deleteRoom) return;
    await supabase.from('rooms').delete().eq('id', deleteRoom.id);
    toast.success('Oda silindi');
    setDeleteRoom(null);
    fetchRooms();
  };

  // Standard room import
  const openStdImport = async () => {
    setStdDialogOpen(true);
    setStdLoading(true);
    setStdSelected(new Set());
    const { data } = await supabase.from('standard_rooms').select('*').order('name');
    setStdRooms((data as StandardRoom[]) || []);
    setStdLoading(false);
  };

  const toggleStdRoom = (id: string) => {
    setStdSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAllStd = () => {
    if (stdSelected.size === stdRooms.length) {
      setStdSelected(new Set());
    } else {
      setStdSelected(new Set(stdRooms.map(r => r.id)));
    }
  };

  const handleStdImport = async () => {
    if (!currentSalonId || stdSelected.size === 0) return;
    setStdImporting(true);

    const selected = stdRooms.filter(r => stdSelected.has(r.id));
    const rows = selected.map(r => ({
      name: r.name,
      room_number: r.room_number,
      capacity: r.capacity || 1,
      description: r.description,
      salon_id: currentSalonId,
    }));

    const { error } = await supabase.from('rooms').insert(rows as any);
    if (error) {
      toast.error('Hata: ' + error.message);
    } else {
      toast.success(`${rows.length} oda başarıyla eklendi`);
    }

    setStdImporting(false);
    setStdDialogOpen(false);
    fetchRooms();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <StaffPageGuard permissionKey="page_rooms" featureLabel="Odalar">
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-bold" style={{ fontSize: '22px' }}>Odalar</h1>
          <p className="text-muted-foreground" style={{ fontSize: '13px' }}>
            Seans odalarını yönetin
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={openStdImport} className="rounded-full gap-1.5">
            <ListPlus className="h-4 w-4" /> Standart Listeden Ekle
          </Button>
          <Button onClick={openAdd} className="rounded-full gap-1.5">
            <Plus className="h-4 w-4" /> Oda Ekle
          </Button>
        </div>
      </div>

      {rooms.length === 0 ? (
        <Card style={{ borderRadius: '12px', border: '0.5px solid #e8e8e8', boxShadow: 'none' }}>
          <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
            <DoorOpen className="h-12 w-12 text-muted-foreground/40" />
            <p className="text-muted-foreground" style={{ fontSize: '14px' }}>
              Henüz oda eklenmemiş
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={openStdImport} className="rounded-full gap-1.5">
                <ListPlus className="h-4 w-4" /> Standart Listeden Ekle
              </Button>
              <Button variant="outline" onClick={openAdd} className="rounded-full gap-1.5">
                <Plus className="h-4 w-4" /> İlk Odayı Ekle
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rooms.map(room => (
            <Card
              key={room.id}
              style={{ borderRadius: '12px', border: '0.5px solid #e8e8e8', boxShadow: 'none' }}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <DoorOpen className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold" style={{ fontSize: '14px' }}>{room.name}</p>
                      {room.room_number && (
                        <p className="text-muted-foreground" style={{ fontSize: '12px' }}>
                          #{room.room_number}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(room)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteRoom(room)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="secondary" className="gap-1 text-xs">
                    <Users className="h-3 w-3" /> {room.capacity || 1} Kişi
                  </Badge>
                  <Badge variant={room.is_active ? 'default' : 'destructive'} className="text-xs">
                    {room.is_active ? 'Aktif' : 'Pasif'}
                  </Badge>
                </div>

                {room.description && (
                  <p className="text-muted-foreground line-clamp-2" style={{ fontSize: '13px' }}>
                    {room.description}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingRoom ? 'Oda Düzenle' : 'Yeni Oda'}</DialogTitle>
            <DialogDescription>Oda bilgilerini girin</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label style={{ fontSize: '13px' }}>Oda Adı *</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ör: Lazer Odası 1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label style={{ fontSize: '13px' }}>Oda Numarası</Label>
                <Input value={roomNumber} onChange={e => setRoomNumber(e.target.value)} placeholder="Ör: 101" />
              </div>
              <div className="space-y-1.5">
                <Label style={{ fontSize: '13px' }}>Kapasite</Label>
                <Input type="number" min="1" value={capacity} onChange={e => setCapacity(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label style={{ fontSize: '13px' }}>Açıklama</Label>
              <Textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Oda hakkında kısa açıklama..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>İptal</Button>
            <Button onClick={handleSave} disabled={saving || !name.trim()} className="rounded-full">
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Kaydet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Standard Rooms Import Dialog */}
      <Dialog open={stdDialogOpen} onOpenChange={setStdDialogOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ListPlus className="h-5 w-5 text-primary" />
              Standart Odalardan Ekle
            </DialogTitle>
            <DialogDescription>Eklemek istediğiniz odaları seçin.</DialogDescription>
          </DialogHeader>
          {stdLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : stdRooms.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <DoorOpen className="h-10 w-10 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">Henüz standart oda tanımlanmamış</p>
            </div>
          ) : (
            <div className="space-y-1">
              <div className="flex items-center gap-3 py-2 px-3 rounded-lg bg-muted/30 mb-2">
                <Checkbox
                  checked={stdSelected.size === stdRooms.length && stdRooms.length > 0}
                  onCheckedChange={toggleAllStd}
                />
                <span className="text-sm font-bold">Tümünü Seç</span>
                <Badge variant="secondary" className="text-[10px]">{stdRooms.length}</Badge>
              </div>
              {stdRooms.map(room => (
                <div key={room.id} className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-muted/50">
                  <Checkbox
                    checked={stdSelected.has(room.id)}
                    onCheckedChange={() => toggleStdRoom(room.id)}
                  />
                  <DoorOpen className="h-4 w-4 text-primary/60 shrink-0" />
                  <div className="flex-1">
                    <span className="text-sm font-medium">{room.name}</span>
                    {room.room_number && (
                      <span className="text-xs text-muted-foreground ml-2">#{room.room_number}</span>
                    )}
                  </div>
                  {room.capacity && (
                    <Badge variant="secondary" className="gap-1 text-[10px]">
                      <Users className="h-2.5 w-2.5" /> {room.capacity}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setStdDialogOpen(false)}>İptal</Button>
            <Button
              onClick={handleStdImport}
              disabled={stdImporting || stdSelected.size === 0}
              className="rounded-full gap-1.5"
            >
              {stdImporting && <Loader2 className="h-4 w-4 animate-spin" />}
              {stdSelected.size > 0 ? `${stdSelected.size} Oda Ekle` : 'Seçim Yapın'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteRoom} onOpenChange={v => { if (!v) setDeleteRoom(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Odayı Sil</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{deleteRoom?.name}</strong> odasını silmek istediğinize emin misiniz? Bu işlem geri alınamaz.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Vazgeç</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Evet, Sil
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
    </StaffPageGuard>
  );
}
