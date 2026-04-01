import { useState, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Loader2, CreditCard, CalendarDays, Pencil } from 'lucide-react';
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
  const [manualAmounts, setManualAmounts] = useState<Record<number, number>>({});
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

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

  // Calculate installment plan with manual overrides
  const installmentPlan = useMemo(() => {
    const plan: { number: number; date: string; amount: number }[] = [];
    const start = new Date(startDate);

    // Calculate how much is manually assigned
    const manualTotal = Object.entries(manualAmounts)
      .filter(([idx]) => parseInt(idx) < count)
      .reduce((s, [, v]) => s + v, 0);
    const manualCount = Object.keys(manualAmounts).filter(idx => parseInt(idx) < count).length;
    const autoCount = count - manualCount;
    const autoPerInstallment = autoCount > 0 ? Math.round(((remaining - manualTotal) / autoCount) * 100) / 100 : 0;

    for (let i = 0; i < count; i++) {
      let dueDate: Date;
      if (interval === 'weekly') {
        dueDate = addWeeks(start, i);
      } else if (interval === 'biweekly') {
        dueDate = addDays(start, i * 15);
      } else {
        dueDate = addMonths(start, i);
      }

      let amount: number;
      if (manualAmounts[i] !== undefined) {
        amount = manualAmounts[i];
      } else if (i === count - 1 && autoCount > 0) {
        // Last auto-installment gets the remainder
        const otherAutoTotal = autoPerInstallment * (autoCount - 1);
        amount = Math.round((remaining - manualTotal - otherAutoTotal) * 100) / 100;
      } else {
        amount = autoPerInstallment;
      }

      plan.push({ number: i + 1, date: format(dueDate, 'yyyy-MM-dd'), amount: Math.max(0, amount) });
    }
    return plan;
  }, [count, interval, startDate, remaining, manualAmounts]);

  const perInstallment = count > 0 ? Math.round((remaining / count) * 100) / 100 : 0;

  // Reset manual amounts when count changes
  const handleCountChange = useCallback((val: string) => {
    setInstallmentCount(val);
    setManualAmounts({});
    setEditingIndex(null);
  }, []);

  const handleManualAmountChange = (index: number, value: string) => {
    const num = parseFloat(value);
    if (isNaN(num) || num < 0) return;
    if (num > remaining) {
      toast.error('Taksit tutarı kalan borçtan büyük olamaz');
      return;
    }
    setManualAmounts(prev => ({ ...prev, [index]: num }));
  };

  const handleSave = async () => {
    if (!salonId || !user) return;
    if (remaining <= 0) {
      toast.error('Taksitlendirilecek tutar 0 olamaz');
      return;
    }

    // Validate total matches
    const planTotal = installmentPlan.reduce((s, p) => s + p.amount, 0);
    if (Math.abs(planTotal - remaining) > 0.02) {
      toast.error('Taksit toplamı kalan borca eşit olmalı');
      return;
    }

    setSaving(true);
    try {
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

      const { data: inst, error } = await supabase.from('installments').insert({
        salon_id: salonId,
        customer_id: customerId,
        total_amount: remaining,
        installment_count: count,
        notes: saleDescription ? `Satış: ${saleDescription}` : null,
        created_by: user.id,
      }).select('id').single();
      if (error || !inst) throw error || new Error('Taksit planı oluşturulamadı');

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
          <div className="space-y-2">
            <Label className="text-xs font-semibold">Peşinat (₺)</Label>
            <Input type="number" min="0" max={totalAmount} value={downPayment}
              onChange={e => setDownPayment(e.target.value)} placeholder="0" className="h-10" />
          </div>

          {downPaymentNum > 0 && (
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Peşinat Ödeme Yöntemi</Label>
              <Select value={downPaymentMethod} onValueChange={setDownPaymentMethod}>
                <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Nakit</SelectItem>
                  <SelectItem value="credit_card">Kredi Kartı</SelectItem>
                  <SelectItem value="eft">EFT / Havale</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-xs font-semibold">Taksit Sayısı</Label>
            <Select value={installmentCount} onValueChange={handleCountChange}>
              <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[2, 3, 4, 5, 6, 8, 10, 12].map(n => (
                  <SelectItem key={n} value={String(n)}>{n} Taksit</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

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

          {/* Installment Plan Preview with manual editing */}
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            <Label className="text-xs font-semibold flex items-center gap-1">
              <CalendarDays className="h-3.5 w-3.5" /> Ödeme Planı
              <span className="text-muted-foreground font-normal ml-1">(tıklayarak düzenle)</span>
            </Label>
            {installmentPlan.map((p, idx) => (
              <div key={p.number} className="flex items-center justify-between text-xs p-2 rounded-lg bg-muted/30 border">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] w-6 justify-center">{p.number}</Badge>
                  <span>{format(new Date(p.date), 'd MMM yyyy', { locale: tr })}</span>
                </div>
                <div className="flex items-center gap-1">
                  {editingIndex === idx ? (
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      className="w-24 h-7 text-xs text-right"
                      defaultValue={p.amount.toFixed(2)}
                      autoFocus
                      onBlur={(e) => {
                        handleManualAmountChange(idx, e.target.value);
                        setEditingIndex(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleManualAmountChange(idx, (e.target as HTMLInputElement).value);
                          setEditingIndex(null);
                        }
                        if (e.key === 'Escape') setEditingIndex(null);
                      }}
                    />
                  ) : (
                    <button
                      className="font-medium flex items-center gap-1 hover:text-primary transition-colors cursor-pointer"
                      onClick={() => setEditingIndex(idx)}
                    >
                      {p.amount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                      <Pencil className="h-2.5 w-2.5 opacity-40" />
                    </button>
                  )}
                </div>
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
