import { useState } from 'react';
import { useSalon } from '@/contexts/SalonContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Plus, Pencil } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Staff } from '@/types/salon';

export default function StaffPage() {
  const { staff, addStaff, updateStaff, branches } = useSalon();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Staff | null>(null);
  const [form, setForm] = useState({ name: '', phone: '', active: true, branchId: '' });

  const activeBranches = branches.filter(b => b.active);

  const openAdd = () => {
    setEditing(null);
    setForm({ name: '', phone: '', active: true, branchId: activeBranches[0]?.id || '' });
    setDialogOpen(true);
  };

  const openEdit = (s: Staff) => {
    setEditing(s);
    setForm({ name: s.name, phone: s.phone, active: s.active, branchId: s.branchId });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.name.trim() || !form.branchId) return;
    if (editing) updateStaff(editing.id, form);
    else addStaff(form);
    setDialogOpen(false);
  };

  const getBranchName = (id: string) => branches.find(b => b.id === id)?.name ?? '-';

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Personel</h1>
        <Button onClick={openAdd}><Plus className="h-4 w-4 mr-1" /> Ekle</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ad Soyad</TableHead>
                <TableHead>Telefon</TableHead>
                <TableHead>Şube</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead className="text-right">İşlem</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {staff.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Personel bulunamadı.</TableCell></TableRow>
              ) : staff.map(s => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell>{s.phone}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{getBranchName(s.branchId)}</TableCell>
                  <TableCell>
                    <Badge variant={s.active ? 'default' : 'secondary'}>
                      {s.active ? 'Aktif' : 'Pasif'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(s)}><Pencil className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'Personel Düzenle' : 'Yeni Personel'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Ad Soyad</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div><Label>Telefon</Label><Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
            <div>
              <Label>Şube</Label>
              <Select value={form.branchId} onValueChange={v => setForm(f => ({ ...f, branchId: v }))}>
                <SelectTrigger><SelectValue placeholder="Şube seçin" /></SelectTrigger>
                <SelectContent>
                  {activeBranches.map(b => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3">
              <Label>Aktif</Label>
              <Switch checked={form.active} onCheckedChange={v => setForm(f => ({ ...f, active: v }))} />
            </div>
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
