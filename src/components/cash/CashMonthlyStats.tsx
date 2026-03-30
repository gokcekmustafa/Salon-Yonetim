import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { format, parseISO, eachDayOfInterval, startOfMonth, endOfMonth, isSameDay } from 'date-fns';
import { tr } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

type CashTransaction = {
  id: string; type: string; amount: number;
  transaction_date: string; payment_method: string;
  cash_box_id: string | null;
};

type CashBox = { id: string; name: string; payment_method: string };

interface Props {
  transactions: CashTransaction[];
  cashBoxes: CashBox[];
  month: string;
}

const COLORS = ['hsl(160, 60%, 45%)', 'hsl(210, 70%, 50%)', 'hsl(340, 65%, 50%)', 'hsl(45, 80%, 50%)', 'hsl(270, 50%, 55%)'];

const METHOD_LABELS: Record<string, string> = {
  cash: 'Nakit',
  eft: 'EFT / Havale',
  credit_card: 'Kredi Kartı',
  mail_order: 'Mail Order',
  other: 'Diğer',
};

export function CashMonthlyStats({ transactions, cashBoxes, month }: Props) {
  const monthDate = parseISO(month + '-01');
  const monthStart = startOfMonth(monthDate);
  const monthEnd = endOfMonth(monthDate);

  // Daily bar chart data
  const dailyData = useMemo(() => {
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
    return days.map(day => {
      const dayTxs = transactions.filter(tx => {
        try { return isSameDay(parseISO(tx.transaction_date), day); } catch { return false; }
      });
      const income = dayTxs.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
      const expense = dayTxs.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
      return {
        day: format(day, 'd', { locale: tr }),
        Gelir: income,
        Gider: expense,
      };
    });
  }, [transactions, monthStart, monthEnd]);

  // Donut data per payment method
  const pieData = useMemo(() => {
    const methods = new Map<string, { income: number; expense: number }>();
    transactions.forEach(tx => {
      const key = tx.payment_method || 'other';
      if (!methods.has(key)) methods.set(key, { income: 0, expense: 0 });
      const entry = methods.get(key)!;
      if (tx.type === 'income') entry.income += Number(tx.amount);
      else entry.expense += Number(tx.amount);
    });
    return Array.from(methods.entries()).map(([method, vals]) => ({
      name: METHOD_LABELS[method] || method,
      value: vals.income,
      expense: vals.expense,
    }));
  }, [transactions]);

  const totalIncome = transactions.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
  const totalExpense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-center text-muted-foreground">
        Ay İçi Kasa İstatistiği — {format(monthDate, 'MMMM yyyy', { locale: tr })}
      </h2>

      {/* Summary bar */}
      <div className="flex flex-wrap gap-3 justify-center">
        <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-4 py-2">
          <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">Gelir Toplamı</span>
          <span className="font-bold text-sm tabular-nums text-emerald-600 dark:text-emerald-300">₺{totalIncome.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span>
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-2">
          <span className="text-xs font-semibold text-red-700 dark:text-red-400">Gider Nakit Toplamı</span>
          <span className="font-bold text-sm tabular-nums text-red-600 dark:text-red-300">₺{totalExpense.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span>
        </div>
      </div>

      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        {/* Donut Charts */}
        <Card className="shadow-soft border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Ödeme Yöntemine Göre Dağılım</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap justify-center gap-6">
              {pieData.map((entry, i) => (
                <div key={entry.name} className="flex flex-col items-center gap-1">
                  <div className="w-24 h-24">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={[{ value: entry.value }, { value: Math.max(totalIncome - entry.value, 0) || 1 }]}
                          cx="50%" cy="50%" innerRadius={25} outerRadius={38}
                          dataKey="value" startAngle={90} endAngle={-270}
                          stroke="none"
                        >
                          <Cell fill={COLORS[i % COLORS.length]} />
                          <Cell fill="hsl(var(--muted))" />
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <span className="text-[10px] font-semibold text-muted-foreground">{entry.name}</span>
                  <span className="text-xs font-bold tabular-nums">₺{entry.value.toLocaleString('tr-TR')}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Daily Bar Chart */}
        <Card className="shadow-soft border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Günlük Gelir Grafiği</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyData} barGap={0}>
                  <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `₺${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    formatter={(value: number) => [`₺${value.toLocaleString('tr-TR')}`, '']}
                    labelFormatter={label => `Gün ${label}`}
                  />
                  <Bar dataKey="Gelir" fill="hsl(160, 60%, 45%)" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="Gider" fill="hsl(0, 65%, 55%)" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
