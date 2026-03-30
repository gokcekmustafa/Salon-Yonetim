import { useState, useMemo, useRef, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { format, parseISO, eachDayOfInterval, startOfMonth, endOfMonth, isSameDay, isSameMonth, isSameYear, isWithinInterval } from 'date-fns';
import { tr } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

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
  allTransactions?: CashTransaction[];
}

type ViewMode = 'monthly' | 'months_compare' | 'years_compare' | 'custom';

const COLORS = ['hsl(160, 60%, 45%)', 'hsl(0, 70%, 55%)', 'hsl(210, 70%, 50%)', 'hsl(35, 80%, 50%)', 'hsl(270, 50%, 55%)'];

const METHOD_LABELS: Record<string, string> = {
  cash: 'Nakit',
  credit_card: 'Kredi Kartı',
  eft: 'EFT / Havale',
  mail_order: 'Mail Order',
  other: 'Diğer',
};

const MONTHS_TR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

export function CashMonthlyStats({ transactions, cashBoxes, month, allTransactions }: Props) {
  const allTx = allTransactions || transactions;

  const [viewMode, setViewMode] = useState<ViewMode>('monthly');
  const [selectedYear, setSelectedYear] = useState(() => parseInt(month.split('-')[0]));
  const [selectedMonth, setSelectedMonth] = useState(() => parseInt(month.split('-')[1]) - 1);
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const yearScrollRef = useRef<HTMLDivElement>(null);

  // Determine year range from all transactions
  const yearRange = useMemo(() => {
    const currentYear = new Date().getFullYear();
    let minYear = currentYear;
    let maxYear = currentYear;
    allTx.forEach(tx => {
      try {
        const y = parseInt(tx.transaction_date.substring(0, 4));
        if (y < minYear) minYear = y;
        if (y > maxYear) maxYear = y;
      } catch { /* skip */ }
    });
    minYear = Math.min(minYear, currentYear - 2);
    maxYear = Math.max(maxYear, currentYear + 1);
    const years: number[] = [];
    for (let y = minYear; y <= maxYear; y++) years.push(y);
    return years;
  }, [allTx]);

  // Scroll to selected year
  useEffect(() => {
    if (yearScrollRef.current) {
      const el = yearScrollRef.current.querySelector(`[data-year="${selectedYear}"]`);
      if (el) el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }, [selectedYear]);

  // Filter transactions based on view mode
  const filteredTx = useMemo(() => {
    if (viewMode === 'monthly') {
      return allTx.filter(tx => {
        try {
          const d = parseISO(tx.transaction_date);
          return d.getFullYear() === selectedYear && d.getMonth() === selectedMonth;
        } catch { return false; }
      });
    }
    if (viewMode === 'months_compare') {
      return allTx.filter(tx => {
        try { return parseInt(tx.transaction_date.substring(0, 4)) === selectedYear; } catch { return false; }
      });
    }
    if (viewMode === 'years_compare') {
      return allTx;
    }
    if (viewMode === 'custom' && customStart && customEnd) {
      return allTx.filter(tx => {
        try {
          const d = parseISO(tx.transaction_date);
          return isWithinInterval(d, { start: parseISO(customStart), end: parseISO(customEnd + 'T23:59:59') });
        } catch { return false; }
      });
    }
    return [];
  }, [allTx, viewMode, selectedYear, selectedMonth, customStart, customEnd]);

  // Payment method breakdown
  const methodData = useMemo(() => {
    const methods = new Map<string, number>();
    let total = 0;
    filteredTx.forEach(tx => {
      if (tx.type === 'income') {
        const key = tx.payment_method || 'other';
        methods.set(key, (methods.get(key) || 0) + Number(tx.amount));
        total += Number(tx.amount);
      }
    });
    return Array.from(methods.entries()).map(([method, value]) => ({
      key: method,
      name: METHOD_LABELS[method] || method,
      value,
      percent: total > 0 ? Math.round((value / total) * 100) : 0,
    }));
  }, [filteredTx]);

  // Totals
  const totalIncome = filteredTx.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
  const totalExpenseCash = filteredTx.filter(t => t.type === 'expense' && t.payment_method === 'cash').reduce((s, t) => s + Number(t.amount), 0);
  const totalExpenseEft = filteredTx.filter(t => t.type === 'expense' && t.payment_method === 'eft').reduce((s, t) => s + Number(t.amount), 0);

  // Bar chart data
  const barData = useMemo(() => {
    if (viewMode === 'monthly') {
      const monthDate = new Date(selectedYear, selectedMonth, 1);
      const days = eachDayOfInterval({ start: startOfMonth(monthDate), end: endOfMonth(monthDate) });
      return days.map(day => {
        const dayTxs = filteredTx.filter(tx => { try { return isSameDay(parseISO(tx.transaction_date), day); } catch { return false; } });
        return {
          label: format(day, 'd'),
          Gelir: dayTxs.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0),
          Gider: dayTxs.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0),
        };
      });
    }
    if (viewMode === 'months_compare') {
      return MONTHS_TR.map((name, i) => {
        const monthTxs = filteredTx.filter(tx => { try { return parseISO(tx.transaction_date).getMonth() === i; } catch { return false; } });
        return {
          label: name.substring(0, 3),
          Gelir: monthTxs.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0),
          Gider: monthTxs.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0),
        };
      });
    }
    if (viewMode === 'years_compare') {
      return yearRange.map(y => {
        const yTxs = filteredTx.filter(tx => { try { return parseInt(tx.transaction_date.substring(0, 4)) === y; } catch { return false; } });
        return {
          label: String(y),
          Gelir: yTxs.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0),
          Gider: yTxs.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0),
        };
      });
    }
    // custom - daily
    if (customStart && customEnd) {
      try {
        const days = eachDayOfInterval({ start: parseISO(customStart), end: parseISO(customEnd) });
        if (days.length > 60) {
          // group by month
          const monthMap = new Map<string, { Gelir: number; Gider: number }>();
          filteredTx.forEach(tx => {
            const key = tx.transaction_date.substring(0, 7);
            if (!monthMap.has(key)) monthMap.set(key, { Gelir: 0, Gider: 0 });
            const e = monthMap.get(key)!;
            if (tx.type === 'income') e.Gelir += Number(tx.amount);
            else e.Gider += Number(tx.amount);
          });
          return Array.from(monthMap.entries()).sort().map(([k, v]) => ({ label: k.substring(5), ...v }));
        }
        return days.map(day => {
          const dayTxs = filteredTx.filter(tx => { try { return isSameDay(parseISO(tx.transaction_date), day); } catch { return false; } });
          return {
            label: format(day, 'd MMM', { locale: tr }),
            Gelir: dayTxs.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0),
            Gider: dayTxs.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0),
          };
        });
      } catch { return []; }
    }
    return [];
  }, [viewMode, filteredTx, selectedYear, selectedMonth, yearRange, customStart, customEnd]);

  const viewTitle = useMemo(() => {
    if (viewMode === 'monthly') return `${MONTHS_TR[selectedMonth]} ${selectedYear}`;
    if (viewMode === 'months_compare') return `${selectedYear} Yılı`;
    if (viewMode === 'years_compare') return 'Tüm Yıllar';
    if (viewMode === 'custom' && customStart && customEnd) return `${customStart} — ${customEnd}`;
    return 'Özel Tarih Aralığı';
  }, [viewMode, selectedYear, selectedMonth, customStart, customEnd]);

  return (
    <div className="space-y-0">
      {/* Title */}
      <h2 className="text-lg font-bold text-center text-foreground py-3">
        Ay İçi Kasa İstatistiği
      </h2>

      {/* View mode tabs */}
      <div className="flex flex-wrap gap-2 justify-center pb-3">
        {([
          ['monthly', 'Ay İçi Bakış'],
          ['months_compare', 'Aylar Arası Bakış'],
          ['years_compare', 'Yıllar Arası Bakış'],
          ['custom', 'Tarihler Arası Tercih'],
        ] as [ViewMode, string][]).map(([mode, label]) => (
          <Button
            key={mode}
            size="sm"
            variant={viewMode === mode ? 'default' : 'outline'}
            className={viewMode === mode
              ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600 rounded-full px-4 text-xs'
              : 'rounded-full px-4 text-xs border-border text-muted-foreground hover:text-foreground'
            }
            onClick={() => setViewMode(mode)}
          >
            {label}
          </Button>
        ))}
      </div>

      {/* Custom date range picker */}
      {viewMode === 'custom' && (
        <div className="flex flex-wrap gap-3 justify-center pb-3 items-center">
          <Input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="w-40 h-8 text-xs" />
          <span className="text-xs text-muted-foreground">—</span>
          <Input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="w-40 h-8 text-xs" />
        </div>
      )}

      {/* Year ruler */}
      {(viewMode === 'monthly' || viewMode === 'months_compare') && (
        <div className="border-b border-border">
          <div ref={yearScrollRef} className="flex overflow-x-auto scrollbar-hide">
            {yearRange.map(y => (
              <button
                key={y}
                data-year={y}
                onClick={() => setSelectedYear(y)}
                className={`flex-shrink-0 px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap
                  ${y === selectedYear
                    ? 'text-foreground font-bold border-b-2 border-emerald-500'
                    : 'text-muted-foreground hover:text-foreground'
                  }`}
              >
                {y}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Month ruler */}
      {viewMode === 'monthly' && (
        <div className="border-b-2 border-emerald-500/30">
          <div className="flex overflow-x-auto scrollbar-hide">
            {MONTHS_TR.map((name, i) => (
              <button
                key={i}
                onClick={() => setSelectedMonth(i)}
                className={`flex-shrink-0 px-3 py-2 text-xs transition-colors whitespace-nowrap flex items-center gap-1
                  ${i === selectedMonth
                    ? 'text-foreground font-bold border-b-2 border-emerald-500'
                    : 'text-muted-foreground hover:text-foreground'
                  }`}
              >
                <svg width="12" height="10" viewBox="0 0 12 10" className="opacity-40"><rect x="1" y="1" width="2" height="8" rx="0.5" fill="currentColor"/><rect x="5" y="3" width="2" height="6" rx="0.5" fill="currentColor"/><rect x="9" y="0" width="2" height="9" rx="0.5" fill="currentColor"/></svg>
                {name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Content: Donuts + Bar chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-4">
        {/* Donut charts */}
        <div className="flex flex-wrap justify-center items-start gap-5 py-2">
          {methodData.length === 0 && (
            <p className="text-xs text-muted-foreground py-8">Bu dönemde gelir kaydı bulunamadı.</p>
          )}
          {methodData.map((entry, i) => (
            <div key={entry.key} className="flex flex-col items-center gap-1 min-w-[90px]">
              <div className="w-24 h-24 relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { value: entry.value || 0.001 },
                        { value: Math.max(totalIncome - entry.value, 0) || 0.001 },
                      ]}
                      cx="50%" cy="50%" innerRadius={28} outerRadius={40}
                      dataKey="value" startAngle={90} endAngle={-270}
                      stroke="none"
                    >
                      <Cell fill={COLORS[i % COLORS.length]} />
                      <Cell fill="hsl(var(--muted))" />
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                {/* Center text */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-[10px] font-medium text-muted-foreground">{entry.name}</span>
                  <span className="text-xs font-bold" style={{ color: COLORS[i % COLORS.length] }}>%{entry.percent}</span>
                </div>
              </div>
              <span className="text-xs font-bold tabular-nums" style={{ color: COLORS[i % COLORS.length] }}>
                {entry.value.toLocaleString('tr-TR', { minimumFractionDigits: 0 })} ₺
              </span>
            </div>
          ))}
        </div>

        {/* Bar chart */}
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barData} barGap={0}>
              <XAxis dataKey="label" tick={{ fontSize: 9 }} interval={viewMode === 'monthly' ? 0 : undefined} />
              <YAxis tick={{ fontSize: 9 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k ₺`} />
              <Tooltip
                formatter={(value: number) => [`₺${value.toLocaleString('tr-TR')}`, '']}
                labelFormatter={label => viewMode === 'monthly' ? `Gün ${label}` : label}
              />
              <Bar dataKey="Gelir" fill="hsl(210, 70%, 50%)" radius={[2, 2, 0, 0]} />
              <Bar dataKey="Gider" fill="hsl(0, 65%, 55%)" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Bottom summary bar */}
      <div className="flex flex-wrap items-stretch mt-4 rounded-lg overflow-hidden border border-border text-sm">
        <div className="flex-1 min-w-[200px] flex items-center justify-between px-4 py-2.5 bg-emerald-600/10 border-r border-border">
          <span className="font-semibold text-emerald-700 dark:text-emerald-400 text-xs">Gelir Toplamı</span>
          <span className="font-bold tabular-nums text-emerald-600 dark:text-emerald-300">
            {totalIncome.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
          </span>
        </div>
        <div className="flex-1 min-w-[200px] flex items-center gap-4 px-4 py-2.5 bg-red-600/10">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-red-700 dark:text-red-400 text-xs">Gider Nakit Toplamı</span>
            <span className="font-bold tabular-nums text-red-600 dark:text-red-300">
              {totalExpenseCash.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-red-700 dark:text-red-400 text-xs">Gider EFT Toplamı</span>
            <span className="font-bold tabular-nums text-red-600 dark:text-red-300">
              {totalExpenseEft.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
