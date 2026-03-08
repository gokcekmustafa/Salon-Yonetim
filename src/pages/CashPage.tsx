import { useState, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useSalonData } from '@/hooks/useSalonData';
import { usePermissions } from '@/hooks/usePermissions';
import { NoPermission } from '@/components/permissions/NoPermission';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO, isSameMonth } from 'date-fns';
import { tr } from 'date-fns/locale';
import {
  Wallet, TrendingUp, TrendingDown, Plus, Loader2, ArrowUpCircle, ArrowDownCircle, Receipt, Pencil, Trash2,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

type CashTransaction = {
  id: string;
  salon_id: string;
  type: string;
  amount: number;
  description: string | null;
  transaction_date: string;
  created_by: string;
  created_at: string;
};

export default function CashPage() {
  const { hasPermission } = usePermissions();
  const { user, currentSalonId, isSuperAdmin } = useAuth();
  const { loading: salonLoading } = useSalonData();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [month, setMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<CashTransaction | null>(null);

  // Form state
  const [txType, setTxType] = useState<'income' | 'expense'>('income');
  const [txAmount, setTxAmount] = useState('');
  const [txDescription, setTxDescription] = useState('');
  const [txDate, setTxDate] = useState(format(new Date(), "yyyy-MM-dd'T'HH:mm"));

  const salonId = currentSalonId;

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ['cash_transactions', salonId],
    queryFn: async () => {
      if (!salonId) return [];
      const { data, error } = await supabase
        .from('cash_transactions')
        .select('*')
        .eq('salon_id', salonId)
        .order('transaction_date', { ascending: false });
      if (error) throw error;
      return (data || []) as CashTransaction[];
    },
    enabled: !!salonId && !!user,
  });

  const monthTransactions = useMemo(() =>
    transactions.filter(t => {
      try { return isSameMonth(parseISO(t.transaction_date), parseISO(month + '-01')); }
      catch { return false; }
    }), [transactions, month]);

  const totalIncome = useMemo(() =>
    monthTransactions.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0), [monthTransactions]);

  const totalExpense = useMemo(() =>
    monthTransactions.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0), [monthTransactions]);

  const balance = totalIncome - totalExpense;

  const resetForm = useCallback(() => {
    setTxType('income');
    setTxAmount('');
    setTxDescription('');
    setTxDate(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
    setEditingTx(null);
  }, []);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!salonId || !user) throw new Error('Missing context');
      const amount = parseFloat(txAmount);
      if (isNaN(amount) || amount <= 0) throw new Error('Geçerli bir tutar girin');

      if (editingTx) {
        const { error } = await supabase.from('cash_transactions').update({
          type: txType,
          amount,
          description: txDescription || null,
          transaction_date: new Date(txDate).toISOString(),
        }).eq('id', editingTx.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('cash_transactions').insert({
          salon_id: salonId,
          type: txType,
          amount,
          description: txDescription || null,
          transaction_date: new Date(txDate).toISOString(),
          created_by: user.id,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cash_transactions', salonId] });
      toast({ title: editingTx ? 'İşlem güncellendi' : 'İşlem eklendi' });
      setDialogOpen(false);
      resetForm();
    },
    onError: (err: Error) => {
      toast({ title: 'Hata', description: err.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('cash_transactions').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cash_transactions', salonId] });
      toast({ title: 'İşlem silindi' });
    },
    onError: (err: Error) => {
      toast({ title: 'Hata', description: err.message, variant: 'destructive' });
    },
  });

  const openEdit = (tx: CashTransaction) => {
    setEditingTx(tx);
    setTxType(tx.type as 'income' | 'expense');
    setTxAmount(String(tx.amount));
    setTxDescription(tx.description || '');
    setTxDate(format(parseISO(tx.transaction_date), "yyyy-MM-dd'T'HH:mm"));
    setDialogOpen(true);
  };

  if (!hasPermission('can_manage_payments')) return <NoPermission feature="Kasa Yönetimi" />;
  if (salonLoading || isLoading) return (
    <div className="flex items-center justify-center py-20">
      <div className="flex flex-col items-center gap-3"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="text-sm text-muted-foreground">Yükleniyor...</p></div>
    </div>
  );

  const canEdit = isSuperAdmin || true; // salon_admin always can

  const kpis = [
    { label: 'Aylık Gelir', value: `₺${totalIncome.toLocaleString('tr-TR')}`, icon: TrendingUp, color: 'text-green-600 bg-green-500/10' },
    { label: 'Aylık Gider', value: `₺${totalExpense.toLocaleString('tr-TR')}`, icon: TrendingDown, color: 'text-red-500 bg-red-500/10' },
    { label: 'Bakiye', value: `₺${balance.toLocaleString('tr-TR')}`, icon: Wallet, color: balance >= 0 ? 'text-primary bg-primary/10' : 'text-destructive bg-destructive/10' },
  ];

  return (
    <div className="page-container animate-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Kasa Yönetimi</h1>
          <p className="page-subtitle">Gelir ve gider takibi</p>
        </div>
        {canEdit && (
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button className="btn-gradient gap-2"><Plus className="h-4 w-4" />İşlem Ekle</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingTx ? 'İşlem Düzenle' : 'Yeni İşlem'}</DialogTitle>
              </DialogHeader>
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
                  {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  {editingTx ? 'Güncelle' : 'Kaydet'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* KPIs */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        {kpis.map(kpi => (
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

      <div className="flex items-center gap-2">
        <Input type="month" value={month} onChange={e => setMonth(e.target.value)} className="w-48 h-10" />
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
                  <p className="text-xs text-muted-foreground">{format(parseISO(tx.transaction_date), 'd MMM yyyy HH:mm', { locale: tr })}</p>
                </div>
              </div>
              <div className="text-right space-y-1">
                <p className={`font-bold tabular-nums ${tx.type === 'income' ? 'text-green-600' : 'text-red-500'}`}>
                  {tx.type === 'income' ? '+' : '-'}₺{Number(tx.amount).toLocaleString('tr-TR')}
                </p>
                {canEdit && (
                  <div className="flex gap-1 justify-end">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(tx)}><Pencil className="h-3 w-3" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteMutation.mutate(tx.id)}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                )}
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
                {canEdit && <TableHead className="text-right font-semibold w-24">İşlem</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {monthTransactions.length === 0 ? (
                <TableRow><TableCell colSpan={canEdit ? 5 : 4} className="text-center py-12 text-muted-foreground text-sm">Bu ay işlem bulunmamaktadır.</TableCell></TableRow>
              ) : monthTransactions.map(tx => (
                <TableRow key={tx.id}>
                  <TableCell className="text-muted-foreground">{format(parseISO(tx.transaction_date), 'd MMM yyyy HH:mm', { locale: tr })}</TableCell>
                  <TableCell>
                    <Badge variant={tx.type === 'income' ? 'default' : 'destructive'} className="text-[10px] font-semibold">
                      {tx.type === 'income' ? 'Gelir' : 'Gider'}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">{tx.description || '-'}</TableCell>
                  <TableCell className={`text-right font-bold tabular-nums ${tx.type === 'income' ? 'text-green-600' : 'text-red-500'}`}>
                    {tx.type === 'income' ? '+' : '-'}₺{Number(tx.amount).toLocaleString('tr-TR')}
                  </TableCell>
                  {canEdit && (
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(tx)}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteMutation.mutate(tx.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
