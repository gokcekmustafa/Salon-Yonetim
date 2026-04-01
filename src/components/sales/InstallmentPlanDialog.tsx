import { useState, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Loader2, CreditCard, Pencil, Lock, Unlock } from 'lucide-react';
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
  const [manualDates, setManualDates] = useState<Record<number, string>>({});
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingDateIndex, setEditingDateIndex] = useState<number | null>(null);
  const [lockedIndexes, setLockedIndexes] = useState<Set<number>>(new Set());

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

  const installmentPlan = useMemo(() => {
    const plan: { number: number; date: string; amount: number }[] = [];
    const start = new Date(startDate);

    // Fixed (locked or manually set) amounts
    const fixedTotal = Object.entries(manualAmounts)
      .filter(([idx]) => parseInt(idx) < count)
      .reduce((s, [, v]) => s + v, 0);

    // Auto indexes: not in manualAmounts AND not locked
    const autoIndexes: number[] = [];
    for (let i = 0; i < count; i++) {
      if (manualAmounts[i] === undefined && !lockedIndexes.has(i)) {
        autoIndexes.push(i);
      }
    }

    const autoRemaining = Math.max(0, remaining - fixedTotal);
    const autoCount = autoIndexes.length;
    const autoPerInstallment = autoCount > 0 ? Math.round((autoRemaining / autoCount) * 100) / 100 : 0;

    for (let i = 0; i < count; i++) {
      let dueDate: Date;
      if (manualDates[i]) {
        dueDate = new Date(manualDates[i]);
      } else if (interval === 'weekly') {
        dueDate = addWeeks(start, i);
      } else if (interval === 'biweekly') {
        dueDate = addDays(start, i * 15);
      } else {
        dueDate = addMonths(start, i);
      }

      let amount: number;
      if (manualAmounts[i] !== undefined) {
        amount = manualAmounts[i];
      } else if (autoIndexes.length > 0 && i === autoIndexes[autoIndexes.length - 1]) {
        // Last auto gets remainder to avoid rounding drift
        const otherAutoTotal = autoPerInstallment * (autoCount - 1);
        amount = Math.round((autoRemaining - otherAutoTotal) * 100) / 100;
      } else if (autoIndexes.includes(i)) {
        amount = autoPerInstallment;
      } else {
        // Locked but no manual amount — keep previous equal share (0 if nothing set)
        amount = 0;
      }

      plan.push({ number: i + 1, date: format(dueDate, 'yyyy-MM-dd'), amount: Math.max(0, amount) });
    }
    return plan;
  }, [count, interval, startDate, remaining, manualAmounts, manualDates, lockedIndexes]);

  const perInstallment = count > 0 ? Math.round((remaining / count) * 100) / 100 : 0;

  const handleCountChange = useCallback((val: string) => {
    setInstallmentCount(val);
    setManualAmounts({});
    setManualDates({});
    setEditingIndex(null);
    setEditingDateIndex(null);
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

  const handleManualDateChange = (index: number, value: string) => {
    if (!value) return;
    setManualDates(prev => ({ ...prev, [index]: value }));
  };

  const handleSave = async () => {
    if (!salonId || !user) return;
    if (remaining <= 0) {
      toast.error('Taksitlendirilecek tutar 0 olamaz');
      return;
    }

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
      <DialogContent className="w-[min(96vw,68rem)] max-w-4xl max-h-[80vh] overflow-hidden flex flex-col p-4 sm:p-6">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" /> Taksitlendirme
          </DialogTitle>
          <DialogDescription>
            {customerName} — Toplam: {totalAmount.toLocaleString('tr-TR')} ₺
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0">
          <div className="grid grid-cols-1 gap-x-6 gap-y-4 py-2 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
            {/* Left column */}
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Peşinat (₺)</Label>
                <Input type="number" min="0" max={totalAmount} value={downPayment}
                  onChange={e => setDownPayment(e.target.value)} placeholder="0" className="h-9" />
              </div>

              {downPaymentNum > 0 && (
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Peşinat Ödeme Yöntemi</Label>
                  <Select value={downPaymentMethod} onValueChange={setDownPaymentMethod}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Nakit</SelectItem>
                      <SelectItem value="credit_card">Kredi Kartı</SelectItem>
                      <SelectItem value="eft">EFT / Havale</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Taksit Sayısı</Label>
                <Select value={installmentCount} onValueChange={handleCountChange}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[2, 3, 4, 5, 6, 8, 10, 12].map(n => (
                      <SelectItem key={n} value={String(n)}>{n} Taksit</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Taksit Aralığı</Label>
                <Select value={interval} onValueChange={(v) => setInterval(v as IntervalType)}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {INTERVAL_OPTIONS.map(o => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">İlk Taksit Tarihi</Label>
                <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-9" />
              </div>

              {/* Summary */}
              <div className="p-2.5 rounded-lg bg-muted/50 border space-y-1">
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
            </div>

            {/* Right column - Payment Plan */}
               <div className="space-y-1.5 min-h-0">
              <Label className="text-xs font-semibold flex items-center gap-1">
                Ödeme Planı
                <span className="text-muted-foreground font-normal ml-1">(tıklayarak düzenle)</span>
              </Label>
               <div className="space-y-1 max-h-[42vh] overflow-y-auto pr-1">
                {installmentPlan.map((p, idx) => (
                  <div key={p.number} className="flex items-center justify-between text-xs p-2 rounded-lg bg-muted/30 border gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Badge variant="outline" className="text-[10px] w-5 h-5 justify-center shrink-0 p-0">{p.number}</Badge>
                      {editingDateIndex === idx ? (
                        <Input
                          type="date"
                          className="w-32 h-6 text-xs px-1"
                          defaultValue={p.date}
                          autoFocus
                          onBlur={(e) => {
                            handleManualDateChange(idx, e.target.value);
                            setEditingDateIndex(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleManualDateChange(idx, (e.target as HTMLInputElement).value);
                              setEditingDateIndex(null);
                            }
                            if (e.key === 'Escape') setEditingDateIndex(null);
                          }}
                        />
                      ) : (
                        <button
                          className="text-muted-foreground hover:text-primary transition-colors cursor-pointer text-xs"
                          onClick={() => setEditingDateIndex(idx)}
                        >
                          {format(new Date(p.date), 'd MMM yyyy', { locale: tr })}
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {editingIndex === idx ? (
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          className="w-24 h-6 text-xs text-right px-1"
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
          </div>
        </div>

        <DialogFooter className="shrink-0">
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
