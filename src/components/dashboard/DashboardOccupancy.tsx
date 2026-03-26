import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CircleDot } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

interface Props {
  completed: number;
  inSession: number;
  waiting: number;
  total: number;
}

export function DashboardOccupancy({ completed, inSession, waiting, total }: Props) {
  const data = [
    { name: 'Tamamlandı', value: completed, color: 'hsl(160, 67%, 37%)' },
    { name: 'Devam Eden', value: inSession, color: 'hsl(340, 60%, 58%)' },
    { name: 'Bekliyor', value: waiting, color: 'hsl(244, 52%, 67%)' },
  ].filter(d => d.value > 0);

  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <Card className="border-border/40">
      <CardHeader className="pb-1 px-4 pt-4">
        <CardTitle className="text-[13px] font-semibold flex items-center gap-2">
          <div className="h-6 w-6 rounded-md bg-accent/10 flex items-center justify-center">
            <CircleDot className="h-3 w-3 text-accent" />
          </div>
          Doluluk Oranı
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-3">
        {total === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">Veri yok</p>
        ) : (
          <div className="flex items-center gap-3">
            <div className="relative w-24 h-24">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data}
                    cx="50%"
                    cy="50%"
                    innerRadius={28}
                    outerRadius={42}
                    paddingAngle={3}
                    dataKey="value"
                    strokeWidth={0}
                  >
                    {data.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-sm font-bold">{completionRate}%</span>
              </div>
            </div>
            <div className="space-y-1.5 flex-1">
              {[
                { label: 'Tamamlandı', value: completed, color: 'bg-success' },
                { label: 'Devam Eden', value: inSession, color: 'bg-accent' },
                { label: 'Bekliyor', value: waiting, color: 'bg-primary' },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-2 text-[11px]">
                  <div className={`h-2 w-2 rounded-full ${item.color}`} />
                  <span className="text-muted-foreground">{item.label}</span>
                  <span className="ml-auto font-semibold">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
