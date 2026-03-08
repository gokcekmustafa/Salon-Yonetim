import { useState } from 'react';
import { useSalonData, DbStaff } from '@/hooks/useSalonData';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Plus, Pencil, User, UserCheck, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

export default function StaffPage() {
  const { staff, addStaff, updateStaff, branches, loading } = useSalonData();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<DbStaff | null>(null);
  const [form, setForm] = useState({ name: '', phone: '', is_active: true, branch_id: '' });

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  const activeBranches = branches.filter(b => b.is_active);
  const openAdd = () => { setEditing(null); setForm({ name: '', phone: '', is_active: true, branch_id: activeBranches[0]?.id || '' }); setDialogOpen(true); };
  const openEdit = (s: DbStaff) => { setEditing(s); setForm({ name: s.name, phone: s.phone || '', is_active: s.is_active, branch_id: s.branch_id || '' }); setDialogOpen(true); };

  const handleSave = async () => {
    if (!form.name.trim() || !form.branch_id) { toast.error('Ad ve şube zorunludur.'); return; }
    if (editing) { await updateStaff(editing.id, { name: form.name, phone: form.phone, is_active: form.is_active, branch_id: form.branch_id }); toast.success('Personel güncellendi.'); }
    else { await addStaff({ name: form.name, phone: form.phone, is_active: form.is_active, branch_id: form.branch_id }); toast.success('Personel eklendi.'); }
    setDialogOpen(false);
  };

  const getBranchName = (id: string | null) => branches.find(b => b.id === id)?.name ?? '-';

  return (
    <div className="page-container animate-in">
      <div className="page-header">
        <div><h1 className="page-title">Personel</h1><p className="page-subtitle">{staff.filter(s => s.is_active).length} aktif personel</p></div>
        <Button onClick={openAdd} size="sm" className="h-9"><Plus className="h-4 w-4 mr-1.5" /> Ekle</Button>
      </div>

      <div className="block md:hidden space-y-3">
        {staff.length === 0 ? (
          <Card className="shadow-card border-border/60"><CardContent className="empty-state"><UserCheck className="empty-state-icon" /><p className="empty-state-title">Personel bulunamadı</p></CardContent></Card>
        ) : staff.map(s => (
          <Card key={s.id} className={`shadow-soft border-border/60 hover:shadow-card transition-shadow ${!s.is_active ? 'opacity-50' : ''}`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-full flex items-center justify-center ${s.is_active ? 'bg-primary/8' : 'bg-muted'}`}><User className={`h-4.5 w-4.5 ${s.is_active ? 'text-primary' : 'text-muted-foreground'}`} /></div>
                  <div>
                    <p className="font-medium text-sm">{s.name}</p>
                    <p className="text-xs text-muted-foreground">{s.phone}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-muted-foreground">{getBranchName(s.branch_id)}</span>
                      <Badge variant={s.is_active ? 'default' : 'secondary'} className="text-[10px] px-1.5">{s.is_active ? 'Aktif' : 'Pasif'}</Badge>
                    </div>
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => openEdit(s)}><Pencil className="h-3.5 w-3.5" /></Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="hidden md:block shadow-card border-border/60">
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow className="hover:bg-transparent"><TableHead className="font-semibold">Ad Soyad</TableHead><TableHead className="font-semibold">Telefon</TableHead><TableHead className="font-semibold">Şube</TableHead><TableHead className="font-semibold">Durum</TableHead><TableHead className="text-right font-semibold">İşlem</TableHead></TableRow></TableHeader>
            <TableBody>
              {staff.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground text-sm">Personel bulunamadı.</TableCell></TableRow>
              ) : staff.map(s => (
                <TableRow key={s.id} className={`group ${!s.is_active ? 'opacity-50' : ''}`}>
                  <TableCell><div className="flex items-center gap-3"><div className="h-8 w-8 rounded-full bg-primary/8 flex items-center justify-center"><User className="h-4 w-4 text-primary" /></div><span className="font-medium">{s.name}</span></div></TableCell>
                  <TableCell className="text-muted-foreground">{s.phone}</TableCell>
                  <TableCell className="text-muted-foreground">{getBranchName(s.branch_id)}</TableCell>
                  <TableCell><Badge variant={s.is_active ? 'default' : 'secondary'} className="text-[10px]">{s.is_active ? 'Aktif' : 'Pasif'}</Badge></TableCell>
                  <TableCell className="text-right"><Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => openEdit(s)}><Pencil className="h-3.5 w-3.5" /></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md"><DialogHeader><DialogTitle>{editing ? 'Personel Düzenle' : 'Yeni Personel'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5"><Label className="text-xs font-medium">Ad Soyad</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ad Soyad" /></div>
            <div className="space-y-1.5"><Label className="text-xs font-medium">Telefon</Label><Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="0500 000 0000" type="tel" /></div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Şube</Label>
              <Select value={form.branch_id} onValueChange={v => setForm(f => ({ ...f, branch_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Şube seçin" /></SelectTrigger>
                <SelectContent>{activeBranches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between py-1"><Label className="text-xs font-medium">Aktif</Label><Switch checked={form.is_active} onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)}>İptal</Button><Button onClick={handleSave}>Kaydet</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
