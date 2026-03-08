import { useSalon } from '@/contexts/SalonContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Bell, MessageSquare, Phone, Clock, Send, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import type { NotificationSettings } from '@/types/salon';

export default function SettingsPage() {
  const { salon, notificationSettings, updateNotificationSettings } = useSalon();

  const handleSaveNotifications = () => {
    toast.success('Bildirim ayarları kaydedildi.');
  };

  const templateVars = [
    { key: '{müşteri_adı}', desc: 'Müşteri adı' },
    { key: '{tarih}', desc: 'Randevu tarihi' },
    { key: '{saat}', desc: 'Randevu saati' },
    { key: '{hizmet}', desc: 'Hizmet adı' },
    { key: '{personel}', desc: 'Personel adı' },
    { key: '{salon_adı}', desc: 'Salon adı' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-2xl font-bold">Ayarlar</h1>

      {/* Salon Info */}
      <Card>
        <CardHeader>
          <CardTitle>Salon Bilgileri</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Salon Adı</p>
            <p className="font-medium">{salon.name}</p>
          </div>
          <Separator />
          <div>
            <p className="text-sm font-medium text-muted-foreground">Rezervasyon Linki</p>
            <p className="font-medium text-primary text-sm">/book/{salon.slug}</p>
          </div>
          <Separator />
          <div>
            <p className="text-sm font-medium text-muted-foreground">Telefon</p>
            <p className="font-medium">{salon.phone}</p>
          </div>
          <Separator />
          <div>
            <p className="text-sm font-medium text-muted-foreground">Adres</p>
            <p className="font-medium">{salon.address}</p>
          </div>
          <Separator />
          <div>
            <p className="text-sm font-medium text-muted-foreground">Çalışma Saatleri</p>
            <p className="font-medium">09:00 - 21:00</p>
          </div>
        </CardContent>
      </Card>

      {/* Notification Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            <div>
              <CardTitle>Bildirim Ayarları</CardTitle>
              <CardDescription>Randevu hatırlatma bildirimleri</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Integration notice */}
          <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 border border-border">
            <AlertTriangle className="h-5 w-5 text-accent shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium">Twilio Entegrasyonu Gerekli</p>
              <p className="text-muted-foreground mt-0.5">
                WhatsApp ve SMS gönderimi için Twilio hesabı bağlanmalıdır.
                Backend entegrasyonu yapıldığında bildirimler otomatik olarak gönderilecektir.
              </p>
            </div>
          </div>

          {/* Channels */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold">Bildirim Kanalları</h3>

            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <MessageSquare className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-sm">WhatsApp</p>
                  <p className="text-xs text-muted-foreground">Twilio WhatsApp Business API</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={notificationSettings.whatsappEnabled ? 'default' : 'secondary'} className="text-xs">
                  {notificationSettings.whatsappEnabled ? 'Aktif' : 'Pasif'}
                </Badge>
                <Switch
                  checked={notificationSettings.whatsappEnabled}
                  onCheckedChange={v => updateNotificationSettings({ whatsappEnabled: v })}
                />
              </div>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Phone className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-sm">SMS</p>
                  <p className="text-xs text-muted-foreground">Twilio SMS API</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={notificationSettings.smsEnabled ? 'default' : 'secondary'} className="text-xs">
                  {notificationSettings.smsEnabled ? 'Aktif' : 'Pasif'}
                </Badge>
                <Switch
                  checked={notificationSettings.smsEnabled}
                  onCheckedChange={v => updateNotificationSettings({ smsEnabled: v })}
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Timing */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Clock className="h-4 w-4" /> Hatırlatma Zamanı
            </h3>
            <div className="flex items-center gap-3">
              <Label className="text-sm text-muted-foreground whitespace-nowrap">Randevudan</Label>
              <Select
                value={String(notificationSettings.reminderHoursBefore)}
                onValueChange={v => updateNotificationSettings({ reminderHoursBefore: Number(v) })}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 saat</SelectItem>
                  <SelectItem value="2">2 saat</SelectItem>
                  <SelectItem value="6">6 saat</SelectItem>
                  <SelectItem value="12">12 saat</SelectItem>
                  <SelectItem value="24">1 gün</SelectItem>
                  <SelectItem value="48">2 gün</SelectItem>
                </SelectContent>
              </Select>
              <Label className="text-sm text-muted-foreground">önce gönder</Label>
            </div>
          </div>

          <Separator />

          {/* Message Template */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Send className="h-4 w-4" /> Mesaj Şablonu
            </h3>
            <Textarea
              value={notificationSettings.messageTemplate}
              onChange={e => updateNotificationSettings({ messageTemplate: e.target.value })}
              rows={3}
              className="text-sm"
            />
            <div className="flex flex-wrap gap-1.5">
              {templateVars.map(v => (
                <button
                  key={v.key}
                  onClick={() => updateNotificationSettings({ messageTemplate: notificationSettings.messageTemplate + ' ' + v.key })}
                  className="text-xs px-2 py-1 rounded-md bg-muted hover:bg-muted/80 text-muted-foreground transition-colors"
                  title={v.desc}
                >
                  {v.key}
                </button>
              ))}
            </div>
            <div className="p-3 rounded-lg bg-muted/50 border">
              <p className="text-xs font-medium text-muted-foreground mb-1">Önizleme:</p>
              <p className="text-sm">
                {notificationSettings.messageTemplate
                  .replace('{müşteri_adı}', 'Ayşe Yılmaz')
                  .replace('{tarih}', '10 Mart 2026')
                  .replace('{saat}', '14:00')
                  .replace('{hizmet}', 'Saç Kesimi')
                  .replace('{personel}', 'Elif Arslan')
                  .replace('{salon_adı}', salon.name)}
              </p>
            </div>
          </div>

          <Button onClick={handleSaveNotifications} className="w-full sm:w-auto">
            Ayarları Kaydet
          </Button>
        </CardContent>
      </Card>

      {/* About */}
      <Card>
        <CardHeader>
          <CardTitle>Hakkında</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            SalonYönetim v1.0 — Güzellik salonları için modern yönetim sistemi.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
