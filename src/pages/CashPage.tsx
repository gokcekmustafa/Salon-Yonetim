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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format, parseISO, isSameMonth } from 'date-fns';
import { tr } from 'date-fns/locale';
import {
  Wallet, TrendingUp, TrendingDown, Plus, Loader2, ArrowUpCircle, ArrowDownCircle,
  Receipt, Pencil, Trash2, Banknote, CreditCard, Building2, Send, FileSpreadsheet, FileText,
} from 'lucide-react';
import { exportToExcel, exportToPDF } from '@/lib/exportUtils';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { StaffPageGuard } from '@/components/permissions/StaffPageGuard';

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

const TAB_ICONS: Record<string, typeof Banknote> = {
  cash: Banknote,
  eft: Building2,
  credit_card: CreditCard,
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
  useFormGuard(dialogOpen || transferDialogOpen);
  const [editingTx, setEditingTx] = useState<CashTransaction | null>(null);
  const [activeTab, setActiveTab] = useState('cash');

  // Transaction form
  const [txType, setTxType] = useState<'income' | 'expense'>('income');
  const [txAmount, setTxAmount] = useState('');
  const [txDescription, setTxDescription] = useState('');
  const [txDate, setTxDate] = useState(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
  const [txSourceBox, setTxSourceBox] = useState<string>(''); // for expenses: which box to deduct from
  const [txIncomeMethod, setTxIncomeMethod] = useState<string>('cash'); // for income: payment method selection

  // Transfer form
  const [transferFromBox, setTransferFromBox] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferDescription, setTransferDescription] = useState('');

  const salonId = currentSalonId;

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

  // Get box for current tab
  const currentBox = useMemo(() => cashBoxes.find(b => b.payment_method === activeTab), [cashBoxes, activeTab]);

  // Filter transactions for current tab & month
  const tabTransactions = useMemo(() => {
    if (!currentBox) return [];
    return transactions.filter(t => {
      if (t.cash_box_id !== currentBox.id) return false;
      try { return isSameMonth(parseISO(t.transaction_date), parseISO(month + '-01')); } catch { return false; }
    });
  }, [transactions, currentBox, month]);

  // Calculate balances per box (all-time)
  const boxBalances = useMemo(() => {
    return cashBoxes.map(box => {
      const boxTxs = transactions.filter(t => t.cash_box_id === box.id);
      const income = boxTxs.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
      const expense = boxTxs.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
      return { ...box, income, expense, balance: income - expense };
    });
  }, [cashBoxes, transactions]);

  // Monthly stats for current tab
  const monthlyIncome = useMemo(() => tabTransactions.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0), [tabTransactions]);
  const monthlyExpense = useMemo(() => tabTransactions.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0), [tabTransactions]);

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

      // For income: route to the box matching selected payment method
      // For expense: use selected source box
      let targetBoxId: string | null = null;
      let paymentMethod = activeTab;

      if (txType === 'income') {
        const targetBox = cashBoxes.find(b => b.payment_method === txIncomeMethod);
        targetBoxId = targetBox?.id || currentBox?.id || null;
        paymentMethod = txIncomeMethod;
      } else {
        if (!txSourceBox) throw new Error('Lütfen harcama yapılacak kasayı seçin');
        targetBoxId = txSourceBox;
        const sourceBox = cashBoxes.find(b => b.id === txSourceBox);
        paymentMethod = sourceBox?.payment_method || activeTab;
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

  // Bulk transfer (para çıkışı)
  const transferMutation = useMutation({
    mutationFn: async () => {
      if (!salonId || !user) throw new Error('Oturum bulunamadı');
      const amount = parseFloat(transferAmount);
      if (isNaN(amount) || amount <= 0) throw new Error('Geçerli bir tutar girin');
      if (!transferFromBox) throw new Error('Kaynak kasayı seçin');

      const { error } = await supabase.from('cash_transactions').insert({
        salon_id: salonId,
        created_by: user.id,
        type: 'expense',
        amount,
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

  const openAddIncome = () => {
    resetForm();
    setTxType('income');
    setDialogOpen(true);
  };

  const openAddExpense = () => {
    resetForm();
    setTxType('expense');
    setDialogOpen(true);
  };

  useEffect(() => {
    const action = searchParams.get('islem');
    if (!action) return;

    if (action === 'odeme-al' || action === 'gelir-gir') {
      openAddIncome();
      setSearchParams({}, { replace: true });
      return;
    }

    if (action === 'odeme-yap' || action === 'gider-gir') {
      openAddExpense();
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  if (!hasPermission('can_manage_payments')) return <NoPermission feature="Kasa Yönetimi" />;
  if (salonLoading || isLoading || loadingBoxes) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );

  const getTabLabel = (method: string) => {
    switch (method) {
      case 'cash': return 'Nakit';
      case 'eft': return 'EFT / Havale';
      case 'credit_card': return 'Kredi Kartı';
      default: return method;
    }
  };

  return (
    <div className="page-container animate-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Kasa Yönetimi</h1>
          <p className="page-subtitle">Nakit, EFT/Havale ve Kredi Kartı kasalarınız</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto flex-wrap">
          <Button variant="outline" size="sm" onClick={() => {
            const headers = ['Tarih', 'Tür', 'Açıklama', 'Tutar (₺)'];
            const boxName = currentBox?.name || 'Kasa';
            const rows = tabTransactions.map(tx => ({
              Tarih: format(parseISO(tx.transaction_date), 'd MMM yyyy HH:mm', { locale: tr }),
              Tür: tx.type === 'income' ? 'Gelir' : 'Gider',
              Açıklama: tx.description || '-',
              'Tutar (₺)': Number(tx.amount),
            }));
            exportToExcel(rows, headers, `kasa-${boxName}-${month}`);
          }} className="gap-1.5">
            <FileSpreadsheet className="h-4 w-4" /> Excel
          </Button>
          <Button variant="outline" size="sm" onClick={() => {
            const headers = ['Tarih', 'Tür', 'Açıklama', 'Tutar (₺)'];
            const boxName = currentBox?.name || 'Kasa';
            const rows = tabTransactions.map(tx => [
              format(parseISO(tx.transaction_date), 'd MMM yyyy HH:mm', { locale: tr }),
              tx.type === 'income' ? 'Gelir' : 'Gider',
              tx.description || '-',
              Number(tx.amount).toLocaleString('tr-TR'),
            ]);
            const summary = [
              `Kasa: ${boxName}  |  Dönem: ${month}`,
              `Gelir: ₺${monthlyIncome.toLocaleString('tr-TR')}  |  Gider: ₺${monthlyExpense.toLocaleString('tr-TR')}  |  Net: ₺${(monthlyIncome - monthlyExpense).toLocaleString('tr-TR')}`,
            ];
            exportToPDF(rows, headers, `${boxName} — Kasa Raporu`, `kasa-${boxName}-${month}`, summary);
          }} className="gap-1.5">
            <FileText className="h-4 w-4" /> PDF
          </Button>
          <Button variant="outline" onClick={() => setTransferDialogOpen(true)} className="gap-1.5 flex-1 sm:flex-initial">
            <Send className="h-4 w-4" /> Ödeme Yap
          </Button>
          <Button className="btn-gradient gap-2 flex-1 sm:flex-initial" onClick={openAddIncome}>
            <Plus className="h-4 w-4" /> Ödeme Al
          </Button>
          <Button variant="outline" className="gap-2 flex-1 sm:flex-initial" onClick={openAddIncome}>
            <ArrowUpCircle className="h-4 w-4" /> Gelir Gir
          </Button>
          <Button variant="destructive" className="gap-2 flex-1 sm:flex-initial" onClick={openAddExpense}>
            <TrendingDown className="h-4 w-4" /> Gider Gir
          </Button>
        </div>
      </div>

      {/* Summary cards - all 3 boxes */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        {boxBalances.map(box => {
          const Icon = TAB_ICONS[box.payment_method] || Wallet;
          return (
            <div key={box.id} className={`stat-card p-5 cursor-pointer transition-all ${activeTab === box.payment_method ? 'ring-2 ring-primary shadow-lg' : ''}`} onClick={() => setActiveTab(box.payment_method)}>
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{box.name}</p>
                  <p className={`text-2xl font-bold tracking-tight tabular-nums ${box.balance >= 0 ? 'text-foreground' : 'text-destructive'}`}>
                    ₺{box.balance.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                  </p>
                  <div className="flex gap-3 text-xs">
                    <span className="text-success">+₺{box.income.toLocaleString('tr-TR')}</span>
                    <span className="text-destructive">-₺{box.expense.toLocaleString('tr-TR')}</span>
                  </div>
                </div>
                <div className={`h-11 w-11 rounded-xl flex items-center justify-center ${activeTab === box.payment_method ? 'bg-primary text-primary-foreground' : 'bg-primary/10 text-primary'}`}>
                  <Icon className="h-5 w-5" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Tab Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
            <TabsList className="h-10 w-max">
              {DEFAULT_BOXES.map(b => {
                const Icon = TAB_ICONS[b.payment_method];
                return (
                  <TabsTrigger key={b.payment_method} value={b.payment_method} className="gap-1.5 text-xs sm:text-sm">
                    <Icon className="h-4 w-4" /> <span className="hidden sm:inline">{b.name}</span>
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </div>
          <Input type="month" value={month} onChange={e => setMonth(e.target.value)} className="w-full sm:w-44 h-10" />
        </div>

        {DEFAULT_BOXES.map(b => (
          <TabsContent key={b.payment_method} value={b.payment_method} className="space-y-4">
            {/* Monthly KPIs for this box */}
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
              <div className="stat-card p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Aylık Gelir</p>
                    <p className="text-xl font-bold tabular-nums text-success mt-1">+₺{monthlyIncome.toLocaleString('tr-TR')}</p>
                  </div>
                  <div className="h-9 w-9 rounded-lg bg-success/10 flex items-center justify-center"><TrendingUp className="h-4 w-4 text-success" /></div>
                </div>
              </div>
              <div className="stat-card p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Aylık Gider</p>
                    <p className="text-xl font-bold tabular-nums text-destructive mt-1">-₺{monthlyExpense.toLocaleString('tr-TR')}</p>
                  </div>
                  <div className="h-9 w-9 rounded-lg bg-destructive/10 flex items-center justify-center"><TrendingDown className="h-4 w-4 text-destructive" /></div>
                </div>
              </div>
              <div className="stat-card p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Aylık Net</p>
                    <p className={`text-xl font-bold tabular-nums mt-1 ${(monthlyIncome - monthlyExpense) >= 0 ? 'text-primary' : 'text-destructive'}`}>
                      ₺{(monthlyIncome - monthlyExpense).toLocaleString('tr-TR')}
                    </p>
                  </div>
                  <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center"><Wallet className="h-4 w-4 text-primary" /></div>
                </div>
              </div>
            </div>

            {/* Mobile Cards */}
            <div className="block md:hidden space-y-3">
              {tabTransactions.length === 0 ? (
                <Card className="shadow-soft border-border/60"><CardContent className="empty-state py-8"><Receipt className="empty-state-icon !h-8 !w-8" /><p className="empty-state-title">Bu ay işlem yok</p></CardContent></Card>
              ) : tabTransactions.map(tx => (
                <div key={tx.id} className="card-interactive p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {tx.type === 'income' ? <ArrowUpCircle className="h-5 w-5 text-success shrink-0" /> : <ArrowDownCircle className="h-5 w-5 text-destructive shrink-0" />}
                      <div className="space-y-0.5">
                        <p className="font-semibold text-sm">{tx.description || (tx.type === 'income' ? 'Gelir' : 'Gider')}</p>
                        <p className="text-xs text-muted-foreground">{format(parseISO(tx.transaction_date), 'd MMM yyyy HH:mm', { locale: tr })}</p>
                      </div>
                    </div>
                    <div className="text-right space-y-1">
                      <p className={`font-bold tabular-nums ${tx.type === 'income' ? 'text-success' : 'text-destructive'}`}>
                        {tx.type === 'income' ? '+' : '-'}₺{Number(tx.amount).toLocaleString('tr-TR')}
                      </p>
                      <div className="flex gap-1 justify-end">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(tx)}><Pencil className="h-3 w-3" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteMutation.mutate(tx.id)}><Trash2 className="h-3 w-3" /></Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table */}
            <Card className="hidden md:block shadow-soft border-border/60 overflow-hidden">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="font-semibold">Tarih</TableHead>
                      <TableHead className="font-semibold">Tür</TableHead>
                      <TableHead className="font-semibold">Açıklama</TableHead>
                      <TableHead className="text-right font-semibold">Tutar</TableHead>
                      <TableHead className="text-right font-semibold w-24">İşlem</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tabTransactions.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground text-sm">Bu ay işlem bulunmamaktadır.</TableCell></TableRow>
                    ) : tabTransactions.map(tx => (
                      <TableRow key={tx.id} className="group">
                        <TableCell className="text-muted-foreground">{format(parseISO(tx.transaction_date), 'd MMM yyyy HH:mm', { locale: tr })}</TableCell>
                        <TableCell>
                          <Badge variant={tx.type === 'income' ? 'default' : 'destructive'} className="text-[10px] font-semibold">
                            {tx.type === 'income' ? 'Gelir' : 'Gider'}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">{tx.description || '-'}</TableCell>
                        <TableCell className={`text-right font-bold tabular-nums ${tx.type === 'income' ? 'text-success' : 'text-destructive'}`}>
                          {tx.type === 'income' ? '+' : '-'}₺{Number(tx.amount).toLocaleString('tr-TR')}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(tx)}><Pencil className="h-3.5 w-3.5" /></Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteMutation.mutate(tx.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      {/* Add/Edit Transaction Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingTx ? 'İşlem Düzenle' : txType === 'income' ? 'Gelir Ekle' : 'Gider Ekle'}</DialogTitle>
            <DialogDescription>
              {txType === 'income'
                ? `${getTabLabel(activeTab)} kasasına gelir kaydı ekleyin`
                : 'Harcama yapılacak kasayı seçin'
              }
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
                <p className="text-xs text-muted-foreground">
                  Gelir <strong>{getTabLabel(txIncomeMethod)}</strong> kasasına eklenecek
                </p>
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

      {/* Bulk Transfer Dialog */}
      <Dialog open={transferDialogOpen} onOpenChange={setTransferDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Toplu Para Çıkışı</DialogTitle>
            <DialogDescription>Bankaya veya yöneticiye toplu para transferi yapın. Seçilen kasadan tutar düşülecek.</DialogDescription>
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
    <StaffPageGuard permissionKey="page_payments" featureLabel="Kasa Yönetimi">
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
              <Textarea value={transferDescription} onChange={e => setTransferDescription(e.target.value)} placeholder="Ör: Bankaya transfer, Yöneticiye teslim..." rows={2} />
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
    </div>
  );
    </StaffPageGuard>
}
