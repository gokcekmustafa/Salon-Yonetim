import { useState } from 'react';
import { useSalon } from '@/contexts/SalonContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Search, Pencil, Trash2, History } from 'lucide-react';
import { Customer } from '@/types/salon';
import { format, parseISO } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';

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
    if (!form.name.trim() || !form.phone.trim()) return;
    if (editing) {
      updateCustomer(editing.id, form);
    } else {
      addCustomer(form);
    }
    setDialogOpen(false);
  };

  const openHistory = (c: Customer) => {
    setSelectedCustomer(c);
    setHistoryOpen(true);
  };

  const customerAppointments = selectedCustomer
    ? appointments.filter(a => a.customerId === selectedCustomer.id)
    : [];

  const getServiceName = (id: string) => services.find(s => s.id === id)?.name ?? '-';
  const getStaffName = (id: string) => staff.find(s => s.id === id)?.name ?? '-';

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Müşteriler</h1>
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-initial">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Müşteri ara..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 w-full sm:w-64" />
          </div>
          <Button onClick={openAdd}><Plus className="h-4 w-4 mr-1" /> Ekle</Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ad Soyad</TableHead>
                <TableHead>Telefon</TableHead>
                <TableHead className="hidden md:table-cell">Doğum Tarihi</TableHead>
                <TableHead className="hidden lg:table-cell">Notlar</TableHead>
                <TableHead className="text-right">İşlem</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Müşteri bulunamadı.</TableCell></TableRow>
              ) : (
                filtered.map(c => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell>{c.phone}</TableCell>
                    <TableCell className="hidden md:table-cell">{c.birthDate || '-'}</TableCell>
                    <TableCell className="hidden lg:table-cell max-w-[200px] truncate">{c.notes || '-'}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openHistory(c)}><History className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => deleteCustomer(c.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Müşteri Düzenle' : 'Yeni Müşteri'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label>Ad Soyad</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div><Label>Telefon</Label><Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
            <div><Label>Doğum Tarihi</Label><Input type="date" value={form.birthDate} onChange={e => setForm(f => ({ ...f, birthDate: e.target.value }))} /></div>
            <div><Label>Notlar</Label><Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
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
            <DialogTitle>{selectedCustomer?.name} - Geçmiş Randevular</DialogTitle>
          </DialogHeader>
          {customerAppointments.length === 0 ? (
            <p className="text-muted-foreground text-sm py-4 text-center">Geçmiş randevu bulunamadı.</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-auto">
              {customerAppointments.map(a => (
                <div key={a.id} className="flex justify-between items-center p-3 rounded-lg bg-muted/50">
                  <div>
                    <p className="text-sm font-medium">{getServiceName(a.serviceId)}</p>
                    <p className="text-xs text-muted-foreground">{getStaffName(a.staffId)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs">{format(parseISO(a.startTime), 'd MMM yyyy HH:mm', { locale: tr })}</p>
                    <Badge variant={a.status === 'tamamlandi' ? 'default' : a.status === 'iptal' ? 'destructive' : 'secondary'}>
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
