import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Gift } from 'lucide-react';
import { format, parseISO, isToday, addDays, isBefore } from 'date-fns';
import { tr } from 'date-fns/locale';

interface Props {
  customers: any[];
}

export function DashboardBirthdays({ customers }: Props) {
  const upcoming = useMemo(() => {
    const today = new Date();
    const nextWeek = addDays(today, 7);

    return customers
      .filter(c => c.birth_date)
      .map(c => {
        const bd = parseISO(c.birth_date);
        const thisYear = new Date(today.getFullYear(), bd.getMonth(), bd.getDate());
        if (isBefore(thisYear, today) && !isToday(thisYear)) {
          thisYear.setFullYear(today.getFullYear() + 1);
        }
        return { ...c, nextBirthday: thisYear };
      })
      .filter(c => !isBefore(nextWeek, c.nextBirthday) && !isBefore(c.nextBirthday, today))
      .sort((a, b) => a.nextBirthday.getTime() - b.nextBirthday.getTime())
      .slice(0, 4);
  }, [customers]);

  if (upcoming.length === 0) return null;

  return (
    <Card className="border-border/40">
      <CardHeader className="pb-1 px-4 pt-4">
        <CardTitle className="text-[13px] font-semibold flex items-center gap-2">
          <div className="h-6 w-6 rounded-md bg-warning/10 flex items-center justify-center">
            <Gift className="h-3 w-3 text-warning" />
          </div>
          Doğum Günleri
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 pb-3 space-y-1">
        {upcoming.map(c => (
          <div key={c.id} className="flex items-center gap-2.5 p-2 rounded-md hover:bg-muted/30 transition-colors">
            <div className="h-7 w-7 rounded-full bg-warning/10 flex items-center justify-center text-[10px] font-bold text-warning">
              🎂
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{c.name}</p>
              <p className="text-[10px] text-muted-foreground">
                {isToday(c.nextBirthday) ? 'Bugün!' : format(c.nextBirthday, 'd MMMM', { locale: tr })}
              </p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
