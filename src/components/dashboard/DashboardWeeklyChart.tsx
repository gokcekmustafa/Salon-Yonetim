import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3 } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { format, subDays, parseISO, isSameDay } from 'date-fns';
import { tr } from 'date-fns/locale';

interface Props {
  payments: any[];
}

export function DashboardWeeklyChart({ payments }: Props) {
  const chartData = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, i) => {
      const date = subDays(new Date(), 6 - i);
      const dayPayments = payments.filter(p => {
        try { return isSameDay(parseISO(p.payment_date), date); } catch { return false; }
      });
      const total = dayPayments.reduce((s: number, p: any) => s + Number(p.amount), 0);
      return {
        day: format(date, 'EEE', { locale: tr }),
        date: format(date, 'd MMM', { locale: tr }),
        total,
      };
    });
    return days;
  }, [payments]);

  return (
    <Card className="border-border/40">
      <CardHeader className="pb-2 px-4 pt-4">
        <CardTitle className="text-[13px] font-semibold flex items-center gap-2">
          <div className="h-6 w-6 rounded-md bg-primary/10 flex items-center justify-center">
            <BarChart3 className="h-3 w-3 text-primary" />
          </div>
          Haftalık Gelir
        </CardTitle>
      </CardHeader>
      <CardContent className="px-2 pb-3">
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(244, 52%, 67%)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(244, 52%, 67%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(220, 16%, 92%)" />
            <XAxis dataKey="day" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `₺${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`} />
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid hsl(220,16%,92%)' }}
              formatter={(value: number) => [`₺${value.toLocaleString('tr-TR')}`, 'Gelir']}
              labelFormatter={(_, payload) => payload?.[0]?.payload?.date || ''}
            />
            <Area type="monotone" dataKey="total" stroke="hsl(244, 52%, 67%)" strokeWidth={2} fill="url(#colorRevenue)" />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
