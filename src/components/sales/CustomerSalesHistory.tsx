import { useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useAuditLog } from '@/hooks/useAuditLog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, History, ShoppingCart, Scissors, Package, Trash2, Pencil, AlertTriangle, CalendarX } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string;
  customerName: string;
}

export function CustomerSalesHistory({ open, onOpenChange, customerId, customerName }: Props) {
  const { user, currentSalonId } = useAuth();
  const { logAction } = useAuditLog();
  const qc = useQueryClient();
  const [deleting, setDeleting] = useState<string | null>(null);
  const [editingSale, setEditingSale] = useState<any>(null);
  const [editType, setEditType] = useState<'service' | 'product'>('service');
  const [editQuantity, setEditQuantity] = useState('1');
  const [editUnitPrice, setEditUnitPrice] = useState('0');
  const [editSaving, setEditSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ sale: any; type: 'service' | 'product'; linkedAppointments: any[] } | null>(null);

  const { data: serviceSales = [], isLoading: loadingServices } = useQuery({
    queryKey: ['service_sales', currentSalonId, customerId],
    queryFn: async () => {
      const { data } = await supabase
        .from('service_sales')
        .select('*, services(name)')
        .eq('salon_id', currentSalonId!)
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!currentSalonId && !!customerId && open,
  });

  const { data: productSales = [], isLoading: loadingProducts } = useQuery({
    queryKey: ['product_sales', currentSalonId, customerId],
    queryFn: async () => {
      const { data } = await supabase
        .from('product_sales')
        .select('*, products(name)')
        .eq('salon_id', currentSalonId!)
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!currentSalonId && !!customerId && open,
  });

  const totalSpent = useMemo(() => {
    const sTotal = serviceSales.reduce((s: number, i: any) => s + Number(i.total_price), 0);
    const pTotal = productSales.reduce((s: number, i: any) => s + Number(i.total_price), 0);
    return sTotal + pTotal;
  }, [serviceSales, productSales]);

  const loading = loadingServices || loadingProducts;

  const paymentLabel = (m: string) => {
    if (m === 'cash') return 'Nakit';
    if (m === 'credit_card') return 'K.Kartı';
    if (m === 'eft') return 'EFT';
    if (m === 'installment') return 'Taksit';
    return m;
  };

  const invalidateAllSaleQueries = () => {
    qc.invalidateQueries({ queryKey: ['service_sales'] });
    qc.invalidateQueries({ queryKey: ['product_sales'] });
    qc.invalidateQueries({ queryKey: ['products'] });
    qc.invalidateQueries({ queryKey: ['cash_transactions'] });
    qc.invalidateQueries({ queryKey: ['installments'] });
    qc.invalidateQueries({ queryKey: ['installment_payments'] });
    qc.invalidateQueries({ queryKey: ['customers'] });
  };

  const deleteCashTransaction = async (description: string) => {
    if (!currentSalonId) return;
    // Find and delete matching cash transaction by description
    const { data: cashRows } = await supabase
      .from('cash_transactions')
      .select('id')
      .eq('salon_id', currentSalonId)
      .ilike('description', `%${description}%`);
    if (cashRows && cashRows.length > 0) {
      for (const row of cashRows) {
        await supabase.from('cash_transactions').delete().eq('id', row.id);
      }
    }
  };

  const prepareDeleteServiceSale = async (sale: any) => {
    // Find linked appointments for this customer + service
    const { data: linkedAppts } = await supabase
      .from('appointments')
      .select('id, start_time, status, staff:staff(name), rooms:room_id(name)')
      .eq('salon_id', currentSalonId!)
      .eq('customer_id', customerId)
      .eq('service_id', sale.service_id);
    setDeleteConfirm({ sale, type: 'service', linkedAppointments: linkedAppts || [] });
  };

  const executeDeleteServiceSale = async () => {
    if (!deleteConfirm || deleteConfirm.type !== 'service') return;
    const sale = deleteConfirm.sale;
    const linkedAppts = deleteConfirm.linkedAppointments;
    setDeleteConfirm(null);
    setDeleting(sale.id);
    try {
      // Delete linked appointments and their payments
      if (linkedAppts.length > 0) {
        const apptIds = linkedAppts.map((a: any) => a.id);
        // Delete payments linked to these appointments
        for (const apptId of apptIds) {
          await supabase.from('payments').delete().eq('appointment_id', apptId).eq('salon_id', currentSalonId!);
        }
        // Delete the appointments
        for (const apptId of apptIds) {
          await supabase.from('appointments').delete().eq('id', apptId);
        }
      }

      // Delete related installments if payment_method is installment
      if (sale.payment_method === 'installment') {
        const { data: instData } = await supabase
          .from('installments')
          .select('id')
          .eq('salon_id', currentSalonId!)
          .eq('customer_id', customerId);
        if (instData) {
          for (const inst of instData) {
            await supabase.from('installment_payments').delete().eq('installment_id', inst.id);
          }
          await supabase.from('installments').delete().eq('salon_id', currentSalonId!).eq('customer_id', customerId);
        }
      }

      // Delete related cash transaction
      const serviceName = sale.services?.name || '';
      if (serviceName) {
        await deleteCashTransaction(serviceName);
      }

      // Delete linked session credits (even if used)
      await supabase.from('customer_session_credits').delete().eq('service_sale_id', sale.id);

      const { error } = await supabase.from('service_sales').delete().eq('id', sale.id);
      if (error) throw error;
      invalidateAllSaleQueries();
      qc.invalidateQueries({ queryKey: ['session_credits'] });
      qc.invalidateQueries({ queryKey: ['appointments'] });
      logAction({ action: 'delete', target_type: 'service_sale', target_id: sale.id, target_label: `${customerName} - ${serviceName}` });
      toast.success(`Satış${linkedAppts.length > 0 ? `, ${linkedAppts.length} randevu` : ''} ve seans hakları silindi`);
    } catch (e: any) {
      toast.error(e.message || 'Satış silinemedi');
    } finally {
      setDeleting(null);
    }
  };

  const handleDeleteProductSale = async (sale: any) => {
    if (!confirm('Bu satışı silmek istediğinize emin misiniz?')) return;
    setDeleting(sale.id);
    try {
      // Restore stock
      if (sale.product_id) {
        const { data: prod } = await supabase.from('products').select('current_stock').eq('id', sale.product_id).single();
        if (prod) {
          await supabase.from('products').update({ current_stock: prod.current_stock + sale.quantity }).eq('id', sale.product_id);
        }
      }

      // Delete related cash transaction
      const productName = sale.products?.name || '';
      if (productName) {
        await deleteCashTransaction(productName);
      }

      const { error } = await supabase.from('product_sales').delete().eq('id', sale.id);
      if (error) throw error;
      invalidateAllSaleQueries();
      logAction({ action: 'delete', target_type: 'product_sale', target_id: sale.id, target_label: `${customerName} - ${productName}` });
      toast.success('Satış silindi');
    } catch (e: any) {
      toast.error(e.message || 'Satış silinemedi');
    } finally {
      setDeleting(null);
    }
  };

  const openEdit = (sale: any, type: 'service' | 'product') => {
    setEditingSale(sale);
    setEditType(type);
    setEditQuantity(String(sale.quantity));
    setEditUnitPrice(String(sale.unit_price));
  };

  const handleEditSave = async () => {
    if (!editingSale) return;
    setEditSaving(true);
    try {
      const qty = parseInt(editQuantity) || 1;
      const price = parseFloat(editUnitPrice) || 0;
      const total = qty * price;
      const table = editType === 'service' ? 'service_sales' : 'product_sales';

      const { error } = await supabase.from(table).update({
        quantity: qty,
        unit_price: price,
        total_price: total,
      } as any).eq('id', editingSale.id);
      if (error) throw error;

      // Update stock difference for product sales
      if (editType === 'product' && editingSale.product_id) {
        const qtyDiff = editingSale.quantity - qty;
        if (qtyDiff !== 0) {
          const { data: prod } = await supabase.from('products').select('current_stock').eq('id', editingSale.product_id).single();
          if (prod) {
            await supabase.from('products').update({ current_stock: prod.current_stock + qtyDiff }).eq('id', editingSale.product_id);
          }
        }
      }

      invalidateAllSaleQueries();
      toast.success('Satış güncellendi');
      setEditingSale(null);
    } catch (e: any) {
      toast.error(e.message || 'Güncellenemedi');
    } finally {
      setEditSaving(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" /> {customerName} — Satış Geçmişi
            </DialogTitle>
            <DialogDescription>
              Toplam Harcama: <span className="font-bold text-foreground">{totalSpent.toLocaleString('tr-TR')} ₺</span>
            </DialogDescription>
          </DialogHeader>

          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : serviceSales.length === 0 && productSales.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <ShoppingCart className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Henüz satış kaydı yok</p>
            </div>
          ) : (
            <div className="space-y-4">
              {serviceSales.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold flex items-center gap-1 mb-2">
                    <Scissors className="h-3.5 w-3.5" /> Hizmet Satışları
                  </h3>
                  <div className="space-y-1.5">
                    {serviceSales.map((s: any) => (
                      <div key={s.id} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/30 border">
                        <div>
                          <p className="text-sm font-medium">{s.services?.name || 'Hizmet'} x{s.quantity}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(s.created_at), 'd MMM yyyy HH:mm', { locale: tr })}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-right">
                            <p className="text-sm font-semibold">{Number(s.total_price).toLocaleString('tr-TR')} ₺</p>
                            <Badge variant="outline" className="text-[10px]">{paymentLabel(s.payment_method)}</Badge>
                          </div>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(s, 'service')}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" disabled={deleting === s.id} onClick={() => prepareDeleteServiceSale(s)}>
                            {deleting === s.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {productSales.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold flex items-center gap-1 mb-2">
                    <Package className="h-3.5 w-3.5" /> Ürün Satışları
                  </h3>
                  <div className="space-y-1.5">
                    {productSales.map((s: any) => (
                      <div key={s.id} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/30 border">
                        <div>
                          <p className="text-sm font-medium">{s.products?.name || 'Ürün'} x{s.quantity}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(s.created_at), 'd MMM yyyy HH:mm', { locale: tr })}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-right">
                            <p className="text-sm font-semibold">{Number(s.total_price).toLocaleString('tr-TR')} ₺</p>
                            <Badge variant="outline" className="text-[10px]">{paymentLabel(s.payment_method)}</Badge>
                          </div>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(s, 'product')}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" disabled={deleting === s.id} onClick={() => handleDeleteProductSale(s)}>
                            {deleting === s.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Sale Dialog */}
      <Dialog open={!!editingSale} onOpenChange={(o) => !o && setEditingSale(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Satışı Düzenle</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Adet</Label>
              <Input type="number" min="1" value={editQuantity} onChange={e => setEditQuantity(e.target.value)} className="h-10" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Birim Fiyat (₺)</Label>
              <Input type="number" min="0" step="0.01" value={editUnitPrice} onChange={e => setEditUnitPrice(e.target.value)} className="h-10" />
            </div>
            <div className="p-3 rounded-lg bg-muted/50 border">
              <div className="flex justify-between text-sm font-bold">
                <span>Toplam:</span>
                <span>{((parseInt(editQuantity) || 0) * (parseFloat(editUnitPrice) || 0)).toLocaleString('tr-TR')} ₺</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingSale(null)}>İptal</Button>
            <Button onClick={handleEditSave} disabled={editSaving} className="btn-gradient">
              {editSaving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Kaydet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={(o) => !o && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Satışı Silmek İstediğinize Emin Misiniz?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>Bu işlem geri alınamaz. Aşağıdakiler de silinecektir:</p>
                <ul className="list-disc list-inside text-sm space-y-1">
                  <li>Satışa bağlı tüm seans hakları (kullanılmış dahil)</li>
                  {deleteConfirm?.type === 'service' && deleteConfirm.linkedAppointments.length > 0 && (
                    <li className="text-destructive font-medium">
                      <CalendarX className="h-3.5 w-3.5 inline mr-1" />
                      {deleteConfirm.linkedAppointments.length} adet bağlı randevu silinecek
                    </li>
                  )}
                  <li>İlgili kasa hareketleri</li>
                  {deleteConfirm?.sale?.payment_method === 'installment' && (
                    <li>Taksit planı ve ödemeleri</li>
                  )}
                </ul>
                {deleteConfirm?.type === 'service' && deleteConfirm.linkedAppointments.length > 0 && (
                  <div className="mt-2 p-2 rounded border bg-muted/50 max-h-32 overflow-y-auto">
                    <p className="text-xs font-semibold mb-1">Silinecek Randevular:</p>
                    {deleteConfirm.linkedAppointments.map((a: any) => (
                      <p key={a.id} className="text-xs text-muted-foreground">
                        {format(new Date(a.start_time), 'd MMM yyyy HH:mm', { locale: tr })} — {a.status}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>İptal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteConfirm?.type === 'service') executeDeleteServiceSale();
                else if (deleteConfirm?.type === 'product') executeDeleteProductSale();
              }}
            >
              Evet, Sil
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
