import { useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Loader2, History, ShoppingCart, Scissors, Package } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string;
  customerName: string;
}

export function CustomerSalesHistory({ open, onOpenChange, customerId, customerName }: Props) {
  const { currentSalonId } = useAuth();

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
    return m;
  };

  return (
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
                        <p className="text-sm font-medium">{(s as any).services?.name || 'Hizmet'} x{s.quantity}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(s.created_at), 'd MMM yyyy HH:mm', { locale: tr })}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold">{Number(s.total_price).toLocaleString('tr-TR')} ₺</p>
                        <Badge variant="outline" className="text-[10px]">{paymentLabel(s.payment_method)}</Badge>
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
                        <p className="text-sm font-medium">{(s as any).products?.name || 'Ürün'} x{s.quantity}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(s.created_at), 'd MMM yyyy HH:mm', { locale: tr })}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold">{Number(s.total_price).toLocaleString('tr-TR')} ₺</p>
                        <Badge variant="outline" className="text-[10px]">{paymentLabel(s.payment_method)}</Badge>
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
  );
}
