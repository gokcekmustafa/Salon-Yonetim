import { useState } from 'react';
import { useSalon } from '@/contexts/SalonContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
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
    <div className="page-container animate-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Şubeler</h1>
          <p className="page-subtitle">{branches.filter(b => b.active).length} aktif şube</p>
        </div>
        <Button onClick={openAdd} size="sm" className="h-9"><Plus className="h-4 w-4 mr-1.5" /> Yeni Şube</Button>
      </div>

      {/* Branch Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {branches.map(b => (
          <Card key={b.id} className={`shadow-soft border-border/60 hover:shadow-card transition-all ${!b.active ? 'opacity-50' : ''}`}>
            <CardContent className="p-5 space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-11 w-11 rounded-xl bg-primary/8 flex items-center justify-center">
                    <Building2 className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm">{b.name}</h3>
                    <Badge variant={b.active ? 'default' : 'secondary'} className="text-[10px] mt-1">
                      {b.active ? 'Aktif' : 'Pasif'}
                    </Badge>
                  </div>
                </div>
                <div className="flex gap-0.5">
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => openEdit(b)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(b)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              <div className="space-y-1.5 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  <span>{b.address}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="h-3.5 w-3.5 shrink-0" />
                  <span>{b.phone}</span>
                </div>
              </div>

              <div className="pt-3 border-t border-border/50 text-xs text-muted-foreground">
                {getStaffCount(b.id)} personel
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {branches.length === 0 && (
        <Card className="shadow-card border-border/60">
          <CardContent className="empty-state">
            <Building2 className="empty-state-icon" />
            <p className="empty-state-title">Henüz şube eklenmedi</p>
            <p className="empty-state-description">İlk şubenizi ekleyerek başlayın.</p>
          </CardContent>
        </Card>
      )}

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Şube Düzenle' : 'Yeni Şube'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Şube Adı</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Kadıköy Şubesi" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Adres</Label>
              <Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Kadıköy, İstanbul" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Telefon</Label>
              <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="0212 555 1234" type="tel" />
            </div>
            <div className="flex items-center justify-between py-1">
              <Label className="text-xs font-medium">Aktif</Label>
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
