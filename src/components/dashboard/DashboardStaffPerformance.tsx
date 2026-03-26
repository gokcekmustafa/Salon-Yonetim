import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { UserCheck } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface Props {
  staffCounts: { name: string; count: number }[];
}

const COLORS = [
  'hsl(244, 52%, 67%)',
  'hsl(160, 67%, 37%)',
  'hsl(340, 60%, 58%)',
  'hsl(37, 87%, 55%)',
  'hsl(210, 75%, 55%)',
];

export function DashboardStaffPerformance({ staffCounts }: Props) {
  return (
    <Card className="border-border/40">
      <CardHeader className="pb-2 px-4 pt-4">
        <CardTitle className="text-[13px] font-semibold flex items-center gap-2">
          <div className="h-6 w-6 rounded-md bg-success/10 flex items-center justify-center">
            <UserCheck className="h-3 w-3 text-success" />
          </div>
          Personel Performansı
        </CardTitle>
      </CardHeader>
      <CardContent className="px-2 pb-3">
        {staffCounts.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">Bugün aktif personel yok</p>
        ) : (
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={staffCounts.slice(0, 5)} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
              <XAxis type="number" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={70} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid hsl(220,16%,92%)' }}
                formatter={(v: number) => [`${v} randevu`, 'Bugün']}
              />
              <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={14}>
                {staffCounts.slice(0, 5).map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
