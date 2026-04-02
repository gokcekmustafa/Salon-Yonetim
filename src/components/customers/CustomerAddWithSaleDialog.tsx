import { useState, useMemo, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useBranch } from '@/contexts/BranchContext';
import { useAuditLog } from '@/hooks/useAuditLog';
import { useFormGuard } from '@/hooks/useFormGuard';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, Trash2, ShoppingCart, Scissors, Package, AlertTriangle, CreditCard, Percent, ArrowRight, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { InstallmentPlanDialog } from '@/components/sales/InstallmentPlanDialog';

const SOURCE_OPTIONS = [
  { value: 'advertisement', label: 'Reklam' },
  { value: 'social_media', label: 'Sosyal Medya Reklamı' },
  { value: 'referral', label: 'Tanıdık Tavsiyesi' },
  { value: 'surveyor', label: 'Anketör / Personel' },
  { value: 'other', label: 'Diğer' },
];

type ServiceItem = { service_id: string; name: string; quantity: number; unit_price: number };
type ProductItem = { product_id: string; name: string; quantity: number; unit_price: number; current_stock: number };

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCompleted: (payload: { customerId: string; customerName: string; serviceIds: string[] }) => void;
  staff: any[];
}

const emptyCustomerForm = {
  name: '', phone: '', birth_date: '', notes: '', tc_kimlik_no: '',
  address: '', secondary_phone: '', source_type: '', source_detail: '',
  assigned_staff_id: '', assigned_staff_other: '',
};

export function CustomerAddWithSaleDialog({ open, onOpenChange, onCompleted, staff }: Props) {
  const { user, currentSalonId } = useAuth();
  const { logAction } = useAuditLog();
  const { requireBranchForAction, getEffectiveBranchId } = useBranch();
  const qc = useQueryClient();
  const salonId = currentSalonId;

  // Steps: 1 = customer info, 2 = sale
  const [step, setStep] = useState<1 | 2>(1);
  const [form, setForm] = useState(emptyCustomerForm);
  const [saving, setSaving] = useState(false);

  // Sale state
  const [activeTab, setActiveTab] = useState('services');
  const [serviceItems, setServiceItems] = useState<ServiceItem[]>([]);
  const [productItems, setProductItems] = useState<ProductItem[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [discountType, setDiscountType] = useState<'none' | 'amount' | 'percent'>('none');
  const [discountValue, setDiscountValue] = useState('');
  const [saleDate, setSaleDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [installmentDialogOpen, setInstallmentDialogOpen] = useState(false);
  const [pendingSaleTotal, setPendingSaleTotal] = useState(0);
  const [createdCustomerId, setCreatedCustomerId] = useState<string | null>(null);
  const installmentCompletionRef = useRef(false);
  const skipDraftCleanupOnCloseRef = useRef(false);

  useFormGuard(open);

  // Queries for sale
  const { data: categories = [] } = useQuery({
    queryKey: ['service_categories', salonId],
    queryFn: async () => {
      if (!salonId) return [];
      const { data } = await supabase.from('service_categories').select('*').eq('salon_id', salonId).order('sort_order');
      return data || [];
    },
    enabled: !!salonId && open && step === 2,
  });

  const { data: services = [] } = useQuery({
    queryKey: ['services', salonId],
    queryFn: async () => {
      if (!salonId) return [];
      const { data } = await supabase.from('services').select('*').eq('salon_id', salonId).eq('is_active', true).order('name');
      return data || [];
    },
    enabled: !!salonId && open && step === 2,
  });

  const { data: products = [] } = useQuery({
    queryKey: ['products', salonId],
    queryFn: async () => {
      if (!salonId) return [];
      const { data } = await supabase.from('products').select('*').eq('salon_id', salonId).eq('is_active', true).order('name');
      return data || [];
    },
    enabled: !!salonId && open && step === 2,
  });

  const filteredServices = useMemo(() => {
    if (!selectedCategoryId || selectedCategoryId === 'all') return services;
    return services.filter((s: any) => s.category_id === selectedCategoryId);
  }, [services, selectedCategoryId]);

  const serviceTotal = useMemo(() => serviceItems.reduce((s, i) => s + i.quantity * i.unit_price, 0), [serviceItems]);
  const productTotal = useMemo(() => productItems.reduce((s, i) => s + i.quantity * i.unit_price, 0), [productItems]);
  const subtotal = serviceTotal + productTotal;

  const discountAmount = useMemo(() => {
    const val = parseFloat(discountValue) || 0;
    if (discountType === 'amount') return Math.min(val, subtotal);
    if (discountType === 'percent') return Math.min(Math.round(subtotal * val / 100 * 100) / 100, subtotal);
    return 0;
  }, [discountType, discountValue, subtotal]);

  const grandTotal = Math.max(0, subtotal - discountAmount);

  const totalServiceSessions = useMemo(() => serviceItems.reduce((s, i) => s + i.quantity, 0), [serviceItems]);

  const resetAll = () => {
    setStep(1);
    setForm(emptyCustomerForm);
    setServiceItems([]);
    setProductItems([]);
    setSelectedCategoryId('');
    setSelectedServiceId('');
    setSelectedProductId('');
    setPaymentMethod('cash');
    setDiscountType('none');
    setDiscountValue('');
    setSaleDate(format(new Date(), 'yyyy-MM-dd'));
    setCreatedCustomerId(null);
    setPendingSaleTotal(0);
    setActiveTab('services');
  };

  const cleanupDraftCustomer = async (customerId: string | null) => {
    if (!customerId || !salonId) return;

    const { error } = await supabase.rpc('delete_customer_cascade', {
      _customer_id: customerId,
      _salon_id: salonId,
    });

    if (error) {
      await supabase.from('customers').delete().eq('id', customerId).eq('salon_id', salonId);
    }

    setCreatedCustomerId((prev) => (prev === customerId ? null : prev));
  };

  const handleClose = (open: boolean) => {
    if (!open && !skipDraftCleanupOnCloseRef.current && createdCustomerId) {
      void cleanupDraftCustomer(createdCustomerId);
    }
    if (!open) {
      skipDraftCleanupOnCloseRef.current = false;
      resetAll();
    }
    onOpenChange(open);
  };

  const set = (key: string, val: string) => setForm(f => ({ ...f, [key]: val }));

  // Step 1 → Step 2
  const goToSale = () => {
    if (!form.name.trim() || !form.phone.trim()) {
      toast.error('Ad ve telefon zorunludur.');
      return;
    }
    if (!requireBranchForAction()) return;
    setStep(2);
  };

  // Add service/product handlers
  const addService = () => {
    const svc = services.find((s: any) => s.id === selectedServiceId);
    if (!svc) return;
    if (serviceItems.find(i => i.service_id === svc.id)) { toast.error('Bu hizmet zaten eklendi'); return; }
    setServiceItems(prev => [...prev, { service_id: svc.id, name: svc.name, quantity: 1, unit_price: svc.price }]);
    setSelectedServiceId('');
  };

  const addProduct = () => {
    const prod = products.find((p: any) => p.id === selectedProductId);
    if (!prod) return;
    if (productItems.find(i => i.product_id === prod.id)) { toast.error('Bu ürün zaten eklendi'); return; }
    setProductItems(prev => [...prev, { product_id: prod.id, name: prod.name, quantity: 1, unit_price: prod.sale_price, current_stock: prod.current_stock }]);
    setSelectedProductId('');
  };

  const updateServiceItem = (idx: number, field: keyof ServiceItem, value: number) => {
    setServiceItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  };
  const updateProductItem = (idx: number, field: keyof ProductItem, value: number) => {
    setProductItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  };

  const handleSave = async () => {
    if (!salonId || !user || (serviceItems.length === 0 && productItems.length === 0)) return;

    if (paymentMethod === 'installment') {
      // First create customer, then open installment dialog
      const custId = await createCustomerIfNeeded();
      if (!custId) return;
      setPendingSaleTotal(grandTotal);
      setInstallmentDialogOpen(true);
      return;
    }

    await processSale(paymentMethod);
  };

  const createCustomerIfNeeded = async (): Promise<string | null> => {
    if (createdCustomerId) return createdCustomerId;
    if (!salonId) return null;

    // Determine customer_type
    const customerType = totalServiceSessions > 1 ? 'installment' : 'single_session';

    const branchId = getEffectiveBranchId();
    const { data: inserted, error } = await supabase.from('customers').insert({
      name: form.name, phone: form.phone, salon_id: salonId,
      birth_date: form.birth_date || null, notes: form.notes || null,
      tc_kimlik_no: form.tc_kimlik_no || null, address: form.address || null,
      secondary_phone: form.secondary_phone || null,
      source_type: form.source_type || null, source_detail: form.source_detail || null,
      customer_type: customerType,
      assigned_staff_id: form.assigned_staff_id === '__other__' ? null : (form.assigned_staff_id || null),
      branch_id: branchId,
    }).select('id').single();

    if (error) {
      toast.error('Müşteri oluşturulamadı: ' + error.message);
      return null;
    }

    const custId = inserted.id;
    setCreatedCustomerId(custId);
    logAction({ action: 'create', target_type: 'customer', target_label: form.name, details: { phone: form.phone, type: customerType } });
    return custId;
  };

  const processSale = async (method: string) => {
    if (!salonId || !user) return;
    setSaving(true);
    let customerIdForRollback: string | null = null;
    const stockMovementIds: string[] = [];
    const originalStocks = new Map<string, number>();

    try {
      const custId = await createCustomerIfNeeded();
      if (!custId) { setSaving(false); return; }
      customerIdForRollback = custId;

      const soldServiceIds = [...new Set(serviceItems.map(item => item.service_id))];
      const saleTimestamp = new Date(saleDate + 'T12:00:00').toISOString();
      const discountRatio = subtotal > 0 ? discountAmount / subtotal : 0;

      // Service sales
      const serviceSaleIds: { service_id: string; sale_id: string; quantity: number }[] = [];
      for (const item of serviceItems) {
        const itemTotal = item.quantity * item.unit_price;
        const itemDiscount = Math.round(itemTotal * discountRatio * 100) / 100;
        const finalPrice = itemTotal - itemDiscount;
        const { data: saleRow, error } = await supabase.from('service_sales').insert({
          salon_id: salonId, customer_id: custId, service_id: item.service_id,
          quantity: item.quantity, unit_price: item.unit_price, total_price: finalPrice,
          payment_method: method === 'installment' ? 'installment' : method,
          sold_by: user.id, created_at: saleTimestamp,
        } as any).select('id').single();
        if (error) throw error;
        if (saleRow) serviceSaleIds.push({ service_id: item.service_id, sale_id: (saleRow as any).id, quantity: item.quantity });
      }

      // Product sales
      for (const item of productItems) {
        const itemTotal = item.quantity * item.unit_price;
        const itemDiscount = Math.round(itemTotal * discountRatio * 100) / 100;
        const finalPrice = itemTotal - itemDiscount;
        const { error: saleErr } = await supabase.from('product_sales').insert({
          salon_id: salonId, product_id: item.product_id, customer_id: custId,
          quantity: item.quantity, unit_price: item.unit_price, total_price: finalPrice,
          payment_method: method === 'installment' ? 'installment' : method,
          sold_by: user.id, created_at: saleTimestamp,
        } as any);
        if (saleErr) throw saleErr;

        const { data: moveRow, error: moveErr } = await supabase.from('stock_movements').insert({
          product_id: item.product_id, salon_id: salonId,
          quantity: item.quantity, type: 'out',
          description: `Satış - ${form.name}`, created_by: user.id,
        }).select('id').single();
        if (moveErr) throw moveErr;
        if (moveRow?.id) stockMovementIds.push(moveRow.id);

        if (!originalStocks.has(item.product_id)) {
          originalStocks.set(item.product_id, item.current_stock);
        }
        const newStock = Math.max(0, item.current_stock - item.quantity);
        const { error: stockErr } = await supabase.from('products').update({ current_stock: newStock }).eq('id', item.product_id);
        if (stockErr) throw stockErr;
        if (newStock === 0) toast.warning(`${item.name} stokta kalmadı!`);
      }

      // Cash transactions
      if (method !== 'installment') {
        const svcFinal = serviceTotal > 0 ? Math.round((serviceTotal - serviceTotal * discountRatio) * 100) / 100 : 0;
        const prdFinal = productTotal > 0 ? Math.round((productTotal - productTotal * discountRatio) * 100) / 100 : 0;
        const discountNote = discountAmount > 0 ? ` (İndirim: ${discountAmount.toLocaleString('tr-TR')} ₺)` : '';

        if (svcFinal > 0) {
          await supabase.from('cash_transactions').insert({
            salon_id: salonId, type: 'income', amount: svcFinal,
            description: `Hizmet satışı - ${form.name}: ${serviceItems.map(i => `${i.name} x${i.quantity}`).join(', ')}${discountNote}`,
            payment_method: method, created_by: user.id, transaction_date: saleTimestamp,
          } as any);
        }
        if (prdFinal > 0) {
          await supabase.from('cash_transactions').insert({
            salon_id: salonId, type: 'income', amount: prdFinal,
            description: `Ürün satışı - ${form.name}: ${productItems.map(i => `${i.name} x${i.quantity}`).join(', ')}`,
            payment_method: method, created_by: user.id, transaction_date: saleTimestamp,
          } as any);
        }
      }

      // Create session credits for service sales
      for (const item of serviceItems) {
        await supabase.from('customer_session_credits').insert({
          salon_id: salonId,
          customer_id: custId,
          service_id: item.service_id,
          total_sessions: item.quantity,
          used_sessions: 0,
          remaining_sessions: item.quantity,
        } as any);
      }

      qc.invalidateQueries({ queryKey: ['products', salonId] });
      qc.invalidateQueries({ queryKey: ['services', salonId] });
      qc.invalidateQueries({ queryKey: ['cash_transactions'] });
      qc.invalidateQueries({ queryKey: ['product_sales'] });
      qc.invalidateQueries({ queryKey: ['service_sales'] });
      qc.invalidateQueries({ queryKey: ['service_sales_all'] });
      qc.invalidateQueries({ queryKey: ['product_sales_all'] });
      qc.invalidateQueries({ queryKey: ['session_credits'] });

      logAction({ action: 'create', target_type: 'sale', target_label: form.name, details: { services: serviceItems.length, products: productItems.length, total: grandTotal, method } });
      toast.success(`Müşteri "${form.name}" oluşturuldu ve satış tamamlandı.`);

      skipDraftCleanupOnCloseRef.current = true;
      setCreatedCustomerId(null);
      onCompleted({ customerId: custId, customerName: form.name, serviceIds: soldServiceIds });
      handleClose(false);
      return true;
    } catch (e: any) {
      for (const [productId, stock] of originalStocks.entries()) {
        await supabase.from('products').update({ current_stock: stock }).eq('id', productId);
      }

      if (stockMovementIds.length > 0) {
        await supabase.from('stock_movements').delete().in('id', stockMovementIds);
      }

      if (customerIdForRollback) {
        await cleanupDraftCustomer(customerIdForRollback);
      }

      toast.error(e.message || 'Satış kaydedilemedi');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleInstallmentComplete = async () => {
    installmentCompletionRef.current = true;
    const success = await processSale('installment');
    if (success) {
      setInstallmentDialogOpen(false);
      return;
    }

    installmentCompletionRef.current = false;
  };

  const handleInstallmentDialogOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && !installmentCompletionRef.current && createdCustomerId) {
      void cleanupDraftCustomer(createdCustomerId);
    }

    if (!nextOpen) {
      setPendingSaleTotal(0);
      installmentCompletionRef.current = false;
    }

    setInstallmentDialogOpen(nextOpen);
  };

  const renderItemRow = (
    item: { name: string; quantity: number; unit_price: number; current_stock?: number },
    idx: number,
    type: 'service' | 'product'
  ) => (
    <div key={idx} className="p-2 flex items-center gap-2">
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium truncate block">{item.name}</span>
        {type === 'product' && item.current_stock !== undefined && item.quantity > item.current_stock && (
          <div className="flex items-center gap-1 text-xs text-destructive">
            <AlertTriangle className="h-3 w-3" /> Stok yetersiz ({item.current_stock})
          </div>
        )}
      </div>
      <Input type="number" min={1} value={item.quantity}
        onChange={e => type === 'service'
          ? updateServiceItem(idx, 'quantity', Number(e.target.value) || 1)
          : updateProductItem(idx, 'quantity', Number(e.target.value) || 1)}
        className="w-16 text-center" />
      <Input type="number" value={item.unit_price}
        onChange={e => type === 'service'
          ? updateServiceItem(idx, 'unit_price', Number(e.target.value) || 0)
          : updateProductItem(idx, 'unit_price', Number(e.target.value) || 0)}
        className="w-24 text-right" />
      <span className="text-sm font-medium w-20 text-right whitespace-nowrap">
        {(item.quantity * item.unit_price).toLocaleString('tr-TR')} ₺
      </span>
      <Button size="icon" variant="ghost" className="text-destructive shrink-0" onClick={() =>
        type === 'service'
          ? setServiceItems(prev => prev.filter((_, i) => i !== idx))
          : setProductItems(prev => prev.filter((_, i) => i !== idx))
      }>
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {step === 1 ? 'Yeni Müşteri' : `Satış — ${form.name}`}
            </DialogTitle>
            <DialogDescription>
              {step === 1 ? 'Müşteri bilgilerini girin, ardından satış yapın' : 'Hizmet ve ürün satışı yapın'}
            </DialogDescription>
          </DialogHeader>

          {step === 1 && (
            <div className="space-y-4 py-2">
              <div className="space-y-2"><Label className="text-xs font-semibold">Ad Soyad *</Label><Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Ad Soyad" className="h-10" /></div>
              <div className="space-y-2"><Label className="text-xs font-semibold">Telefon *</Label><Input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="0500 000 0000" type="tel" className="h-10" /></div>
              <div className="space-y-2"><Label className="text-xs font-semibold">2. Telefon <span className="text-muted-foreground font-normal">(Opsiyonel)</span></Label><Input value={form.secondary_phone} onChange={e => set('secondary_phone', e.target.value)} placeholder="0500 000 0000" type="tel" className="h-10" /></div>
              <div className="space-y-2"><Label className="text-xs font-semibold">TC Kimlik No <span className="text-muted-foreground font-normal">(Opsiyonel)</span></Label><Input value={form.tc_kimlik_no} onChange={e => set('tc_kimlik_no', e.target.value)} placeholder="11 haneli TC Kimlik No" maxLength={11} className="h-10" /></div>
              <div className="space-y-2"><Label className="text-xs font-semibold">Adres <span className="text-muted-foreground font-normal">(Opsiyonel)</span></Label><Textarea value={form.address} onChange={e => set('address', e.target.value)} placeholder="Müşteri adresi..." rows={2} /></div>
              <div className="space-y-2"><Label className="text-xs font-semibold">Doğum Tarihi <span className="text-muted-foreground font-normal">(Opsiyonel)</span></Label><Input type="date" value={form.birth_date} onChange={e => set('birth_date', e.target.value)} className="h-10" /></div>
              <div className="space-y-2"><Label className="text-xs font-semibold">Notlar <span className="text-muted-foreground font-normal">(Opsiyonel)</span></Label><Textarea value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Müşteri notları..." rows={2} /></div>
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
          )}

          {step === 2 && (
            <div className="space-y-3">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="services" className="gap-1">
                    <Scissors className="h-3.5 w-3.5" /> Hizmetler
                    {serviceItems.length > 0 && <Badge variant="secondary" className="ml-1 text-[10px]">{serviceItems.length}</Badge>}
                  </TabsTrigger>
                  <TabsTrigger value="products" className="gap-1">
                    <Package className="h-3.5 w-3.5" /> Ürünler
                    {productItems.length > 0 && <Badge variant="secondary" className="ml-1 text-[10px]">{productItems.length}</Badge>}
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="services" className="space-y-3 mt-3">
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">Kategori</Label>
                    <Select value={selectedCategoryId} onValueChange={v => { setSelectedCategoryId(v); setSelectedServiceId(''); }}>
                      <SelectTrigger className="w-full"><SelectValue placeholder="Kategori seçin" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Tüm Kategoriler</SelectItem>
                        {categories.map((c: any) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex gap-2">
                    <Select value={selectedServiceId} onValueChange={setSelectedServiceId}>
                      <SelectTrigger className="flex-1"><SelectValue placeholder={selectedCategoryId ? "Hizmet seçin" : "Önce kategori seçin"} /></SelectTrigger>
                      <SelectContent>
                        {filteredServices.map((s: any) => (
                          <SelectItem key={s.id} value={s.id}>{s.name} - {Number(s.price).toLocaleString('tr-TR')} ₺</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button size="icon" onClick={addService} disabled={!selectedServiceId}><Plus className="h-4 w-4" /></Button>
                  </div>
                  {serviceItems.length > 0 && (
                    <div className="border rounded-lg divide-y">
                      {serviceItems.map((item, idx) => renderItemRow(item, idx, 'service'))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="products" className="space-y-3 mt-3">
                  <div className="flex gap-2">
                    <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                      <SelectTrigger className="flex-1"><SelectValue placeholder="Ürün seçin" /></SelectTrigger>
                      <SelectContent>
                        {products.map((p: any) => (
                          <SelectItem key={p.id} value={p.id}>{p.name} (Stok: {p.current_stock}) - {Number(p.sale_price).toLocaleString('tr-TR')} ₺</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button size="icon" onClick={addProduct} disabled={!selectedProductId}><Plus className="h-4 w-4" /></Button>
                  </div>
                  {productItems.length > 0 && (
                    <div className="border rounded-lg divide-y">
                      {productItems.map((item, idx) => renderItemRow(item, idx, 'product'))}
                    </div>
                  )}
                </TabsContent>
              </Tabs>

              {/* Discount */}
              {subtotal > 0 && (
                <div className="space-y-2 border rounded-lg p-3 bg-muted/30">
                  <Label className="text-xs font-semibold flex items-center gap-1"><Percent className="h-3.5 w-3.5" /> İndirim</Label>
                  <div className="flex items-center gap-2">
                    <Select value={discountType} onValueChange={(v) => { setDiscountType(v as any); setDiscountValue(''); }}>
                      <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">İndirim Yok</SelectItem>
                        <SelectItem value="amount">Tutar (₺)</SelectItem>
                        <SelectItem value="percent">Yüzde (%)</SelectItem>
                      </SelectContent>
                    </Select>
                    {discountType !== 'none' && (
                      <div className="flex items-center gap-1 flex-1">
                        <Input type="number" min={0} max={discountType === 'percent' ? 100 : subtotal} step={discountType === 'percent' ? 1 : 0.01} value={discountValue} onChange={e => setDiscountValue(e.target.value)} placeholder={discountType === 'percent' ? '% oran' : '₺ tutar'} className="h-9" />
                        <span className="text-sm text-muted-foreground shrink-0">{discountType === 'percent' ? '%' : '₺'}</span>
                      </div>
                    )}
                  </div>
                  {discountAmount > 0 && <p className="text-xs text-primary font-medium">İndirim: -{discountAmount.toLocaleString('tr-TR')} ₺</p>}
                </div>
              )}

              {/* Auto customer type indicator */}
              {serviceItems.length > 0 && (
                <div className="text-xs text-muted-foreground bg-muted/40 rounded-lg p-2">
                  Müşteri türü: <span className="font-semibold text-foreground">{totalServiceSessions > 1 ? 'Paket Müşteri' : 'Tek Seans Müşteri'}</span>
                  <span className="ml-1">(toplam {totalServiceSessions} seans)</span>
                </div>
              )}

              {/* Date & Payment */}
              <div className="space-y-3 border-t pt-3">
                <div className="space-y-1">
                  <Label className="text-xs">Satış Tarihi</Label>
                  <Input type="date" value={saleDate} onChange={e => setSaleDate(e.target.value)} className="h-9 w-44" />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-xs">Ödeme Yöntemi</Label>
                    <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                      <SelectTrigger className="w-44 mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Nakit</SelectItem>
                        <SelectItem value="credit_card">Kredi Kartı</SelectItem>
                        <SelectItem value="eft">EFT / Havale</SelectItem>
                        <SelectItem value="installment">
                          <span className="flex items-center gap-1.5"><CreditCard className="h-3.5 w-3.5" /> Taksitli Ödeme</span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="text-right space-y-0.5">
                    {serviceTotal > 0 && <p className="text-xs text-muted-foreground">Hizmet: {serviceTotal.toLocaleString('tr-TR')} ₺</p>}
                    {productTotal > 0 && <p className="text-xs text-muted-foreground">Ürün: {productTotal.toLocaleString('tr-TR')} ₺</p>}
                    {discountAmount > 0 && <p className="text-xs text-destructive">İndirim: -{discountAmount.toLocaleString('tr-TR')} ₺</p>}
                    <p className="text-lg font-bold">{grandTotal.toLocaleString('tr-TR')} ₺</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            {step === 1 && (
              <>
                <Button variant="outline" onClick={() => handleClose(false)}>İptal</Button>
                <Button onClick={goToSale} className="btn-gradient gap-1">
                  Satışa Geç <ArrowRight className="h-4 w-4" />
                </Button>
              </>
            )}
            {step === 2 && (
              <>
                <Button variant="outline" onClick={() => setStep(1)} className="gap-1">
                  <ArrowLeft className="h-4 w-4" /> Geri
                </Button>
                <Button onClick={handleSave} disabled={saving || (serviceItems.length === 0 && productItems.length === 0)}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                  {paymentMethod === 'installment' ? 'Taksitlendir' : 'Satışı Tamamla'}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {createdCustomerId && (
        <InstallmentPlanDialog
          open={installmentDialogOpen}
          onOpenChange={handleInstallmentDialogOpenChange}
          customerId={createdCustomerId}
          customerName={form.name}
          totalAmount={pendingSaleTotal}
          onComplete={handleInstallmentComplete}
          saleDescription={[
            ...serviceItems.map(i => `${i.name} x${i.quantity}`),
            ...productItems.map(i => `${i.name} x${i.quantity}`),
          ].join(', ')}
        />
      )}
    </>
  );
}
