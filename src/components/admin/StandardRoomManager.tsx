import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Plus, DoorOpen, Pencil, Trash2, Loader2, Users } from 'lucide-react';
import { toast } from 'sonner';

interface StandardRoom {
  id: string;
  name: string;
  room_number: string | null;
  capacity: number | null;
  description: string | null;
  created_at: string;
}

export function StandardRoomManager() {
  const [rooms, setRooms] = useState<StandardRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<StandardRoom | null>(null);
  const [deleteRoom, setDeleteRoom] = useState<StandardRoom | null>(null);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [roomNumber, setRoomNumber] = useState('');
  const [capacity, setCapacity] = useState('1');
  const [description, setDescription] = useState('');

  const fetchRooms = async () => {
    const { data } = await supabase
      .from('standard_rooms')
      .select('*')
      .order('name');
    setRooms((data as StandardRoom[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchRooms(); }, []);

  const openAdd = () => {
    setEditingRoom(null);
    setName(''); setRoomNumber(''); setCapacity('1'); setDescription('');
    setDialogOpen(true);
  };

  const openEdit = (room: StandardRoom) => {
    setEditingRoom(room);
    setName(room.name);
    setRoomNumber(room.room_number || '');
    setCapacity(String(room.capacity || 1));
    setDescription(room.description || '');
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);

    const payload = {
      name: name.trim(),
      room_number: roomNumber.trim() || null,
      capacity: parseInt(capacity) || 1,
      description: description.trim() || null,
    };

    if (editingRoom) {
      const { error } = await supabase.from('standard_rooms').update(payload as any).eq('id', editingRoom.id);
      if (error) toast.error('Hata: ' + error.message);
      else toast.success('Standart oda güncellendi');
    } else {
      const { error } = await supabase.from('standard_rooms').insert(payload as any);
      if (error) toast.error('Hata: ' + error.message);
      else toast.success('Standart oda eklendi');
    }

    setSaving(false);
    setDialogOpen(false);
    fetchRooms();
  };

  const handleDelete = async () => {
    if (!deleteRoom) return;
    const { error } = await supabase.from('standard_rooms').delete().eq('id', deleteRoom.id);
    if (error) toast.error('Hata: ' + error.message);
    else toast.success('Standart oda silindi');
    setDeleteRoom(null);
    fetchRooms();
  };

  return (
    <Card className="shadow-soft border-border/60">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
              <DoorOpen className="h-3.5 w-3.5 text-primary" />
            </div>
            Standart Odalar
          </CardTitle>
          <Button onClick={openAdd} size="sm" className="gap-1.5 h-8 rounded-full">
            <Plus className="h-3.5 w-3.5" /> Oda Ekle
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Yeni salon oluşturulduğunda bu odalar otomatik olarak salona eklenir.
        </p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : rooms.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 gap-2">
            <DoorOpen className="h-10 w-10 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">Henüz standart oda tanımlanmamış</p>
            <Button variant="outline" size="sm" onClick={openAdd} className="gap-1.5 mt-1">
              <Plus className="h-3.5 w-3.5" /> İlk Odayı Ekle
            </Button>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {rooms.map(room => (
              <div
                key={room.id}
                className="rounded-xl border border-border/60 p-4 bg-muted/20 hover:bg-muted/40 transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <DoorOpen className="h-4 w-4 text-primary" />
                    <span className="font-medium text-sm">{room.name}</span>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(room)}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteRoom(room)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {room.room_number && (
                    <Badge variant="outline" className="text-[10px]">#{room.room_number}</Badge>
                  )}
                  <Badge variant="secondary" className="text-[10px] gap-1">
                    <Users className="h-2.5 w-2.5" /> {room.capacity || 1} Kişi
                  </Badge>
                </div>
                {room.description && (
                  <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{room.description}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingRoom ? 'Standart Oda Düzenle' : 'Yeni Standart Oda'}</DialogTitle>
            <DialogDescription>Bu oda yeni salonlara otomatik eklenecektir.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Oda Adı *</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ör: Lazer Odası 1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Oda Numarası</Label>
                <Input value={roomNumber} onChange={e => setRoomNumber(e.target.value)} placeholder="Ör: 101" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Kapasite</Label>
                <Input type="number" min="1" value={capacity} onChange={e => setCapacity(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Açıklama</Label>
              <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Oda hakkında kısa açıklama..." rows={3} />
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
            <AlertDialogTitle>Standart Odayı Sil</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{deleteRoom?.name}</strong> standart odasını silmek istediğinize emin misiniz? Mevcut salonlardaki odalar etkilenmez.
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
    </Card>
  );
}
