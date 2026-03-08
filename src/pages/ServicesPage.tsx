import { useState } from 'react';
import { useSalon } from '@/contexts/SalonContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Pencil, Trash2, Clock, Scissors } from 'lucide-react';
import { Service } from '@/types/salon';
import { toast } from 'sonner';

export default function ServicesPage() {
  const { services, addService, updateService, deleteService } = useSalon();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);
  const [form, setForm] = useState({ name: '', duration: '', price: '' });

  const openAdd = () => { setEditing(null); setForm({ name: '', duration: '', price: '' }); setDialogOpen(true); };
  const openEdit = (s: Service) => { setEditing(s); setForm({ name: s.name, duration: String(s.duration), price: String(s.price) }); setDialogOpen(true); };

  const handleSave = () => {
    if (!form.name.trim()) {
      toast.error('Hizmet adı zorunludur.');
      return;
    }
    const data = { name: form.name, duration: Number(form.duration) || 0, price: Number(form.price) || 0 };
    if (editing) {
      updateService(editing.id, data);
      toast.success('Hizmet güncellendi.');
    } else {
      addService(data);
      toast.success('Hizmet eklendi.');
    }
    setDialogOpen(false);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Hizmetler</h1>
        <Button onClick={openAdd}><Plus className="h-4 w-4 mr-1" /> Ekle</Button>
      </div>

      {/* Mobile card view */}
      <div className="block md:hidden space-y-3">
        {services.length === 0 ? (
          <p className="text-center py-8 text-muted-foreground text-sm">Hizmet bulunamadı.</p>
        ) : services.map(s => (
          <Card key={s.id}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Scissors className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">{s.name}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {s.duration} dk</span>
                      <span>₺{s.price.toLocaleString('tr-TR')}</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(s)}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => deleteService(s.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Desktop table view */}
      <Card className="hidden md:block">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Hizmet Adı</TableHead>
                <TableHead>Süre (dk)</TableHead>
                <TableHead>Fiyat (₺)</TableHead>
                <TableHead className="text-right">İşlem</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {services.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Hizmet bulunamadı.</TableCell></TableRow>
              ) : services.map(s => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell>{s.duration} dk</TableCell>
                  <TableCell>₺{s.price.toLocaleString('tr-TR')}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(s)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteService(s.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? 'Hizmet Düzenle' : 'Yeni Hizmet'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5"><Label>Hizmet Adı</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Saç Kesimi" /></div>
            <div className="space-y-1.5"><Label>Süre (dakika)</Label><Input type="number" value={form.duration} onChange={e => setForm(f => ({ ...f, duration: e.target.value }))} placeholder="45" /></div>
            <div className="space-y-1.5"><Label>Fiyat (₺)</Label><Input type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} placeholder="250" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>İptal</Button>
            <Button onClick={handleSave}>Kaydet</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}