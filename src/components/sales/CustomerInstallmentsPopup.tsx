import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, CheckCircle2, AlertTriangle, Clock, CreditCard, Pencil, Lock, Unlock } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format, parseISO, isBefore, startOfDay } from 'date-fns';
import { tr } from 'date-fns/locale';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string;
  customerName: string;
}

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Nakit' },
  { value: 'credit_card', label: 'Kredi Kartı' },
  { value: 'eft', label: 'EFT / Havale' },
];

const roundCurrency = (v: number) => Math.round(v * 100) / 100;

export function CustomerInstallmentsPopup({ open, onOpenChange, customerId, customerName }: Props) {
  const { user, currentSalonId } = useAuth();
  const qc = useQueryClient();
  const today = startOfDay(new Date());

  const [payingId, setPayingId] = useState<string | null>(null);
  const [payMethod, setPayMethod] = useState('cash');
  const [payDate, setPayDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [paying, setPaying] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  // Lock state per installment_id -> set of locked payment ids
  const [lockedIds, setLockedIds] = useState<Set<string>>(new Set());

  const { data: installments = [] } = useQuery({
    queryKey: ['customer_installments', currentSalonId, customerId],
    queryFn: async () => {
      const { data } = await supabase.from('installments').select('*')
        .eq('salon_id', currentSalonId!).eq('customer_id', customerId)
        .order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!currentSalonId && !!customerId && open,
  });

  const { data: payments = [] } = useQuery({
    queryKey: ['customer_inst_payments', currentSalonId, customerId],
    queryFn: async () => {
      if (!installments.length) return [];
      const ids = installments.map((i: any) => i.id);
      const { data } = await supabase.from('installment_payments').select('*')
        .in('installment_id', ids).order('due_date');
      return data || [];
    },
    enabled: !!currentSalonId && installments.length > 0 && open,
  });

  const { data: cashBoxes = [] } = useQuery({
    queryKey: ['cash_boxes', currentSalonId],
    queryFn: async () => {
      const { data } = await supabase.from('cash_boxes').select('*').eq('salon_id', currentSalonId!);
      return (data || []) as { id: string; payment_method: string }[];
    },
    enabled: !!currentSalonId,
  });

  const findCashBoxId = (method: string) => cashBoxes.find(b => b.payment_method === method)?.id || null;

  const toggleLock = (paymentId: string) => {
    setLockedIds(prev => {
      const next = new Set(prev);
      if (next.has(paymentId)) {
        next.delete(paymentId);
      } else {
        next.add(paymentId);
      }
      return next;
    });
  };

  const handlePay = async (paymentId: string, amount: number) => {
    if (!currentSalonId || !user) return;
    setPaying(true);
    try {
      const { error } = await supabase.from('installment_payments').update({
        is_paid: true,
        paid_amount: amount,
        paid_at: new Date(payDate).toISOString(),
        payment_method: payMethod,
      } as any).eq('id', paymentId);
      if (error) throw error;

      const { error: cashErr } = await supabase.from('cash_transactions').insert({
        salon_id: currentSalonId,
        type: 'income',
        amount,
        description: `Taksit tahsilatı - ${customerName}`,
        payment_method: payMethod,
        cash_box_id: findCashBoxId(payMethod),
        created_by: user.id,
        transaction_date: new Date(payDate).toISOString(),
      });
      if (cashErr) throw cashErr;

      qc.invalidateQueries({ queryKey: ['customer_inst_payments'] });
      qc.invalidateQueries({ queryKey: ['installment_payments'] });
      qc.invalidateQueries({ queryKey: ['cash_transactions'] });
      qc.invalidateQueries({ queryKey: ['installments_all'] });
      qc.invalidateQueries({ queryKey: ['installment_payments_all'] });
      toast.success('Taksit ödendi olarak işaretlendi');
      setPayingId(null);
    } catch (e: any) {
      toast.error(e.message || 'Hata oluştu');
    } finally {
      setPaying(false);
    }
  };

  const handleEditSave = async () => {
    if (!editingId) return;
    const newAmount = parseFloat(editAmount);
    if (isNaN(newAmount) || newAmount < 0) {
      toast.error('Geçersiz tutar');
      return;
    }

    const editedPayment = allPayments.find((p: any) => p.id === editingId);
    if (!editedPayment) return;

    // Get all unpaid payments in the same installment plan
    const siblingUnpaid = allPayments.filter(
      (p: any) => p.installment_id === editedPayment.installment_id && !p.is_paid
    );

    const totalUnpaid = siblingUnpaid.reduce((s: number, p: any) => s + Number(p.amount), 0);

    if (newAmount > totalUnpaid) {
      toast.error('Tutar toplam kalan borçtan büyük olamaz');
      return;
    }

    // Others excluding edited one, and excluding locked ones
    const othersUnlocked = siblingUnpaid.filter(
      (p: any) => p.id !== editingId && !lockedIds.has(p.id)
    );
    const lockedTotal = siblingUnpaid
      .filter((p: any) => p.id !== editingId && lockedIds.has(p.id))
      .reduce((s: number, p: any) => s + Number(p.amount), 0);

    const remainingForOthers = roundCurrency(totalUnpaid - newAmount - lockedTotal);

    if (remainingForOthers < -0.01) {
      toast.error('Sabitlenmiş taksitlerle birlikte toplam borcu aşıyor');
      return;
    }

    if (othersUnlocked.length === 0 && Math.abs(remainingForOthers) > 0.01) {
      toast.error('Dağıtılacak sabitlenmemiş taksit yok');
      return;
    }

    setEditSaving(true);
    try {
      const updates: any = { amount: newAmount };
      if (editDate) updates.due_date = editDate;

      const { error } = await supabase.from('installment_payments').update(updates).eq('id', editingId);
      if (error) throw error;

      // Redistribute remaining to unlocked unpaid installments only
      if (othersUnlocked.length > 0) {
        const perOther = roundCurrency(remainingForOthers / othersUnlocked.length);

        for (let i = 0; i < othersUnlocked.length; i++) {
          const amt = i === othersUnlocked.length - 1
            ? roundCurrency(remainingForOthers - perOther * (othersUnlocked.length - 1))
            : perOther;
          await supabase.from('installment_payments').update({ amount: amt } as any).eq('id', othersUnlocked[i].id);
        }
      }

      qc.invalidateQueries({ queryKey: ['customer_inst_payments'] });
      qc.invalidateQueries({ queryKey: ['installment_payments'] });
      toast.success('Taksit güncellendi, kalan sabitlenmemiş taksitlere dağıtıldı');
      setEditingId(null);
    } catch (e: any) {
      toast.error(e.message || 'Güncelleme hatası');
    } finally {
      setEditSaving(false);
    }
  };

  const allPayments = payments as any[];
  const totalOwed = allPayments.filter((p: any) => !p.is_paid).reduce((s: number, p: any) => s + Number(p.amount), 0);
  const totalPaid = allPayments.filter((p: any) => p.is_paid).reduce((s: number, p: any) => s + Number(p.paid_amount || p.amount), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" /> {customerName} - Taksitler
          </DialogTitle>
          <DialogDescription>
            Toplam Alacak: {totalOwed.toLocaleString('tr-TR')} ₺ • Tahsil Edilen: {totalPaid.toLocaleString('tr-TR')} ₺
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0 space-y-2 py-2">
          {allPayments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Bu müşterinin taksit planı yok</p>
          ) : allPayments.map((p: any) => {
            const isOverdue = !p.is_paid && isBefore(parseISO(p.due_date), today);
            const isEditing = editingId === p.id;
            const isPaying = payingId === p.id;
            const isLocked = lockedIds.has(p.id);

            return (
              <div key={p.id} className={`p-3 rounded-lg border text-sm ${isOverdue ? 'border-destructive/40 bg-destructive/5' : isLocked && !p.is_paid ? 'border-primary/40 bg-primary/5' : 'border-border/60'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {!p.is_paid && (
                      <button
                        onClick={() => toggleLock(p.id)}
                        className={`shrink-0 p-1 rounded-md transition-all ${isLocked
                          ? 'bg-primary/15 text-primary ring-1 ring-primary/30'
                          : 'text-muted-foreground/40 hover:text-muted-foreground hover:bg-muted'
                        }`}
                        title={isLocked ? 'Sabitlemeyi kaldır' : 'Taksiti sabitle — düzenlemeden etkilenmez'}
                      >
                        {isLocked
                          ? <Lock className="h-3.5 w-3.5" />
                          : <Unlock className="h-3.5 w-3.5" />
                        }
                      </button>
                    )}
                    {p.is_paid ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                    ) : isOverdue ? (
                      <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                    ) : (
                      <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                    )}
                    <span className="font-medium">Taksit {p.installment_number}</span>
                    <span className="text-muted-foreground text-xs">
                      {format(parseISO(p.due_date), 'd MMM yyyy', { locale: tr })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold">{Number(p.amount).toLocaleString('tr-TR')} ₺</span>
                    {p.is_paid ? (
                      <Badge variant="outline" className="text-[10px] text-green-600">
                        {PAYMENT_METHODS.find(m => m.value === p.payment_method)?.label || 'Ödendi'}
                      </Badge>
                    ) : (
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2" onClick={() => {
                          setEditingId(p.id);
                          setEditAmount(String(p.amount));
                          setEditDate(p.due_date);
                        }}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button size="sm" variant="outline" className="h-6 text-[10px] px-2" onClick={() => {
                          setPayingId(p.id);
                          setPayDate(format(new Date(), 'yyyy-MM-dd'));
                        }}>
                          Öde
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                {isPaying && (
                  <div className="mt-2 pt-2 border-t space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">Ödeme Yöntemi</Label>
                        <Select value={payMethod} onValueChange={setPayMethod}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {PAYMENT_METHODS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">İşlem Tarihi</Label>
                        <Input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} className="h-8 text-xs" />
                      </div>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setPayingId(null)}>İptal</Button>
                      <Button size="sm" className="h-7 text-xs btn-gradient" disabled={paying} onClick={() => handlePay(p.id, Number(p.amount))}>
                        {paying && <Loader2 className="h-3 w-3 animate-spin mr-1" />} Ödendi İşaretle
                      </Button>
                    </div>
                  </div>
                )}

                {isEditing && (
                  <div className="mt-2 pt-2 border-t space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">Tutar (₺)</Label>
                        <Input type="number" min="0" step="0.01" value={editAmount} onChange={e => setEditAmount(e.target.value)} className="h-8 text-xs" />
                      </div>
                      <div>
                        <Label className="text-xs">Vade Tarihi</Label>
                        <Input type="date" value={editDate} onChange={e => setEditDate(e.target.value)} className="h-8 text-xs" />
                      </div>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      🔒 Sabitlenmiş taksitler korunur. Kalan tutar sadece sabitlenmemiş taksitlere dağıtılır.
                    </p>
                    <div className="flex gap-2 justify-end">
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingId(null)}>İptal</Button>
                      <Button size="sm" className="h-7 text-xs btn-gradient" disabled={editSaving} onClick={handleEditSave}>
                        {editSaving && <Loader2 className="h-3 w-3 animate-spin mr-1" />} Kaydet
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <DialogFooter className="shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Kapat</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
