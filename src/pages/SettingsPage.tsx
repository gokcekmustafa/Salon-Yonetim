import { useState } from 'react';
import { useSalonData } from '@/hooks/useSalonData';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bell, MessageSquare, Phone, Clock, Send, AlertTriangle, Loader2, Globe } from 'lucide-react';
import { toast } from 'sonner';
import { ChangeOwnPassword } from '@/components/password/ChangeOwnPassword';
import { StaffPasswordManager } from '@/components/password/StaffPasswordManager';
import { AnnouncementManager } from '@/components/notifications/AnnouncementManager';
import { PopupManager } from '@/components/popup/PopupManager';
import { SalonProfileSettings } from '@/components/salon/SalonProfileSettings';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { BrandingSettings } from '@/components/branding/BrandingSettings';

export default function SettingsPage() {
  const { salon, notificationSettings, updateNotificationSettings, loading, refetchSalon } = useSalonData();
  const { isSalonAdmin, isSuperAdmin, currentSalonId } = useAuth();
  const { hasPermission } = usePermissions();

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  const ns = notificationSettings;

  const handleSaveNotifications = () => { toast.success('Bildirim ayarları kaydedildi.'); };

  const templateVars = [
    { key: '{müşteri_adı}', desc: 'Müşteri adı' }, { key: '{tarih}', desc: 'Randevu tarihi' },
    { key: '{saat}', desc: 'Randevu saati' }, { key: '{hizmet}', desc: 'Hizmet adı' },
    { key: '{personel}', desc: 'Personel adı' }, { key: '{salon_adı}', desc: 'Salon adı' },
  ];

  return (
    <div className="page-container animate-in">
      <div><h1 className="page-title">Ayarlar</h1><p className="page-subtitle">Salon ve bildirim ayarlarını yönetin</p></div>

      {/* System Branding - Super Admin only */}
      {isSuperAdmin && <BrandingSettings />}

      {/* Salon Profile (name + logo edit) */}
      {salon && currentSalonId && (isSalonAdmin || isSuperAdmin) && (
        <SalonProfileSettings
          salonId={currentSalonId}
          salonName={salon.name}
          logoUrl={salon.logo_url ?? null}
          onUpdated={refetchSalon}
        />
      )}

      <Card>
        <CardHeader><CardTitle>Salon Bilgileri</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            {salon?.logo_url && <img src={salon.logo_url} alt="Logo" className="h-10 w-10 rounded-lg object-cover border" />}
            <div><p className="text-sm font-medium text-muted-foreground">Salon Adı</p><p className="font-medium">{salon?.name || '-'}</p></div>
          </div>
          <Separator />
          <div><p className="text-sm font-medium text-muted-foreground">Rezervasyon Linki</p><p className="font-medium text-primary text-sm">/book/{salon?.slug || '-'}</p></div>
          <Separator />
          <div><p className="text-sm font-medium text-muted-foreground">Telefon</p><p className="font-medium">{salon?.phone || '-'}</p></div>
          <Separator />
          <div><p className="text-sm font-medium text-muted-foreground">Adres</p><p className="font-medium">{salon?.address || '-'}</p></div>
        </CardContent>
      </Card>

      {/* Password Management */}
      <ChangeOwnPassword />

      {(isSalonAdmin || isSuperAdmin) && <StaffPasswordManager />}

      {/* Salon Announcements */}
      {(isSalonAdmin || isSuperAdmin) && currentSalonId && hasPermission('can_manage_announcements') && (
        <AnnouncementManager mode="salon_admin" salonId={currentSalonId} />
      )}

      {/* Salon Popup Announcements */}
      {(isSalonAdmin || isSuperAdmin) && currentSalonId && hasPermission('can_manage_popups') && (
        <PopupManager mode="salon_admin" salonId={currentSalonId} />
      )}

      {ns && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2"><Bell className="h-5 w-5 text-primary" /><div><CardTitle>Bildirim Ayarları</CardTitle><CardDescription>Randevu hatırlatma bildirimleri</CardDescription></div></div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 border border-border">
              <AlertTriangle className="h-5 w-5 text-accent shrink-0 mt-0.5" />
              <div className="text-sm"><p className="font-medium">Twilio Entegrasyonu Gerekli</p><p className="text-muted-foreground mt-0.5">WhatsApp ve SMS gönderimi için Twilio hesabı bağlanmalıdır.</p></div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-semibold">Bildirim Kanalları</h3>
              <div className="flex items-center justify-between p-3 rounded-lg border">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center"><MessageSquare className="h-4 w-4 text-primary" /></div>
                  <div><p className="font-medium text-sm">WhatsApp</p><p className="text-xs text-muted-foreground">Twilio WhatsApp Business API</p></div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={ns.whatsapp_enabled ? 'default' : 'secondary'} className="text-xs">{ns.whatsapp_enabled ? 'Aktif' : 'Pasif'}</Badge>
                  <Switch checked={ns.whatsapp_enabled} onCheckedChange={v => updateNotificationSettings({ whatsapp_enabled: v })} />
                </div>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg border">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center"><Phone className="h-4 w-4 text-primary" /></div>
                  <div><p className="font-medium text-sm">SMS</p><p className="text-xs text-muted-foreground">Twilio SMS API</p></div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={ns.sms_enabled ? 'default' : 'secondary'} className="text-xs">{ns.sms_enabled ? 'Aktif' : 'Pasif'}</Badge>
                  <Switch checked={ns.sms_enabled} onCheckedChange={v => updateNotificationSettings({ sms_enabled: v })} />
                </div>
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-2"><Clock className="h-4 w-4" /> Hatırlatma Zamanı</h3>
              <div className="flex items-center gap-3">
                <Label className="text-sm text-muted-foreground whitespace-nowrap">Randevudan</Label>
                <Select value={String(ns.reminder_hours_before)} onValueChange={v => updateNotificationSettings({ reminder_hours_before: Number(v) })}>
                  <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 saat</SelectItem><SelectItem value="2">2 saat</SelectItem><SelectItem value="6">6 saat</SelectItem>
                    <SelectItem value="12">12 saat</SelectItem><SelectItem value="24">1 gün</SelectItem><SelectItem value="48">2 gün</SelectItem>
                  </SelectContent>
                </Select>
                <Label className="text-sm text-muted-foreground">önce gönder</Label>
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-2"><Send className="h-4 w-4" /> Mesaj Şablonu</h3>
              <Textarea value={ns.message_template || ''} onChange={e => updateNotificationSettings({ message_template: e.target.value })} rows={3} className="text-sm" />
              <div className="flex flex-wrap gap-1.5">
                {templateVars.map(v => (
                  <button key={v.key} onClick={() => updateNotificationSettings({ message_template: (ns.message_template || '') + ' ' + v.key })} className="text-xs px-2 py-1 rounded-md bg-muted hover:bg-muted/80 text-muted-foreground transition-colors" title={v.desc}>{v.key}</button>
                ))}
              </div>
              <div className="p-3 rounded-lg bg-muted/50 border">
                <p className="text-xs font-medium text-muted-foreground mb-1">Önizleme:</p>
                <p className="text-sm">{(ns.message_template || '').replace('{müşteri_adı}', 'Ayşe Yılmaz').replace('{tarih}', '10 Mart 2026').replace('{saat}', '14:00').replace('{hizmet}', 'Saç Kesimi').replace('{personel}', 'Elif Arslan').replace('{salon_adı}', salon?.name || 'Salon')}</p>
              </div>
            </div>

            <Button onClick={handleSaveNotifications} className="w-full sm:w-auto">Ayarları Kaydet</Button>
          </CardContent>
        </Card>
      )}

      <Card><CardHeader><CardTitle>Hakkında</CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground">SalonYönetim v2.0 — Multi-salon SaaS yönetim platformu.</p></CardContent></Card>
    </div>
  );
}

function OnlineBookingToggle({ salonId, initialActive, salonSlug }: { salonId: string; initialActive: boolean; salonSlug: string }) {
  const [active, setActive] = useState(initialActive);
  const [saving, setSaving] = useState(false);

  const toggle = async (val: boolean) => {
    setSaving(true);
    const { error } = await supabase.from('salons').update({ online_booking_active: val } as any).eq('id', salonId);
    if (error) {
      toast.error('Güncelenemedi: ' + error.message);
    } else {
      setActive(val);
      toast.success(val ? 'Online randevu aktif edildi' : 'Online randevu kapatıldı');
    }
    setSaving(false);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Globe className="h-5 w-5 text-primary" />
          <div><CardTitle>Online Randevu</CardTitle><CardDescription>Müşterilerin online randevu almasını yönetin</CardDescription></div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between p-3 rounded-lg border">
          <div>
            <p className="font-medium text-sm">Online Randevu Durumu</p>
            <p className="text-xs text-muted-foreground">Aktif olduğunda müşteriler /book/{salonSlug} adresinden randevu alabilir</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={active ? 'default' : 'secondary'} className="text-xs">{active ? 'Aktif' : 'Pasif'}</Badge>
            <Switch checked={active} onCheckedChange={toggle} disabled={saving} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
