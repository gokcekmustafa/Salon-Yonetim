import { useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuditLog } from '@/hooks/useAuditLog';
import { useAuth } from '@/contexts/AuthContext';
import { useBranch } from '@/contexts/BranchContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, Trash2, ShoppingCart, Scissors, Package, AlertTriangle, CreditCard, Percent } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useFormGuard } from '@/hooks/useFormGuard';
import { InstallmentPlanDialog } from './InstallmentPlanDialog';
import { format } from 'date-fns';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaleCompleted?: (payload: { customerId?: string; serviceIds: string[] }) => void;
  customerId?: string;
  customerName?: string;
}

type ServiceItem = {
  service_id: string;
  name: string;
  quantity: number;
  unit_price: number;
};

type ProductItem = {
  product_id: string;
  name: string;
  quantity: number;
  unit_price: number;
  current_stock: number;
};

export function CustomerSaleDialog({ open, onOpenChange, onSaleCompleted, customerId, customerName }: Props) {
  const { user, currentSalonId } = useAuth();
  const { requireBranchForAction } = useBranch();
  const qc = useQueryClient();
  const { logAction } = useAuditLog();
  const salonId = currentSalonId;

  const [activeTab, setActiveTab] = useState('services');
  const [serviceItems, setServiceItems] = useState<ServiceItem[]>([]);
  const [productItems, setProductItems] = useState<ProductItem[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [saving, setSaving] = useState(false);
  const [installmentDialogOpen, setInstallmentDialogOpen] = useState(false);
  const [pendingSaleTotal, setPendingSaleTotal] = useState(0);
  const [saleDate, setSaleDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  // Discount state
  const [discountType, setDiscountType] = useState<'none' | 'amount' | 'percent'>('none');
  const [discountValue, setDiscountValue] = useState('');

  useFormGuard(open);

  const { data: categories = [] } = useQuery({
    queryKey: ['service_categories', salonId],
    queryFn: async () => {
      if (!salonId) return [];
      const { data } = await supabase.from('service_categories').select('*').eq('salon_id', salonId).order('sort_order');
      return data || [];
    },
    enabled: !!salonId && open,
  });

  const { data: services = [] } = useQuery({
    queryKey: ['services', salonId],
    queryFn: async () => {
      if (!salonId) return [];
      const { data } = await supabase.from('services').select('*').eq('salon_id', salonId).eq('is_active', true).order('name');
      return data || [];
    },
    enabled: !!salonId && open,
  });

  const { data: products = [] } = useQuery({
    queryKey: ['products', salonId],
    queryFn: async () => {
      if (!salonId) return [];
      const { data } = await supabase.from('products').select('*').eq('salon_id', salonId).eq('is_active', true).order('name');
      return data || [];
    },
    enabled: !!salonId && open,
  });

  // Filter services by selected category
  const filteredServices = useMemo(() => {
    if (!selectedCategoryId) return services;
    return services.filter((s: any) => s.category_id === selectedCategoryId);
  }, [services, selectedCategoryId]);

  // Reset service selection when category changes
  const handleCategoryChange = (catId: string) => {
    setSelectedCategoryId(catId);
    setSelectedServiceId('');
  };

  const addService = () => {
    const svc = services.find((s: any) => s.id === selectedServiceId);
    if (!svc) return;
    if (serviceItems.find(i => i.service_id === svc.id)) {
      toast.error('Bu hizmet zaten eklendi');
      return;
    }
    setServiceItems(prev => [...prev, {
      service_id: svc.id, name: svc.name,
      quantity: 1, unit_price: svc.price,
    }]);
    setSelectedServiceId('');
  };

  const addProduct = () => {
    const prod = products.find((p: any) => p.id === selectedProductId);
    if (!prod) return;
    if (productItems.find(i => i.product_id === prod.id)) {
      toast.error('Bu ürün zaten eklendi');
      return;
    }
    setProductItems(prev => [...prev, {
      product_id: prod.id, name: prod.name,
      quantity: 1, unit_price: prod.sale_price,
      current_stock: prod.current_stock,
    }]);
    setSelectedProductId('');
  };

  const updateServiceItem = (idx: number, field: keyof ServiceItem, value: number) => {
    setServiceItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  };

  const updateProductItem = (idx: number, field: keyof ProductItem, value: number) => {
    setProductItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  };

  const serviceTotal = useMemo(() => serviceItems.reduce((s, i) => s + i.quantity * i.unit_price, 0), [serviceItems]);
  const productTotal = useMemo(() => productItems.reduce((s, i) => s + i.quantity * i.unit_price, 0), [productItems]);
  const subtotal = serviceTotal + productTotal;

  // Calculate discount
  const discountAmount = useMemo(() => {
    const val = parseFloat(discountValue) || 0;
    if (discountType === 'amount') return Math.min(val, subtotal);
    if (discountType === 'percent') return Math.min(Math.round(subtotal * val / 100 * 100) / 100, subtotal);
    return 0;
  }, [discountType, discountValue, subtotal]);

  const grandTotal = Math.max(0, subtotal - discountAmount);

  const handleSave = async () => {
    if (!salonId || !user || (serviceItems.length === 0 && productItems.length === 0)) return;
    if (!requireBranchForAction()) return;

    if (paymentMethod === 'installment') {
      if (!customerId) {
        toast.error('Taksitli ödeme için müşteri seçilmelidir');
        return;
      }
      setPendingSaleTotal(grandTotal);
      setInstallmentDialogOpen(true);
      return;
    }

    await processSale(paymentMethod);
  };

  const processSale = async (method: string) => {
    if (!salonId || !user) return;
    setSaving(true);
    try {
      const soldServiceIds = [...new Set(serviceItems.map(item => item.service_id))];
      const saleTimestamp = new Date(saleDate + 'T12:00:00').toISOString();

      // Calculate per-item discount ratio
      const discountRatio = subtotal > 0 ? discountAmount / subtotal : 0;

      // Service sales
      for (const item of serviceItems) {
        const itemTotal = item.quantity * item.unit_price;
        const itemDiscount = Math.round(itemTotal * discountRatio * 100) / 100;
        const finalPrice = itemTotal - itemDiscount;

        const { error } = await supabase.from('service_sales').insert({
          salon_id: salonId,
          customer_id: customerId || null,
          service_id: item.service_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: finalPrice,
          payment_method: method === 'installment' ? 'installment' : method,
          sold_by: user.id,
          created_at: saleTimestamp,
        } as any);
        if (error) throw error;
      }

      // Product sales
      for (const item of productItems) {
        const itemTotal = item.quantity * item.unit_price;
        const itemDiscount = Math.round(itemTotal * discountRatio * 100) / 100;
        const finalPrice = itemTotal - itemDiscount;

        const { error: saleErr } = await supabase.from('product_sales').insert({
          salon_id: salonId,
          product_id: item.product_id,
          customer_id: customerId || null,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: finalPrice,
          payment_method: method === 'installment' ? 'installment' : method,
          sold_by: user.id,
          created_at: saleTimestamp,
        } as any);
        if (saleErr) throw saleErr;

        const { error: moveErr } = await supabase.from('stock_movements').insert({
          product_id: item.product_id, salon_id: salonId,
          quantity: item.quantity, type: 'out',
          description: `Satış${customerName ? ` - ${customerName}` : ''}`, created_by: user.id,
        });
        if (moveErr) throw moveErr;

        const newStock = Math.max(0, item.current_stock - item.quantity);
        const { error: upErr } = await supabase.from('products')
          .update({ current_stock: newStock })
          .eq('id', item.product_id);
        if (upErr) throw upErr;

        if (newStock === 0) toast.warning(`${item.name} stokta kalmadı!`);
      }

      // Cash transactions (only for non-installment)
      if (method !== 'installment') {
        const svcFinal = serviceTotal > 0 ? Math.round((serviceTotal - serviceTotal * discountRatio) * 100) / 100 : 0;
        const prdFinal = productTotal > 0 ? Math.round((productTotal - productTotal * discountRatio) * 100) / 100 : 0;

        if (svcFinal > 0) {
          const discountNote = discountAmount > 0 ? ` (İndirim: ${discountAmount.toLocaleString('tr-TR')} ₺)` : '';
          const { error: cashErr } = await supabase.from('cash_transactions').insert({
            salon_id: salonId,
            type: 'income',
            amount: svcFinal,
            description: `Hizmet satışı${customerName ? ` - ${customerName}` : ''}: ${serviceItems.map(i => `${i.name} x${i.quantity}`).join(', ')}${discountNote}`,
            payment_method: method,
            created_by: user.id,
            transaction_date: saleTimestamp,
          } as any);
          if (cashErr) throw cashErr;
        }

        if (prdFinal > 0) {
          const { error: cashErr } = await supabase.from('cash_transactions').insert({
            salon_id: salonId,
            type: 'income',
            amount: prdFinal,
            description: `Ürün satışı${customerName ? ` - ${customerName}` : ''}: ${productItems.map(i => `${i.name} x${i.quantity}`).join(', ')}`,
            payment_method: method,
            created_by: user.id,
            transaction_date: saleTimestamp,
          } as any);
          if (cashErr) throw cashErr;
        }
      }

      // Create session credits for service sales
      if (customerId) {
        for (const item of serviceItems) {
          await supabase.from('customer_session_credits').insert({
            salon_id: salonId,
            customer_id: customerId,
            service_id: item.service_id,
            total_sessions: item.quantity,
            used_sessions: 0,
            remaining_sessions: item.quantity,
          } as any);
        }
      }

      qc.invalidateQueries({ queryKey: ['products', salonId] });
      qc.invalidateQueries({ queryKey: ['services', salonId] });
      qc.invalidateQueries({ queryKey: ['cash_transactions'] });
      qc.invalidateQueries({ queryKey: ['product_sales'] });
      qc.invalidateQueries({ queryKey: ['service_sales'] });
      qc.invalidateQueries({ queryKey: ['session_credits'] });
      logAction({ action: 'create', target_type: 'sale', target_label: customerName || '', details: { services: serviceItems.length, products: productItems.length, total: grandTotal, method } });
      toast.success('Satış tamamlandı');
      setServiceItems([]);
      setProductItems([]);
      setSelectedServiceId('');
      setSelectedCategoryId('');
      setSelectedProductId('');
      setDiscountType('none');
      setDiscountValue('');
      onOpenChange(false);
      if (customerId && soldServiceIds.length > 0) {
        onSaleCompleted?.({ customerId, serviceIds: soldServiceIds });
      }
    } catch (e: any) {
      toast.error(e.message || 'Satış kaydedilemedi');
    } finally {
      setSaving(false);
    }
  };

  const handleInstallmentComplete = async () => {
    await processSale('installment');
    setInstallmentDialogOpen(false);
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
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              {customerName ? `Satış — ${customerName}` : 'Satış'}
            </DialogTitle>
            <DialogDescription>Hizmet ve ürün satışı yapın</DialogDescription>
          </DialogHeader>

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
              {/* Category selection */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Kategori</Label>
                <Select value={selectedCategoryId} onValueChange={handleCategoryChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Kategori seçin" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tüm Kategoriler</SelectItem>
                    {categories.map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Service selection */}
              <div className="flex gap-2">
                <Select value={selectedServiceId} onValueChange={setSelectedServiceId}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder={selectedCategoryId ? "Hizmet seçin" : "Önce kategori seçin"} />
                  </SelectTrigger>
                  <SelectContent>
                    {(selectedCategoryId === 'all' ? services : filteredServices).map((s: any) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name} - {Number(s.price).toLocaleString('tr-TR')} ₺
                      </SelectItem>
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
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} (Stok: {p.current_stock}) - {Number(p.sale_price).toLocaleString('tr-TR')} ₺
                      </SelectItem>
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

          {/* Discount Section */}
          {subtotal > 0 && (
            <div className="space-y-2 border rounded-lg p-3 bg-muted/30">
              <Label className="text-xs font-semibold flex items-center gap-1">
                <Percent className="h-3.5 w-3.5" /> İndirim
              </Label>
              <div className="flex items-center gap-2">
                <Select value={discountType} onValueChange={(v) => { setDiscountType(v as any); setDiscountValue(''); }}>
                  <SelectTrigger className="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">İndirim Yok</SelectItem>
                    <SelectItem value="amount">Tutar (₺)</SelectItem>
                    <SelectItem value="percent">Yüzde (%)</SelectItem>
                  </SelectContent>
                </Select>
                {discountType !== 'none' && (
                  <div className="flex items-center gap-1 flex-1">
                    <Input
                      type="number"
                      min={0}
                      max={discountType === 'percent' ? 100 : subtotal}
                      step={discountType === 'percent' ? 1 : 0.01}
                      value={discountValue}
                      onChange={e => setDiscountValue(e.target.value)}
                      placeholder={discountType === 'percent' ? '% oran' : '₺ tutar'}
                      className="h-9"
                    />
                    <span className="text-sm text-muted-foreground shrink-0">
                      {discountType === 'percent' ? '%' : '₺'}
                    </span>
                  </div>
                )}
              </div>
              {discountAmount > 0 && (
                <p className="text-xs text-primary font-medium">
                  İndirim: -{discountAmount.toLocaleString('tr-TR')} ₺
                </p>
              )}
            </div>
          )}

          {/* Sale Date & Payment */}
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
                      <span className="flex items-center gap-1.5">
                        <CreditCard className="h-3.5 w-3.5" /> Taksitli Ödeme
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="text-right space-y-0.5">
                {serviceTotal > 0 && (
                  <p className="text-xs text-muted-foreground">Hizmet: {serviceTotal.toLocaleString('tr-TR')} ₺</p>
                )}
                {productTotal > 0 && (
                  <p className="text-xs text-muted-foreground">Ürün: {productTotal.toLocaleString('tr-TR')} ₺</p>
                )}
                {discountAmount > 0 && (
                  <p className="text-xs text-destructive">İndirim: -{discountAmount.toLocaleString('tr-TR')} ₺</p>
                )}
                <p className="text-lg font-bold">{grandTotal.toLocaleString('tr-TR')} ₺</p>
              </div>
            </div>
            {paymentMethod === 'installment' && !customerId && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> Taksitli ödeme için müşteri seçilmelidir
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>İptal</Button>
            <Button onClick={handleSave} disabled={saving || (serviceItems.length === 0 && productItems.length === 0)}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              {paymentMethod === 'installment' ? 'Taksitlendir' : 'Satışı Tamamla'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {customerId && (
        <InstallmentPlanDialog
          open={installmentDialogOpen}
          onOpenChange={setInstallmentDialogOpen}
          customerId={customerId}
          customerName={customerName || ''}
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
