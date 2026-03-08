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
    <div className="page-container animate-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Hizmetler</h1>
          <p className="page-subtitle">{services.length} hizmet tanımlı</p>
        </div>
        <Button onClick={openAdd} size="sm" className="h-9"><Plus className="h-4 w-4 mr-1.5" /> Ekle</Button>
      </div>

      {/* Mobile card view */}
      <div className="block md:hidden space-y-3">
        {services.length === 0 ? (
          <Card className="shadow-card border-border/60">
            <CardContent className="empty-state">
              <Scissors className="empty-state-icon" />
              <p className="empty-state-title">Hizmet bulunamadı</p>
              <p className="empty-state-description">İlk hizmetinizi ekleyerek başlayın.</p>
            </CardContent>
          </Card>
        ) : services.map(s => (
          <Card key={s.id} className="shadow-soft border-border/60 hover:shadow-card transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-primary/8 flex items-center justify-center">
                    <Scissors className="h-4.5 w-4.5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">{s.name}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {s.duration} dk</span>
                      <span className="font-semibold text-foreground">₺{s.price.toLocaleString('tr-TR')}</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-0.5">
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => openEdit(s)}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => deleteService(s.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Desktop table view */}
      <Card className="hidden md:block shadow-card border-border/60">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="font-semibold">Hizmet Adı</TableHead>
                <TableHead className="font-semibold">Süre</TableHead>
                <TableHead className="font-semibold">Fiyat</TableHead>
                <TableHead className="text-right font-semibold">İşlem</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {services.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center py-12 text-muted-foreground text-sm">Hizmet bulunamadı.</TableCell></TableRow>
              ) : services.map(s => (
                <TableRow key={s.id} className="group">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg bg-primary/8 flex items-center justify-center">
                        <Scissors className="h-4 w-4 text-primary" />
                      </div>
                      <span className="font-medium">{s.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{s.duration} dk</TableCell>
                  <TableCell className="font-semibold">₺{s.price.toLocaleString('tr-TR')}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(s)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-destructive" onClick={() => deleteService(s.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
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
          <div className="space-y-4 py-2">
            <div className="space-y-1.5"><Label className="text-xs font-medium">Hizmet Adı</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Saç Kesimi" /></div>
            <div className="space-y-1.5"><Label className="text-xs font-medium">Süre (dakika)</Label><Input type="number" value={form.duration} onChange={e => setForm(f => ({ ...f, duration: e.target.value }))} placeholder="45" /></div>
            <div className="space-y-1.5"><Label className="text-xs font-medium">Fiyat (₺)</Label><Input type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} placeholder="250" /></div>
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
