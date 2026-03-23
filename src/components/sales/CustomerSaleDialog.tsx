import { useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Plus, Trash2, ShoppingCart, Scissors, Package, FileText, CalendarPlus, AlertTriangle } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useFormGuard } from '@/hooks/useFormGuard';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
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

export function CustomerSaleDialog({ open, onOpenChange, customerId, customerName }: Props) {
  const { user, currentSalonId } = useAuth();
  const qc = useQueryClient();
  const salonId = currentSalonId;

  const [activeTab, setActiveTab] = useState('services');
  const [serviceItems, setServiceItems] = useState<ServiceItem[]>([]);
  const [productItems, setProductItems] = useState<ProductItem[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [saving, setSaving] = useState(false);

  useFormGuard(open);

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
  const grandTotal = serviceTotal + productTotal;

  const handleSave = async () => {
    if (!salonId || !user || (serviceItems.length === 0 && productItems.length === 0)) return;
    setSaving(true);
    try {
      // Service sales
      for (const item of serviceItems) {
        const { error } = await supabase.from('service_sales').insert({
          salon_id: salonId,
          customer_id: customerId || null,
          service_id: item.service_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: item.quantity * item.unit_price,
          payment_method: paymentMethod,
          sold_by: user.id,
        });
        if (error) throw error;
      }

      // Product sales
      for (const item of productItems) {
        const { error: saleErr } = await supabase.from('product_sales').insert({
          salon_id: salonId,
          product_id: item.product_id,
          customer_id: customerId || null,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: item.quantity * item.unit_price,
          payment_method: paymentMethod,
          sold_by: user.id,
        });
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

      // Cash transaction - service sales
      if (serviceTotal > 0) {
        const { error: cashErr } = await supabase.from('cash_transactions').insert({
          salon_id: salonId,
          type: 'income',
          amount: serviceTotal,
          description: `Hizmet satışı${customerName ? ` - ${customerName}` : ''}: ${serviceItems.map(i => `${i.name} x${i.quantity}`).join(', ')}`,
          payment_method: paymentMethod,
          created_by: user.id,
        });
        if (cashErr) throw cashErr;
      }

      // Cash transaction - product sales
      if (productTotal > 0) {
        const { error: cashErr } = await supabase.from('cash_transactions').insert({
          salon_id: salonId,
          type: 'income',
          amount: productTotal,
          description: `Ürün satışı${customerName ? ` - ${customerName}` : ''}: ${productItems.map(i => `${i.name} x${i.quantity}`).join(', ')}`,
          payment_method: paymentMethod,
          created_by: user.id,
        });
        if (cashErr) throw cashErr;
      }

      qc.invalidateQueries({ queryKey: ['products', salonId] });
      qc.invalidateQueries({ queryKey: ['services', salonId] });
      qc.invalidateQueries({ queryKey: ['cash_transactions'] });
      qc.invalidateQueries({ queryKey: ['product_sales'] });
      qc.invalidateQueries({ queryKey: ['service_sales'] });
      toast.success('Satış tamamlandı');
      setServiceItems([]);
      setProductItems([]);
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || 'Satış kaydedilemedi');
    } finally {
      setSaving(false);
    }
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
            <div className="flex gap-2">
              <Select value={selectedServiceId} onValueChange={setSelectedServiceId}>
                <SelectTrigger className="flex-1"><SelectValue placeholder="Hizmet seçin" /></SelectTrigger>
                <SelectContent>
                  {services.map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} - {s.price.toLocaleString('tr-TR')} ₺
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
                      {p.name} (Stok: {p.current_stock}) - {p.sale_price.toLocaleString('tr-TR')} ₺
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

        {/* Payment & Totals */}
        <div className="space-y-3 border-t pt-3">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-xs">Ödeme Yöntemi</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger className="w-40 mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Nakit</SelectItem>
                  <SelectItem value="credit_card">Kredi Kartı</SelectItem>
                  <SelectItem value="eft">EFT / Havale</SelectItem>
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
              <p className="text-lg font-bold">{grandTotal.toLocaleString('tr-TR')} ₺</p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>İptal</Button>
          <Button onClick={handleSave} disabled={saving || (serviceItems.length === 0 && productItems.length === 0)}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            Satışı Tamamla
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
