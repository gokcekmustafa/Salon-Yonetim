import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Settings, Loader2, Save, Clock } from 'lucide-react';

const DAYS_OF_WEEK = [
  { key: 'monday', label: 'Pazartesi' },
  { key: 'tuesday', label: 'Salı' },
  { key: 'wednesday', label: 'Çarşamba' },
  { key: 'thursday', label: 'Perşembe' },
  { key: 'friday', label: 'Cuma' },
  { key: 'saturday', label: 'Cumartesi' },
  { key: 'sunday', label: 'Pazar' },
];

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0') + ':00');

const CURRENCIES = [
  { value: 'TRY', label: '₺ Türk Lirası (TRY)' },
  { value: 'USD', label: '$ Amerikan Doları (USD)' },
  { value: 'EUR', label: '€ Euro (EUR)' },
  { value: 'GBP', label: '£ İngiliz Sterlini (GBP)' },
];

type WorkingHours = Record<string, { open: string; close: string; enabled: boolean }>;

const DEFAULT_HOURS: WorkingHours = DAYS_OF_WEEK.reduce((acc, day) => {
  acc[day.key] = { open: '09:00', close: '18:00', enabled: day.key !== 'sunday' };
  return acc;
}, {} as WorkingHours);

interface GeneralSettingsProps {
  salonId: string;
  salonName: string;
  salonAddress: string | null;
  salonPhone: string | null;
  onUpdated: () => void;
}

export function GeneralSettings({ salonId, salonName, salonAddress, salonPhone, onUpdated }: GeneralSettingsProps) {
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(salonName);
  const [address, setAddress] = useState(salonAddress || '');
  const [phone, setPhone] = useState(salonPhone || '');
  const [currency, setCurrency] = useState('TRY');
  const [workingHours, setWorkingHours] = useState<WorkingHours>(DEFAULT_HOURS);

  useEffect(() => {
    setName(salonName);
    setAddress(salonAddress || '');
    setPhone(salonPhone || '');
  }, [salonName, salonAddress, salonPhone]);

  // Load settings from platform_settings
  useEffect(() => {
    const loadSettings = async () => {
      const { data } = await supabase
        .from('platform_settings')
        .select('key, value')
        .in('key', [`salon_${salonId}_currency`, `salon_${salonId}_working_hours`]);

      if (data) {
        const currencySetting = data.find(d => d.key === `salon_${salonId}_currency`);
        const hoursSetting = data.find(d => d.key === `salon_${salonId}_working_hours`);
        if (currencySetting?.value) setCurrency(String((currencySetting.value as any)?.currency || 'TRY'));
        if (hoursSetting?.value) setWorkingHours({ ...DEFAULT_HOURS, ...(hoursSetting.value as any) });
      }
    };
    loadSettings();
  }, [salonId]);

  const updateWorkingDay = (dayKey: string, field: string, value: string | boolean) => {
    setWorkingHours(prev => ({
      ...prev,
      [dayKey]: { ...prev[dayKey], [field]: value },
    }));
  };

  const handleSave = async () => {
    if (!name.trim()) { toast.error('Salon adı zorunludur'); return; }
    setSaving(true);

    try {
      // Update salon record
      const { error: salonError } = await supabase
        .from('salons')
        .update({ name: name.trim(), address: address.trim() || null, phone: phone.trim() || null })
        .eq('id', salonId);

      if (salonError) {
        toast.error('Salon bilgileri güncellenemedi: ' + salonError.message);
        setSaving(false);
        return;
      }

      // Save currency and working hours to platform_settings
      await supabase.from('platform_settings').upsert(
        { key: `salon_${salonId}_currency`, value: { currency } as any, updated_at: new Date().toISOString() },
        { onConflict: 'key' }
      );

      await supabase.from('platform_settings').upsert(
        { key: `salon_${salonId}_working_hours`, value: workingHours as any, updated_at: new Date().toISOString() },
        { onConflict: 'key' }
      );

      toast.success('Genel ayarlar güncellendi');
      onUpdated();
    } catch {
      toast.error('Beklenmeyen bir hata oluştu');
    }
    setSaving(false);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Settings className="h-5 w-5 text-primary" />
          <div>
            <CardTitle>Genel Ayarlar</CardTitle>
            <CardDescription>Salon bilgileri, çalışma saatleri ve para birimi</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Salon info */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label className="text-xs font-semibold">Salon Adı</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Salon adı" />
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-semibold">Telefon</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="05XX XXX XX XX" />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label className="text-xs font-semibold">Adres</Label>
            <Textarea value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Salon adresi" rows={2} />
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-semibold">Para Birimi</Label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CURRENCIES.map(c => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Working hours */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <Label className="text-sm font-semibold">Çalışma Saatleri</Label>
          </div>
          <div className="space-y-2">
            {DAYS_OF_WEEK.map(day => {
              const d = workingHours[day.key];
              return (
                <div key={day.key} className="flex items-center gap-3 p-2 rounded-lg border border-border bg-card">
                  <label className="flex items-center gap-2 min-w-[100px]">
                    <input
                      type="checkbox"
                      checked={d?.enabled ?? true}
                      onChange={(e) => updateWorkingDay(day.key, 'enabled', e.target.checked)}
                      className="rounded border-border"
                    />
                    <span className={`text-sm font-medium ${d?.enabled ? '' : 'text-muted-foreground line-through'}`}>
                      {day.label}
                    </span>
                  </label>
                  {d?.enabled && (
                    <div className="flex items-center gap-2 text-sm">
                      <Select value={d.open} onValueChange={(v) => updateWorkingDay(day.key, 'open', v)}>
                        <SelectTrigger className="w-24 h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {HOURS.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <span className="text-muted-foreground">—</span>
                      <Select value={d.close} onValueChange={(v) => updateWorkingDay(day.key, 'close', v)}>
                        <SelectTrigger className="w-24 h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {HOURS.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {!d?.enabled && (
                    <span className="text-xs text-muted-foreground">Kapalı</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <Button onClick={handleSave} disabled={saving} className="gap-1.5">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Değişiklikleri Kaydet
        </Button>
      </CardContent>
    </Card>
  );
}
