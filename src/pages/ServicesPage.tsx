import { useState } from 'react';
import { useSalon } from '@/contexts/SalonContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { Service } from '@/types/salon';

export default function ServicesPage() {
  const { services, addService, updateService, deleteService } = useSalon();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);
  const [form, setForm] = useState({ name: '', duration: '', price: '' });

  const openAdd = () => { setEditing(null); setForm({ name: '', duration: '', price: '' }); setDialogOpen(true); };
  const openEdit = (s: Service) => { setEditing(s); setForm({ name: s.name, duration: String(s.duration), price: String(s.price) }); setDialogOpen(true); };

  const handleSave = () => {
    if (!form.name.trim()) return;
    const data = { name: form.name, duration: Number(form.duration) || 0, price: Number(form.price) || 0 };
    if (editing) updateService(editing.id, data);
    else addService(data);
    setDialogOpen(false);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Hizmetler</h1>
        <Button onClick={openAdd}><Plus className="h-4 w-4 mr-1" /> Ekle</Button>
      </div>

      <Card>
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
                    <Button variant="ghost" size="icon" onClick={() => openEdit(s)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => deleteService(s.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'Hizmet Düzenle' : 'Yeni Hizmet'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Hizmet Adı</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div><Label>Süre (dakika)</Label><Input type="number" value={form.duration} onChange={e => setForm(f => ({ ...f, duration: e.target.value }))} /></div>
            <div><Label>Fiyat (₺)</Label><Input type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} /></div>
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
