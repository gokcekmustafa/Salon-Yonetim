import { useState, useEffect, useCallback } from 'react';
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
import { Plus, DoorOpen, Pencil, Trash2, Loader2, Users } from 'lucide-react';
import { toast } from 'sonner';

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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-bold" style={{ fontSize: '22px' }}>Odalar</h1>
          <p className="text-muted-foreground" style={{ fontSize: '13px' }}>
            Seans odalarını yönetin
          </p>
        </div>
        <Button onClick={openAdd} className="rounded-full gap-1.5">
          <Plus className="h-4 w-4" /> Oda Ekle
        </Button>
      </div>

      {rooms.length === 0 ? (
        <Card style={{ borderRadius: '12px', border: '0.5px solid #e8e8e8', boxShadow: 'none' }}>
          <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
            <DoorOpen className="h-12 w-12 text-muted-foreground/40" />
            <p className="text-muted-foreground" style={{ fontSize: '14px' }}>
              Henüz oda eklenmemiş
            </p>
            <Button variant="outline" onClick={openAdd} className="rounded-full gap-1.5">
              <Plus className="h-4 w-4" /> İlk Odayı Ekle
            </Button>
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
  );
}
