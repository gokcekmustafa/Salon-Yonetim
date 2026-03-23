import { useState, useMemo } from 'react';
import { useFormGuard } from '@/hooks/useFormGuard';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
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
import { Loader2, Plus, CreditCard, AlertTriangle, CheckCircle2, Clock, Banknote } from 'lucide-react';
import { format, parseISO, isBefore, startOfDay, addMonths } from 'date-fns';
import { tr } from 'date-fns/locale';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { StaffPageGuard } from '@/components/permissions/StaffPageGuard';

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

export default function InstallmentsPage() {
  const { hasPermission } = usePermissions();
  const { user, currentSalonId } = useAuth();
  const { customers, loading: salonLoading } = useSalonData();
  const queryClient = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  useFormGuard(dialogOpen || payDialogOpen);
  const [selectedPayment, setSelectedPayment] = useState<InstallmentPayment | null>(null);
  const [payMethod, setPayMethod] = useState('cash');

  // Form
  const [formCustomerId, setFormCustomerId] = useState('');
  const [formTotal, setFormTotal] = useState('');
  const [formCount, setFormCount] = useState('3');
  const [formNotes, setFormNotes] = useState('');
  const [formStartDate, setFormStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const salonId = currentSalonId;

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
      if (isNaN(total) || total <= 0) throw new Error('Geçerli tutar girin');
      if (!formCustomerId) throw new Error('Müşteri seçin');

      const { data: inst, error } = await supabase.from('installments').insert({
        salon_id: salonId,
        customer_id: formCustomerId,
        total_amount: total,
        installment_count: count,
        notes: formNotes || null,
        created_by: user.id,
      } as any).select('id').single();
      if (error || !inst) throw error || new Error('Failed');

      const perAmount = Math.round((total / count) * 100) / 100;
      const installmentPayments = Array.from({ length: count }, (_, i) => ({
        installment_id: inst.id,
        salon_id: salonId,
        due_date: format(addMonths(new Date(formStartDate), i), 'yyyy-MM-dd'),
        amount: i === count - 1 ? Math.round((total - perAmount * (count - 1)) * 100) / 100 : perAmount,
        installment_number: i + 1,
      }));

      const { error: payErr } = await supabase.from('installment_payments').insert(installmentPayments as any);
      if (payErr) throw payErr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['installments', salonId] });
      queryClient.invalidateQueries({ queryKey: ['installment_payments', salonId] });
      toast.success('Taksit planı oluşturuldu');
      setDialogOpen(false);
      setFormCustomerId(''); setFormTotal(''); setFormCount('3'); setFormNotes('');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const markPaidMutation = useMutation({
    mutationFn: async () => {
      if (!selectedPayment) throw new Error('No payment');
      const { error } = await supabase.from('installment_payments').update({
        is_paid: true,
        paid_amount: selectedPayment.amount,
        paid_at: new Date().toISOString(),
        payment_method: payMethod,
      } as any).eq('id', selectedPayment.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['installment_payments', salonId] });
      toast.success('Taksit ödendi olarak işaretlendi');
      setPayDialogOpen(false);
      setSelectedPayment(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!hasPermission('can_manage_payments')) return <NoPermission feature="Taksit Yönetimi" />;
  if (salonLoading || loadingInst || loadingPay) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );

  const today = startOfDay(new Date());
  const getCustomerName = (id: string) => customers.find(c => c.id === id)?.name ?? '-';

  // Upcoming & overdue
  const unpaidPayments = payments.filter(p => !p.is_paid);
  const overduePayments = unpaidPayments.filter(p => isBefore(parseISO(p.due_date), today));
  const upcomingPayments = unpaidPayments.filter(p => !isBefore(parseISO(p.due_date), today)).slice(0, 10);

  const totalOwed = unpaidPayments.reduce((s, p) => s + Number(p.amount), 0);
  const totalPaid = payments.filter(p => p.is_paid).reduce((s, p) => s + Number(p.paid_amount), 0);

  const openPay = (p: InstallmentPayment) => { setSelectedPayment(p); setPayMethod('cash'); setPayDialogOpen(true); };

  // Group installment payments by installment
  const getInstPayments = (instId: string) => payments.filter(p => p.installment_id === instId);

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

      {/* All Installment Plans */}
      <Card className="shadow-soft border-border/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-primary" /> Taksit Planları
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {installments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Henüz taksit planı yok</p>
          ) : installments.map(inst => {
            const instPayments = getInstPayments(inst.id);
            const paid = instPayments.filter(p => p.is_paid).length;
            const hasOverdue = instPayments.some(p => !p.is_paid && isBefore(parseISO(p.due_date), today));
            const paidTotal = instPayments.filter(p => p.is_paid).reduce((s, p) => s + Number(p.paid_amount), 0);

            return (
    <StaffPageGuard permissionKey="page_installments" featureLabel="Taksitler">
              <div key={inst.id} className={`p-4 rounded-xl border ${hasOverdue ? 'border-destructive/40 bg-destructive/5' : 'border-border/60'}`}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm">{getCustomerName(inst.customer_id)}</p>
                      {hasOverdue && <Badge variant="destructive" className="text-[10px]">Gecikmiş</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      ₺{Number(inst.total_amount).toLocaleString('tr-TR')} • {inst.installment_count} taksit • {paid}/{inst.installment_count} ödendi
                    </p>
                    {inst.notes && <p className="text-xs text-muted-foreground/70 mt-0.5">{inst.notes}</p>}
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Kalan</p>
                    <p className="font-bold text-sm">₺{(Number(inst.total_amount) - paidTotal).toLocaleString('tr-TR')}</p>
                  </div>
                </div>

                {/* Progress */}
                <div className="h-2 rounded-full bg-muted overflow-hidden mb-3">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${(paid / inst.installment_count) * 100}%` }}
                  />
                </div>

                {/* Individual installments */}
                <div className="space-y-1.5">
                  {instPayments.map(p => (
                    <div key={p.id} className="flex items-center justify-between text-xs p-2 rounded-lg bg-muted/30">
                      <div className="flex items-center gap-2">
                        {p.is_paid ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                        ) : isBefore(parseISO(p.due_date), today) ? (
                          <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
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
                          <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2" onClick={() => openPay(p)}>Öde</Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Create Installment Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Yeni Taksit Planı</DialogTitle>
            <DialogDescription>Müşteri borcunu taksitlendirin</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
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
              <Label className="text-xs font-semibold">Taksit Sayısı *</Label>
              <Select value={formCount} onValueChange={setFormCount}>
                <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[2, 3, 4, 5, 6, 8, 10, 12].map(n => (
                    <SelectItem key={n} value={String(n)}>{n} Taksit</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold">İlk Taksit Tarihi</Label>
              <Input type="date" value={formStartDate} onChange={e => setFormStartDate(e.target.value)} className="h-10" />
            </div>
            {formTotal && formCount && (
              <div className="p-3 rounded-lg bg-muted/50 border">
                <p className="text-xs text-muted-foreground">Aylık taksit tutarı:</p>
                <p className="font-bold text-lg">₺{(parseFloat(formTotal || '0') / parseInt(formCount || '1')).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>
            )}
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Not <span className="text-muted-foreground font-normal">(Opsiyonel)</span></Label>
              <Input value={formNotes} onChange={e => setFormNotes(e.target.value)} placeholder="Taksit notu..." className="h-10" />
            </div>
          </div>
          <DialogFooter>
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayDialogOpen(false)}>İptal</Button>
            <Button onClick={() => markPaidMutation.mutate()} disabled={markPaidMutation.isPending} className="btn-gradient">
              {markPaidMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Ödendi İşaretle
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </StaffPageGuard>
  );
}
