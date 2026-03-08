import { useState } from 'react';
import { useSalon } from '@/contexts/SalonContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Search, Pencil, Trash2, History, Users } from 'lucide-react';
import { Customer } from '@/types/salon';
import { format, parseISO } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

export default function CustomersPage() {
  const { customers, addCustomer, updateCustomer, deleteCustomer, appointments, services, staff } = useSalon();
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState({ name: '', phone: '', birthDate: '', notes: '' });

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.phone.includes(search)
  );

  const openAdd = () => {
    setEditing(null);
    setForm({ name: '', phone: '', birthDate: '', notes: '' });
    setDialogOpen(true);
  };

  const openEdit = (c: Customer) => {
    setEditing(c);
    setForm({ name: c.name, phone: c.phone, birthDate: c.birthDate || '', notes: c.notes || '' });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.name.trim() || !form.phone.trim()) {
      toast.error('Ad ve telefon zorunludur.');
      return;
    }
    if (editing) {
      updateCustomer(editing.id, form);
      toast.success('Müşteri güncellendi.');
    } else {
      addCustomer(form);
      toast.success('Müşteri eklendi.');
    }
    setDialogOpen(false);
  };

  const handleDelete = (c: Customer) => {
    deleteCustomer(c.id);
    toast.success('Müşteri silindi.');
  };

  const openHistory = (c: Customer) => {
    setSelectedCustomer(c);
    setHistoryOpen(true);
  };

  const customerAppointments = selectedCustomer
    ? appointments.filter(a => a.customerId === selectedCustomer.id)
        .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
    : [];

  const getServiceName = (id: string) => services.find(s => s.id === id)?.name ?? '-';
  const getStaffName = (id: string) => staff.find(s => s.id === id)?.name ?? '-';

  return (
    <div className="page-container animate-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Müşteriler</h1>
          <p className="page-subtitle">{customers.length} kayıtlı müşteri</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-initial">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Müşteri ara..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 w-full sm:w-64 h-9" />
          </div>
          <Button onClick={openAdd} size="sm" className="h-9"><Plus className="h-4 w-4 mr-1.5" /> Ekle</Button>
        </div>
      </div>

      {/* Mobile card view */}
      <div className="block md:hidden space-y-3">
        {filtered.length === 0 ? (
          <Card className="shadow-card border-border/60">
            <CardContent className="empty-state">
              <Users className="empty-state-icon" />
              <p className="empty-state-title">Müşteri bulunamadı</p>
              <p className="empty-state-description">Arama kriterlerinize uygun müşteri yok.</p>
            </CardContent>
          </Card>
        ) : filtered.map(c => (
          <Card key={c.id} className="shadow-soft border-border/60 hover:shadow-card transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/8 flex items-center justify-center shrink-0">
                    <span className="text-xs font-semibold text-primary">{c.name.charAt(0)}</span>
                  </div>
                  <div className="space-y-0.5 min-w-0">
                    <p className="font-medium text-sm">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{c.phone}</p>
                    {c.notes && <p className="text-xs text-muted-foreground/70 truncate max-w-[180px]">{c.notes}</p>}
                  </div>
                </div>
                <div className="flex gap-0.5">
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => openHistory(c)}><History className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => openEdit(c)}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(c)}><Trash2 className="h-3.5 w-3.5" /></Button>
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
                <TableHead className="font-semibold">Ad Soyad</TableHead>
                <TableHead className="font-semibold">Telefon</TableHead>
                <TableHead className="hidden lg:table-cell font-semibold">Doğum Tarihi</TableHead>
                <TableHead className="hidden lg:table-cell font-semibold">Notlar</TableHead>
                <TableHead className="text-right font-semibold">İşlem</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground text-sm">Müşteri bulunamadı.</TableCell></TableRow>
              ) : (
                filtered.map(c => (
                  <TableRow key={c.id} className="group">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-primary/8 flex items-center justify-center shrink-0">
                          <span className="text-xs font-semibold text-primary">{c.name.charAt(0)}</span>
                        </div>
                        <span className="font-medium">{c.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{c.phone}</TableCell>
                    <TableCell className="hidden lg:table-cell text-muted-foreground">{c.birthDate || '-'}</TableCell>
                    <TableCell className="hidden lg:table-cell max-w-[200px] truncate text-muted-foreground">{c.notes || '-'}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openHistory(c)}><History className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(c)}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-destructive" onClick={() => handleDelete(c)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Müşteri Düzenle' : 'Yeni Müşteri'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5"><Label className="text-xs font-medium">Ad Soyad</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ad Soyad" /></div>
            <div className="space-y-1.5"><Label className="text-xs font-medium">Telefon</Label><Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="0500 000 0000" type="tel" /></div>
            <div className="space-y-1.5"><Label className="text-xs font-medium">Doğum Tarihi</Label><Input type="date" value={form.birthDate} onChange={e => setForm(f => ({ ...f, birthDate: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label className="text-xs font-medium">Notlar</Label><Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Müşteri notları..." rows={3} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>İptal</Button>
            <Button onClick={handleSave}>Kaydet</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History Dialog */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedCustomer?.name} — Geçmiş</DialogTitle>
          </DialogHeader>
          {customerAppointments.length === 0 ? (
            <div className="empty-state py-8">
              <History className="empty-state-icon !h-8 !w-8" />
              <p className="empty-state-title">Geçmiş randevu yok</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-72 overflow-auto">
              {customerAppointments.map(a => (
                <div key={a.id} className="flex justify-between items-center p-3 rounded-xl bg-muted/40">
                  <div>
                    <p className="text-sm font-medium">{getServiceName(a.serviceId)}</p>
                    <p className="text-xs text-muted-foreground">{getStaffName(a.staffId)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">{format(parseISO(a.startTime), 'd MMM yyyy HH:mm', { locale: tr })}</p>
                    <Badge variant={a.status === 'tamamlandi' ? 'default' : a.status === 'iptal' ? 'destructive' : 'secondary'} className="text-[10px]">
                      {a.status === 'tamamlandi' ? 'Tamamlandı' : a.status === 'iptal' ? 'İptal' : 'Bekliyor'}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
