import { useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Loader2, CreditCard, CalendarDays } from 'lucide-react';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useFormGuard } from '@/hooks/useFormGuard';
import { format, addDays, addMonths, addWeeks } from 'date-fns';
import { tr } from 'date-fns/locale';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string;
  customerName: string;
  totalAmount: number;
  onComplete: () => void;
  saleDescription?: string;
}

type IntervalType = 'weekly' | 'biweekly' | 'monthly';

const INTERVAL_OPTIONS: { value: IntervalType; label: string }[] = [
  { value: 'weekly', label: 'Haftalık' },
  { value: 'biweekly', label: '15 Günlük' },
  { value: 'monthly', label: 'Aylık' },
];

export function InstallmentPlanDialog({ open, onOpenChange, customerId, customerName, totalAmount, onComplete, saleDescription }: Props) {
  const { user, currentSalonId } = useAuth();
  const qc = useQueryClient();
  const salonId = currentSalonId;

  const [downPayment, setDownPayment] = useState('0');
  const [downPaymentMethod, setDownPaymentMethod] = useState('cash');
  const [installmentCount, setInstallmentCount] = useState('3');
  const [interval, setInterval] = useState<IntervalType>('monthly');
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [saving, setSaving] = useState(false);

  // Fetch cash boxes to link transactions properly
  const { data: cashBoxes = [] } = useQuery({
    queryKey: ['cash_boxes', salonId],
    queryFn: async () => {
      if (!salonId) return [];
      const { data } = await supabase.from('cash_boxes').select('*').eq('salon_id', salonId).order('name');
      return (data || []) as { id: string; payment_method: string }[];
    },
    enabled: !!salonId,
  });

  const findCashBoxId = (method: string) => cashBoxes.find(b => b.payment_method === method)?.id || null;

  useFormGuard(open);

  const downPaymentNum = parseFloat(downPayment) || 0;
  const remaining = Math.max(0, totalAmount - downPaymentNum);
  const count = parseInt(installmentCount) || 1;
  const perInstallment = Math.round((remaining / count) * 100) / 100;

  const installmentPlan = useMemo(() => {
    const plan: { number: number; date: string; amount: number }[] = [];
    const start = new Date(startDate);

    for (let i = 0; i < count; i++) {
      let dueDate: Date;
      if (interval === 'weekly') {
        dueDate = addWeeks(start, i);
      } else if (interval === 'biweekly') {
        dueDate = addDays(start, i * 15);
      } else {
        dueDate = addMonths(start, i);
      }

      const amount = i === count - 1
        ? Math.round((remaining - perInstallment * (count - 1)) * 100) / 100
        : perInstallment;

      plan.push({ number: i + 1, date: format(dueDate, 'yyyy-MM-dd'), amount });
    }
    return plan;
  }, [count, interval, startDate, remaining, perInstallment]);

  const handleSave = async () => {
    if (!salonId || !user) return;
    if (remaining <= 0) {
      toast.error('Taksitlendirilecek tutar 0 olamaz');
      return;
    }

    setSaving(true);
    try {
      // If there's a down payment, create cash transaction with proper method and cash_box_id
      if (downPaymentNum > 0) {
        const { error: cashErr } = await supabase.from('cash_transactions').insert({
          salon_id: salonId,
          type: 'income',
          amount: downPaymentNum,
          description: `Peşinat - ${customerName}${saleDescription ? `: ${saleDescription}` : ''}`,
          payment_method: downPaymentMethod,
          cash_box_id: findCashBoxId(downPaymentMethod),
          created_by: user.id,
        });
        if (cashErr) throw cashErr;
      }

      // Create installment plan
      const { data: inst, error } = await supabase.from('installments').insert({
        salon_id: salonId,
        customer_id: customerId,
        total_amount: remaining,
        installment_count: count,
        notes: saleDescription ? `Satış: ${saleDescription}` : null,
        created_by: user.id,
      } as any).select('id').single();
      if (error || !inst) throw error || new Error('Failed');

      // Create installment payments
      const installmentPayments = installmentPlan.map(p => ({
        installment_id: inst.id,
        salon_id: salonId,
        due_date: p.date,
        amount: p.amount,
        installment_number: p.number,
      }));

      const { error: payErr } = await supabase.from('installment_payments').insert(installmentPayments as any);
      if (payErr) throw payErr;

      qc.invalidateQueries({ queryKey: ['installments', salonId] });
      qc.invalidateQueries({ queryKey: ['installment_payments', salonId] });
      qc.invalidateQueries({ queryKey: ['cash_transactions'] });
      toast.success('Taksit planı oluşturuldu');

      // Call onComplete to process the sale records
      onComplete();
    } catch (e: any) {
      toast.error(e.message || 'Taksit planı oluşturulamadı');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" /> Taksitlendirme
          </DialogTitle>
          <DialogDescription>
            {customerName} — Toplam: {totalAmount.toLocaleString('tr-TR')} ₺
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Down Payment */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold">Peşinat (₺)</Label>
            <Input
              type="number"
              min="0"
              max={totalAmount}
              value={downPayment}
              onChange={e => setDownPayment(e.target.value)}
              placeholder="0"
              className="h-10"
            />
          </div>

          {/* Installment Count */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold">Taksit Sayısı</Label>
            <Select value={installmentCount} onValueChange={setInstallmentCount}>
              <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[2, 3, 4, 5, 6, 8, 10, 12].map(n => (
                  <SelectItem key={n} value={String(n)}>{n} Taksit</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Interval */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold">Taksit Aralığı</Label>
            <Select value={interval} onValueChange={(v) => setInterval(v as IntervalType)}>
              <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
              <SelectContent>
                {INTERVAL_OPTIONS.map(o => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Start Date */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold">İlk Taksit Tarihi</Label>
            <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-10" />
          </div>

          {/* Summary */}
          <div className="p-3 rounded-lg bg-muted/50 border space-y-1">
            {downPaymentNum > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Peşinat:</span>
                <span className="font-medium">{downPaymentNum.toLocaleString('tr-TR')} ₺</span>
              </div>
            )}
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Taksitlendirilecek:</span>
              <span className="font-medium">{remaining.toLocaleString('tr-TR')} ₺</span>
            </div>
            <div className="flex justify-between text-sm font-bold pt-1 border-t">
              <span>Taksit Tutarı:</span>
              <span>{perInstallment.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</span>
            </div>
          </div>

          {/* Installment Plan Preview */}
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            <Label className="text-xs font-semibold flex items-center gap-1">
              <CalendarDays className="h-3.5 w-3.5" /> Ödeme Planı
            </Label>
            {installmentPlan.map(p => (
              <div key={p.number} className="flex items-center justify-between text-xs p-2 rounded-lg bg-muted/30 border">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] w-6 justify-center">{p.number}</Badge>
                  <span>{format(new Date(p.date), 'd MMM yyyy', { locale: tr })}</span>
                </div>
                <span className="font-medium">{p.amount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</span>
              </div>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>İptal</Button>
          <Button onClick={handleSave} disabled={saving || remaining <= 0} className="btn-gradient">
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Taksit Planını Onayla
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
