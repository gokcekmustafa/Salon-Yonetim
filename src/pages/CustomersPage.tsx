import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { DbCustomer } from '@/hooks/useSalonData';
import { useBranchFilteredData } from '@/hooks/useBranchFilteredData';
import { useFormGuard } from '@/hooks/useFormGuard';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSub, ContextMenuSubContent, ContextMenuSubTrigger, ContextMenuSeparator, ContextMenuTrigger } from '@/components/ui/context-menu';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { Plus, Search, Pencil, Trash2, History, Users, Loader2, ShoppingCart, CalendarPlus, FileText, CreditCard, Phone, MessageSquare, UserCheck, Filter, X, Eye } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { usePermissions } from '@/hooks/usePermissions';
import { NoPermission } from '@/components/permissions/NoPermission';
import DataExportImport, { ColumnMapping } from '@/components/DataExportImport';
import { StaffPageGuard } from '@/components/permissions/StaffPageGuard';
import { CustomerSaleDialog } from '@/components/sales/CustomerSaleDialog';
import { CustomerSalesHistory } from '@/components/sales/CustomerSalesHistory';

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

type TabFilter = 'all' | 'installment' | 'single_session' | 'cash';

// Row color helpers
function getRowColorClass(customerType: string, hasDebt: boolean): string {
  if (hasDebt) return 'bg-red-50 dark:bg-red-950/20 hover:bg-red-100 dark:hover:bg-red-950/30';
  if (customerType === 'installment') return 'bg-emerald-50/60 dark:bg-emerald-950/15 hover:bg-emerald-100/80 dark:hover:bg-emerald-950/25';
  if (customerType === 'single_session') return 'bg-sky-50/60 dark:bg-sky-950/15 hover:bg-sky-100/80 dark:hover:bg-sky-950/25';
  if (customerType === 'cash') return 'bg-amber-50/60 dark:bg-amber-950/15 hover:bg-amber-100/80 dark:hover:bg-amber-950/25';
  return '';
}

function getStatusBadge(customerType: string) {
  if (customerType === 'single_session') return { label: 'Tek Seans', className: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300 border-sky-200 dark:border-sky-800' };
  if (customerType === 'cash') return { label: 'Peşin', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-800' };
  return { label: 'Taksitli', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' };
}

export default function CustomersPage() {
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const { customers, addCustomer, updateCustomer, deleteCustomer, appointments, services, staff, payments, loading } = useBranchFilteredData();
  const [searchParams, setSearchParams] = useSearchParams();
  const [nameSearch, setNameSearch] = useState('');
  const [phoneSearch, setPhoneSearch] = useState('');
  const [tcSearch, setTcSearch] = useState('');
  const [tabFilter, setTabFilter] = useState<TabFilter>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [saleDialogOpen, setSaleDialogOpen] = useState(false);
  const [salesHistoryOpen, setSalesHistoryOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<DbCustomer | null>(null);
  const [editing, setEditing] = useState<DbCustomer | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [saleCustomer, setSaleCustomer] = useState<DbCustomer | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<DbCustomer | null>(null);
  const [deleteBlocked, setDeleteBlocked] = useState(false);
  const [detailCustomer, setDetailCustomer] = useState<DbCustomer | null>(null);
  useFormGuard(dialogOpen);

  useEffect(() => {
    if (searchParams.get('yeni') === '1' && !loading) {
      setEditing(null);
      setForm(emptyForm);
      setDialogOpen(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, loading]);

  // Compute customer balances for debt detection
  const customerBalances = useMemo(() => {
    const balances: Record<string, number> = {};
    payments.forEach(p => {
      if (p.appointment_id) {
        const apt = appointments.find(a => a.id === p.appointment_id);
        if (apt) {
          balances[apt.customer_id] = (balances[apt.customer_id] || 0) + Number(p.amount);
        }
      }
    });
    return balances;
  }, [payments, appointments]);

  // Get customer service summary for hover tooltip
  const getCustomerServiceSummary = (customerId: string) => {
    const custAppts = appointments.filter(a => a.customer_id === customerId);
    const serviceMap: Record<string, { name: string; total: number; completed: number; cancelled: number }> = {};
    custAppts.forEach(a => {
      const svc = services.find(s => s.id === a.service_id);
      const svcName = svc?.name || 'Bilinmeyen';
      if (!serviceMap[svcName]) serviceMap[svcName] = { name: svcName, total: 0, completed: 0, cancelled: 0 };
      serviceMap[svcName].total++;
      if (a.status === 'tamamlandi') serviceMap[svcName].completed++;
      if (a.status === 'iptal') serviceMap[svcName].cancelled++;
    });
    return Object.values(serviceMap);
  };

  const getAssignedStaffName = (c: DbCustomer) => {
    const sid = (c as any).assigned_staff_id;
    if (!sid) return null;
    return staff.find(s => s.id === sid)?.name || null;
  };

  const tabCounts = useMemo(() => ({
    all: customers.length,
    installment: customers.filter(c => c.customer_type === 'installment').length,
    single_session: customers.filter(c => c.customer_type === 'single_session').length,
    cash: customers.filter(c => c.customer_type === 'cash').length,
  }), [customers]);

  if (!hasPermission('can_manage_customers')) return <NoPermission feature="Müşteri Yönetimi" />;
  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="flex flex-col items-center gap-3"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="text-sm text-muted-foreground">Yükleniyor...</p></div>
    </div>
  );

  const filtered = customers.filter(c => {
    const matchName = !nameSearch || c.name.toLowerCase().includes(nameSearch.toLowerCase());
    const matchPhone = !phoneSearch || (c.phone || '').includes(phoneSearch) || (c.secondary_phone || '').includes(phoneSearch);
    const matchTc = !tcSearch || (c.tc_kimlik_no || '').includes(tcSearch);
    const matchTab = tabFilter === 'all' || c.customer_type === tabFilter;
    return matchName && matchPhone && matchTc && matchTab;
  });

  const hasAnyFilter = nameSearch || phoneSearch || tcSearch;
  const clearFilters = () => { setNameSearch(''); setPhoneSearch(''); setTcSearch(''); };

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
      setSaving(false);
      setDialogOpen(false);
    } else {
      const result = await addCustomer({ name: form.name, phone: form.phone, ...optionals });
      toast.success('Müşteri eklendi.');
      setSaving(false);
      setDialogOpen(false);
      if (result && !result.error) {
        setTimeout(() => {
          const newCustomer = customers.find(c => c.phone === form.phone && c.name === form.name);
          if (newCustomer) {
            setSaleCustomer(newCustomer);
            setSaleDialogOpen(true);
          }
        }, 500);
      }
    }
  };

  const handleDeleteClick = (c: DbCustomer) => {
    const now = new Date();
    const hasActiveAppointments = appointments.some(a =>
      a.customer_id === c.id && a.status !== 'iptal' && new Date(a.start_time) >= now
    );
    setDeleteBlocked(hasActiveAppointments);
    setCustomerToDelete(c);
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!customerToDelete) return;
    await deleteCustomer(customerToDelete.id);
    toast.success('Müşteri silindi.');
    setDeleteConfirmOpen(false);
    setCustomerToDelete(null);
  };

  const openHistory = (c: DbCustomer) => { setSelectedCustomer(c); setHistoryOpen(true); };
  const openSale = (c: DbCustomer) => { setSaleCustomer(c); setSaleDialogOpen(true); };
  const openSalesHistory = (c: DbCustomer) => { setSaleCustomer(c); setSalesHistoryOpen(true); };
  const openAppointment = (c: DbCustomer) => { navigate(`/salon/appointments?customer_id=${c.id}`); };

  const customerAppointments = selectedCustomer
    ? appointments.filter(a => a.customer_id === selectedCustomer.id).sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime())
    : [];

  const getName = (list: { id: string; name: string }[], id: string) => list.find(x => x.id === id)?.name ?? '-';
  const set = (key: string, val: string) => setForm(f => ({ ...f, [key]: val }));

  const tabCounts = useMemo(() => ({
    all: customers.length,
    installment: customers.filter(c => c.customer_type === 'installment').length,
    single_session: customers.filter(c => c.customer_type === 'single_session').length,
    cash: customers.filter(c => c.customer_type === 'cash').length,
  }), [customers]);

  const renderCustomerRow = (c: DbCustomer) => {
    const hasDebt = (customerBalances[c.id] || 0) < 0;
    const badge = getStatusBadge(c.customer_type);
    const custApptCount = appointments.filter(a => a.customer_id === c.id).length;
    const assignedStaff = getAssignedStaffName(c);
    const serviceSummary = getCustomerServiceSummary(c.id);
    const lastAppt = appointments.filter(a => a.customer_id === c.id).sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime())[0];

    return (
      <ContextMenu key={c.id}>
        <ContextMenuTrigger asChild>
          <TableRow className={`group cursor-context-menu transition-colors ${getRowColorClass(c.customer_type, hasDebt)}`}>
            {/* M. No */}
            <TableCell className="font-mono text-xs text-muted-foreground w-16">
              {c.id.substring(0, 6).toUpperCase()}
            </TableCell>
            {/* Ad Soyad - with hover card */}
            <TableCell>
              <HoverCard openDelay={300} closeDelay={100}>
                <HoverCardTrigger asChild>
                  <div className="flex items-center gap-2.5 cursor-pointer">
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
                      hasDebt ? 'bg-red-200 text-red-800 dark:bg-red-900/50 dark:text-red-300' : 'bg-primary/10 text-primary'
                    }`}>
                      {c.name.charAt(0)}
                    </div>
                    <span className="font-semibold text-sm hover:underline">{c.name}</span>
                  </div>
                </HoverCardTrigger>
                <HoverCardContent className="w-80 p-0" side="right" align="start">
                  <div className="p-3 border-b border-border bg-muted/30 rounded-t-lg">
                    <p className="font-bold text-sm">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{c.phone}{c.secondary_phone ? ` • ${c.secondary_phone}` : ''}</p>
                    {assignedStaff && <p className="text-xs text-muted-foreground mt-0.5">Personel: {assignedStaff}</p>}
                  </div>
                  {serviceSummary.length > 0 ? (
                    <div className="p-3 space-y-1.5 max-h-48 overflow-auto">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Hizmet Özeti</p>
                      {serviceSummary.map((s, i) => (
                        <div key={i} className="flex items-center justify-between text-xs py-1 border-b border-border/30 last:border-0">
                          <span className="font-medium">{s.name}</span>
                          <span className="text-muted-foreground">
                            {s.completed}/{s.total} seans
                            {s.cancelled > 0 && <span className="text-red-500 ml-1">({s.cancelled} iptal)</span>}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-3 text-xs text-muted-foreground text-center">Henüz hizmet kaydı yok</div>
                  )}
                  {lastAppt && (
                    <div className="p-2 border-t border-border bg-muted/20 rounded-b-lg">
                      <p className="text-[10px] text-muted-foreground">
                        Son randevu: {format(parseISO(lastAppt.start_time), 'd MMM yyyy', { locale: tr })}
                      </p>
                    </div>
                  )}
                </HoverCardContent>
              </HoverCard>
            </TableCell>
            {/* Telefon */}
            <TableCell className="text-sm text-muted-foreground">{c.phone || '-'}</TableCell>
            {/* Hizmet */}
            <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
              {serviceSummary.length > 0 ? serviceSummary.map(s => s.name).join(', ') : '-'}
            </TableCell>
            {/* Kayıt Tarihi */}
            <TableCell className="hidden xl:table-cell text-xs text-muted-foreground">
              {format(parseISO(c.created_at), 'dd.MM.yyyy', { locale: tr })}
            </TableCell>
            {/* Ödeme Şekli */}
            <TableCell>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${badge.className}`}>
                {badge.label}
              </span>
            </TableCell>
            {/* Randevu Sayısı */}
            <TableCell className="hidden lg:table-cell text-center text-sm text-muted-foreground">{custApptCount}</TableCell>
            {/* Personel */}
            <TableCell className="hidden xl:table-cell text-sm text-muted-foreground">{assignedStaff || '-'}</TableCell>
            {/* Durum */}
            <TableCell>
              {hasDebt ? (
                <Badge className="bg-red-500/90 text-white text-[10px] hover:bg-red-600">Borçlu</Badge>
              ) : (
                <Badge className="bg-emerald-500/90 text-white text-[10px] hover:bg-emerald-600">Düzenli</Badge>
              )}
            </TableCell>
          </TableRow>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-56">
          <ContextMenuItem className="gap-2 cursor-pointer" onClick={() => setDetailCustomer(c)}>
            <Eye className="h-4 w-4" /> Müşteri Detayı
          </ContextMenuItem>
          <ContextMenuItem className="gap-2 cursor-pointer" onClick={() => openEdit(c)}>
            <Pencil className="h-4 w-4" /> Bilgileri Düzenle
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem className="gap-2 cursor-pointer" onClick={() => openAppointment(c)}>
            <CalendarPlus className="h-4 w-4" /> Randevu Ver
          </ContextMenuItem>
          <ContextMenuSub>
            <ContextMenuSubTrigger className="gap-2">
              <ShoppingCart className="h-4 w-4" /> Satış İşlemleri
            </ContextMenuSubTrigger>
            <ContextMenuSubContent className="w-48">
              <ContextMenuItem className="gap-2 cursor-pointer" onClick={() => openSale(c)}>
                <ShoppingCart className="h-4 w-4" /> Yeni Satış Yap
              </ContextMenuItem>
              <ContextMenuItem className="gap-2 cursor-pointer" onClick={() => openSalesHistory(c)}>
                <History className="h-4 w-4" /> Satış Geçmişi
              </ContextMenuItem>
            </ContextMenuSubContent>
          </ContextMenuSub>
          <ContextMenuItem className="gap-2 cursor-pointer" onClick={() => openHistory(c)}>
            <History className="h-4 w-4" /> Seans Geçmişi
          </ContextMenuItem>
          <ContextMenuSub>
            <ContextMenuSubTrigger className="gap-2">
              <CreditCard className="h-4 w-4" /> Ödeme İşlemleri
            </ContextMenuSubTrigger>
            <ContextMenuSubContent className="w-48">
              <ContextMenuItem className="gap-2 cursor-pointer" onClick={() => navigate(`/salon/installments?customer=${c.id}`)}>
                <CreditCard className="h-4 w-4" /> Taksit Planı
              </ContextMenuItem>
              <ContextMenuItem className="gap-2 cursor-pointer" onClick={() => navigate(`/salon/payments?customer=${c.id}`)}>
                <FileText className="h-4 w-4" /> Ödeme Geçmişi
              </ContextMenuItem>
            </ContextMenuSubContent>
          </ContextMenuSub>
          <ContextMenuSeparator />
          <ContextMenuItem className="gap-2 cursor-pointer" onClick={() => navigate(`/salon/contracts?customer=${c.id}`)}>
            <FileText className="h-4 w-4" /> Sözleşmeler
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem className="gap-2 cursor-pointer text-destructive focus:text-destructive" onClick={() => handleDeleteClick(c)}>
            <Trash2 className="h-4 w-4" /> Müşteriyi Sil
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    );
  };

  return (
    <StaffPageGuard permissionKey="page_customers" featureLabel="Müşteriler">
    <div className="page-container animate-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Müşteri Listesi</h1>
          <p className="page-subtitle">{customers.length} kayıtlı müşteri</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <DataExportImport
            title="Müşteri Listesi"
            filePrefix="musteriler"
            columns={CUSTOMER_COLUMNS}
            data={customers}
            toExportRow={(c) => ({
              'Ad Soyad': c.name, 'Telefon': c.phone || '', 'TC Kimlik No': c.tc_kimlik_no || '',
              'Doğum Tarihi': c.birth_date || '', 'Adres': c.address || '', '2. Telefon': c.secondary_phone || '', 'Notlar': c.notes || '',
            })}
            fromImportRow={(row) => ({
              name: row['Ad Soyad'], phone: row['Telefon'], tc_kimlik_no: row['TC Kimlik No'] || null,
              birth_date: row['Doğum Tarihi'] || null, address: row['Adres'] || null,
              secondary_phone: row['2. Telefon'] || null, notes: row['Notlar'] || null,
            })}
            onImport={async (rows) => {
              let success = 0, errors = 0;
              for (const row of rows) { const res = await addCustomer(row as any); if (res?.error) errors++; else success++; }
              return { success, errors };
            }}
            summaryLines={[`Toplam: ${customers.length} müşteri`]}
          />
          <Button onClick={openAdd} size="sm" className="h-10 btn-gradient gap-1.5 rounded-xl px-4">
            <Plus className="h-4 w-4" /> Yeni Müşteri
          </Button>
        </div>
      </div>

      {/* Search Filters - menajer.im style */}
      <Card className="shadow-soft border-border/60">
        <CardContent className="p-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Adı Soyadı</Label>
              <Input placeholder="ADI SOYADI" value={nameSearch} onChange={e => setNameSearch(e.target.value)} className="h-9 text-sm uppercase" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Cep Telefonu</Label>
              <Input placeholder="CEP TELEFONU" value={phoneSearch} onChange={e => setPhoneSearch(e.target.value)} className="h-9 text-sm" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">TC No / Pasaport</Label>
              <div className="flex gap-2">
                <Input placeholder="TC KİMLİK PASAPORT" value={tcSearch} onChange={e => setTcSearch(e.target.value)} className="h-9 text-sm flex-1" />
                <Button variant="outline" size="sm" className="h-9 gap-1 text-xs" onClick={clearFilters} disabled={!hasAnyFilter}>
                  <X className="h-3 w-3" /> Sıfırla
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tab Filters */}
      <div className="flex gap-1 mt-2 mb-1">
        {([
          { key: 'all', label: 'Tümü' },
          { key: 'installment', label: 'Paket Müşterileri' },
          { key: 'single_session', label: 'Tek Seanslık Müşteriler' },
          { key: 'cash', label: 'Peşin Müşteriler' },
        ] as { key: TabFilter; label: string }[]).map(tab => (
          <button
            key={tab.key}
            onClick={() => setTabFilter(tab.key)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              tabFilter === tab.key
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-muted/50 text-muted-foreground hover:bg-muted'
            }`}
          >
            {tab.label} ({tabCounts[tab.key]})
          </button>
        ))}
      </div>

      {/* Mobile Cards */}
      <div className="block md:hidden space-y-3">
        {filtered.length === 0 ? (
          <Card className="shadow-soft border-border/60"><CardContent className="empty-state"><Users className="empty-state-icon" /><p className="empty-state-title">Müşteri bulunamadı</p></CardContent></Card>
        ) : filtered.map(c => {
          const hasDebt = (customerBalances[c.id] || 0) < 0;
          const badge = getStatusBadge(c.customer_type);
          return (
            <div key={c.id} className={`card-interactive p-4 border rounded-xl ${getRowColorClass(c.customer_type, hasDebt)}`}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${
                    hasDebt ? 'bg-red-200 text-red-800' : 'bg-primary/10'
                  }`}>
                    <span className="text-xs font-bold text-primary">{c.name.charAt(0)}</span>
                  </div>
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm">{c.name}</p>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${badge.className}`}>{badge.label}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{c.phone}</p>
                    {hasDebt && <Badge className="bg-red-500/90 text-white text-[10px]">Borçlu</Badge>}
                  </div>
                </div>
                <div className="flex gap-0.5">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openSale(c)}><ShoppingCart className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(c)}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDeleteClick(c)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop Table */}
      <Card className="hidden md:block shadow-soft border-border/60 overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="font-semibold text-xs w-16">M. No</TableHead>
                  <TableHead className="font-semibold text-xs">Adı Soyadı</TableHead>
                  <TableHead className="font-semibold text-xs">Cep Tel</TableHead>
                  <TableHead className="hidden lg:table-cell font-semibold text-xs">Hizmet</TableHead>
                  <TableHead className="hidden xl:table-cell font-semibold text-xs">Kayıt Tarihi</TableHead>
                  <TableHead className="font-semibold text-xs">Ödeme Şekli</TableHead>
                  <TableHead className="hidden lg:table-cell font-semibold text-xs text-center">Randevular</TableHead>
                  <TableHead className="hidden xl:table-cell font-semibold text-xs">Personel</TableHead>
                  <TableHead className="font-semibold text-xs">Durum</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="text-center py-12 text-muted-foreground text-sm">Müşteri bulunamadı.</TableCell></TableRow>
                ) : filtered.map(c => renderCustomerRow(c))}
              </TableBody>
            </Table>
          </div>
          {/* Results count bar */}
          <div className="px-4 py-2 bg-muted/20 border-t border-border/40 text-xs text-muted-foreground flex justify-between">
            <span>Gösterilen: {filtered.length} / {customers.length} müşteri</span>
            <span className="text-[10px]">💡 Sağ tık ile hızlı işlem menüsü</span>
          </div>
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={!!detailCustomer} onOpenChange={(open) => !open && setDetailCustomer(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-primary" /> {detailCustomer?.name}
            </DialogTitle>
            <DialogDescription>Müşteri detay bilgileri</DialogDescription>
          </DialogHeader>
          {detailCustomer && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs text-muted-foreground">Telefon</Label><p className="font-medium">{detailCustomer.phone || '-'}</p></div>
                <div><Label className="text-xs text-muted-foreground">2. Telefon</Label><p className="font-medium">{detailCustomer.secondary_phone || '-'}</p></div>
                <div><Label className="text-xs text-muted-foreground">TC Kimlik</Label><p className="font-medium">{detailCustomer.tc_kimlik_no || '-'}</p></div>
                <div><Label className="text-xs text-muted-foreground">Doğum Tarihi</Label><p className="font-medium">{detailCustomer.birth_date ? format(parseISO(detailCustomer.birth_date), 'dd.MM.yyyy') : '-'}</p></div>
                <div className="col-span-2"><Label className="text-xs text-muted-foreground">Adres</Label><p className="font-medium">{detailCustomer.address || '-'}</p></div>
                <div><Label className="text-xs text-muted-foreground">Müşteri Türü</Label><p className="font-medium">{getStatusBadge(detailCustomer.customer_type).label}</p></div>
                <div><Label className="text-xs text-muted-foreground">Kaynak</Label><p className="font-medium">{detailCustomer.source_type ? getSourceLabel(detailCustomer.source_type) : '-'}</p></div>
                <div className="col-span-2"><Label className="text-xs text-muted-foreground">Notlar</Label><p className="font-medium">{detailCustomer.notes || '-'}</p></div>
                <div><Label className="text-xs text-muted-foreground">Kayıt Tarihi</Label><p className="font-medium">{format(parseISO(detailCustomer.created_at), 'dd.MM.yyyy HH:mm', { locale: tr })}</p></div>
              </div>
              {/* Service summary */}
              {(() => {
                const summary = getCustomerServiceSummary(detailCustomer.id);
                if (summary.length === 0) return null;
                return (
                  <div className="border-t pt-3">
                    <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase">Hizmet Geçmişi</p>
                    {summary.map((s, i) => (
                      <div key={i} className="flex justify-between py-1 text-xs border-b border-border/30 last:border-0">
                        <span>{s.name}</span>
                        <span className="text-muted-foreground">{s.completed}/{s.total} tamamlandı{s.cancelled > 0 && ` • ${s.cancelled} iptal`}</span>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          )}
        </DialogContent>
      </Dialog>

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
              {form.customer_type === 'single_session' && <p className="text-xs text-muted-foreground">Tek seans müşterilerde taksit sistemi devre dışıdır.</p>}
              {form.customer_type === 'cash' && <p className="text-xs text-muted-foreground">Peşin müşterilerde ödeme tek seferde alınır.</p>}
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Müşteri Kaynağı <span className="text-muted-foreground font-normal">(Opsiyonel)</span></Label>
              <Select value={form.source_type} onValueChange={v => set('source_type', v)}>
                <SelectTrigger className="h-10"><SelectValue placeholder="Kaynak seçin" /></SelectTrigger>
                <SelectContent>{SOURCE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {form.source_type && (
              <div className="space-y-2"><Label className="text-xs font-semibold">Kaynak Detayı</Label><Input value={form.source_detail} onChange={e => set('source_detail', e.target.value)} placeholder="Kaynak adı veya tanımı..." className="h-10" /></div>
            )}
            <div className="space-y-2">
              <Label className="text-xs font-semibold">İşlem Yapan Personel <span className="text-muted-foreground font-normal">(Opsiyonel)</span></Label>
              <Select value={form.assigned_staff_id} onValueChange={v => set('assigned_staff_id', v)}>
                <SelectTrigger className="h-10"><SelectValue placeholder="Personel seçin" /></SelectTrigger>
                <SelectContent>
                  {staff.filter((s: any) => s.is_active !== false).map((s: any) => (<SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>))}
                  <SelectItem value="__other__">Diğer</SelectItem>
                </SelectContent>
              </Select>
              {form.assigned_staff_id === '__other__' && <Input value={form.assigned_staff_other} onChange={e => set('assigned_staff_other', e.target.value)} placeholder="Personel adını yazın..." className="h-10" />}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>İptal</Button>
            <Button onClick={handleSave} disabled={saving} className="btn-gradient">{saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Kaydet</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History Dialog */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{selectedCustomer?.name} — Seans Geçmişi</DialogTitle><DialogDescription>Müşterinin geçmiş randevuları</DialogDescription></DialogHeader>
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

      {saleCustomer && <CustomerSaleDialog open={saleDialogOpen} onOpenChange={setSaleDialogOpen} customerId={saleCustomer.id} customerName={saleCustomer.name} />}
      {saleCustomer && <CustomerSalesHistory open={salesHistoryOpen} onOpenChange={setSalesHistoryOpen} customerId={saleCustomer.id} customerName={saleCustomer.name} />}

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{deleteBlocked ? 'Müşteri Silinemez' : 'Müşteriyi Sil'}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteBlocked
                ? `"${customerToDelete?.name}" adlı müşterinin ileri tarihli aktif randevusu bulunmaktadır.`
                : `"${customerToDelete?.name}" adlı müşteriyi silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>İptal</AlertDialogCancel>
            {!deleteBlocked && <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Sil</AlertDialogAction>}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
    </StaffPageGuard>
  );
}
