import { useState, useEffect } from 'react';
import { AlertTriangle, Clock, CreditCard } from 'lucide-react';
import { differenceInDays, parseISO } from 'date-fns';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';

interface AlertSettings {
  message_expired: string;
  message_expiring: string;
  show_days_before: number;
}

const DEFAULTS: AlertSettings = {
  message_expired: 'Aboneliğiniz {days} gün önce sona erdi. Lütfen yenileyin.',
  message_expiring: 'Aboneliğiniz {days} gün sonra ({date}) sona erecek.',
  show_days_before: 30,
};

interface SubscriptionAlertProps {
  expiresAt: string | null;
  plan: string;
}

export function SubscriptionAlert({ expiresAt, plan }: SubscriptionAlertProps) {
  const [settings, setSettings] = useState<AlertSettings>(DEFAULTS);

  useEffect(() => {
    supabase
      .from('platform_settings' as any)
      .select('value')
      .eq('key', 'subscription_alert')
      .single()
      .then(({ data }) => {
        if (data) setSettings({ ...DEFAULTS, ...(data as any).value });
      });
  }, []);

  if (!expiresAt) return null;

  const expiryDate = parseISO(expiresAt);
  const daysRemaining = differenceInDays(expiryDate, new Date());

  if (daysRemaining > settings.show_days_before) return null;

  const isExpired = daysRemaining < 0;
  const isUrgent = daysRemaining <= 7;
  const isWarning = daysRemaining <= 30;

  const bgColor = isExpired
    ? 'bg-destructive/10 border-destructive/30'
    : isUrgent
    ? 'bg-warning/10 border-warning/30'
    : 'bg-info/10 border-info/30';

  const textColor = isExpired
    ? 'text-destructive'
    : isUrgent
    ? 'text-warning'
    : 'text-info';

  const iconColor = isExpired
    ? 'text-destructive'
    : isUrgent
    ? 'text-warning'
    : 'text-info';

  return (
    <div className={`rounded-xl border p-4 ${bgColor} animate-in`}>
      <div className="flex items-start gap-3">
        <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${isExpired ? 'bg-destructive/20' : isUrgent ? 'bg-warning/20' : 'bg-info/20'}`}>
          <AlertTriangle className={`h-5 w-5 ${iconColor}`} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className={`text-sm font-semibold ${textColor}`}>
            {isExpired ? 'Abonelik Süresi Doldu!' : 'Abonelik Süresi Yaklaşıyor'}
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            {isExpired
              ? settings.message_expired
                  .replace('{days}', String(Math.abs(daysRemaining)))
              : settings.message_expiring
                  .replace('{days}', String(daysRemaining))
                  .replace('{date}', format(expiryDate, 'd MMMM yyyy', { locale: tr }))
            }
          </p>
          <div className="flex items-center gap-4 mt-2">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CreditCard className="h-3.5 w-3.5" />
              <span className="capitalize font-medium">{plan}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              <span>{format(expiryDate, 'd MMM yyyy', { locale: tr })}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}