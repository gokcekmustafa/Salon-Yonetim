import { useState, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useSalonData } from '@/hooks/useSalonData';
import { usePermissions } from '@/hooks/usePermissions';
import { NoPermission } from '@/components/permissions/NoPermission';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { format, parseISO, isSameMonth } from 'date-fns';
import { tr } from 'date-fns/locale';
import {
  Wallet, TrendingUp, TrendingDown, Plus, Loader2, ArrowUpCircle, ArrowDownCircle, Receipt, Pencil, Trash2, Building2,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

type CashBox = { id: string; salon_id: string; name: string; payment_method: string; is_active: boolean };
type CashTransaction = {
  id: string; salon_id: string; type: string; amount: number;
  description: string | null; transaction_date: string;
  created_by: string; created_at: string;
  cash_box_id: string | null; payment_method: string;
};

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Nakit' },
  { value: 'credit_card', label: 'Kredi Kartı' },
  { value: 'eft', label: 'EFT / Havale' },
];

export default function CashPage() {
  const { hasPermission } = usePermissions();
  const { user, currentSalonId, isSuperAdmin } = useAuth();
  const { loading: salonLoading } = useSalonData();
  const queryClient = useQueryClient();
  const [month, setMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [dialogOpen, setDialogOpen] = useState(false);
  const [boxDialogOpen, setBoxDialogOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<CashTransaction | null>(null);
  const [filterBox, setFilterBox] = useState<string>('all');

  // Form state
  const [txType, setTxType] = useState<'income' | 'expense'>('income');
  const [txAmount, setTxAmount] = useState('');
  const [txDescription, setTxDescription] = useState('');
  const [txDate, setTxDate] = useState(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
  const [txPaymentMethod, setTxPaymentMethod] = useState('cash');
  const [txCashBoxId, setTxCashBoxId] = useState<string>('none');

  // Box form
  const [boxName, setBoxName] = useState('');
  const [boxMethod, setBoxMethod] = useState('cash');

  const salonId = currentSalonId;

  const { data: cashBoxes = [], isLoading: loadingBoxes } = useQuery({
    queryKey: ['cash_boxes', salonId],
    queryFn: async () => {
      if (!salonId) return [];
      const { data } = await supabase.from('cash_boxes').select('*').eq('salon_id', salonId).order('name');
      return (data || []) as CashBox[];
    },
    enabled: !!salonId,
  });

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ['cash_transactions', salonId],
    queryFn: async () => {
      if (!salonId) return [];
      const { data } = await supabase.from('cash_transactions').select('*').eq('salon_id', salonId).order('transaction_date', { ascending: false });
      return (data || []) as CashTransaction[];
    },
    enabled: !!salonId && !!user,
  });

  const monthTransactions = useMemo(() => {
    let filtered = transactions.filter(t => {
      try { return isSameMonth(parseISO(t.transaction_date), parseISO(month + '-01')); } catch { return false; }
    });
    if (filterBox !== 'all') {
      filtered = filtered.filter(t => t.cash_box_id === filterBox);
    }
    return filtered;
  }, [transactions, month, filterBox]);

  const totalIncome = useMemo(() => monthTransactions.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0), [monthTransactions]);
  const totalExpense = useMemo(() => monthTransactions.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0), [monthTransactions]);
  const balance = totalIncome - totalExpense;

  // Cash box balances
  const boxBalances = useMemo(() => {
    return cashBoxes.map(box => {
      const boxTxs = transactions.filter(t => t.cash_box_id === box.id);
      const income = boxTxs.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
      const expense = boxTxs.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
      return { ...box, balance: income - expense };
    });
  }, [cashBoxes, transactions]);

  const resetForm = useCallback(() => {
    setTxType('income'); setTxAmount(''); setTxDescription('');
    setTxDate(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
    setTxPaymentMethod('cash'); setTxCashBoxId('none');
    setEditingTx(null);
  }, []);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!salonId || !user) throw new Error('Missing context');
      const amount = parseFloat(txAmount);
      if (isNaN(amount) || amount <= 0) throw new Error('Geçerli bir tutar girin');

      const payload: any = {
        type: txType, amount,
        description: txDescription || null,
        transaction_date: new Date(txDate).toISOString(),
        payment_method: txPaymentMethod,
        cash_box_id: txCashBoxId || null,
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

  const createBoxMutation = useMutation({
    mutationFn: async () => {
      if (!salonId || !boxName.trim()) throw new Error('Kasa adı girin');
      const { error } = await supabase.from('cash_boxes').insert({ salon_id: salonId, name: boxName.trim(), payment_method: boxMethod } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cash_boxes', salonId] });
      toast.success('Kasa eklendi');
      setBoxDialogOpen(false); setBoxName(''); setBoxMethod('cash');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteBox = async (id: string) => {
    await supabase.from('cash_boxes').delete().eq('id', id);
    queryClient.invalidateQueries({ queryKey: ['cash_boxes', salonId] });
    toast.success('Kasa silindi');
  };

  const openEdit = (tx: CashTransaction) => {
    setEditingTx(tx);
    setTxType(tx.type as 'income' | 'expense');
    setTxAmount(String(tx.amount));
    setTxDescription(tx.description || '');
    setTxDate(format(parseISO(tx.transaction_date), "yyyy-MM-dd'T'HH:mm"));
    setTxPaymentMethod(tx.payment_method || 'cash');
    setTxCashBoxId(tx.cash_box_id || '');
    setDialogOpen(true);
  };

  if (!hasPermission('can_manage_payments')) return <NoPermission feature="Kasa Yönetimi" />;
  if (salonLoading || isLoading || loadingBoxes) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );

  const getMethodLabel = (m: string) => PAYMENT_METHODS.find(x => x.value === m)?.label ?? m;

  return (
    <div className="page-container animate-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Kasa Yönetimi</h1>
          <p className="page-subtitle">Gelir, gider ve kasa takibi</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setBoxDialogOpen(true)} className="gap-1.5">
            <Building2 className="h-4 w-4" /> Kasa Ekle
          </Button>
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button className="btn-gradient gap-2"><Plus className="h-4 w-4" />İşlem Ekle</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editingTx ? 'İşlem Düzenle' : 'Yeni İşlem'}</DialogTitle></DialogHeader>
              <div className="space-y-4 mt-2">
                <div className="space-y-2">
                  <Label>Tür</Label>
                  <Select value={txType} onValueChange={(v) => setTxType(v as 'income' | 'expense')}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="income">Gelir</SelectItem>
                      <SelectItem value="expense">Gider</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Ödeme Yöntemi</Label>
                  <Select value={txPaymentMethod} onValueChange={setTxPaymentMethod}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHODS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {cashBoxes.length > 0 && (
                  <div className="space-y-2">
                    <Label>Kasa</Label>
                    <Select value={txCashBoxId} onValueChange={setTxCashBoxId}>
                      <SelectTrigger><SelectValue placeholder="Kasa seçin (opsiyonel)" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">— Genel —</SelectItem>
                        {cashBoxes.filter(b => b.is_active).map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Tutar (₺)</Label>
                  <Input type="number" min="0" step="0.01" value={txAmount} onChange={e => setTxAmount(e.target.value)} placeholder="0.00" />
                </div>
                <div className="space-y-2">
                  <Label>Açıklama</Label>
                  <Textarea value={txDescription} onChange={e => setTxDescription(e.target.value)} placeholder="İşlem açıklaması..." rows={2} />
                </div>
                <div className="space-y-2">
                  <Label>Tarih</Label>
                  <Input type="datetime-local" value={txDate} onChange={e => setTxDate(e.target.value)} />
                </div>
                <Button className="w-full btn-gradient" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                  {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  {editingTx ? 'Güncelle' : 'Kaydet'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Cash Box Balances */}
      {boxBalances.length > 0 && (
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {boxBalances.map(box => (
            <div key={box.id} className="stat-card p-4 relative group">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{box.name}</p>
                  <p className="text-xs text-muted-foreground">{getMethodLabel(box.payment_method)}</p>
                  <p className={`text-lg font-bold tabular-nums mt-1 ${box.balance >= 0 ? 'text-foreground' : 'text-destructive'}`}>
                    ₺{box.balance.toLocaleString('tr-TR')}
                  </p>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 text-destructive" onClick={() => deleteBox(box.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* KPIs */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        {[
          { label: 'Aylık Gelir', value: `₺${totalIncome.toLocaleString('tr-TR')}`, icon: TrendingUp, color: 'text-green-600 bg-green-500/10' },
          { label: 'Aylık Gider', value: `₺${totalExpense.toLocaleString('tr-TR')}`, icon: TrendingDown, color: 'text-red-500 bg-red-500/10' },
          { label: 'Bakiye', value: `₺${balance.toLocaleString('tr-TR')}`, icon: Wallet, color: balance >= 0 ? 'text-primary bg-primary/10' : 'text-destructive bg-destructive/10' },
        ].map(kpi => (
          <div key={kpi.label} className="stat-card p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{kpi.label}</p>
                <p className="text-2xl font-bold tracking-tight tabular-nums">{kpi.value}</p>
              </div>
              <div className={`h-11 w-11 rounded-xl flex items-center justify-center ${kpi.color}`}><kpi.icon className="h-5 w-5" /></div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <Input type="month" value={month} onChange={e => setMonth(e.target.value)} className="w-48 h-10" />
        {cashBoxes.length > 0 && (
          <Select value={filterBox} onValueChange={setFilterBox}>
            <SelectTrigger className="w-40 h-10"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tüm Kasalar</SelectItem>
              {cashBoxes.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Mobile Cards */}
      <div className="block md:hidden space-y-3">
        {monthTransactions.length === 0 ? (
          <Card className="shadow-soft border-border/60"><CardContent className="empty-state"><Receipt className="empty-state-icon" /><p className="empty-state-title">Bu ay işlem yok</p></CardContent></Card>
        ) : monthTransactions.map(tx => (
          <div key={tx.id} className="card-interactive p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {tx.type === 'income' ? <ArrowUpCircle className="h-5 w-5 text-green-600 shrink-0" /> : <ArrowDownCircle className="h-5 w-5 text-red-500 shrink-0" />}
                <div className="space-y-0.5">
                  <p className="font-semibold text-sm">{tx.description || (tx.type === 'income' ? 'Gelir' : 'Gider')}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(parseISO(tx.transaction_date), 'd MMM yyyy HH:mm', { locale: tr })}
                    {' • '}{getMethodLabel(tx.payment_method)}
                  </p>
                </div>
              </div>
              <div className="text-right space-y-1">
                <p className={`font-bold tabular-nums ${tx.type === 'income' ? 'text-green-600' : 'text-red-500'}`}>
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
                <TableHead className="font-semibold">Yöntem</TableHead>
                <TableHead className="font-semibold">Kasa</TableHead>
                <TableHead className="font-semibold">Açıklama</TableHead>
                <TableHead className="text-right font-semibold">Tutar</TableHead>
                <TableHead className="text-right font-semibold w-24">İşlem</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {monthTransactions.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground text-sm">Bu ay işlem bulunmamaktadır.</TableCell></TableRow>
              ) : monthTransactions.map(tx => {
                const boxName = cashBoxes.find(b => b.id === tx.cash_box_id)?.name;
                return (
                  <TableRow key={tx.id}>
                    <TableCell className="text-muted-foreground">{format(parseISO(tx.transaction_date), 'd MMM yyyy HH:mm', { locale: tr })}</TableCell>
                    <TableCell>
                      <Badge variant={tx.type === 'income' ? 'default' : 'destructive'} className="text-[10px] font-semibold">
                        {tx.type === 'income' ? 'Gelir' : 'Gider'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">{getMethodLabel(tx.payment_method)}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">{boxName || '-'}</TableCell>
                    <TableCell className="font-medium">{tx.description || '-'}</TableCell>
                    <TableCell className={`text-right font-bold tabular-nums ${tx.type === 'income' ? 'text-green-600' : 'text-red-500'}`}>
                      {tx.type === 'income' ? '+' : '-'}₺{Number(tx.amount).toLocaleString('tr-TR')}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(tx)}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteMutation.mutate(tx.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add Cash Box Dialog */}
      <Dialog open={boxDialogOpen} onOpenChange={setBoxDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Yeni Kasa</DialogTitle>
            <DialogDescription>Ayrı bir kasa hesabı ekleyin</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Kasa Adı</Label>
              <Input value={boxName} onChange={e => setBoxName(e.target.value)} placeholder="Ör: Ana Kasa, POS Hesabı" className="h-10" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Ödeme Yöntemi</Label>
              <Select value={boxMethod} onValueChange={setBoxMethod}>
                <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBoxDialogOpen(false)}>İptal</Button>
            <Button onClick={() => createBoxMutation.mutate()} disabled={createBoxMutation.isPending || !boxName.trim()} className="btn-gradient">
              {createBoxMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Ekle
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
