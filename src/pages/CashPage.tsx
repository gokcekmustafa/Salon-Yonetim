import { useState, useMemo, useCallback, useEffect } from 'react';
import { useFormGuard } from '@/hooks/useFormGuard';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useSalonData } from '@/hooks/useSalonData';
import { usePermissions } from '@/hooks/usePermissions';
import { NoPermission } from '@/components/permissions/NoPermission';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { format, parseISO, isSameMonth, isSameDay, startOfDay, subDays, addDays, isToday as dateFnsIsToday } from 'date-fns';
import { tr } from 'date-fns/locale';
import {
  Wallet, TrendingUp, TrendingDown, Plus, Loader2, ArrowUpCircle, ArrowDownCircle,
  Receipt, Pencil, Trash2, Banknote, CreditCard, Building2, Send, FileSpreadsheet, FileText,
  Clock, Check, X, ChevronLeft, ChevronRight, CalendarDays,
} from 'lucide-react';
import { exportToExcel, exportToPDF } from '@/lib/exportUtils';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { StaffPageGuard } from '@/components/permissions/StaffPageGuard';
import { ProductSaleDialog } from '@/components/products/ProductSaleDialog';
import { CashMonthlyStats } from '@/components/cash/CashMonthlyStats';

type CashBox = { id: string; salon_id: string; name: string; payment_method: string; is_active: boolean };
type CashTransaction = {
  id: string; salon_id: string; type: string; amount: number;
  description: string | null; transaction_date: string;
  created_by: string; created_at: string;
  cash_box_id: string | null; payment_method: string;
};

const DEFAULT_BOXES = [
  { name: 'Nakit', payment_method: 'cash' },
  { name: 'EFT / Havale', payment_method: 'eft' },
  { name: 'Kredi Kartı', payment_method: 'credit_card' },
];

const METHOD_LABELS: Record<string, string> = {
  cash: 'Nakit', eft: 'EFT / Havale', credit_card: 'Kredi Kartı',
};

export default function CashPage() {
  const { hasPermission } = usePermissions();
  const { user, currentSalonId } = useAuth();
  const { loading: salonLoading } = useSalonData();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [month, setMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [dialogOpen, setDialogOpen] = useState(false);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [productSaleOpen, setProductSaleOpen] = useState(false);
  useFormGuard(dialogOpen || transferDialogOpen || productSaleOpen);
  const [editingTx, setEditingTx] = useState<CashTransaction | null>(null);

  // Transaction form
  const [txType, setTxType] = useState<'income' | 'expense'>('income');
  const [txAmount, setTxAmount] = useState('');
  const [txDescription, setTxDescription] = useState('');
  const [txDate, setTxDate] = useState(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
  const [txSourceBox, setTxSourceBox] = useState<string>('');
  const [txIncomeMethod, setTxIncomeMethod] = useState<string>('cash');

  // Transfer form
  const [transferFromBox, setTransferFromBox] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferDescription, setTransferDescription] = useState('');

  const salonId = currentSalonId;
  const [selectedDate, setSelectedDate] = useState(new Date());
  const isSelectedToday = dateFnsIsToday(selectedDate);

  // Fetch cash boxes
  const { data: cashBoxes = [], isLoading: loadingBoxes } = useQuery({
    queryKey: ['cash_boxes', salonId],
    queryFn: async () => {
      if (!salonId) return [];
      const { data } = await supabase.from('cash_boxes').select('*').eq('salon_id', salonId).order('name');
      return (data || []) as CashBox[];
    },
    enabled: !!salonId,
  });

  // Auto-create default 3 boxes if missing
  useEffect(() => {
    if (!salonId || loadingBoxes || cashBoxes.length > 0) return;
    const createDefaults = async () => {
      const inserts = DEFAULT_BOXES.map(b => ({ ...b, salon_id: salonId }));
      await supabase.from('cash_boxes').insert(inserts as any);
      queryClient.invalidateQueries({ queryKey: ['cash_boxes', salonId] });
    };
    createDefaults();
  }, [salonId, loadingBoxes, cashBoxes.length, queryClient]);

  // Fetch transactions
  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ['cash_transactions', salonId],
    queryFn: async () => {
      if (!salonId) return [];
      const { data } = await supabase.from('cash_transactions').select('*').eq('salon_id', salonId).order('transaction_date', { ascending: false });
      return (data || []) as CashTransaction[];
    },
    enabled: !!salonId && !!user,
  });

  const dayTransactions = useMemo(() => {
    return transactions.filter(tx => {
      try { return isSameDay(parseISO(tx.transaction_date), selectedDate); } catch { return false; }
    });
  }, [transactions, selectedDate]);

  const dayIncome = useMemo(() => dayTransactions.filter(t => t.type === 'income'), [dayTransactions]);
  const dayExpense = useMemo(() => dayTransactions.filter(t => t.type === 'expense'), [dayTransactions]);

  // Monthly transactions for stats
  const monthTransactions = useMemo(() => {
    return transactions.filter(tx => {
      try { return isSameMonth(parseISO(tx.transaction_date), parseISO(month + '-01')); } catch { return false; }
    });
  }, [transactions, month]);

  // Calculate balances per box (all-time) — include transactions matched by payment_method when cash_box_id is null
  const boxBalances = useMemo(() => {
    return cashBoxes.map(box => {
      const boxTxs = transactions.filter(t =>
        t.cash_box_id === box.id ||
        (t.cash_box_id === null && t.payment_method === box.payment_method)
      );
      const income = boxTxs.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
      const expense = boxTxs.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
      return { ...box, income, expense, balance: income - expense };
    });
  }, [cashBoxes, transactions]);

  const dayMethodTotals = useMemo(() => {
    const methods: Record<string, { income: number; expense: number }> = {};
    DEFAULT_BOXES.forEach(b => { methods[b.payment_method] = { income: 0, expense: 0 }; });
    dayTransactions.forEach(tx => {
      const key = tx.payment_method || 'cash';
      if (!methods[key]) methods[key] = { income: 0, expense: 0 };
      if (tx.type === 'income') methods[key].income += Number(tx.amount);
      else methods[key].expense += Number(tx.amount);
    });
    return methods;
  }, [dayTransactions]);

  // Day totals
  const dayIncomeTotal = dayIncome.reduce((s, t) => s + Number(t.amount), 0);
  const dayExpenseTotal = dayExpense.reduce((s, t) => s + Number(t.amount), 0);

  // Carryover: all transactions before selectedDate
  const carryover = useMemo(() => {
    const dayStart = startOfDay(selectedDate);
    const beforeDay = transactions.filter(tx => {
      try { return parseISO(tx.transaction_date) < dayStart; } catch { return false; }
    });
    const inc = beforeDay.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
    const exp = beforeDay.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
    return inc - exp;
  }, [transactions, selectedDate]);

  const resetForm = useCallback(() => {
    setTxType('income'); setTxAmount(''); setTxDescription('');
    setTxDate(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
    setTxSourceBox(''); setTxIncomeMethod('cash'); setEditingTx(null);
  }, []);

  // Save transaction
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!salonId || !user) throw new Error('Oturum bulunamadı');
      const amount = parseFloat(txAmount);
      if (isNaN(amount) || amount <= 0) throw new Error('Geçerli bir tutar girin');

      let targetBoxId: string | null = null;
      let paymentMethod = 'cash';

      if (txType === 'income') {
        const targetBox = cashBoxes.find(b => b.payment_method === txIncomeMethod);
        targetBoxId = targetBox?.id || null;
        paymentMethod = txIncomeMethod;
      } else {
        if (!txSourceBox) throw new Error('Lütfen harcama yapılacak kasayı seçin');
        targetBoxId = txSourceBox;
        const sourceBox = cashBoxes.find(b => b.id === txSourceBox);
        paymentMethod = sourceBox?.payment_method || 'cash';
      }

      const payload: any = {
        type: txType, amount,
        description: txDescription || null,
        transaction_date: new Date(txDate).toISOString(),
        payment_method: paymentMethod,
        cash_box_id: targetBoxId,
      };

      if (editingTx) {
        const { error } = await supabase.from('cash_transactions').update(payload).eq('id', editingTx.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('cash_transactions').insert({ ...payload, salon_id: salonId, created_by: user.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cash_transactions', salonId] });
      toast.success(editingTx ? 'İşlem güncellendi' : 'İşlem eklendi');
      setDialogOpen(false); resetForm();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Delete transaction
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('cash_transactions').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cash_transactions', salonId] });
      toast.success('İşlem silindi');
    },
  });

  // Bulk transfer
  const transferMutation = useMutation({
    mutationFn: async () => {
      if (!salonId || !user) throw new Error('Oturum bulunamadı');
      const amount = parseFloat(transferAmount);
      if (isNaN(amount) || amount <= 0) throw new Error('Geçerli bir tutar girin');
      if (!transferFromBox) throw new Error('Kaynak kasayı seçin');

      const { error } = await supabase.from('cash_transactions').insert({
        salon_id: salonId, created_by: user.id, type: 'expense', amount,
        description: transferDescription || 'Toplu para çıkışı (Banka/Yönetici)',
        transaction_date: new Date().toISOString(),
        payment_method: cashBoxes.find(b => b.id === transferFromBox)?.payment_method || 'cash',
        cash_box_id: transferFromBox,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cash_transactions', salonId] });
      toast.success('Para çıkışı kaydedildi');
      setTransferDialogOpen(false);
      setTransferFromBox(''); setTransferAmount(''); setTransferDescription('');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const openEdit = (tx: CashTransaction) => {
    setEditingTx(tx);
    setTxType(tx.type as 'income' | 'expense');
    setTxAmount(String(tx.amount));
    setTxDescription(tx.description || '');
    setTxDate(format(parseISO(tx.transaction_date), "yyyy-MM-dd'T'HH:mm"));
    setTxSourceBox(tx.cash_box_id || '');
    setTxIncomeMethod(tx.payment_method || 'cash');
    setDialogOpen(true);
  };

  const openAddIncome = () => { resetForm(); setTxType('income'); setDialogOpen(true); };
  const openAddExpense = () => { resetForm(); setTxType('expense'); setDialogOpen(true); };

  useEffect(() => {
    const action = searchParams.get('islem');
    if (!action) return;
    if (action === 'odeme-al' || action === 'gelir-gir') {
      openAddIncome(); setSearchParams({}, { replace: true }); return;
    }
    if (action === 'odeme-yap' || action === 'gider-gir') {
      openAddExpense(); setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  if (!hasPermission('can_manage_payments')) return <NoPermission feature="Kasa Yönetimi" />;
  if (salonLoading || isLoading || loadingBoxes) return (
    <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
  );

  const fmtCurrency = (v: number) => `₺${v.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`;

  return (
    <StaffPageGuard permissionKey="page_payments" featureLabel="Kasa Yönetimi">
      <div className="page-container animate-in space-y-5">
        {/* ═══ HEADER ═══ */}
        <Card className="shadow-soft border-border/60">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h1 className="text-xl font-bold">Kasa Defteri</h1>
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={openAddIncome}>
                  <ArrowUpCircle className="h-4 w-4" /> Para Girişi
                </Button>
                <Button size="sm" variant="destructive" className="gap-1.5" onClick={openAddExpense}>
                  <ArrowDownCircle className="h-4 w-4" /> Para Çıkışı
                </Button>
                <div className="flex items-center gap-1 rounded-lg bg-amber-500/15 border border-amber-500/30 px-2 py-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelectedDate(d => subDays(d, 1))}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <div className="flex items-center gap-1.5 px-1">
                    <CalendarDays className="h-4 w-4 text-amber-600" />
                    <input
                      type="date"
                      value={format(selectedDate, 'yyyy-MM-dd')}
                      onChange={e => { if (e.target.value) setSelectedDate(new Date(e.target.value + 'T00:00:00')); }}
                      className="bg-transparent border-none text-sm font-semibold text-amber-700 dark:text-amber-400 w-32 cursor-pointer focus:outline-none"
                    />
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelectedDate(d => addDays(d, 1))} disabled={isSelectedToday}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  {!isSelectedToday && (
                    <Button variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={() => setSelectedDate(new Date())}>
                      Bugün
                    </Button>
                  )}
                </div>
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setTransferDialogOpen(true)}>
                  <Send className="h-4 w-4" /> Ödeme Yap
                </Button>
                <Button size="sm" variant="secondary" className="gap-1.5" onClick={() => setProductSaleOpen(true)}>
                  <Receipt className="h-4 w-4" /> Ürün Satışı
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ═══ SPLIT VIEW: INCOME (LEFT) | EXPENSE (RIGHT) ═══ */}
        <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
          {/* ── GELEN ÖDEMELER ── */}
          <div className="space-y-0">
            <div className="rounded-t-xl bg-emerald-600 text-white px-4 py-2.5 font-bold text-center text-sm tracking-wide">
              Gelen Ödemeler
            </div>
            <Card className="rounded-t-none shadow-soft border-border/60 overflow-hidden">
              <CardContent className="p-0">
                {dayIncome.length === 0 ? (
                  <div className="py-10 text-center text-muted-foreground text-sm">
                    <Receipt className="h-7 w-7 mx-auto mb-2 text-muted-foreground/30" />
                    Bu güne ait gelen ödeme bulunmamaktadır
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-emerald-50 dark:bg-emerald-950/20 hover:bg-emerald-50 dark:hover:bg-emerald-950/20">
                          <TableHead className="font-semibold text-emerald-800 dark:text-emerald-300 w-8">#</TableHead>
                          <TableHead className="font-semibold text-emerald-800 dark:text-emerald-300">Saat</TableHead>
                          <TableHead className="font-semibold text-emerald-800 dark:text-emerald-300">Açıklama</TableHead>
                          <TableHead className="font-semibold text-emerald-800 dark:text-emerald-300 text-right">Tutar</TableHead>
                          <TableHead className="font-semibold text-emerald-800 dark:text-emerald-300">Ödeme Şekli</TableHead>
                          <TableHead className="font-semibold text-emerald-800 dark:text-emerald-300 w-20 text-center">İşlem</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {dayIncome.map((tx, idx) => (
                          <TableRow key={tx.id} className="group">
                            <TableCell className="text-muted-foreground text-xs">{idx + 1}</TableCell>
                            <TableCell className="text-sm">{format(parseISO(tx.transaction_date), 'HH:mm')}</TableCell>
                            <TableCell className="font-medium text-sm">{tx.description || '-'}</TableCell>
                            <TableCell className="text-right font-bold tabular-nums text-emerald-600">{fmtCurrency(Number(tx.amount))}</TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="text-[10px]">
                                {METHOD_LABELS[tx.payment_method] || tx.payment_method}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex gap-0.5 justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(tx)}><Pencil className="h-3 w-3" /></Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteMutation.mutate(tx.id)}><Trash2 className="h-3 w-3" /></Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Payment method summary bar - income */}
            <div className="grid grid-cols-3 text-center text-[11px] font-bold border border-t-0 border-border/60 rounded-b-xl overflow-hidden">
              {DEFAULT_BOXES.map(b => (
                <div key={b.payment_method} className="py-2 bg-emerald-600/10 border-r last:border-r-0 border-emerald-600/20">
                  <div className="text-emerald-700 dark:text-emerald-400">{b.name}</div>
                  <div className="text-foreground tabular-nums">{fmtCurrency(dayMethodTotals[b.payment_method]?.income || 0)}</div>
                </div>
              ))}
            </div>

            {/* Summary rows */}
            <div className="mt-2 space-y-1">
              {[
                { label: 'Gelen Nakit Toplamı', value: dayIncomeTotal, color: 'bg-emerald-600 text-white' },
                { label: 'Önceki Gün Devir', value: carryover, color: 'bg-zinc-700 text-white' },
                { label: 'Genel Nakit Toplamı', value: dayIncomeTotal + carryover, color: 'bg-zinc-800 text-white' },
              ].map(row => (
                <div key={row.label} className={`flex items-center justify-between px-4 py-2 rounded-lg ${row.color} text-sm font-semibold`}>
                  <span>{row.label}</span>
                  <span className="tabular-nums">{fmtCurrency(row.value)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── GİDEN ÖDEMELER ── */}
          <div className="space-y-0">
            <div className="rounded-t-xl bg-red-600 text-white px-4 py-2.5 font-bold text-center text-sm tracking-wide">
              Giden Ödemeler
            </div>
            <Card className="rounded-t-none shadow-soft border-border/60 overflow-hidden">
              <CardContent className="p-0">
                {dayExpense.length === 0 ? (
                  <div className="py-10 text-center text-muted-foreground text-sm">
                    <Receipt className="h-7 w-7 mx-auto mb-2 text-muted-foreground/30" />
                    Bu güne ait giden ödeme bulunmamaktadır
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-red-50 dark:bg-red-950/20 hover:bg-red-50 dark:hover:bg-red-950/20">
                          <TableHead className="font-semibold text-red-800 dark:text-red-300 w-8">#</TableHead>
                          <TableHead className="font-semibold text-red-800 dark:text-red-300">Saat</TableHead>
                          <TableHead className="font-semibold text-red-800 dark:text-red-300">Açıklama</TableHead>
                          <TableHead className="font-semibold text-red-800 dark:text-red-300 text-right">Tutar</TableHead>
                          <TableHead className="font-semibold text-red-800 dark:text-red-300">Ödeme Şekli</TableHead>
                          <TableHead className="font-semibold text-red-800 dark:text-red-300 w-20 text-center">İşlem</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {dayExpense.map((tx, idx) => (
                          <TableRow key={tx.id} className="group">
                            <TableCell className="text-muted-foreground text-xs">{idx + 1}</TableCell>
                            <TableCell className="text-sm">{format(parseISO(tx.transaction_date), 'HH:mm')}</TableCell>
                            <TableCell className="font-medium text-sm">{tx.description || '-'}</TableCell>
                            <TableCell className="text-right font-bold tabular-nums text-red-600">{fmtCurrency(Number(tx.amount))}</TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="text-[10px]">
                                {METHOD_LABELS[tx.payment_method] || tx.payment_method}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex gap-0.5 justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(tx)}><Pencil className="h-3 w-3" /></Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteMutation.mutate(tx.id)}><Trash2 className="h-3 w-3" /></Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Payment method summary bar - expense */}
            <div className="grid grid-cols-3 text-center text-[11px] font-bold border border-t-0 border-border/60 rounded-b-xl overflow-hidden">
              {DEFAULT_BOXES.map(b => (
                <div key={b.payment_method} className="py-2 bg-red-600/10 border-r last:border-r-0 border-red-600/20">
                  <div className="text-red-700 dark:text-red-400">{b.name}</div>
                  <div className="text-foreground tabular-nums">{fmtCurrency(dayMethodTotals[b.payment_method]?.expense || 0)}</div>
                </div>
              ))}
            </div>

            {/* Summary rows */}
            <div className="mt-2 space-y-1">
              {[
                { label: 'Gider Nakit Toplamı', value: todayExpenseTotal, color: 'bg-red-600 text-white' },
                { label: 'Bugünün Nakit Toplamı', value: todayIncomeTotal - todayExpenseTotal, color: 'bg-zinc-700 text-white' },
                { label: 'Genel Nakit Kasası', value: todayIncomeTotal + yesterdayCarryover - todayExpenseTotal, color: 'bg-zinc-800 text-white' },
              ].map(row => (
                <div key={row.label} className={`flex items-center justify-between px-4 py-2 rounded-lg ${row.color} text-sm font-semibold`}>
                  <span>{row.label}</span>
                  <span className="tabular-nums">{fmtCurrency(row.value)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ═══ MONTHLY STATISTICS ═══ */}
        <div className="pt-4 border-t border-border/60">
          <div className="flex items-center justify-between mb-4">
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => {
                const headers = ['Tarih', 'Tür', 'Açıklama', 'Ödeme Şekli', 'Tutar (₺)'];
                const rows = monthTransactions.map(tx => ({
                  Tarih: format(parseISO(tx.transaction_date), 'd MMM yyyy HH:mm', { locale: tr }),
                  Tür: tx.type === 'income' ? 'Gelir' : 'Gider',
                  Açıklama: tx.description || '-',
                  'Ödeme Şekli': METHOD_LABELS[tx.payment_method] || tx.payment_method,
                  'Tutar (₺)': Number(tx.amount),
                }));
                exportToExcel(rows, headers, `kasa-${month}`);
              }}>
                <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => {
                const headers = ['Tarih', 'Tür', 'Açıklama', 'Ödeme Şekli', 'Tutar (₺)'];
                const rows = monthTransactions.map(tx => [
                  format(parseISO(tx.transaction_date), 'd MMM yyyy HH:mm', { locale: tr }),
                  tx.type === 'income' ? 'Gelir' : 'Gider',
                  tx.description || '-',
                  METHOD_LABELS[tx.payment_method] || tx.payment_method,
                  Number(tx.amount).toLocaleString('tr-TR'),
                ]);
                exportToPDF(rows, headers, 'Kasa Raporu', `kasa-${month}`, [`Dönem: ${month}`]);
              }}>
                <FileText className="h-3.5 w-3.5" /> PDF
              </Button>
            </div>
            <Input type="month" value={month} onChange={e => setMonth(e.target.value)} className="w-44 h-9" />
          </div>
          <CashMonthlyStats transactions={monthTransactions} cashBoxes={cashBoxes} month={month} allTransactions={transactions} />
        </div>

        {/* ═══ DIALOGS ═══ */}
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingTx ? 'İşlem Düzenle' : txType === 'income' ? 'Gelir Ekle' : 'Gider Ekle'}</DialogTitle>
              <DialogDescription>
                {txType === 'income' ? 'Kasaya gelir kaydı ekleyin' : 'Harcama yapılacak kasayı seçin'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              {!editingTx && (
                <div className="space-y-2">
                  <Label className="text-xs font-semibold">İşlem Türü</Label>
                  <Select value={txType} onValueChange={(v) => setTxType(v as 'income' | 'expense')}>
                    <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="income">Gelir</SelectItem>
                      <SelectItem value="expense">Gider</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {txType === 'expense' && (
                <div className="space-y-2">
                  <Label className="text-xs font-semibold">Harcama Yapılacak Kasa</Label>
                  <Select value={txSourceBox} onValueChange={setTxSourceBox}>
                    <SelectTrigger className="h-10"><SelectValue placeholder="Kasa seçin" /></SelectTrigger>
                    <SelectContent>
                      {cashBoxes.filter(b => b.is_active).map(b => {
                        const bal = boxBalances.find(bb => bb.id === b.id);
                        return (
                          <SelectItem key={b.id} value={b.id}>
                            {b.name} — ₺{(bal?.balance || 0).toLocaleString('tr-TR')}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {txType === 'income' && (
                <div className="space-y-2">
                  <Label className="text-xs font-semibold">Ödeme Şekli</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { value: 'cash', label: 'Nakit', icon: Banknote },
                      { value: 'eft', label: 'EFT/Havale', icon: Building2 },
                      { value: 'credit_card', label: 'Kredi Kartı', icon: CreditCard },
                    ].map(m => (
                      <button
                        key={m.value}
                        type="button"
                        onClick={() => setTxIncomeMethod(m.value)}
                        className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all ${
                          txIncomeMethod === m.value
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border hover:border-primary/40 text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <m.icon className="h-5 w-5" />
                        <span className="text-[10px] font-semibold">{m.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label className="text-xs font-semibold">Tutar (₺)</Label>
                <Input type="number" min="0" step="0.01" value={txAmount} onChange={e => setTxAmount(e.target.value)} placeholder="0.00" className="h-10" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Açıklama</Label>
                <Textarea value={txDescription} onChange={e => setTxDescription(e.target.value)} placeholder="İşlem açıklaması..." rows={2} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Tarih</Label>
                <Input type="datetime-local" value={txDate} onChange={e => setTxDate(e.target.value)} className="h-10" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>İptal</Button>
              <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="btn-gradient">
                {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {editingTx ? 'Güncelle' : 'Kaydet'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={transferDialogOpen} onOpenChange={setTransferDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Toplu Para Çıkışı</DialogTitle>
              <DialogDescription>Bankaya veya yöneticiye toplu para transferi yapın.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Kaynak Kasa</Label>
                <Select value={transferFromBox} onValueChange={setTransferFromBox}>
                  <SelectTrigger className="h-10"><SelectValue placeholder="Kasa seçin" /></SelectTrigger>
                  <SelectContent>
                    {cashBoxes.filter(b => b.is_active).map(b => {
                      const bal = boxBalances.find(bb => bb.id === b.id);
                      return (
                        <SelectItem key={b.id} value={b.id}>
                          {b.name} — Bakiye: ₺{(bal?.balance || 0).toLocaleString('tr-TR')}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Çıkış Tutarı (₺)</Label>
                <Input type="number" min="0" step="0.01" value={transferAmount} onChange={e => setTransferAmount(e.target.value)} placeholder="0.00" className="h-10" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Açıklama</Label>
                <Textarea value={transferDescription} onChange={e => setTransferDescription(e.target.value)} placeholder="Ör: Bankaya transfer..." rows={2} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setTransferDialogOpen(false)}>İptal</Button>
              <Button variant="destructive" onClick={() => transferMutation.mutate()} disabled={transferMutation.isPending} className="gap-1.5">
                {transferMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                <Send className="h-4 w-4" /> Çıkışı Kaydet
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <ProductSaleDialog open={productSaleOpen} onOpenChange={setProductSaleOpen} />
      </div>
    </StaffPageGuard>
  );
}
