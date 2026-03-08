import { useState } from 'react';
import { useSalonData, DbBranch } from '@/hooks/useSalonData';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Plus, Pencil, Trash2, Building2, MapPin, Phone, Loader2, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { usePermissions } from '@/hooks/usePermissions';
import { NoPermission } from '@/components/permissions/NoPermission';

export default function BranchesPage() {
  const { hasPermission } = usePermissions();
  const { branches, addBranch, updateBranch, deleteBranch, staff, loading } = useSalonData();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<DbBranch | null>(null);
  const [form, setForm] = useState({ name: '', address: '', phone: '', is_active: true });
  const [saving, setSaving] = useState(false);

  if (!hasPermission('can_add_branches')) return <NoPermission feature="Şube Yönetimi" />;

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="flex flex-col items-center gap-3"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="text-sm text-muted-foreground">Yükleniyor...</p></div>
    </div>
  );

  const openAdd = () => { setEditing(null); setForm({ name: '', address: '', phone: '', is_active: true }); setDialogOpen(true); };
  const openEdit = (b: DbBranch) => { setEditing(b); setForm({ name: b.name, address: b.address || '', phone: b.phone || '', is_active: b.is_active }); setDialogOpen(true); };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Şube adı zorunludur.'); return; }
    setSaving(true);
    if (editing) { await updateBranch(editing.id, { name: form.name, address: form.address, phone: form.phone, is_active: form.is_active }); toast.success('Şube güncellendi.'); }
    else { await addBranch({ name: form.name, address: form.address, phone: form.phone, is_active: form.is_active }); toast.success('Şube eklendi.'); }
    setSaving(false);
    setDialogOpen(false);
  };

  const handleDelete = async (b: DbBranch) => {
    const branchStaff = staff.filter(s => s.branch_id === b.id);
    if (branchStaff.length > 0) { toast.error(`Bu şubede ${branchStaff.length} personel var. Önce personeli taşıyın.`); return; }
    await deleteBranch(b.id);
    toast.success('Şube silindi.');
  };

  const getStaffCount = (branchId: string) => staff.filter(s => s.branch_id === branchId).length;

  return (
    <div className="page-container animate-in">
      <div className="page-header">
        <div><h1 className="page-title">Şubeler</h1><p className="page-subtitle">{branches.filter(b => b.is_active).length} aktif şube</p></div>
        <Button onClick={openAdd} size="sm" className="h-10 btn-gradient gap-1.5 rounded-xl px-4"><Plus className="h-4 w-4" /> Yeni Şube</Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {branches.map(b => (
          <div key={b.id} className={`card-interactive p-5 space-y-3 ${!b.is_active ? 'opacity-50' : ''}`}>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center"><Building2 className="h-5 w-5 text-primary" /></div>
                <div>
                  <h3 className="font-bold text-sm">{b.name}</h3>
                  <Badge variant={b.is_active ? 'default' : 'secondary'} className="text-[10px] mt-1 font-semibold">{b.is_active ? 'Aktif' : 'Pasif'}</Badge>
                </div>
              </div>
              <div className="flex gap-0.5">
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => openEdit(b)}><Pencil className="h-3.5 w-3.5" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(b)}><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
            </div>
            <div className="space-y-1.5 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground"><MapPin className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{b.address || '-'}</span></div>
              <div className="flex items-center gap-2 text-muted-foreground"><Phone className="h-3.5 w-3.5 shrink-0" /><span>{b.phone || '-'}</span></div>
            </div>
            <div className="pt-3 border-t border-border/50 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Users className="h-3.5 w-3.5" />{getStaffCount(b.id)} personel
            </div>
          </div>
        ))}
      </div>

      {branches.length === 0 && (
        <Card className="shadow-soft border-border/60"><CardContent className="empty-state"><Building2 className="empty-state-icon" /><p className="empty-state-title">Henüz şube eklenmedi</p><p className="empty-state-description">İlk şubenizi ekleyerek başlayın.</p></CardContent></Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? 'Şube Düzenle' : 'Yeni Şube'}</DialogTitle><DialogDescription>{editing ? 'Şube bilgilerini güncelleyin' : 'Yeni şube ekleyin'}</DialogDescription></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2"><Label className="text-xs font-semibold">Şube Adı</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Kadıköy Şubesi" className="h-10" /></div>
            <div className="space-y-2"><Label className="text-xs font-semibold">Adres</Label><Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Kadıköy, İstanbul" className="h-10" /></div>
            <div className="space-y-2"><Label className="text-xs font-semibold">Telefon</Label><Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="0212 555 1234" type="tel" className="h-10" /></div>
            <div className="flex items-center justify-between py-1"><Label className="text-xs font-semibold">Aktif</Label><Switch checked={form.is_active} onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))} /></div>
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
