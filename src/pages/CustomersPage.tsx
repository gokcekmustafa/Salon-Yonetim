import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSalonData, DbCustomer } from '@/hooks/useSalonData';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Search, Pencil, Trash2, History, Users, Loader2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { usePermissions } from '@/hooks/usePermissions';
import { NoPermission } from '@/components/permissions/NoPermission';
import DataExportImport, { ColumnMapping } from '@/components/DataExportImport';

const CUSTOMER_COLUMNS: ColumnMapping[] = [
  { excelHeader: 'Ad Soyad', dbKey: 'name', required: true },
  { excelHeader: 'Telefon', dbKey: 'phone', required: true },
  { excelHeader: 'TC Kimlik No', dbKey: 'tc_kimlik_no' },
  { excelHeader: 'Doğum Tarihi', dbKey: 'birth_date' },
  { excelHeader: 'Adres', dbKey: 'address' },
  { excelHeader: '2. Telefon', dbKey: 'secondary_phone' },
  { excelHeader: 'Notlar', dbKey: 'notes' },
];

const SOURCE_OPTIONS = [
  { value: 'advertisement', label: 'Reklam' },
  { value: 'social_media', label: 'Sosyal Medya Reklamı' },
  { value: 'referral', label: 'Tanıdık Tavsiyesi' },
  { value: 'surveyor', label: 'Anketör / Personel' },
  { value: 'other', label: 'Diğer' },
];
const getSourceLabel = (val: string | null) => SOURCE_OPTIONS.find(o => o.value === val)?.label ?? val ?? '-';

const emptyForm = { name: '', phone: '', birth_date: '', notes: '', tc_kimlik_no: '', address: '', secondary_phone: '', source_type: '', source_detail: '', customer_type: 'installment', assigned_staff_id: '', assigned_staff_other: '' };

export default function CustomersPage() {
  const { hasPermission } = usePermissions();
  const { customers, addCustomer, updateCustomer, deleteCustomer, appointments, services, staff, loading } = useSalonData();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<DbCustomer | null>(null);
  const [editing, setEditing] = useState<DbCustomer | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (searchParams.get('yeni') === '1' && !loading) {
      setEditing(null);
      setForm(emptyForm);
      setDialogOpen(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, loading]);

  if (!hasPermission('can_manage_customers')) return <NoPermission feature="Müşteri Yönetimi" />;
  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="flex flex-col items-center gap-3"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="text-sm text-muted-foreground">Yükleniyor...</p></div>
    </div>
  );

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) || (c.phone || '').includes(search) || (c.tc_kimlik_no || '').includes(search)
  );

  const openAdd = () => { setEditing(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (c: DbCustomer) => {
    setEditing(c);
    setForm({
      name: c.name, phone: c.phone || '', birth_date: c.birth_date || '', notes: c.notes || '',
      tc_kimlik_no: c.tc_kimlik_no || '', address: c.address || '', secondary_phone: c.secondary_phone || '',
      source_type: c.source_type || '', source_detail: c.source_detail || '',
      customer_type: c.customer_type || 'installment',
      assigned_staff_id: (c as any).assigned_staff_id || '', assigned_staff_other: '',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.phone.trim()) { toast.error('Ad ve telefon zorunludur.'); return; }
    setSaving(true);
    const optionals = {
      birth_date: form.birth_date || null,
      notes: form.notes || null,
      tc_kimlik_no: form.tc_kimlik_no || null,
      address: form.address || null,
      secondary_phone: form.secondary_phone || null,
      source_type: form.source_type || null,
      source_detail: form.source_detail || null,
      customer_type: form.customer_type,
      assigned_staff_id: form.assigned_staff_id === '__other__' ? null : (form.assigned_staff_id || null),
    };
    if (editing) {
      await updateCustomer(editing.id, { name: form.name, phone: form.phone, ...optionals });
      toast.success('Müşteri güncellendi.');
    } else {
      await addCustomer({ name: form.name, phone: form.phone, ...optionals });
      toast.success('Müşteri eklendi.');
    }
    setSaving(false);
    setDialogOpen(false);
  };

  const handleDelete = async (c: DbCustomer) => { await deleteCustomer(c.id); toast.success('Müşteri silindi.'); };
  const openHistory = (c: DbCustomer) => { setSelectedCustomer(c); setHistoryOpen(true); };

  const customerAppointments = selectedCustomer
    ? appointments.filter(a => a.customer_id === selectedCustomer.id).sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime())
    : [];

  const getName = (list: { id: string; name: string }[], id: string) => list.find(x => x.id === id)?.name ?? '-';

  const set = (key: string, val: string) => setForm(f => ({ ...f, [key]: val }));

  return (
    <div className="page-container animate-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Müşteriler</h1>
          <p className="page-subtitle">{customers.length} kayıtlı müşteri</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <DataExportImport
            title="Müşteri Listesi"
            filePrefix="musteriler"
            columns={CUSTOMER_COLUMNS}
            data={customers}
            toExportRow={(c) => ({
              'Ad Soyad': c.name,
              'Telefon': c.phone || '',
              'TC Kimlik No': c.tc_kimlik_no || '',
              'Doğum Tarihi': c.birth_date || '',
              'Adres': c.address || '',
              '2. Telefon': c.secondary_phone || '',
              'Notlar': c.notes || '',
            })}
            fromImportRow={(row) => ({
              name: row['Ad Soyad'],
              phone: row['Telefon'],
              tc_kimlik_no: row['TC Kimlik No'] || null,
              birth_date: row['Doğum Tarihi'] || null,
              address: row['Adres'] || null,
              secondary_phone: row['2. Telefon'] || null,
              notes: row['Notlar'] || null,
            })}
            onImport={async (rows) => {
              let success = 0, errors = 0;
              for (const row of rows) {
                const res = await addCustomer(row as any);
                if (res?.error) errors++; else success++;
              }
              return { success, errors };
            }}
            summaryLines={[`Toplam: ${customers.length} müşteri`]}
          />
          <div className="flex gap-2">
            <div className="relative flex-1 sm:flex-initial">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Müşteri ara..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 w-full sm:w-64 h-10" />
            </div>
            <Button onClick={openAdd} size="sm" className="h-10 btn-gradient gap-1.5 rounded-xl px-4">
              <Plus className="h-4 w-4" /> Ekle
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile Cards */}
      <div className="block md:hidden space-y-3">
        {filtered.length === 0 ? (
          <Card className="shadow-soft border-border/60"><CardContent className="empty-state"><Users className="empty-state-icon" /><p className="empty-state-title">Müşteri bulunamadı</p></CardContent></Card>
        ) : filtered.map(c => (
          <div key={c.id} className="card-interactive p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-primary">{c.name.charAt(0)}</span>
                </div>
                <div className="space-y-0.5 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm">{c.name}</p>
                    <Badge variant={c.customer_type === 'single_session' ? 'secondary' : 'default'} className="text-[10px]">
                      {c.customer_type === 'single_session' ? 'Tek Seans' : 'Taksitli'}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{c.phone}</p>
                  {c.secondary_phone && <p className="text-xs text-muted-foreground">2. Tel: {c.secondary_phone}</p>}
                  {c.source_type && (
                    <p className="text-xs text-muted-foreground/70">
                      {getSourceLabel(c.source_type)}{c.source_detail ? ` — ${c.source_detail}` : ''}
                    </p>
                  )}
                  {c.notes && <p className="text-xs text-muted-foreground/70 truncate max-w-[180px]">{c.notes}</p>}
                </div>
              </div>
              <div className="flex gap-0.5">
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => openHistory(c)}><History className="h-3.5 w-3.5" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => openEdit(c)}><Pencil className="h-3.5 w-3.5" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(c)}><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop Table */}
      <Card className="hidden md:block shadow-soft border-border/60 overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="font-semibold">Ad Soyad</TableHead>
                <TableHead className="font-semibold">Tür</TableHead>
                <TableHead className="font-semibold">Telefon</TableHead>
                <TableHead className="hidden lg:table-cell font-semibold">TC Kimlik</TableHead>
                <TableHead className="hidden xl:table-cell font-semibold">Adres</TableHead>
                <TableHead className="hidden lg:table-cell font-semibold">Notlar</TableHead>
                <TableHead className="hidden xl:table-cell font-semibold">Kaynak</TableHead>
                <TableHead className="text-right font-semibold">İşlem</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-12 text-muted-foreground text-sm">Müşteri bulunamadı.</TableCell></TableRow>
              ) : filtered.map(c => (
                <TableRow key={c.id} className="group">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0"><span className="text-xs font-bold text-primary">{c.name.charAt(0)}</span></div>
                      <span className="font-medium">{c.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={c.customer_type === 'single_session' ? 'secondary' : 'default'} className="text-[10px]">
                      {c.customer_type === 'single_session' ? 'Tek Seans' : 'Taksitli'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    <div>{c.phone}</div>
                    {c.secondary_phone && <div className="text-xs text-muted-foreground/70">2. {c.secondary_phone}</div>}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-muted-foreground">{c.tc_kimlik_no || '-'}</TableCell>
                  <TableCell className="hidden xl:table-cell max-w-[150px] truncate text-muted-foreground">{c.address || '-'}</TableCell>
                  <TableCell className="hidden lg:table-cell max-w-[200px] truncate text-muted-foreground">{c.notes || '-'}</TableCell>
                  <TableCell className="hidden xl:table-cell text-muted-foreground">
                    {c.source_type ? getSourceLabel(c.source_type) : '-'}
                    {c.source_detail && <span className="text-xs text-muted-foreground/70 block">{c.source_detail}</span>}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-primary" onClick={() => openHistory(c)}><History className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-primary" onClick={() => openEdit(c)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-destructive" onClick={() => handleDelete(c)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Müşteri Düzenle' : 'Yeni Müşteri'}</DialogTitle><DialogDescription>{editing ? 'Müşteri bilgilerini güncelleyin' : 'Yeni müşteri ekleyin'}</DialogDescription></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2"><Label className="text-xs font-semibold">Ad Soyad *</Label><Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Ad Soyad" className="h-10" /></div>
            <div className="space-y-2"><Label className="text-xs font-semibold">Telefon *</Label><Input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="0500 000 0000" type="tel" className="h-10" /></div>
            <div className="space-y-2"><Label className="text-xs font-semibold">2. Telefon <span className="text-muted-foreground font-normal">(Opsiyonel)</span></Label><Input value={form.secondary_phone} onChange={e => set('secondary_phone', e.target.value)} placeholder="0500 000 0000" type="tel" className="h-10" /></div>
            <div className="space-y-2"><Label className="text-xs font-semibold">TC Kimlik No <span className="text-muted-foreground font-normal">(Opsiyonel)</span></Label><Input value={form.tc_kimlik_no} onChange={e => set('tc_kimlik_no', e.target.value)} placeholder="11 haneli TC Kimlik No" maxLength={11} className="h-10" /></div>
            <div className="space-y-2"><Label className="text-xs font-semibold">Adres <span className="text-muted-foreground font-normal">(Opsiyonel)</span></Label><Textarea value={form.address} onChange={e => set('address', e.target.value)} placeholder="Müşteri adresi..." rows={2} /></div>
            <div className="space-y-2"><Label className="text-xs font-semibold">Doğum Tarihi <span className="text-muted-foreground font-normal">(Opsiyonel)</span></Label><Input type="date" value={form.birth_date} onChange={e => set('birth_date', e.target.value)} className="h-10" /></div>
            <div className="space-y-2"><Label className="text-xs font-semibold">Notlar <span className="text-muted-foreground font-normal">(Opsiyonel)</span></Label><Textarea value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Müşteri notları..." rows={3} /></div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Müşteri Türü</Label>
              <Select value={form.customer_type} onValueChange={v => set('customer_type', v)}>
                <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="installment">Taksitli Müşteri</SelectItem>
                  <SelectItem value="single_session">Tek Seans Müşteri</SelectItem>
                  <SelectItem value="cash">Peşin Müşteri</SelectItem>
                </SelectContent>
              </Select>
              {form.customer_type === 'single_session' && (
                <p className="text-xs text-muted-foreground">Tek seans müşterilerde taksit sistemi devre dışıdır, ödemeler doğrudan kasaya gider.</p>
              )}
              {form.customer_type === 'cash' && (
                <p className="text-xs text-muted-foreground">Peşin müşterilerde ödeme tek seferde alınır.</p>
              )}
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Müşteri Kaynağı <span className="text-muted-foreground font-normal">(Opsiyonel)</span></Label>
              <Select value={form.source_type} onValueChange={v => set('source_type', v)}>
                <SelectTrigger className="h-10"><SelectValue placeholder="Kaynak seçin" /></SelectTrigger>
                <SelectContent>
                  {SOURCE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {form.source_type && (
              <div className="space-y-2"><Label className="text-xs font-semibold">Kaynak Detayı <span className="text-muted-foreground font-normal">(Opsiyonel)</span></Label><Input value={form.source_detail} onChange={e => set('source_detail', e.target.value)} placeholder="Kaynak adı veya tanımı yazın..." className="h-10" /></div>
            )}
            <div className="space-y-2">
              <Label className="text-xs font-semibold">İşlem Yapan Personel <span className="text-muted-foreground font-normal">(Opsiyonel)</span></Label>
              <Select value={form.assigned_staff_id} onValueChange={v => set('assigned_staff_id', v)}>
                <SelectTrigger className="h-10"><SelectValue placeholder="Personel seçin" /></SelectTrigger>
                <SelectContent>
                  {staff.filter((s: any) => s.is_active !== false).map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                  <SelectItem value="__other__">Diğer</SelectItem>
                </SelectContent>
              </Select>
              {form.assigned_staff_id === '__other__' && (
                <Input value={form.assigned_staff_other} onChange={e => set('assigned_staff_other', e.target.value)} placeholder="Personel adını yazın..." className="h-10" />
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>İptal</Button>
            <Button onClick={handleSave} disabled={saving} className="btn-gradient">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Kaydet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History Dialog */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{selectedCustomer?.name} — Geçmiş</DialogTitle><DialogDescription>Müşterinin geçmiş randevuları</DialogDescription></DialogHeader>
          {customerAppointments.length === 0 ? (
            <div className="empty-state py-8"><History className="empty-state-icon !h-8 !w-8" /><p className="empty-state-title">Geçmiş randevu yok</p></div>
          ) : (
            <div className="space-y-2 max-h-72 overflow-auto">
              {customerAppointments.map(a => (
                <div key={a.id} className="flex justify-between items-center p-3.5 rounded-xl bg-muted/30 border border-transparent hover:border-border/40 transition-colors">
                  <div><p className="text-sm font-medium">{getName(services, a.service_id)}</p><p className="text-xs text-muted-foreground">{getName(staff, a.staff_id)}</p></div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">{format(parseISO(a.start_time), 'd MMM yyyy HH:mm', { locale: tr })}</p>
                    <Badge variant={a.status === 'tamamlandi' ? 'default' : a.status === 'iptal' ? 'destructive' : 'secondary'} className="text-[10px]">{a.status === 'tamamlandi' ? 'Tamamlandı' : a.status === 'iptal' ? 'İptal' : 'Bekliyor'}</Badge>
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
