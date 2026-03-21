import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Bell, Loader2, Save } from 'lucide-react';

interface NotificationPreferencesProps {
  salonId: string;
}

export function NotificationPreferences({ salonId }: NotificationPreferencesProps) {
  const [saving, setSaving] = useState(false);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [smsNotifications, setSmsNotifications] = useState(false);
  const [appointmentReminders, setAppointmentReminders] = useState(true);

  useEffect(() => {
    const loadPreferences = async () => {
      const { data } = await supabase
        .from('notification_settings')
        .select('*')
        .eq('salon_id', salonId)
        .single();

      if (data) {
        setSmsNotifications(data.sms_enabled);
        setAppointmentReminders(data.reminder_hours_before > 0);
        setEmailNotifications(data.whatsapp_enabled); // reusing whatsapp_enabled for email toggle
      }
    };
    loadPreferences();
  }, [salonId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('notification_settings')
        .update({
          sms_enabled: smsNotifications,
          whatsapp_enabled: emailNotifications, // reusing for email toggle
          reminder_hours_before: appointmentReminders ? 24 : 0,
        })
        .eq('salon_id', salonId);

      if (error) {
        toast.error('Bildirim tercihleri güncellenemedi: ' + error.message);
      } else {
        toast.success('Bildirim tercihleri güncellendi');
      }
    } catch {
      toast.error('Beklenmeyen bir hata oluştu');
    }
    setSaving(false);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-primary" />
          <div>
            <CardTitle>Bildirim Tercihleri</CardTitle>
            <CardDescription>Bildirim kanallarını ve hatırlatmaları yönetin</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-card">
            <div>
              <Label className="text-sm font-medium">E-posta Bildirimleri</Label>
              <p className="text-xs text-muted-foreground mt-0.5">Yeni randevu ve güncellemeler için e-posta alın</p>
            </div>
            <Switch checked={emailNotifications} onCheckedChange={setEmailNotifications} />
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-card">
            <div>
              <Label className="text-sm font-medium">SMS Bildirimleri</Label>
              <p className="text-xs text-muted-foreground mt-0.5">Önemli güncellemeler için SMS alın</p>
            </div>
            <Switch checked={smsNotifications} onCheckedChange={setSmsNotifications} />
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-card">
            <div>
              <Label className="text-sm font-medium">Randevu Hatırlatma</Label>
              <p className="text-xs text-muted-foreground mt-0.5">Müşterilere randevu öncesi hatırlatma gönder</p>
            </div>
            <Switch checked={appointmentReminders} onCheckedChange={setAppointmentReminders} />
          </div>
        </div>

        <Button onClick={handleSave} disabled={saving} className="gap-1.5">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Tercihleri Kaydet
        </Button>
      </CardContent>
    </Card>
  );
}
