import { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useFormGuard } from '@/hooks/useFormGuard';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useAuditLog } from '@/hooks/useAuditLog';
import { useSalonData } from '@/hooks/useSalonData';
import { usePermissions } from '@/hooks/usePermissions';
import { NoPermission } from '@/components/permissions/NoPermission';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Loader2, Plus, CreditCard, AlertTriangle, CheckCircle2, Clock, Banknote, ChevronDown, Phone, User, Pencil, Lock, Unlock } from 'lucide-react';
import { format, parseISO, isBefore, startOfDay, addMonths, addDays, addWeeks } from 'date-fns';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { tr } from 'date-fns/locale';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { StaffPageGuard } from '@/components/permissions/StaffPageGuard';

const roundCurrency = (value: number) => Math.round(value * 100) / 100;

type Installment = {
  id: string; salon_id: string; customer_id: string;
  total_amount: number; installment_count: number; notes: string | null;
  created_by: string; created_at: string;
};

type InstallmentPayment = {
  id: string; installment_id: string; salon_id: string;
  due_date: string; amount: number; paid_amount: number;
  payment_method: string | null; is_paid: boolean; paid_at: string | null;
  installment_number: number;
};

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Nakit' },
  { value: 'credit_card', label: 'Kredi Kartı' },
  { value: 'eft', label: 'EFT / Havale' },
];

type CashBox = { id: string; salon_id: string; name: string; payment_method: string; is_active: boolean };

export default function InstallmentsPage() {
  const { hasPermission } = usePermissions();
  const { user, currentSalonId } = useAuth();
  const { customers, loading: salonLoading } = useSalonData();
  const { logAction } = useAuditLog();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  useFormGuard(dialogOpen || payDialogOpen);
  const [selectedPayment, setSelectedPayment] = useState<InstallmentPayment | null>(null);
  const [payMethod, setPayMethod] = useState('cash');
  const [payDate, setPayDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [downPaymentMethod, setDownPaymentMethod] = useState('cash');

  // Edit existing installment payment
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editPayment, setEditPayment] = useState<InstallmentPayment | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const [editLockedIds, setEditLockedIds] = useState<Set<string>>(new Set());

  // Form
  const [formCustomerId, setFormCustomerId] = useState('');
  const [formTotal, setFormTotal] = useState('');
  const [formCount, setFormCount] = useState('3');
  const [formNotes, setFormNotes] = useState('');
  const [formStartDate, setFormStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [formInterval, setFormInterval] = useState<'weekly' | 'biweekly' | 'monthly'>('monthly');
  const [formDownPayment, setFormDownPayment] = useState('0');
  const [filterStatus, setFilterStatus] = useState<'all' | 'overdue' | 'upcoming'>('all');
  const [formManualAmounts, setFormManualAmounts] = useState<Record<number, number>>({});
  const [formLockedIndexes, setFormLockedIndexes] = useState<Set<number>>(new Set());

  const salonId = currentSalonId;

  useEffect(() => {
    const customerId = searchParams.get('customer');
    const shouldOpen = searchParams.get('yeni') === '1';

    if (!customerId && !shouldOpen) return;

    if (customerId) setFormCustomerId(customerId);
    if (shouldOpen) setDialogOpen(true);

    setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams]);

  // Fetch cash boxes to link transactions properly
  const { data: cashBoxes = [] } = useQuery({
    queryKey: ['cash_boxes', salonId],
    queryFn: async () => {
      if (!salonId) return [];
      const { data } = await supabase.from('cash_boxes').select('*').eq('salon_id', salonId).order('name');
      return (data || []) as CashBox[];
    },
    enabled: !!salonId,
  });

  const findCashBoxId = (method: string) => cashBoxes.find(b => b.payment_method === method)?.id || null;

  const { data: installments = [], isLoading: loadingInst } = useQuery({
    queryKey: ['installments', salonId],
    queryFn: async () => {
      if (!salonId) return [];
      const { data } = await supabase.from('installments').select('*').eq('salon_id', salonId).order('created_at', { ascending: false });
      return (data || []) as Installment[];
    },
    enabled: !!salonId,
  });

  const { data: payments = [], isLoading: loadingPay } = useQuery({
    queryKey: ['installment_payments', salonId],
    queryFn: async () => {
      if (!salonId) return [];
      const { data } = await supabase.from('installment_payments').select('*').eq('salon_id', salonId).order('due_date');
      return (data || []) as InstallmentPayment[];
    },
    enabled: !!salonId,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!salonId || !user) throw new Error('Missing');
      const total = parseFloat(formTotal);
      const count = parseInt(formCount);
      const dp = roundCurrency(parseFloat(formDownPayment) || 0);
      if (isNaN(total) || total <= 0) throw new Error('Geçerli tutar girin');
      if (!formCustomerId) throw new Error('Müşteri seçin');

      const remaining = Math.max(0, roundCurrency(total - dp));
      if (remaining <= 0) throw new Error('Taksitlendirilecek tutar 0 olamaz');

      const planTotal = installmentPreview.reduce((sum, item) => sum + item.amount, 0);
      if (Math.abs(planTotal - remaining) > 0.02) {
        throw new Error('Taksit toplamı kalan borca eşit olmalı');
      }

      // Down payment cash entry with proper payment method and cash_box_id
      if (dp > 0) {
        const custName = customers.find(c => c.id === formCustomerId)?.name || '';
        const { error: cashErr } = await supabase.from('cash_transactions').insert({
          salon_id: salonId,
          type: 'income',
          amount: dp,
          description: `Peşinat - ${custName}`,
          payment_method: downPaymentMethod,
          cash_box_id: findCashBoxId(downPaymentMethod),
          created_by: user.id,
        });
        if (cashErr) throw cashErr;
      }

      const { data: inst, error } = await supabase.from('installments').insert({
        salon_id: salonId,
        customer_id: formCustomerId,
        total_amount: remaining,
        installment_count: count,
        notes: formNotes || null,
        created_by: user.id,
      } as any).select('id').single();
      if (error || !inst) throw error || new Error('Failed');

      const installmentPayments = installmentPreview.map((item, i) => ({
        installment_id: inst.id,
        salon_id: salonId,
        due_date: item.date,
        amount: item.amount,
        installment_number: i + 1,
      }));

      const { error: payErr } = await supabase.from('installment_payments').insert(installmentPayments as any);
      if (payErr) throw payErr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['installments', salonId] });
      queryClient.invalidateQueries({ queryKey: ['installment_payments', salonId] });
      queryClient.invalidateQueries({ queryKey: ['cash_transactions'] });
      const custName = customers.find(c => c.id === formCustomerId)?.name || '';
      logAction({ action: 'create', target_type: 'installment', target_label: custName, details: { total: formTotal, count: formCount } });
      toast.success('Taksit planı oluşturuldu');
      setDialogOpen(false);
      setFormCustomerId(''); setFormTotal(''); setFormCount('3'); setFormNotes(''); setFormDownPayment('0');
      setFormManualAmounts({}); setFormLockedIndexes(new Set());
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const markPaidMutation = useMutation({
    mutationFn: async () => {
      if (!selectedPayment || !salonId || !user) throw new Error('No payment');
      const selectedDateISO = new Date(payDate).toISOString();
      const { error } = await supabase.from('installment_payments').update({
        is_paid: true,
        paid_amount: selectedPayment.amount,
        paid_at: selectedDateISO,
        payment_method: payMethod,
      } as any).eq('id', selectedPayment.id);
      if (error) throw error;

      const inst = installments.find(i => i.id === selectedPayment.installment_id);
      const custName = inst ? getCustomerName(inst.customer_id) : '';

      const { error: cashErr } = await supabase.from('cash_transactions').insert({
        salon_id: salonId,
        type: 'income',
        amount: selectedPayment.amount,
        description: `Taksit tahsilatı - ${custName} (Taksit ${selectedPayment.installment_number})`,
        payment_method: payMethod,
        cash_box_id: findCashBoxId(payMethod),
        created_by: user.id,
        transaction_date: selectedDateISO,
      });
      if (cashErr) throw cashErr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['installment_payments', salonId] });
      queryClient.invalidateQueries({ queryKey: ['cash_transactions'] });
      toast.success('Taksit ödendi olarak işaretlendi');
      setPayDialogOpen(false);
      setSelectedPayment(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const editPaymentMutation = useMutation({
    mutationFn: async () => {
      if (!editPayment) throw new Error('No payment');
      const updates: any = {};
      const currentAmount = Number(editPayment.amount);
      const nextAmount = editAmount === '' ? currentAmount : parseFloat(editAmount);
      const amountChanged = Math.abs(nextAmount - currentAmount) > 0.009;
      const dateChanged = !!editDueDate && editDueDate !== editPayment.due_date;

      if (Number.isNaN(nextAmount) || nextAmount < 0) {
        throw new Error('Geçerli tutar girin');
      }

      if (amountChanged) {
        const siblingUnpaid = payments.filter(
          p => p.installment_id === editPayment.installment_id && !p.is_paid
        );
        const totalUnpaid = siblingUnpaid.reduce((sum, payment) => sum + Number(payment.amount), 0);

        if (nextAmount > totalUnpaid) {
          throw new Error('Tutar toplam kalan borçtan büyük olamaz');
        }

        // Exclude locked siblings from redistribution
        const otherUnlocked = siblingUnpaid.filter(p => p.id !== editPayment.id && !editLockedIds.has(p.id));
        const lockedTotal = siblingUnpaid
          .filter(p => p.id !== editPayment.id && editLockedIds.has(p.id))
          .reduce((sum, p) => sum + Number(p.amount), 0);
        const remainingForOthers = roundCurrency(totalUnpaid - nextAmount - lockedTotal);

        if (remainingForOthers < -0.01) {
          throw new Error('Sabitlenmiş taksitlerle birlikte toplam borcu aşıyor');
        }

        if (otherUnlocked.length === 0 && Math.abs(remainingForOthers) > 0.01) {
          throw new Error('Dağıtılacak sabitlenmemiş taksit yok');
        }

        updates.amount = nextAmount;
        if (otherUnlocked.length > 0) {
          const perOther = roundCurrency(remainingForOthers / otherUnlocked.length);

          for (let i = 0; i < otherUnlocked.length; i += 1) {
            const redistributedAmount = i === otherUnlocked.length - 1
              ? roundCurrency(remainingForOthers - perOther * (otherUnlocked.length - 1))
              : perOther;

            const { error: siblingError } = await supabase
              .from('installment_payments')
              .update({ amount: redistributedAmount } as any)
              .eq('id', otherUnlocked[i].id);

            if (siblingError) throw siblingError;
          }
        }
      }

      if (dateChanged) updates.due_date = editDueDate;
      if (!Object.keys(updates).length) throw new Error('Değişiklik yok');

      const { error } = await supabase.from('installment_payments').update(updates).eq('id', editPayment.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['installment_payments', salonId] });
      toast.success('Taksit güncellendi');
      setEditDialogOpen(false);
      setEditPayment(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const today = startOfDay(new Date());
  const getCustomerName = (id: string) => customers.find(c => c.id === id)?.name ?? '-';

  // Upcoming & overdue
  const unpaidPayments = payments.filter(p => !p.is_paid);
  const overduePayments = unpaidPayments.filter(p => isBefore(parseISO(p.due_date), today));
  const upcomingPayments = unpaidPayments.filter(p => !isBefore(parseISO(p.due_date), today)).slice(0, 10);

  const totalOwed = unpaidPayments.reduce((s, p) => s + Number(p.amount), 0);
  const totalPaid = payments.filter(p => p.is_paid).reduce((s, p) => s + Number(p.paid_amount), 0);
  const formCountNum = parseInt(formCount) || 1;
  const formRemaining = Math.max(0, roundCurrency((parseFloat(formTotal) || 0) - (parseFloat(formDownPayment) || 0)));

  const installmentPreview = useMemo(() => {
    const plan: { number: number; date: string; amount: number }[] = [];
    const start = new Date(formStartDate);
    const fixedTotal = Object.entries(formManualAmounts)
      .filter(([idx]) => parseInt(idx) < formCountNum)
      .reduce((sum, [, amount]) => sum + amount, 0);

    const autoIndexes: number[] = [];
    for (let i = 0; i < formCountNum; i += 1) {
      if (formManualAmounts[i] === undefined && !formLockedIndexes.has(i)) {
        autoIndexes.push(i);
      }
    }

    const autoRemaining = Math.max(0, roundCurrency(formRemaining - fixedTotal));
    const autoPerInstallment = autoIndexes.length > 0 ? roundCurrency(autoRemaining / autoIndexes.length) : 0;

    for (let i = 0; i < formCountNum; i += 1) {
      let dueDate: Date;
      if (formInterval === 'weekly') {
        dueDate = addWeeks(start, i);
      } else if (formInterval === 'biweekly') {
        dueDate = addDays(start, i * 15);
      } else {
        dueDate = addMonths(start, i);
      }

      let amount = 0;
      if (formManualAmounts[i] !== undefined) {
        amount = formManualAmounts[i];
      } else if (autoIndexes.length > 0 && i === autoIndexes[autoIndexes.length - 1]) {
        amount = roundCurrency(autoRemaining - autoPerInstallment * (autoIndexes.length - 1));
      } else if (autoIndexes.includes(i)) {
        amount = autoPerInstallment;
      }

      plan.push({
        number: i + 1,
        date: format(dueDate, 'yyyy-MM-dd'),
        amount: Math.max(0, roundCurrency(amount)),
      });
    }

    return plan;
  }, [formCountNum, formInterval, formManualAmounts, formLockedIndexes, formRemaining, formStartDate]);

  const handleFormCountChange = (value: string) => {
    setFormCount(value);
    setFormManualAmounts({});
    setFormLockedIndexes(new Set());
  };

  const toggleFormLock = (index: number) => {
    setFormLockedIndexes((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
        setFormManualAmounts((current) => {
          const copy = { ...current };
          delete copy[index];
          return copy;
        });
      } else {
        next.add(index);
        setFormManualAmounts((current) => ({ ...current, [index]: installmentPreview[index]?.amount ?? 0 }));
      }
      return next;
    });
  };

  const handleFormManualAmountChange = (index: number, value: string) => {
    const num = parseFloat(value);
    if (Number.isNaN(num) || num < 0) {
      toast.error('Geçerli bir taksit tutarı girin');
      return;
    }

    const lockedTotalExcludingCurrent = Array.from(formLockedIndexes).reduce((sum, lockedIndex) => {
      if (lockedIndex === index) return sum;
      return sum + Number(installmentPreview[lockedIndex]?.amount || 0);
    }, 0);

    if (roundCurrency(lockedTotalExcludingCurrent + num) > formRemaining + 0.01) {
      toast.error('Bu tutar, sabitlenen taksitlerle birlikte kalan borcu aşıyor');
      return;
    }

    setFormManualAmounts(() => {
      const next: Record<number, number> = {};
      formLockedIndexes.forEach((lockedIndex) => {
        if (lockedIndex !== index) {
          next[lockedIndex] = installmentPreview[lockedIndex]?.amount ?? 0;
        }
      });
      next[index] = roundCurrency(num);
      return next;
    });
  };

  const openPay = (p: InstallmentPayment) => { setSelectedPayment(p); setPayMethod('cash'); setPayDate(format(new Date(), 'yyyy-MM-dd')); setPayDialogOpen(true); };
  const openEdit = (p: InstallmentPayment) => { setEditPayment(p); setEditAmount(String(p.amount)); setEditDueDate(p.due_date); setEditLockedIds(new Set()); setEditDialogOpen(true); };

  // Group installment payments by installment
  const getInstPayments = (instId: string) => payments.filter(p => p.installment_id === instId);

  if (!hasPermission('can_manage_payments')) return <NoPermission feature="Taksit Yönetimi" />;
  if (salonLoading || loadingInst || loadingPay) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );

  return (
    <StaffPageGuard permissionKey="page_installments" featureLabel="Taksitler">
    <div className="page-container animate-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Taksit Yönetimi</h1>
          <p className="page-subtitle">{installments.length} taksit planı</p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="btn-gradient gap-2">
          <Plus className="h-4 w-4" /> Yeni Taksit
        </Button>
      </div>

      {/* Filter Buttons */}
      <div className="flex gap-2">
        <Button size="sm" variant={filterStatus === 'all' ? 'default' : 'outline'} onClick={() => setFilterStatus('all')}>Tümü</Button>
        <Button size="sm" variant={filterStatus === 'overdue' ? 'destructive' : 'outline'} onClick={() => setFilterStatus('overdue')}>
          Gecikmiş ({overduePayments.length})
        </Button>
        <Button size="sm" variant={filterStatus === 'upcoming' ? 'default' : 'outline'} onClick={() => setFilterStatus('upcoming')}>
          Yaklaşan
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        <div className="stat-card p-5">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Toplam Alacak</p>
              <p className="text-2xl font-bold tabular-nums">₺{totalOwed.toLocaleString('tr-TR')}</p>
            </div>
            <div className="h-11 w-11 rounded-xl flex items-center justify-center text-primary bg-primary/10"><Banknote className="h-5 w-5" /></div>
          </div>
        </div>
        <div className="stat-card p-5">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Toplam Tahsilat</p>
              <p className="text-2xl font-bold tabular-nums text-green-600">₺{totalPaid.toLocaleString('tr-TR')}</p>
            </div>
            <div className="h-11 w-11 rounded-xl flex items-center justify-center text-green-600 bg-green-500/10"><CheckCircle2 className="h-5 w-5" /></div>
          </div>
        </div>
        <div className="stat-card p-5">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Gecikmiş</p>
              <p className="text-2xl font-bold tabular-nums text-red-500">{overduePayments.length} taksit</p>
            </div>
            <div className="h-11 w-11 rounded-xl flex items-center justify-center text-red-500 bg-red-500/10"><AlertTriangle className="h-5 w-5" /></div>
          </div>
        </div>
      </div>

      {/* Overdue Warning */}
      {overduePayments.length > 0 && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-destructive flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" /> Gecikmiş Taksitler ({overduePayments.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {overduePayments.map(p => {
              const inst = installments.find(i => i.id === p.installment_id);
              return (
                <div key={p.id} className="flex items-center justify-between p-3 rounded-lg border border-destructive/20 bg-card">
                  <div>
                    <p className="text-sm font-medium">{inst ? getCustomerName(inst.customer_id) : '-'}</p>
                    <p className="text-xs text-muted-foreground">Taksit {p.installment_number} • Vade: {format(parseISO(p.due_date), 'd MMM yyyy', { locale: tr })}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-destructive">₺{Number(p.amount).toLocaleString('tr-TR')}</span>
                    <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => openPay(p)}>Ödendi</Button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Upcoming */}
      {upcomingPayments.length > 0 && (
        <Card className="shadow-soft border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" /> Yaklaşan Taksitler
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {upcomingPayments.map(p => {
              const inst = installments.find(i => i.id === p.installment_id);
              return (
                <div key={p.id} className="flex items-center justify-between p-3 rounded-lg border border-border/60 bg-card hover:bg-muted/30 transition-colors">
                  <div>
                    <p className="text-sm font-medium">{inst ? getCustomerName(inst.customer_id) : '-'}</p>
                    <p className="text-xs text-muted-foreground">Taksit {p.installment_number} • Vade: {format(parseISO(p.due_date), 'd MMM yyyy', { locale: tr })}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm">₺{Number(p.amount).toLocaleString('tr-TR')}</span>
                    <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => openPay(p)}>Ödendi</Button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* All Installment Plans - Collapsible per customer */}
      <Card className="shadow-soft border-border/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-primary" /> Taksit Planları
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {installments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Henüz taksit planı yok</p>
          ) : installments.filter(inst => {
            if (filterStatus === 'all') return true;
            const instPays = getInstPayments(inst.id);
            if (filterStatus === 'overdue') return instPays.some(p => !p.is_paid && isBefore(parseISO(p.due_date), today));
            if (filterStatus === 'upcoming') return instPays.some(p => !p.is_paid && !isBefore(parseISO(p.due_date), today));
            return true;
          }).map(inst => {
            const instPayments = getInstPayments(inst.id);
            const paid = instPayments.filter(p => p.is_paid).length;
            const hasOverdue = instPayments.some(p => !p.is_paid && isBefore(parseISO(p.due_date), today));
            const paidTotal = instPayments.filter(p => p.is_paid).reduce((s, p) => s + Number(p.paid_amount), 0);
            const customer = customers.find(c => c.id === inst.customer_id);
            const remaining = Number(inst.total_amount) - paidTotal;

            return (
              <Collapsible key={inst.id}>
                <div className={`rounded-xl border transition-colors ${hasOverdue ? 'border-destructive/40 bg-destructive/5' : 'border-border/60'}`}>
                  <CollapsibleTrigger asChild>
                    <button className="w-full text-left p-4 flex items-center gap-3 group cursor-pointer hover:bg-muted/30 rounded-xl transition-colors">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <User className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-sm truncate">{customer?.name || '-'}</p>
                          {hasOverdue && <Badge variant="destructive" className="text-[10px]">Gecikmiş</Badge>}
                          {paid === inst.installment_count && <Badge variant="outline" className="text-[10px] text-green-600 border-green-600/30">Tamamlandı</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {customer?.phone && <><Phone className="h-3 w-3 inline mr-1" />{customer.phone} • </>}
                          ₺{Number(inst.total_amount).toLocaleString('tr-TR')} • {paid}/{inst.installment_count} ödendi
                        </p>
                        {inst.notes && <p className="text-[11px] text-muted-foreground/60 truncate mt-0.5">{inst.notes}</p>}
                      </div>
                      <div className="text-right shrink-0 mr-2">
                        <p className="text-[10px] text-muted-foreground uppercase">Kalan</p>
                        <p className={`font-bold text-sm ${remaining > 0 ? 'text-destructive' : 'text-green-600'}`}>₺{remaining.toLocaleString('tr-TR')}</p>
                      </div>
                      <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                    </button>
                  </CollapsibleTrigger>

                  <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
                    <div className="px-4 pb-4 space-y-2">
                      {/* Progress */}
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(paid / inst.installment_count) * 100}%` }} />
                      </div>

                      {/* Individual installments */}
                      <div className="space-y-1.5">
                        {instPayments.map(p => (
                          <div key={p.id} className="flex items-center justify-between text-xs p-2 rounded-lg bg-muted/30">
                            <div className="flex items-center gap-2">
                              {p.is_paid ? (
                                <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                              ) : isBefore(parseISO(p.due_date), today) ? (
                                <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                              ) : (
                                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                              )}
                              <span>Taksit {p.installment_number}</span>
                              <span className="text-muted-foreground">{format(parseISO(p.due_date), 'd MMM yyyy', { locale: tr })}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">₺{Number(p.amount).toLocaleString('tr-TR')}</span>
                              {p.is_paid ? (
                                <Badge variant="outline" className="text-[10px] text-green-600">
                                  {PAYMENT_METHODS.find(m => m.value === p.payment_method)?.label || 'Ödendi'}
                                </Badge>
                              ) : (
                                <div className="flex gap-1">
                                  <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2" onClick={(e) => { e.stopPropagation(); openEdit(p); }}>
                                    <Pencil className="h-3 w-3" />
                                  </Button>
                                  <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2" onClick={(e) => { e.stopPropagation(); openPay(p); }}>Öde</Button>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            );
          })}
        </CardContent>
      </Card>

      {/* Create Installment Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="w-[min(96vw,68rem)] max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle>Yeni Taksit Planı</DialogTitle>
            <DialogDescription>Müşteri borcunu taksitlendirin</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto min-h-0 py-2">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.9fr)]">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label className="text-xs font-semibold">Müşteri *</Label>
                  <Select value={formCustomerId} onValueChange={setFormCustomerId}>
                    <SelectTrigger className="h-10"><SelectValue placeholder="Müşteri seçin" /></SelectTrigger>
                    <SelectContent>
                      {customers.filter(c => (c as any).customer_type !== 'single_session').map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold">Toplam Tutar (₺) *</Label>
                  <Input type="number" min="0" step="0.01" value={formTotal} onChange={e => setFormTotal(e.target.value)} placeholder="0.00" className="h-10" />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold">Peşinat (₺)</Label>
                  <Input type="number" min="0" value={formDownPayment} onChange={e => setFormDownPayment(e.target.value)} placeholder="0" className="h-10" />
                </div>

                {parseFloat(formDownPayment) > 0 && (
                  <div className="space-y-2 sm:col-span-2">
                    <Label className="text-xs font-semibold">Peşinat Ödeme Yöntemi</Label>
                    <Select value={downPaymentMethod} onValueChange={setDownPaymentMethod}>
                      <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PAYMENT_METHODS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-2">
                  <Label className="text-xs font-semibold">Taksit Sayısı *</Label>
                  <Select value={formCount} onValueChange={handleFormCountChange}>
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
                  <Select value={formInterval} onValueChange={(v) => setFormInterval(v as any)}>
                    <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="weekly">Haftalık</SelectItem>
                      <SelectItem value="biweekly">15 Günlük</SelectItem>
                      <SelectItem value="monthly">Aylık</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <Label className="text-xs font-semibold">İlk Taksit Tarihi</Label>
                  <Input type="date" value={formStartDate} onChange={e => setFormStartDate(e.target.value)} className="h-10" />
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <Label className="text-xs font-semibold">Not <span className="text-muted-foreground font-normal">(Opsiyonel)</span></Label>
                  <Input value={formNotes} onChange={e => setFormNotes(e.target.value)} placeholder="Taksit notu..." className="h-10" />
                </div>
              </div>

              <div className="space-y-3">
                <div className="p-4 rounded-lg bg-muted/50 border space-y-2">
                  <p className="text-xs font-semibold">Özet</p>
                  {parseFloat(formDownPayment) > 0 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Peşinat:</span>
                      <span className="font-medium">₺{parseFloat(formDownPayment).toLocaleString('tr-TR')}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Taksitlendirilecek:</span>
                    <span className="font-medium">₺{formRemaining.toLocaleString('tr-TR')}</span>
                  </div>
                  <div className="pt-2 border-t space-y-1">
                    <p className="text-xs text-muted-foreground">Ortalama taksit tutarı</p>
                    <p className="font-bold text-xl">₺{(formCountNum > 0 ? formRemaining / formCountNum : 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  </div>
                </div>
                <div className="p-4 rounded-lg border bg-muted/20 space-y-2">
                  <p className="text-xs font-semibold">Taksit Planı</p>
                  <div className="space-y-1 max-h-[36vh] overflow-y-auto pr-1">
                    {installmentPreview.map((item, index) => (
                      <div key={`${item.number}-${item.date}`} className={`flex items-center justify-between gap-2 rounded-lg border p-2 text-xs ${formLockedIndexes.has(index) ? 'bg-primary/5 border-primary/30' : 'bg-background/70'}`}>
                        <div className="flex items-center gap-2 min-w-0">
                          <button
                            type="button"
                            onClick={() => toggleFormLock(index)}
                            className={`shrink-0 p-0.5 rounded transition-colors ${formLockedIndexes.has(index) ? 'text-primary' : 'text-muted-foreground/40 hover:text-muted-foreground'}`}
                            title={formLockedIndexes.has(index) ? 'Sabitlemeyi kaldır' : 'Sabitle'}
                          >
                            {formLockedIndexes.has(index) ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                          </button>
                          <Badge variant="outline" className="text-[10px] w-5 h-5 justify-center p-0 shrink-0">{item.number}</Badge>
                          <span className="text-muted-foreground truncate">{format(new Date(item.date), 'd MMM yyyy', { locale: tr })}</span>
                        </div>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.amount}
                          onChange={(e) => handleFormManualAmountChange(index, e.target.value)}
                          className="h-7 w-24 text-right text-xs"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter className="shrink-0">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>İptal</Button>
            <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending} className="btn-gradient">
              {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Oluştur
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pay Dialog */}
      <Dialog open={payDialogOpen} onOpenChange={setPayDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Taksit Ödemesi</DialogTitle>
            <DialogDescription>
              {selectedPayment && `₺${Number(selectedPayment.amount).toLocaleString('tr-TR')} tutarındaki taksiti ödenmiş olarak işaretle`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Ödeme Yöntemi</Label>
              <Select value={payMethod} onValueChange={setPayMethod}>
                <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold">İşlem Tarihi</Label>
              <Input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} className="h-10" />
              <p className="text-[10px] text-muted-foreground">Geçmiş tarihli tahsilat için tarihi değiştirin</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayDialogOpen(false)}>İptal</Button>
            <Button onClick={() => markPaidMutation.mutate()} disabled={markPaidMutation.isPending} className="btn-gradient">
              {markPaidMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Ödendi İşaretle
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Installment Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle>Taksit Düzenle</DialogTitle>
            <DialogDescription>Taksit tutarını ve vade tarihini güncelleyin. Diğer taksitleri sabitleyebilirsiniz.</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto min-h-0 space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Taksit Tutarı (₺)</Label>
                <Input type="number" min="0" step="0.01" value={editAmount} onChange={e => setEditAmount(e.target.value)} className="h-9" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Vade Tarihi</Label>
                <Input type="date" value={editDueDate} onChange={e => setEditDueDate(e.target.value)} className="h-9" />
              </div>
            </div>

            {/* Sibling unpaid payments with lock toggles */}
            {editPayment && (() => {
              const siblings = payments.filter(
                p => p.installment_id === editPayment.installment_id && !p.is_paid && p.id !== editPayment.id
              );
              if (siblings.length === 0) return null;
              return (
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold flex items-center gap-1">
                    <Lock className="h-3 w-3" /> Diğer Taksitler — Sabitle
                  </Label>
                  <p className="text-[10px] text-muted-foreground">Sabitlenmiş taksitler değişiklikten etkilenmez.</p>
                  <div className="space-y-1 max-h-[30vh] overflow-y-auto">
                    {siblings.map(s => {
                      const isLocked = editLockedIds.has(s.id);
                      return (
                        <div
                          key={s.id}
                          className={`flex items-center justify-between text-xs p-2 rounded-lg border ${isLocked ? 'border-primary/40 bg-primary/5' : 'border-border/60'}`}
                        >
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setEditLockedIds(prev => {
                                const next = new Set(prev);
                                if (next.has(s.id)) next.delete(s.id); else next.add(s.id);
                                return next;
                              })}
                              className={`shrink-0 p-1 rounded-md transition-all ${isLocked
                                ? 'bg-primary/15 text-primary ring-1 ring-primary/30'
                                : 'text-muted-foreground/40 hover:text-muted-foreground hover:bg-muted'
                              }`}
                              title={isLocked ? 'Sabitlemeyi kaldır' : 'Sabitle'}
                            >
                              {isLocked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
                            </button>
                            <span>Taksit {s.installment_number}</span>
                            <span className="text-muted-foreground">
                              {format(parseISO(s.due_date), 'd MMM yyyy', { locale: tr })}
                            </span>
                          </div>
                          <span className="font-medium">{Number(s.amount).toLocaleString('tr-TR')} ₺</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </div>
          <DialogFooter className="shrink-0">
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>İptal</Button>
            <Button onClick={() => editPaymentMutation.mutate()} disabled={editPaymentMutation.isPending} className="btn-gradient">
              {editPaymentMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Kaydet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </StaffPageGuard>
  );
}
