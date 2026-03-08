import { useState } from 'react';
import { useSalonData, DbService } from '@/hooks/useSalonData';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Pencil, Trash2, Clock, Scissors, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function ServicesPage() {
  const { services, addService, updateService, deleteService, loading } = useSalonData();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<DbService | null>(null);
  const [form, setForm] = useState({ name: '', duration: '', price: '' });
  const [saving, setSaving] = useState(false);

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="flex flex-col items-center gap-3"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="text-sm text-muted-foreground">Yükleniyor...</p></div>
    </div>
  );

  const openAdd = () => { setEditing(null); setForm({ name: '', duration: '', price: '' }); setDialogOpen(true); };
  const openEdit = (s: DbService) => { setEditing(s); setForm({ name: s.name, duration: String(s.duration), price: String(s.price) }); setDialogOpen(true); };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Hizmet adı zorunludur.'); return; }
    setSaving(true);
    const data = { name: form.name, duration: Number(form.duration) || 0, price: Number(form.price) || 0 };
    if (editing) { await updateService(editing.id, data); toast.success('Hizmet güncellendi.'); }
    else { await addService(data); toast.success('Hizmet eklendi.'); }
    setSaving(false);
    setDialogOpen(false);
  };

  const handleDelete = async (id: string) => { await deleteService(id); toast.success('Hizmet silindi.'); };

  return (
    <div className="page-container animate-in">
      <div className="page-header">
        <div><h1 className="page-title">Hizmetler</h1><p className="page-subtitle">{services.length} hizmet tanımlı</p></div>
        <Button onClick={openAdd} size="sm" className="h-10 btn-gradient gap-1.5 rounded-xl px-4"><Plus className="h-4 w-4" /> Ekle</Button>
      </div>

      {/* Mobile Cards */}
      <div className="block md:hidden space-y-3">
        {services.length === 0 ? (
          <Card className="shadow-soft border-border/60"><CardContent className="empty-state"><Scissors className="empty-state-icon" /><p className="empty-state-title">Hizmet bulunamadı</p><p className="empty-state-description">İlk hizmetinizi ekleyerek başlayın.</p></CardContent></Card>
        ) : services.map(s => (
          <div key={s.id} className="card-interactive p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center"><Scissors className="h-4.5 w-4.5 text-primary" /></div>
                <div>
                  <p className="font-semibold text-sm">{s.name}</p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {s.duration} dk</span>
                    <span className="font-bold text-foreground">₺{Number(s.price).toLocaleString('tr-TR')}</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-0.5">
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => openEdit(s)}><Pencil className="h-3.5 w-3.5" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(s.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop Table */}
      <Card className="hidden md:block shadow-soft border-border/60 overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow className="hover:bg-transparent"><TableHead className="font-semibold">Hizmet Adı</TableHead><TableHead className="font-semibold">Süre</TableHead><TableHead className="font-semibold">Fiyat</TableHead><TableHead className="text-right font-semibold">İşlem</TableHead></TableRow></TableHeader>
            <TableBody>
              {services.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center py-12 text-muted-foreground text-sm">Hizmet bulunamadı.</TableCell></TableRow>
              ) : services.map(s => (
                <TableRow key={s.id} className="group">
                  <TableCell><div className="flex items-center gap-3"><div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center"><Scissors className="h-4 w-4 text-primary" /></div><span className="font-medium">{s.name}</span></div></TableCell>
                  <TableCell className="text-muted-foreground">{s.duration} dk</TableCell>
                  <TableCell className="font-bold tabular-nums">₺{Number(s.price).toLocaleString('tr-TR')}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-primary" onClick={() => openEdit(s)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-destructive" onClick={() => handleDelete(s.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
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
          <DialogHeader><DialogTitle>{editing ? 'Hizmet Düzenle' : 'Yeni Hizmet'}</DialogTitle><DialogDescription>{editing ? 'Hizmet bilgilerini güncelleyin' : 'Yeni hizmet ekleyin'}</DialogDescription></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2"><Label className="text-xs font-semibold">Hizmet Adı</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Saç Kesimi" className="h-10" /></div>
            <div className="space-y-2"><Label className="text-xs font-semibold">Süre (dakika)</Label><Input type="number" value={form.duration} onChange={e => setForm(f => ({ ...f, duration: e.target.value }))} placeholder="45" className="h-10" /></div>
            <div className="space-y-2"><Label className="text-xs font-semibold">Fiyat (₺)</Label><Input type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} placeholder="250" className="h-10" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>İptal</Button>
            <Button onClick={handleSave} disabled={saving} className="btn-gradient">{saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Kaydet</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
