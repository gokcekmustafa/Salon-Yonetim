import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { DbCustomer } from '@/hooks/useSalonData';
import { useBranchFilteredData } from '@/hooks/useBranchFilteredData';
import { useFormGuard } from '@/hooks/useFormGuard';
import { supabase } from '@/integrations/supabase/client';
import { useAuditLog } from '@/hooks/useAuditLog';
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Plus, Search, Pencil, Trash2, History, Users, Loader2, ShoppingCart, CalendarPlus, FileText, CreditCard, Phone, MessageSquare, UserCheck, Filter, X, Eye } from 'lucide-react';
import { format, parseISO, differenceInDays, differenceInYears, startOfMonth, endOfMonth, isBefore, isAfter } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { usePermissions } from '@/hooks/usePermissions';
import { NoPermission } from '@/components/permissions/NoPermission';
import DataExportImport, { ColumnMapping } from '@/components/DataExportImport';
import { StaffPageGuard } from '@/components/permissions/StaffPageGuard';
import { CustomerSaleDialog } from '@/components/sales/CustomerSaleDialog';
import { CustomerSalesHistory } from '@/components/sales/CustomerSalesHistory';
import { CustomerInstallmentsPopup } from '@/components/sales/CustomerInstallmentsPopup';
import { CustomerAddWithSaleDialog } from '@/components/customers/CustomerAddWithSaleDialog';
import { useQuery } from '@tanstack/react-query';

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

const emptyForm = { name: '', phone: '', birth_date: '', notes: '', tc_kimlik_no: '', address: '', secondary_phone: '', source_type: '', source_detail: '', assigned_staff_id: '', assigned_staff_other: '' };

type TabFilter = 'all' | 'installment' | 'single_session';

function getRowColorClass(customerType: string, hasDebt: boolean): string {
  if (hasDebt) return 'bg-red-50 dark:bg-red-950/20 hover:bg-red-100 dark:hover:bg-red-950/30';
  if (customerType === 'installment') return 'bg-emerald-50/60 dark:bg-emerald-950/15 hover:bg-emerald-100/80 dark:hover:bg-emerald-950/25';
  if (customerType === 'single_session') return 'bg-sky-50/60 dark:bg-sky-950/15 hover:bg-sky-100/80 dark:hover:bg-sky-950/25';
  return '';
}

function getStatusBadge(customerType: string) {
  if (customerType === 'single_session') return { label: 'Tek Seans', className: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300 border-sky-200 dark:border-sky-800' };
  return { label: 'Paket', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' };
}

function getPaymentMethodLabel(m: string) {
  if (m === 'cash') return 'Nakit';
  if (m === 'credit_card') return 'K.Kartı';
  if (m === 'eft') return 'EFT';
  return m || '-';
}

export default function CustomersPage() {
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const { customers, addCustomer, updateCustomer, deleteCustomer, appointments, services, staff, payments, loading, refetch } = useBranchFilteredData();
  const { currentSalonId } = useAuth();
  const { logAction } = useAuditLog();
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
  const [recentSaleServiceIds, setRecentSaleServiceIds] = useState<Record<string, string[]>>({});
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<DbCustomer | null>(null);
  const [deleteBlocked, setDeleteBlocked] = useState(false);
  const [detailCustomer, setDetailCustomer] = useState<DbCustomer | null>(null);
  const [installmentsCustomer, setInstallmentsCustomer] = useState<DbCustomer | null>(null);
  const [installmentsPopupOpen, setInstallmentsPopupOpen] = useState(false);
  const [salesListSort, setSalesListSort] = useState<'newest' | 'oldest'>('newest');
  const [salesListCustomer, setSalesListCustomer] = useState<DbCustomer | null>(null);
  const [salesListHistoryOpen, setSalesListHistoryOpen] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  useFormGuard(dialogOpen);

  // Fetch installment data for all customers
  const { data: installments = [] } = useQuery({
    queryKey: ['installments_all', currentSalonId],
    queryFn: async () => {
      const { data } = await supabase
        .from('installments')
        .select('*')
        .eq('salon_id', currentSalonId!);
      return data || [];
    },
    enabled: !!currentSalonId,
  });

  const { data: installmentPayments = [] } = useQuery({
    queryKey: ['installment_payments_all', currentSalonId],
    queryFn: async () => {
      const { data } = await supabase
        .from('installment_payments')
        .select('*')
        .eq('salon_id', currentSalonId!);
      return data || [];
    },
    enabled: !!currentSalonId,
  });

  // Fetch service_sales for total service cost
  const { data: serviceSales = [] } = useQuery({
    queryKey: ['service_sales_all', currentSalonId],
    queryFn: async () => {
      const { data } = await supabase
        .from('service_sales')
        .select('*, services(name)')
        .eq('salon_id', currentSalonId!);
      return data || [];
    },
    enabled: !!currentSalonId,
  });

  // Fetch product_sales for sales list
  const { data: productSalesAll = [] } = useQuery({
    queryKey: ['product_sales_all', currentSalonId],
    queryFn: async () => {
      const { data } = await supabase
        .from('product_sales')
        .select('*, products(name)')
        .eq('salon_id', currentSalonId!);
      return data || [];
    },
    enabled: !!currentSalonId,
  });

  useEffect(() => {
    if (searchParams.get('yeni') === '1' && !loading) {
      setEditing(null);
      setForm(emptyForm);
      setDialogOpen(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, loading]);

  // Compute customer installment info
  const customerInstallmentInfo = useMemo(() => {
    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);
    const info: Record<string, {
      thisMonthAmount: number;
      thisMonthPaid: boolean;
      overdueCount: number;
      overdueAmount: number;
      totalBalance: number;
      totalServiceCost: number;
      totalPaid: number;
      paymentMethod: string;
    }> = {};

    customers.forEach(c => {
      const custInstallments = installments.filter((inst: any) => inst.customer_id === c.id);
      let thisMonthAmount = 0;
      let thisMonthPaid = true;
      let overdueCount = 0;
      let overdueAmount = 0;
      let totalPaid = 0;
      let totalServiceCost = 0;
      let paymentMethod = '';

      custInstallments.forEach((inst: any) => {
        totalServiceCost += Number(inst.total_amount);
        const instPayments = installmentPayments.filter((ip: any) => ip.installment_id === inst.id);
        instPayments.forEach((ip: any) => {
          const dueDate = parseISO(ip.due_date);
          if (ip.is_paid) {
            totalPaid += Number(ip.paid_amount || ip.amount);
            if (!paymentMethod && ip.payment_method) paymentMethod = ip.payment_method;
          }
          // This month
          if (dueDate >= monthStart && dueDate <= monthEnd) {
            thisMonthAmount += Number(ip.amount);
            if (!ip.is_paid) thisMonthPaid = false;
          }
          // Overdue
          if (!ip.is_paid && isBefore(dueDate, monthStart)) {
            overdueCount++;
            overdueAmount += Number(ip.amount) - Number(ip.paid_amount || 0);
          }
        });
      });

      // Also add service sales total
      const custServiceSales = serviceSales.filter((ss: any) => ss.customer_id === c.id);
      custServiceSales.forEach((ss: any) => {
        if (!totalServiceCost) totalServiceCost += Number(ss.total_price);
        if (!paymentMethod && ss.payment_method) paymentMethod = ss.payment_method;
      });

      const totalBalance = totalServiceCost - totalPaid;

      info[c.id] = {
        thisMonthAmount,
        thisMonthPaid,
        overdueCount,
        overdueAmount,
        totalBalance: totalBalance > 0 ? totalBalance : 0,
        totalServiceCost,
        totalPaid,
        paymentMethod: paymentMethod || 'cash',
      };
    });
    return info;
  }, [customers, installments, installmentPayments, serviceSales]);

  // Compute customer balances for debt detection
  const customerBalances = useMemo(() => {
    const balances: Record<string, number> = {};
    customers.forEach(c => {
      const info = customerInstallmentInfo[c.id];
      if (info && info.totalBalance > 0) {
        balances[c.id] = -info.totalBalance; // negative means debt
      }
    });
    return balances;
  }, [customerInstallmentInfo, customers]);

  // Sales list: group by customer, only those with sales
  const salesListCustomers = useMemo(() => {
    const customerSalesMap: Record<string, { customer: DbCustomer; totalAmount: number; saleCount: number; lastSaleDate: string }> = {};
    
    serviceSales.forEach((ss: any) => {
      if (!ss.customer_id) return;
      const cust = customers.find(c => c.id === ss.customer_id);
      if (!cust) return;
      if (!customerSalesMap[ss.customer_id]) {
        customerSalesMap[ss.customer_id] = { customer: cust, totalAmount: 0, saleCount: 0, lastSaleDate: ss.created_at };
      }
      customerSalesMap[ss.customer_id].totalAmount += Number(ss.total_price);
      customerSalesMap[ss.customer_id].saleCount++;
      if (ss.created_at > customerSalesMap[ss.customer_id].lastSaleDate) {
        customerSalesMap[ss.customer_id].lastSaleDate = ss.created_at;
      }
    });

    productSalesAll.forEach((ps: any) => {
      if (!ps.customer_id) return;
      const cust = customers.find(c => c.id === ps.customer_id);
      if (!cust) return;
      if (!customerSalesMap[ps.customer_id]) {
        customerSalesMap[ps.customer_id] = { customer: cust, totalAmount: 0, saleCount: 0, lastSaleDate: ps.created_at };
      }
      customerSalesMap[ps.customer_id].totalAmount += Number(ps.total_price);
      customerSalesMap[ps.customer_id].saleCount++;
      if (ps.created_at > customerSalesMap[ps.customer_id].lastSaleDate) {
        customerSalesMap[ps.customer_id].lastSaleDate = ps.created_at;
      }
    });

    const list = Object.values(customerSalesMap);
    if (salesListSort === 'newest') {
      list.sort((a, b) => new Date(b.lastSaleDate).getTime() - new Date(a.lastSaleDate).getTime());
    } else {
      list.sort((a, b) => new Date(a.lastSaleDate).getTime() - new Date(b.lastSaleDate).getTime());
    }
    return list;
  }, [serviceSales, productSalesAll, customers, salesListSort]);
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

  // Staff monthly sale count
  const staffMonthlySales = useMemo(() => {
    const now = new Date();
    const monthStart = startOfMonth(now);
    const counts: Record<string, number> = {};
    serviceSales.forEach((ss: any) => {
      if (parseISO(ss.created_at) >= monthStart) {
        const staffId = ss.sold_by || ss.staff_id;
        if (staffId) counts[staffId] = (counts[staffId] || 0) + 1;
      }
    });
    return counts;
  }, [serviceSales]);

  const tabCounts = useMemo(() => ({
    all: customers.length,
    installment: customers.filter(c => c.customer_type === 'installment' || c.customer_type === 'cash').length,
    single_session: customers.filter(c => c.customer_type === 'single_session').length,
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
    const matchTab = tabFilter === 'all' || c.customer_type === tabFilter || (tabFilter === 'installment' && c.customer_type === 'cash');
    return matchName && matchPhone && matchTc && matchTab;
  });

  const hasAnyFilter = nameSearch || phoneSearch || tcSearch;
  const clearFilters = () => { setNameSearch(''); setPhoneSearch(''); setTcSearch(''); };

  const openAdd = () => { setAddDialogOpen(true); };
  const openEdit = (c: DbCustomer) => {
    setEditing(c);
    setForm({
      name: c.name, phone: c.phone || '', birth_date: c.birth_date || '', notes: c.notes || '',
      tc_kimlik_no: c.tc_kimlik_no || '', address: c.address || '', secondary_phone: c.secondary_phone || '',
      source_type: c.source_type || '', source_detail: c.source_detail || '',
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
      assigned_staff_id: form.assigned_staff_id === '__other__' ? null : (form.assigned_staff_id || null),
    };
    if (editing) {
      await updateCustomer(editing.id, { name: form.name, phone: form.phone, ...optionals });
      logAction({ action: 'update', target_type: 'customer', target_id: editing.id, target_label: form.name, details: { phone: form.phone } });
      toast.success('Müşteri güncellendi.');
      setSaving(false);
      setDialogOpen(false);
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
    if (!customerToDelete || !currentSalonId) return;
    setSaving(true);
    try {
      const { data, error } = await supabase.rpc('delete_customer_cascade', {
        _customer_id: customerToDelete.id,
        _salon_id: currentSalonId,
      });
      if (error) {
        toast.error('Müşteri silinemedi: ' + error.message);
        setSaving(false);
        return;
      }
      const result = data as any;
      if (result && result.success === false) {
        toast.error(result.error || 'Müşteri silinemedi.');
        setSaving(false);
        return;
      }
      logAction({ action: 'delete', target_type: 'customer', target_id: customerToDelete.id, target_label: customerToDelete.name, details: result });
      const parts: string[] = [];
      if (result?.deleted_appointments > 0) parts.push(`${result.deleted_appointments} randevu`);
      if (result?.deleted_payments > 0) parts.push(`${result.deleted_payments} ödeme`);
      if (result?.deleted_installments > 0) parts.push(`${result.deleted_installments} taksit planı`);
      if (result?.deleted_service_sales > 0) parts.push(`${result.deleted_service_sales} hizmet satışı`);
      if (result?.deleted_product_sales > 0) parts.push(`${result.deleted_product_sales} ürün satışı`);
      if (result?.deleted_contracts > 0) parts.push(`${result.deleted_contracts} sözleşme`);
      if (result?.deleted_cash_transactions > 0) parts.push(`${result.deleted_cash_transactions} kasa hareketi`);
      const detail = parts.length > 0 ? ` (${parts.join(', ')} silindi)` : '';
      toast.success(`Müşteri "${customerToDelete.name}" ve tüm bağlantılı verileri silindi.${detail}`);
      await refetch();
    } catch (err: any) {
      toast.error('Müşteri silinirken bir hata oluştu: ' + (err?.message || 'Bilinmeyen hata'));
    } finally {
      setSaving(false);
      setDeleteConfirmOpen(false);
      setCustomerToDelete(null);
    }
  };

  const openHistory = (c: DbCustomer) => { setSelectedCustomer(c); setHistoryOpen(true); };
  const openSale = (c: DbCustomer) => { setSaleCustomer(c); setSaleDialogOpen(true); };
  const openSalesHistory = (c: DbCustomer) => { setSaleCustomer(c); setSalesHistoryOpen(true); };
  const handleSaleCompleted = ({ customerId, serviceIds }: { customerId?: string; serviceIds: string[] }) => {
    if (!customerId || serviceIds.length === 0) return;
    setRecentSaleServiceIds(prev => ({ ...prev, [customerId]: serviceIds }));
    toast.success('Satış kaydedildi. Randevu ekranında hizmetler hazır gelecek.');
  };

  const openAppointment = (c: DbCustomer) => {
    const params = new URLSearchParams({
      yeniRandevu: '1',
      customer_id: c.id,
    });

    const serviceIds = recentSaleServiceIds[c.id] || [];
    if (serviceIds.length > 0) {
      params.set('service_ids', serviceIds.join(','));
    }

    navigate(`/randevular?${params.toString()}`);
  };

  const customerAppointments = selectedCustomer
    ? appointments.filter(a => a.customer_id === selectedCustomer.id).sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime())
    : [];

  const getName = (list: { id: string; name: string }[], id: string) => list.find(x => x.id === id)?.name ?? '-';
  const set = (key: string, val: string) => setForm(f => ({ ...f, [key]: val }));

  const getNextAppointment = (customerId: string) => {
    const now = new Date();
    return appointments
      .filter(a => a.customer_id === customerId && a.status !== 'iptal' && new Date(a.start_time) >= now)
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())[0] || null;
  };

  const renderCustomerRow = (c: DbCustomer, index: number) => {
    const hasDebt = (customerBalances[c.id] || 0) < 0;
    const badge = getStatusBadge(c.customer_type);
    const assignedStaff = getAssignedStaffName(c);
    const serviceSummary = getCustomerServiceSummary(c.id);
    const instInfo = customerInstallmentInfo[c.id];
    const nextAppt = getNextAppointment(c.id);
    const now = new Date();

    // Staff assigned_staff_id for staff tooltip
    const staffId = (c as any).assigned_staff_id;
    const staffSaleCount = staffId ? (staffMonthlySales[staffId] || 0) : 0;

    // Age
    const age = c.birth_date ? differenceInYears(now, parseISO(c.birth_date)) : null;

    return (
      <ContextMenu key={c.id}>
        <ContextMenuTrigger asChild>
          <TableRow className={`group cursor-context-menu transition-colors ${getRowColorClass(c.customer_type, hasDebt)}`}>
            {/* M. No */}
            <TableCell className="font-mono text-xs text-muted-foreground w-12 text-center">
              {index + 1}
            </TableCell>

            {/* Adı Soyadı - hover: Yaş, TC */}
            <TableCell>
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-2 cursor-pointer">
                      <div className={`h-7 w-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
                        hasDebt ? 'bg-red-200 text-red-800 dark:bg-red-900/50 dark:text-red-300' : 'bg-primary/10 text-primary'
                      }`}>
                        {c.name.charAt(0)}
                      </div>
                      <span className="font-semibold text-sm hover:underline text-primary">{c.name}</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="bg-foreground text-background text-xs p-2 max-w-60">
                    <p className="font-bold">{c.name}</p>
                    <p>Yaş: {age !== null ? age : 'Bilinmiyor'}</p>
                    {c.tc_kimlik_no && <p>TC/Pasaport No: {c.tc_kimlik_no}</p>}
                    {c.address && <p>Adres: {c.address}</p>}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </TableCell>

            {/* Cep Tel */}
            <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{c.phone || '-'}</TableCell>

            {/* Hizmet - hover: detailed breakdown */}
            <TableCell className="hidden lg:table-cell text-sm text-muted-foreground max-w-[160px] truncate">
              {serviceSummary.length > 0 ? (
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="cursor-pointer hover:underline">{serviceSummary.map(s => s.name).join(', ')}</span>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="bg-foreground text-background text-xs p-3 max-w-72">
                      <p className="font-bold uppercase mb-1">{serviceSummary[0]?.name}</p>
                      {serviceSummary.map((s, i) => (
                        <p key={i}>• {s.name} {s.total} / {s.completed}</p>
                      ))}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : '-'}
            </TableCell>

            {/* Kayıt Tarihi */}
            <TableCell className="hidden xl:table-cell text-xs text-muted-foreground whitespace-nowrap">
              {format(parseISO(c.created_at), 'dd.MM.yyyy', { locale: tr })}
            </TableCell>

            {/* Ödeme Şekli */}
            <TableCell>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${badge.className}`}>
                {badge.label}
              </span>
            </TableCell>

            {/* Bu Ayki Taksit */}
            <TableCell className="hidden lg:table-cell text-xs text-center whitespace-nowrap">
              {instInfo && instInfo.thisMonthAmount > 0 ? (
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className={`cursor-pointer font-medium ${instInfo.thisMonthPaid ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {instInfo.thisMonthAmount.toLocaleString('tr-TR')} ₺
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="bg-foreground text-background text-xs p-2">
                      <p>{instInfo.thisMonthPaid ? '✅ Bu ayki taksit ödendi' : '⏳ Bu ayki taksit henüz ödenmedi'}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : <span className="text-muted-foreground">-</span>}
            </TableCell>

            {/* Geç. Taksitler */}
            <TableCell className="hidden lg:table-cell text-xs text-center whitespace-nowrap">
              {instInfo && instInfo.overdueCount > 0 ? (
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="cursor-pointer font-bold text-red-600">
                        {instInfo.overdueCount} taksit
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="bg-foreground text-background text-xs p-2">
                      <p>⚠️ {instInfo.overdueCount} adet gecikmiş taksit</p>
                      <p>Toplam: {instInfo.overdueAmount.toLocaleString('tr-TR')} ₺</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : <span className="text-muted-foreground">-</span>}
            </TableCell>

            {/* Bakiye - hover: Hizmet Bedeli */}
            <TableCell className="text-xs text-right whitespace-nowrap">
              {instInfo ? (
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className={`cursor-pointer font-semibold ${instInfo.totalBalance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                        {instInfo.totalBalance > 0 ? instInfo.totalBalance.toLocaleString('tr-TR') + ' ₺' : '0,00 ₺'}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="bg-foreground text-background text-xs p-2">
                      <p className="font-bold">Hizmet Bedeli: {instInfo.totalServiceCost.toLocaleString('tr-TR')} ₺</p>
                      <p>Ödenen: {instInfo.totalPaid.toLocaleString('tr-TR')} ₺</p>
                      <p>Kalan: {instInfo.totalBalance.toLocaleString('tr-TR')} ₺</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : <span className="text-muted-foreground">0,00 ₺</span>}
            </TableCell>

            {/* Rand. Tarihi - hover: Saat ve kaç gün sonra */}
            <TableCell className="hidden xl:table-cell text-xs text-center whitespace-nowrap">
              {nextAppt ? (
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="cursor-pointer text-primary font-medium">
                        {format(parseISO(nextAppt.start_time), 'dd.MM.yyyy', { locale: tr })}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="bg-foreground text-background text-xs p-2">
                      <p>• Saat {format(parseISO(nextAppt.start_time), 'HH:mm')}</p>
                      <p>• {differenceInDays(parseISO(nextAppt.start_time), now)} gün sonra</p>
                      <p>• {getName(services, nextAppt.service_id)}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : <span className="text-muted-foreground">-</span>}
            </TableCell>

            {/* Satış Personeli - hover: Bu ayki satış sayısı */}
            <TableCell className="hidden xl:table-cell text-xs text-muted-foreground whitespace-nowrap">
              {assignedStaff ? (
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="cursor-pointer hover:underline">{assignedStaff}</span>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="bg-foreground text-background text-xs p-2">
                      <p className="font-bold">{assignedStaff}</p>
                      <p>Bu ay ki {staffSaleCount}. satışı</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : '-'}
            </TableCell>

            {/* Araç (Kaynak) */}
            <TableCell className="hidden xl:table-cell text-xs text-muted-foreground whitespace-nowrap">
              {c.source_type ? getSourceLabel(c.source_type) : '-'}
            </TableCell>

            {/* Durum */}
            <TableCell className="whitespace-nowrap">
              {hasDebt || (instInfo && instInfo.overdueCount > 0) ? (
                <Badge className="bg-red-500/90 text-white text-[10px] hover:bg-red-600">Borçlu</Badge>
              ) : instInfo && instInfo.totalBalance === 0 && instInfo.totalServiceCost > 0 ? (
                <Badge className="bg-emerald-500/90 text-white text-[10px] hover:bg-emerald-600">Borçsuz</Badge>
              ) : (
                <Badge className="bg-emerald-500/90 text-white text-[10px] hover:bg-emerald-600">Düzenli</Badge>
              )}
            </TableCell>

            {/* Ödeme Sözü */}
            <TableCell className="hidden xl:table-cell text-xs text-muted-foreground whitespace-nowrap">
              {instInfo?.paymentMethod ? getPaymentMethodLabel(instInfo.paymentMethod) : '-'}
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
              <ContextMenuItem className="gap-2 cursor-pointer" onClick={() => { setInstallmentsCustomer(c); setInstallmentsPopupOpen(true); }}>
                <CreditCard className="h-4 w-4" /> Taksit Planı
              </ContextMenuItem>
              <ContextMenuItem className="gap-2 cursor-pointer" onClick={() => navigate(`/kasa?customer=${c.id}`)}>
                <FileText className="h-4 w-4" /> Ödeme Geçmişi
              </ContextMenuItem>
            </ContextMenuSubContent>
          </ContextMenuSub>
          <ContextMenuSeparator />
          <ContextMenuItem className="gap-2 cursor-pointer" onClick={() => navigate(`/sozlesmeler?customer=${c.id}&yeni=1`)}>
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

      {/* Search Filters */}
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
          const instInfo = customerInstallmentInfo[c.id];
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
                    {instInfo && instInfo.totalBalance > 0 && (
                      <p className="text-xs font-semibold text-red-600">Bakiye: {instInfo.totalBalance.toLocaleString('tr-TR')} ₺</p>
                    )}
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
                  <TableHead className="font-semibold text-[11px] w-12 text-center">M. No</TableHead>
                  <TableHead className="font-semibold text-[11px]">Adı Soyadı</TableHead>
                  <TableHead className="font-semibold text-[11px]">Cep Tel</TableHead>
                  <TableHead className="hidden lg:table-cell font-semibold text-[11px]">Hizmet</TableHead>
                  <TableHead className="hidden xl:table-cell font-semibold text-[11px]">Kayıt Tarihi</TableHead>
                  <TableHead className="font-semibold text-[11px]">Ödeme Şekli</TableHead>
                  <TableHead className="hidden lg:table-cell font-semibold text-[11px] text-center">Bu Ayki Taksit</TableHead>
                  <TableHead className="hidden lg:table-cell font-semibold text-[11px] text-center">Geç. Taksitler</TableHead>
                  <TableHead className="font-semibold text-[11px] text-right">Bakiye</TableHead>
                  <TableHead className="hidden xl:table-cell font-semibold text-[11px] text-center">Rand. Tarihi</TableHead>
                  <TableHead className="hidden xl:table-cell font-semibold text-[11px]">Satış Personeli</TableHead>
                  <TableHead className="hidden xl:table-cell font-semibold text-[11px]">Araç</TableHead>
                  <TableHead className="font-semibold text-[11px]">Durum</TableHead>
                  <TableHead className="hidden xl:table-cell font-semibold text-[11px]">Ödeme Sözü</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={14} className="text-center py-12 text-muted-foreground text-sm">Müşteri bulunamadı.</TableCell></TableRow>
                ) : filtered.map((c, i) => renderCustomerRow(c, i))}
              </TableBody>
            </Table>
          </div>
          <div className="px-4 py-2 bg-muted/20 border-t border-border/40 text-xs text-muted-foreground flex justify-between">
            <span>Gösterilen: {filtered.length} / {customers.length} müşteri</span>
            <span className="text-[10px]">💡 Sağ tık ile hızlı işlem menüsü • Mouse ile sütunlarda gezinerek detay bilgi</span>
          </div>
        </CardContent>
      </Card>

      {/* Sales List Section */}
      <Card className="shadow-soft border-border/60 mt-4">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-primary" /> Satış Listesi
              <Badge variant="secondary" className="text-xs">{salesListCustomers.length}</Badge>
            </h2>
            <Select value={salesListSort} onValueChange={(v: 'newest' | 'oldest') => setSalesListSort(v)}>
              <SelectTrigger className="w-36 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">En Yeni</SelectItem>
                <SelectItem value="oldest">En Eski</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {salesListCustomers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <ShoppingCart className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Henüz satış kaydı yok</p>
            </div>
          ) : (
            <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
              {salesListCustomers.map((item) => (
                <div
                  key={item.customer.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-transparent hover:border-border/40 cursor-pointer transition-colors"
                  onClick={() => {
                    setSalesListCustomer(item.customer);
                    setSalesListHistoryOpen(true);
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full flex items-center justify-center shrink-0 bg-primary/10 text-primary text-xs font-bold">
                      {item.customer.name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-primary hover:underline">{item.customer.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.saleCount} satış • Son: {format(parseISO(item.lastSaleDate), 'dd.MM.yyyy', { locale: tr })}
                      </p>
                    </div>
                  </div>
                  <span className="text-sm font-bold whitespace-nowrap">{item.totalAmount.toLocaleString('tr-TR')} ₺</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

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

      {/* Add Dialog (combined with sale) */}
      <CustomerAddWithSaleDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        staff={staff}
        onCompleted={({ customerId, customerName, serviceIds }) => {
          setRecentSaleServiceIds(prev => ({ ...prev, [customerId]: serviceIds }));
          refetch();
        }}
      />

      {/* Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Müşteri Düzenle</DialogTitle><DialogDescription>Müşteri bilgilerini güncelleyin</DialogDescription></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2"><Label className="text-xs font-semibold">Ad Soyad *</Label><Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Ad Soyad" className="h-10" /></div>
            <div className="space-y-2"><Label className="text-xs font-semibold">Telefon *</Label><Input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="0500 000 0000" type="tel" className="h-10" /></div>
            <div className="space-y-2"><Label className="text-xs font-semibold">2. Telefon <span className="text-muted-foreground font-normal">(Opsiyonel)</span></Label><Input value={form.secondary_phone} onChange={e => set('secondary_phone', e.target.value)} placeholder="0500 000 0000" type="tel" className="h-10" /></div>
            <div className="space-y-2"><Label className="text-xs font-semibold">TC Kimlik No <span className="text-muted-foreground font-normal">(Opsiyonel)</span></Label><Input value={form.tc_kimlik_no} onChange={e => set('tc_kimlik_no', e.target.value)} placeholder="11 haneli TC Kimlik No" maxLength={11} className="h-10" /></div>
            <div className="space-y-2"><Label className="text-xs font-semibold">Adres <span className="text-muted-foreground font-normal">(Opsiyonel)</span></Label><Textarea value={form.address} onChange={e => set('address', e.target.value)} placeholder="Müşteri adresi..." rows={2} /></div>
            <div className="space-y-2"><Label className="text-xs font-semibold">Doğum Tarihi <span className="text-muted-foreground font-normal">(Opsiyonel)</span></Label><Input type="date" value={form.birth_date} onChange={e => set('birth_date', e.target.value)} className="h-10" /></div>
            <div className="space-y-2"><Label className="text-xs font-semibold">Notlar <span className="text-muted-foreground font-normal">(Opsiyonel)</span></Label><Textarea value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Müşteri notları..." rows={3} /></div>
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

      {saleCustomer && <CustomerSaleDialog open={saleDialogOpen} onOpenChange={setSaleDialogOpen} onSaleCompleted={handleSaleCompleted} customerId={saleCustomer.id} customerName={saleCustomer.name} />}
      {saleCustomer && <CustomerSalesHistory open={salesHistoryOpen} onOpenChange={setSalesHistoryOpen} customerId={saleCustomer.id} customerName={saleCustomer.name} />}
      {installmentsCustomer && <CustomerInstallmentsPopup open={installmentsPopupOpen} onOpenChange={setInstallmentsPopupOpen} customerId={installmentsCustomer.id} customerName={installmentsCustomer.name} />}
      {salesListCustomer && <CustomerSalesHistory open={salesListHistoryOpen} onOpenChange={setSalesListHistoryOpen} customerId={salesListCustomer.id} customerName={salesListCustomer.name} />}

      <AlertDialog open={deleteConfirmOpen} onOpenChange={(open) => { if (!saving) setDeleteConfirmOpen(open); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Müşteriyi Sil</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>"{customerToDelete?.name}"</strong> adlı müşteriyi silmek istediğinize emin misiniz?
              <br /><br />
              Bu işlemle birlikte müşteriye ait <strong>tüm randevular, ödemeler, taksit planları, satışlar, sözleşmeler ve kasa hareketleri</strong> kalıcı olarak silinecektir.
              <br /><br />
              <span className="text-destructive font-medium">Bu işlem geri alınamaz.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>İptal</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={saving} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Siliniyor...</> : 'Evet, Sil'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
    </StaffPageGuard>
  );
}
