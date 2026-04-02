import { useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useBranch } from '@/contexts/BranchContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, Trash2, AlertTriangle, ShoppingCart } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

type SaleItem = {
  product_id: string;
  name: string;
  quantity: number;
  unit_price: number;
  current_stock: number;
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  paymentMethod?: string;
  customerId?: string;
  customerName?: string;
}

export function ProductSaleDialog({ open, onOpenChange, paymentMethod = 'cash', customerId, customerName }: Props) {
  const { user, currentSalonId } = useAuth();
  const { requireBranchForAction } = useBranch();
  const qc = useQueryClient();
  const salonId = currentSalonId;

  const [items, setItems] = useState<SaleItem[]>([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [saving, setSaving] = useState(false);
  const [method, setMethod] = useState(paymentMethod);
  const [selectedCustomerId, setSelectedCustomerId] = useState(customerId || '');

  const { data: customers = [] } = useQuery({
    queryKey: ['customers_for_sale', salonId],
    queryFn: async () => {
      if (!salonId) return [];
      const { data } = await supabase.from('customers').select('id, name, phone').eq('salon_id', salonId).order('name');
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

  const addItem = () => {
    const prod = products.find((p: any) => p.id === selectedProductId);
    if (!prod) return;
    if (items.find(i => i.product_id === prod.id)) {
      toast.error('Bu ürün zaten eklendi');
      return;
    }
    setItems(prev => [...prev, {
      product_id: prod.id, name: prod.name,
      quantity: 1, unit_price: prod.sale_price,
      current_stock: prod.current_stock,
    }]);
    setSelectedProductId('');
  };

  const updateItem = (idx: number, field: keyof SaleItem, value: number) => {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  };

  const removeItem = (idx: number) => {
    setItems(prev => prev.filter((_, i) => i !== idx));
  };

  const total = useMemo(() => items.reduce((s, i) => s + i.quantity * i.unit_price, 0), [items]);

  const handleSave = async () => {
    if (!salonId || !user || items.length === 0) return;
    if (!requireBranchForAction()) return;
    setSaving(true);
    try {
      for (const item of items) {
        // Insert sale record
        const { error: saleErr } = await supabase.from('product_sales').insert({
          salon_id: salonId,
          product_id: item.product_id,
          customer_id: (selectedCustomerId && selectedCustomerId !== 'none') ? selectedCustomerId : null,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: item.quantity * item.unit_price,
          payment_method: method,
          sold_by: user.id,
        });
        if (saleErr) throw saleErr;

        // Create stock movement (out)
        const { error: moveErr } = await supabase.from('stock_movements').insert({
          product_id: item.product_id, salon_id: salonId,
          quantity: item.quantity, type: 'out',
          description: 'Satış', created_by: user.id,
        });
        if (moveErr) throw moveErr;

        // Update product stock
        const newStock = Math.max(0, item.current_stock - item.quantity);
        const { error: upErr } = await supabase.from('products')
          .update({ current_stock: newStock })
          .eq('id', item.product_id);
        if (upErr) throw upErr;

        if (newStock === 0) {
          toast.warning(`${item.name} stokta kalmadı!`);
        }
      }

      // Add to cash_transactions as income
      const { error: cashErr } = await supabase.from('cash_transactions').insert({
        salon_id: salonId,
        type: 'income',
        amount: total,
        description: `Ürün satışı: ${items.map(i => `${i.name} x${i.quantity}`).join(', ')}`,
        payment_method: method,
        created_by: user.id,
      });
      if (cashErr) throw cashErr;

      qc.invalidateQueries({ queryKey: ['products', salonId] });
      qc.invalidateQueries({ queryKey: ['cash_transactions'] });
      qc.invalidateQueries({ queryKey: ['product_sales'] });
      toast.success('Satış tamamlandı');
      setItems([]);
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || 'Satış kaydedilemedi');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ShoppingCart className="h-5 w-5" /> Ürün Satışı</DialogTitle>
          <DialogDescription>Satılacak ürünleri seçin</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {!customerId && (
            <div>
              <Label className="text-xs">Müşteri (Opsiyonel)</Label>
              <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Müşteri seçin (opsiyonel)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Kayıtsız Satış</SelectItem>
                  {customers.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.name} {c.phone ? `(${c.phone})` : ''}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
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
            <Button size="icon" onClick={addItem} disabled={!selectedProductId}><Plus className="h-4 w-4" /></Button>
          </div>

          {items.length > 0 && (
            <div className="border rounded-lg divide-y">
              {items.map((item, idx) => (
                <div key={item.product_id} className="p-2 flex items-center gap-2">
                  <div className="flex-1">
                    <span className="text-sm font-medium">{item.name}</span>
                    {item.quantity > item.current_stock && (
                      <div className="flex items-center gap-1 text-xs text-destructive">
                        <AlertTriangle className="h-3 w-3" /> Stok yetersiz (stok: {item.current_stock})
                      </div>
                    )}
                  </div>
                  <Input type="number" min={1} value={item.quantity}
                    onChange={e => updateItem(idx, 'quantity', Number(e.target.value) || 1)}
                    className="w-16 text-center" />
                  <Input type="number" value={item.unit_price}
                    onChange={e => updateItem(idx, 'unit_price', Number(e.target.value) || 0)}
                    className="w-24 text-right" />
                  <span className="text-sm font-medium w-20 text-right">
                    {(item.quantity * item.unit_price).toLocaleString('tr-TR')} ₺
                  </span>
                  <Button size="icon" variant="ghost" className="text-destructive" onClick={() => removeItem(idx)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between">
            <div>
              <Label>Ödeme Yöntemi</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Nakit</SelectItem>
                  <SelectItem value="credit_card">Kredi Kartı</SelectItem>
                  <SelectItem value="eft">EFT / Havale</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Toplam</p>
              <p className="text-xl font-bold">{total.toLocaleString('tr-TR')} ₺</p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>İptal</Button>
          <Button onClick={handleSave} disabled={saving || items.length === 0}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            Satışı Tamamla
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
