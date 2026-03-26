import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { tr } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';

interface Props {
  overdueInstallments: any[];
  customers: any[];
}

export function DashboardOverdueAlert({ overdueInstallments, customers }: Props) {
  const navigate = useNavigate();

  if (overdueInstallments.length === 0) return null;

  return (
    <Card className="border-destructive/30 bg-destructive/5">
      <CardHeader className="pb-1 px-4 pt-3">
        <CardTitle className="text-[12px] text-destructive flex items-center gap-1.5 font-semibold">
          <AlertTriangle className="h-3.5 w-3.5" />
          Gecikmiş Taksitler ({overdueInstallments.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 pb-3 space-y-1.5">
        {overdueInstallments.map((p: any) => {
          const custId = p.installments?.customer_id;
          const custName = custId ? (customers.find((c: any) => c.id === custId)?.name || '-') : '-';
          return (
            <div key={p.id} className="flex items-center justify-between p-2 rounded-md border border-destructive/15 bg-card text-xs">
              <div>
                <p className="font-medium">{custName}</p>
                <p className="text-[10px] text-muted-foreground">
                  Taksit {p.installment_number} · {format(parseISO(p.due_date), 'd MMM', { locale: tr })}
                </p>
              </div>
              <span className="font-bold text-destructive">₺{Number(p.amount).toLocaleString('tr-TR')}</span>
            </div>
          );
        })}
        <Button variant="outline" size="sm" className="w-full text-[11px] h-7" onClick={() => navigate('/taksitler')}>
          Tüm Taksitleri Gör
        </Button>
      </CardContent>
    </Card>
  );
}
