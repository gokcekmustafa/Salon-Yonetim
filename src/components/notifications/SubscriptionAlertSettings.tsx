import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AlertTriangle, Save, Loader2, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

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

export function SubscriptionAlertSettings() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<AlertSettings>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('platform_settings' as any)
      .select('value')
      .eq('key', 'subscription_alert')
      .single();
    if (data) {
      setSettings({ ...DEFAULTS, ...(data as any).value });
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from('platform_settings' as any)
      .update({ value: settings as any, updated_by: user.id, updated_at: new Date().toISOString() } as any)
      .eq('key', 'subscription_alert');

    if (error) {
      toast.error('Ayarlar kaydedilemedi: ' + error.message);
    } else {
      toast.success('Abonelik uyarı ayarları kaydedildi');
    }
    setSaving(false);
  };

  const handleReset = () => {
    setSettings(DEFAULTS);
  };

  if (loading) {
    return (
      <Card className="shadow-soft border-border/60">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-soft border-border/60">
      <CardHeader>
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-warning" />
          <div>
            <CardTitle>Abonelik Uyarı Ayarları</CardTitle>
            <CardDescription>
              Salon adminlerin dashboard'unda gösterilen abonelik uyarı bildirimini özelleştirin
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <Label className="text-xs font-semibold">Kaç gün önce gösterilsin</Label>
          <Input
            type="number"
            min={1}
            max={365}
            value={settings.show_days_before}
            onChange={e => setSettings(s => ({ ...s, show_days_before: parseInt(e.target.value) || 30 }))}
            className="h-10 w-32"
          />
          <p className="text-xs text-muted-foreground">
            Abonelik bitimine bu kadar gün kala uyarı gösterilmeye başlar
          </p>
        </div>

        <div className="space-y-2">
          <Label className="text-xs font-semibold">Süre dolmadan gösterilecek mesaj</Label>
          <Textarea
            value={settings.message_expiring}
            onChange={e => setSettings(s => ({ ...s, message_expiring: e.target.value }))}
            rows={2}
          />
          <p className="text-xs text-muted-foreground">
            Kullanılabilir değişkenler: <code className="text-primary">{'{days}'}</code> (kalan gün), <code className="text-primary">{'{date}'}</code> (bitiş tarihi)
          </p>
        </div>

        <div className="space-y-2">
          <Label className="text-xs font-semibold">Süre dolduktan sonra gösterilecek mesaj</Label>
          <Textarea
            value={settings.message_expired}
            onChange={e => setSettings(s => ({ ...s, message_expired: e.target.value }))}
            rows={2}
          />
          <p className="text-xs text-muted-foreground">
            Kullanılabilir değişkenler: <code className="text-primary">{'{days}'}</code> (geçen gün)
          </p>
        </div>

        {/* Preview */}
        <div className="rounded-xl border border-border/60 p-4 bg-muted/30">
          <p className="text-xs font-semibold text-muted-foreground mb-2">Önizleme (süresi dolmak üzere)</p>
          <p className="text-sm">
            {settings.message_expiring.replace('{days}', '7').replace('{date}', '15 Mart 2026')}
          </p>
          <p className="text-xs font-semibold text-muted-foreground mb-2 mt-3">Önizleme (süresi dolmuş)</p>
          <p className="text-sm">
            {settings.message_expired.replace('{days}', '3')}
          </p>
        </div>

        <div className="flex items-center gap-2 pt-2">
          <Button onClick={handleSave} disabled={saving} className="btn-gradient gap-1.5">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Kaydet
          </Button>
          <Button variant="outline" onClick={handleReset} className="gap-1.5">
            <RotateCcw className="h-4 w-4" />
            Varsayılana Dön
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
