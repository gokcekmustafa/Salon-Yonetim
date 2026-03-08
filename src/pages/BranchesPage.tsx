import { useState } from 'react';
import { useSalon } from '@/contexts/SalonContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Plus, Pencil, Trash2, Building2, MapPin, Phone } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Branch } from '@/types/salon';
import { toast } from 'sonner';

export default function BranchesPage() {
  const { branches, addBranch, updateBranch, deleteBranch, staff } = useSalon();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Branch | null>(null);
  const [form, setForm] = useState({ name: '', address: '', phone: '', active: true });

  const openAdd = () => {
    setEditing(null);
    setForm({ name: '', address: '', phone: '', active: true });
    setDialogOpen(true);
  };

  const openEdit = (b: Branch) => {
    setEditing(b);
    setForm({ name: b.name, address: b.address, phone: b.phone, active: b.active });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.name.trim()) {
      toast.error('Şube adı zorunludur.');
      return;
    }
    if (editing) {
      updateBranch(editing.id, form);
      toast.success('Şube güncellendi.');
    } else {
      addBranch(form);
      toast.success('Şube eklendi.');
    }
    setDialogOpen(false);
  };

  const handleDelete = (b: Branch) => {
    const branchStaff = staff.filter(s => s.branchId === b.id);
    if (branchStaff.length > 0) {
      toast.error(`Bu şubede ${branchStaff.length} personel var. Önce personeli taşıyın.`);
      return;
    }
    deleteBranch(b.id);
    toast.success('Şube silindi.');
  };

  const getStaffCount = (branchId: string) => staff.filter(s => s.branchId === branchId).length;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Şubeler</h1>
        <Button onClick={openAdd}><Plus className="h-4 w-4 mr-1" /> Yeni Şube</Button>
      </div>

      {/* Branch Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {branches.map(b => (
          <Card key={b.id} className={`transition-all ${!b.active ? 'opacity-60' : ''}`}>
            <CardContent className="p-5 space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Building2 className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{b.name}</h3>
                    <Badge variant={b.active ? 'default' : 'secondary'} className="text-xs mt-0.5">
                      {b.active ? 'Aktif' : 'Pasif'}
                    </Badge>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(b)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(b)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              <div className="space-y-1.5 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" />
                  <span>{b.address}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="h-3.5 w-3.5" />
                  <span>{b.phone}</span>
                </div>
              </div>

              <div className="pt-2 border-t text-xs text-muted-foreground">
                {getStaffCount(b.id)} personel
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {branches.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Building2 className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground text-sm">Henüz şube eklenmedi.</p>
          </CardContent>
        </Card>
      )}

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Şube Düzenle' : 'Yeni Şube'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Şube Adı</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Kadıköy Şubesi" />
            </div>
            <div className="space-y-1.5">
              <Label>Adres</Label>
              <Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Kadıköy, İstanbul" />
            </div>
            <div className="space-y-1.5">
              <Label>Telefon</Label>
              <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="0212 555 1234" />
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
