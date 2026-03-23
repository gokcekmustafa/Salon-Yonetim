import { useState } from 'react';
import { useFormGuard } from '@/hooks/useFormGuard';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useBranchFilteredData } from '@/hooks/useBranchFilteredData';
import { usePermissions } from '@/hooks/usePermissions';
import { NoPermission } from '@/components/permissions/NoPermission';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Loader2, Plus, Wallet, Banknote, Users, DollarSign, TrendingDown,
  Gift, ArrowDownCircle, History, Settings2
} from 'lucide-react';
import { format, parseISO, startOfDay, startOfWeek, startOfMonth, startOfYear, endOfDay, isWithinInterval } from 'date-fns';
import { tr } from 'date-fns/locale';
import { StaffPageGuard } from '@/components/permissions/StaffPageGuard';

type StaffSalary = {
  id: string; staff_id: string; salon_id: string; monthly_salary: number;
  created_at: string; updated_at: string;
};

type StaffPayment = {
  id: string; staff_id: string; salon_id: string; payment_type: string;
  amount: number; payment_method: string; cash_box_id: string | null;
  payment_date: string; description: string | null; created_by: string; created_at: string;
};

type CashBox = {
  id: string; salon_id: string; name: string; payment_method: string; is_active: boolean;
};

const PAYMENT_TYPES = [
  { value: 'salary', label: 'Maaş Ödemesi', icon: Banknote },
  { value: 'advance', label: 'Avans', icon: ArrowDownCircle },
  { value: 'bonus', label: 'Prim / Komisyon', icon: Gift },
  { value: 'other', label: 'Diğer', icon: DollarSign },
];

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Nakit' },
  { value: 'credit_card', label: 'Kredi Kartı' },
  { value: 'eft', label: 'EFT / Havale' },
];

type TimeRange = 'daily' | 'weekly' | 'monthly' | 'yearly';
const TIME_LABELS: Record<TimeRange, string> = { daily: 'Günlük', weekly: 'Haftalık', monthly: 'Aylık', yearly: 'Yıllık' };

function getDateRange(range: TimeRange) {
  const now = new Date();
  const end = endOfDay(now);
  switch (range) {
    case 'daily': return { start: startOfDay(now), end };
    case 'weekly': return { start: startOfWeek(now, { weekStartsOn: 1 }), end };
    case 'monthly': return { start: startOfMonth(now), end };
    case 'yearly': return { start: startOfYear(now), end };
  }
}

export default function StaffSalaryPage() {
  const { hasPermission } = usePermissions();
  const { user, currentSalonId } = useAuth();
  const { staff, loading: salonLoading } = useBranchFilteredData();
  const queryClient = useQueryClient();
  const salonId = currentSalonId;

  const [selectedStaffId, setSelectedStaffId] = useState<string>('all');
  const [timeRange, setTimeRange] = useState<TimeRange>('monthly');
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [salaryDialogOpen, setSalaryDialogOpen] = useState(false);
  useFormGuard(payDialogOpen || salaryDialogOpen);
  const [salaryStaffId, setSalaryStaffId] = useState('');
  const [salaryAmount, setSalaryAmount] = useState('');

  // Pay form
  const [payStaffId, setPayStaffId] = useState('');
  const [payType, setPayType] = useState('salary');
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('cash');
  const [payCashBoxId, setPayCashBoxId] = useState('none');
  const [payDesc, setPayDesc] = useState('');

  const { data: salaries = [], isLoading: loadingSal } = useQuery({
    queryKey: ['staff_salaries', salonId],
    queryFn: async () => {
      if (!salonId) return [];
      const { data } = await supabase.from('staff_salaries').select('*').eq('salon_id', salonId);
      return (data || []) as StaffSalary[];
    },
    enabled: !!salonId,
  });

  const { data: staffPayments = [], isLoading: loadingPay } = useQuery({
    queryKey: ['staff_payments', salonId],
    queryFn: async () => {
      if (!salonId) return [];
      const { data } = await supabase.from('staff_payments').select('*').eq('salon_id', salonId).order('payment_date', { ascending: false });
      return (data || []) as StaffPayment[];
    },
    enabled: !!salonId,
  });

  const { data: cashBoxes = [] } = useQuery({
    queryKey: ['cash_boxes_sal', salonId],
    queryFn: async () => {
      if (!salonId) return [];
      const { data } = await supabase.from('cash_boxes').select('*').eq('salon_id', salonId).eq('is_active', true);
      return (data || []) as CashBox[];
    },
    enabled: !!salonId,
  });

  const saveSalaryMutation = useMutation({
    mutationFn: async () => {
      if (!salonId || !salaryStaffId) throw new Error('Personel seçin');
      const amount = parseFloat(salaryAmount);
      if (isNaN(amount) || amount < 0) throw new Error('Geçerli tutar girin');

      const existing = salaries.find(s => s.staff_id === salaryStaffId);
      if (existing) {
        const { error } = await supabase.from('staff_salaries').update({ monthly_salary: amount } as any).eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('staff_salaries').insert({
          staff_id: salaryStaffId, salon_id: salonId, monthly_salary: amount,
        } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff_salaries', salonId] });
      toast.success('Maaş bilgisi kaydedildi');
      setSalaryDialogOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const makePaymentMutation = useMutation({
    mutationFn: async () => {
      if (!salonId || !user) throw new Error('Missing');
      if (!payStaffId) throw new Error('Personel seçin');
      const amount = parseFloat(payAmount);
      if (isNaN(amount) || amount <= 0) throw new Error('Geçerli tutar girin');

      // Insert staff payment
      const { error } = await supabase.from('staff_payments').insert({
        staff_id: payStaffId, salon_id: salonId, payment_type: payType,
        amount, payment_method: payMethod,
        cash_box_id: payCashBoxId === 'none' ? null : payCashBoxId,
        description: payDesc.trim() || null, created_by: user.id,
      } as any);
      if (error) throw error;

      // Also record as cash transaction (expense)
      await supabase.from('cash_transactions').insert({
        salon_id: salonId, amount, type: 'expense',
        payment_method: payMethod, cash_box_id: payCashBoxId === 'none' ? null : payCashBoxId,
        description: `Personel ödemesi: ${staff.find(s => s.id === payStaffId)?.name || ''} - ${PAYMENT_TYPES.find(t => t.value === payType)?.label || payType}`,
        created_by: user.id,
      } as any);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff_payments', salonId] });
      toast.success('Ödeme kaydedildi');
      setPayDialogOpen(false);
      setPayStaffId(''); setPayAmount(''); setPayDesc(''); setPayType('salary');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!hasPermission('can_manage_staff')) return <NoPermission feature="Personel Maaş Yönetimi" />;
  if (salonLoading || loadingSal || loadingPay) return (
    <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
  );

  const activeStaff = staff.filter(s => s.is_active);
  const { start, end } = getDateRange(timeRange);
  const inRange = (d: string) => { try { return isWithinInterval(new Date(d), { start, end }); } catch { return false; } };

  // Build per-staff summary
  const staffSummaries = activeStaff.map(s => {
    const salary = salaries.find(sal => sal.staff_id === s.id);
    const monthlySalary = salary ? Number(salary.monthly_salary) : 0;
    const allPayments = staffPayments.filter(p => p.staff_id === s.id);
    const periodPayments = allPayments.filter(p => inRange(p.payment_date));

    const totalPaid = periodPayments.reduce((sum, p) => sum + Number(p.amount), 0);
    const salaryPaid = periodPayments.filter(p => p.payment_type === 'salary').reduce((sum, p) => sum + Number(p.amount), 0);
    const advancePaid = periodPayments.filter(p => p.payment_type === 'advance').reduce((sum, p) => sum + Number(p.amount), 0);
    const bonusPaid = periodPayments.filter(p => p.payment_type === 'bonus').reduce((sum, p) => sum + Number(p.amount), 0);
    const remaining = monthlySalary - salaryPaid;

    return {
      ...s, monthlySalary, totalPaid, salaryPaid, advancePaid, bonusPaid, remaining,
      payments: periodPayments,
    };
  });

  const displayStaff = selectedStaffId === 'all' ? staffSummaries : staffSummaries.filter(s => s.id === selectedStaffId);

  const totalSalaryOwed = displayStaff.reduce((s, d) => s + d.monthlySalary, 0);
  const totalPaidAll = displayStaff.reduce((s, d) => s + d.totalPaid, 0);
  const totalRemaining = displayStaff.reduce((s, d) => s + Math.max(0, d.remaining), 0);

  const openSalaryEdit = (staffId: string) => {
    const sal = salaries.find(s => s.staff_id === staffId);
    setSalaryStaffId(staffId);
    setSalaryAmount(sal ? String(sal.monthly_salary) : '');
    setSalaryDialogOpen(true);
  };

  const openPayDialog = (staffId?: string) => {
    setPayStaffId(staffId || '');
    setPayAmount(''); setPayDesc(''); setPayType('salary'); setPayMethod('cash'); setPayCashBoxId('none');
    setPayDialogOpen(true);
  };

  return (
    <StaffPageGuard permissionKey="page_salary" featureLabel="Maaş & Ödeme">
    <div className="page-container animate-in space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Personel Maaş & Ödeme</h1>
          <p className="page-subtitle">Maaş takibi, ödeme geçmişi ve bakiye yönetimi</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Select value={timeRange} onValueChange={v => setTimeRange(v as TimeRange)}>
            <SelectTrigger className="h-10 w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(TIME_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={selectedStaffId} onValueChange={setSelectedStaffId}>
            <SelectTrigger className="h-10 w-44"><SelectValue placeholder="Tüm Personel" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tüm Personel</SelectItem>
              {activeStaff.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={() => openPayDialog()} className="btn-gradient gap-2">
            <Plus className="h-4 w-4" /> Ödeme Yap
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        <Card className="shadow-soft border-border/60">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Toplam Maaş</p>
                <p className="text-2xl font-bold tabular-nums">₺{totalSalaryOwed.toLocaleString('tr-TR')}</p>
              </div>
              <div className="h-11 w-11 rounded-xl flex items-center justify-center text-primary bg-primary/10"><Wallet className="h-5 w-5" /></div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-soft border-border/60">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Toplam Ödenen</p>
                <p className="text-2xl font-bold tabular-nums">₺{totalPaidAll.toLocaleString('tr-TR')}</p>
              </div>
              <div className="h-11 w-11 rounded-xl flex items-center justify-center text-primary bg-primary/10"><Banknote className="h-5 w-5" /></div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-soft border-border/60">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Kalan Borç</p>
                <p className="text-2xl font-bold tabular-nums text-destructive">₺{totalRemaining.toLocaleString('tr-TR')}</p>
              </div>
              <div className="h-11 w-11 rounded-xl flex items-center justify-center text-destructive bg-destructive/10"><TrendingDown className="h-5 w-5" /></div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Özet</TabsTrigger>
          <TabsTrigger value="history">Ödeme Geçmişi</TabsTrigger>
        </TabsList>

        {/* OVERVIEW */}
        <TabsContent value="overview" className="space-y-4">
          {displayStaff.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>Aktif personel bulunamadı</p>
            </CardContent></Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {displayStaff.map(s => (
                <Card key={s.id} className="shadow-soft border-border/60">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-sm font-bold text-primary">{s.name.charAt(0)}</span>
                        </div>
                        <div>
                          <CardTitle className="text-sm">{s.name}</CardTitle>
                          <p className="text-xs text-muted-foreground">
                            Maaş: ₺{s.monthlySalary.toLocaleString('tr-TR')}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => openSalaryEdit(s.id)} title="Maaş düzenle">
                          <Settings2 className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => openPayDialog(s.id)}>
                          <Plus className="h-3.5 w-3.5 mr-1" /> Öde
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 rounded-lg bg-muted/30">
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase">Maaş Ödenen</p>
                        <p className="text-sm font-bold tabular-nums">₺{s.salaryPaid.toLocaleString('tr-TR')}</p>
                      </div>
                      <div className="p-3 rounded-lg bg-muted/30">
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase">Kalan</p>
                        <p className={`text-sm font-bold tabular-nums ${s.remaining > 0 ? 'text-destructive' : ''}`}>
                          ₺{Math.max(0, s.remaining).toLocaleString('tr-TR')}
                        </p>
                      </div>
                      <div className="p-3 rounded-lg bg-muted/30">
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase">Avans</p>
                        <p className="text-sm font-bold tabular-nums">₺{s.advancePaid.toLocaleString('tr-TR')}</p>
                      </div>
                      <div className="p-3 rounded-lg bg-muted/30">
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase">Prim</p>
                        <p className="text-sm font-bold tabular-nums">₺{s.bonusPaid.toLocaleString('tr-TR')}</p>
                      </div>
                    </div>

                    {/* Progress bar */}
                    {s.monthlySalary > 0 && (
                      <div>
                        <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                          <span>Maaş ödeme durumu</span>
                          <span>{Math.min(100, Math.round((s.salaryPaid / s.monthlySalary) * 100))}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.min(100, (s.salaryPaid / s.monthlySalary) * 100)}%` }} />
                        </div>
                      </div>
                    )}

                    {/* Recent payments */}
                    {s.payments.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase">Son Ödemeler</p>
                        {s.payments.slice(0, 3).map(p => (
                          <div key={p.id} className="flex items-center justify-between text-xs p-2 rounded-lg bg-muted/20">
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary" className="text-[9px]">
                                {PAYMENT_TYPES.find(t => t.value === p.payment_type)?.label || p.payment_type}
                              </Badge>
                              <span className="text-muted-foreground">{format(parseISO(p.payment_date), 'd MMM', { locale: tr })}</span>
                            </div>
                            <span className="font-medium">₺{Number(p.amount).toLocaleString('tr-TR')}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* HISTORY */}
        <TabsContent value="history">
          <Card className="shadow-soft border-border/60 overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <History className="h-4 w-4 text-primary" /> Ödeme Geçmişi
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="font-semibold">Personel</TableHead>
                    <TableHead className="font-semibold">Tür</TableHead>
                    <TableHead className="font-semibold hidden md:table-cell">Yöntem</TableHead>
                    <TableHead className="font-semibold hidden lg:table-cell">Açıklama</TableHead>
                    <TableHead className="font-semibold">Tarih</TableHead>
                    <TableHead className="font-semibold text-right">Tutar</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {staffPayments.filter(p => selectedStaffId === 'all' || p.staff_id === selectedStaffId).filter(p => inRange(p.payment_date)).length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">Bu dönemde ödeme bulunamadı</TableCell></TableRow>
                  ) : (
                    staffPayments
                      .filter(p => selectedStaffId === 'all' || p.staff_id === selectedStaffId)
                      .filter(p => inRange(p.payment_date))
                      .map(p => (
                        <TableRow key={p.id}>
                          <TableCell className="font-medium text-sm">
                            {staff.find(s => s.id === p.staff_id)?.name || '-'}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="text-[10px]">
                              {PAYMENT_TYPES.find(t => t.value === p.payment_type)?.label || p.payment_type}
                            </Badge>
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-muted-foreground text-xs">
                            {PAYMENT_METHODS.find(m => m.value === p.payment_method)?.label || p.payment_method}
                          </TableCell>
                          <TableCell className="hidden lg:table-cell text-muted-foreground text-xs max-w-[200px] truncate">
                            {p.description || '-'}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {format(parseISO(p.payment_date), 'd MMM yyyy', { locale: tr })}
                          </TableCell>
                          <TableCell className="text-right font-semibold tabular-nums">
                            ₺{Number(p.amount).toLocaleString('tr-TR')}
                          </TableCell>
                        </TableRow>
                      ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Salary Edit Dialog */}
      <Dialog open={salaryDialogOpen} onOpenChange={setSalaryDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Maaş Bilgisi</DialogTitle>
            <DialogDescription>{staff.find(s => s.id === salaryStaffId)?.name} için aylık maaş belirleyin</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Aylık Maaş (₺)</Label>
              <Input type="number" min="0" step="0.01" value={salaryAmount} onChange={e => setSalaryAmount(e.target.value)} placeholder="0.00" className="h-10" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSalaryDialogOpen(false)}>İptal</Button>
            <Button onClick={() => saveSalaryMutation.mutate()} disabled={saveSalaryMutation.isPending}>
              {saveSalaryMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Kaydet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Dialog */}
      <Dialog open={payDialogOpen} onOpenChange={setPayDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Personel Ödemesi</DialogTitle>
            <DialogDescription>Personele ödeme yapın ve kasa hesabını seçin</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Personel *</Label>
              <Select value={payStaffId} onValueChange={setPayStaffId}>
                <SelectTrigger className="h-10"><SelectValue placeholder="Personel seçin" /></SelectTrigger>
                <SelectContent>
                  {activeStaff.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Ödeme Türü</Label>
                <Select value={payType} onValueChange={setPayType}>
                  <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PAYMENT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Tutar (₺) *</Label>
                <Input type="number" min="0" step="0.01" value={payAmount} onChange={e => setPayAmount(e.target.value)} placeholder="0.00" className="h-10" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
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
                <Label className="text-xs font-semibold">Kasa Hesabı</Label>
                <Select value={payCashBoxId} onValueChange={setPayCashBoxId}>
                  <SelectTrigger className="h-10"><SelectValue placeholder="Kasa seçin" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Genel —</SelectItem>
                    {cashBoxes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Açıklama</Label>
              <Textarea value={payDesc} onChange={e => setPayDesc(e.target.value)} placeholder="Ödeme notu..." rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayDialogOpen(false)}>İptal</Button>
            <Button onClick={() => makePaymentMutation.mutate()} disabled={makePaymentMutation.isPending} className="btn-gradient">
              {makePaymentMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Ödeme Yap
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </StaffPageGuard>
  );
}
