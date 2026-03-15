import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DbStaff } from '@/hooks/useSalonData';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { User, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

type StaffDetail = {
  id: string; staff_id: string; salon_id: string; surname: string | null;
  tc_no: string | null; birth_date: string | null; gender: string | null;
  secondary_phone: string | null; address: string | null; department: string | null;
  start_date: string | null; working_hours: any; experiences: string[];
  offered_services: string[]; bonus_type: string; bonus_rate: number;
  reward_description: string | null; payment_period: string; salary_notes: string | null;
  permissions: any;
};

const DEPARTMENTS = ['Firma Sahibi','Yönetici','Hizmet Müdürü','Estetisyen','Stajyer Estetisyen','Satış Müdürü','Satış','Anketör Şefi','Anketör','Resepsiyon','Temizlik','Muhasebe'];
const DAYS = ['Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi','Pazar'];
const EXPERIENCES = ['LAZER EPİLASYON','CİLT BAKIMI','BÖLGESEL ZAYIFLAMA','SOLARİUM','İĞNELİ EPİLASYON'];
const OFFERED = ['LAZER EPİLASYON','CİLT BAKIMI','BÖLGESEL ZAYIFLAMA','KİRPİK LİFTİNG','ÇATLAK BAKIMI'];
const PERMISSION_KEYS = [
  { key: 'appointment_system', label: 'Randevu Sistemi' },
  { key: 'meeting_records', label: 'Görüşme Kayıtları' },
  { key: 'staff_payments', label: 'Personel Ödemeleri' },
  { key: 'cash_book', label: 'Kasa Defteri' },
  { key: 'company_actions', label: 'Firma Hareketleri' },
  { key: 'sms_actions', label: 'SMS Hareketleri' },
  { key: 'customer_reviews', label: 'Müşteri Yorumları' },
  { key: 'past_transactions', label: 'Geçmiş Tarihli İşlemler' },
  { key: 'service_stats', label: 'Hizmet / Ürün / Satış İstatistiği' },
  { key: 'company_stats', label: 'Şirket İstatistiği' },
];

interface Props {
  staff: DbStaff;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  branches: { id: string; name: string }[];
  appointments: any[];
  services: any[];
  customers: any[];
  payments: any[];
}

export default function StaffDetailCard({ staff: s, open, onOpenChange, branches, appointments, services, customers, payments }: Props) {
  const [detail, setDetail] = useState<StaffDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [salary, setSalary] = useState<{ monthly_salary: number } | null>(null);
  const [staffPayments, setStaffPayments] = useState<any[]>([]);

  useEffect(() => {
    if (!open || !s) return;
    setLoading(true);
    Promise.all([
      supabase.from('staff_details').select('*').eq('staff_id', s.id).maybeSingle(),
      supabase.from('staff_salaries').select('*').eq('staff_id', s.id).maybeSingle(),
      supabase.from('staff_payments').select('*').eq('staff_id', s.id).order('payment_date', { ascending: false }),
    ]).then(([detailRes, salaryRes, paymentsRes]) => {
      setDetail(detailRes.data as StaffDetail | null);
      setSalary(salaryRes.data as any);
      setStaffPayments(paymentsRes.data || []);
      setLoading(false);
    });
  }, [open, s?.id]);

  const staffAppointments = appointments.filter(a => a.staff_id === s?.id);
  const completedCount = staffAppointments.filter(a => a.status === 'tamamlandi').length;
  const cancelledCount = staffAppointments.filter(a => a.status === 'iptal').length;
  const totalRevenue = staffAppointments
    .filter(a => a.status === 'tamamlandi')
    .reduce((sum, a) => sum + (services.find((sv: any) => sv.id === a.service_id)?.price || 0), 0);

  const updateDetail = async (updates: Partial<StaffDetail>) => {
    if (!detail) return;
    await supabase.from('staff_details').update(updates).eq('id', detail.id);
    setDetail(prev => prev ? { ...prev, ...updates } : prev);
    toast.success('Güncellendi');
  };

  const togglePermission = (key: string) => {
    if (!detail) return;
    const perms = { ...(detail.permissions || {}) };
    perms[key] = !perms[key];
    updateDetail({ permissions: perms });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-6 w-6 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-lg">{s?.name}</DialogTitle>
              <p className="text-sm text-muted-foreground">{detail?.department || 'Personel'} • {branches.find(b => b.id === s?.branch_id)?.name || '-'}</p>
            </div>
            <Badge variant={s?.is_active ? 'default' : 'secondary'} className="ml-auto">{s?.is_active ? 'Aktif' : 'Pasif'}</Badge>
          </div>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : (
          <Tabs defaultValue="personal" className="mt-2">
            <TabsList className="w-full flex-wrap h-auto gap-1 bg-muted/50 p-1">
              <TabsTrigger value="personal" className="text-xs">Kişisel</TabsTrigger>
              <TabsTrigger value="services" className="text-xs">Hizmet</TabsTrigger>
              <TabsTrigger value="stats" className="text-xs">Satış</TabsTrigger>
              <TabsTrigger value="bonus" className="text-xs">Prim</TabsTrigger>
              <TabsTrigger value="advances" className="text-xs">Avans/Maaş</TabsTrigger>
              <TabsTrigger value="salary" className="text-xs">Maaş Bilgi</TabsTrigger>
              <TabsTrigger value="history" className="text-xs">İşlemler</TabsTrigger>
              <TabsTrigger value="permissions" className="text-xs">Yetki</TabsTrigger>
            </TabsList>

            {/* 1. Kişisel Bilgiler */}
            <TabsContent value="personal" className="space-y-3 mt-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><Label className="text-xs text-muted-foreground">Ad</Label><p className="font-medium">{s?.name}</p></div>
                <div><Label className="text-xs text-muted-foreground">Soyad</Label><p className="font-medium">{detail?.surname || '-'}</p></div>
                <div><Label className="text-xs text-muted-foreground">TC / Pasaport</Label><p className="font-medium">{detail?.tc_no || '-'}</p></div>
                <div><Label className="text-xs text-muted-foreground">Doğum Tarihi</Label><p className="font-medium">{detail?.birth_date || '-'}</p></div>
                <div><Label className="text-xs text-muted-foreground">Cinsiyet</Label><p className="font-medium">{detail?.gender || '-'}</p></div>
                <div><Label className="text-xs text-muted-foreground">Telefon</Label><p className="font-medium">{s?.phone || '-'}</p></div>
                <div><Label className="text-xs text-muted-foreground">Yedek Telefon</Label><p className="font-medium">{detail?.secondary_phone || '-'}</p></div>
                <div><Label className="text-xs text-muted-foreground">Departman</Label><p className="font-medium">{detail?.department || '-'}</p></div>
                <div><Label className="text-xs text-muted-foreground">İşe Başlama</Label><p className="font-medium">{detail?.start_date || '-'}</p></div>
                <div className="col-span-2"><Label className="text-xs text-muted-foreground">Adres</Label><p className="font-medium">{detail?.address || '-'}</p></div>
              </div>
            </TabsContent>

            {/* 2. Hizmet Bilgileri */}
            <TabsContent value="services" className="space-y-4 mt-3">
              <div>
                <Label className="text-xs font-semibold mb-2 block">Çalışma Saatleri</Label>
                <div className="space-y-1.5">
                  {DAYS.map(day => {
                    const wh = detail?.working_hours?.[day] || {};
                    return (
                      <div key={day} className="flex items-center gap-2 text-sm">
                        <span className="w-24 font-medium">{day}</span>
                        <Badge variant={wh.active ? 'default' : 'secondary'} className="text-[10px]">{wh.active ? 'Açık' : 'Kapalı'}</Badge>
                        {wh.active && <span className="text-muted-foreground">{wh.start || '09:00'} - {wh.end || '18:00'}</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
              <div>
                <Label className="text-xs font-semibold mb-2 block">Tecrübeler</Label>
                <div className="flex flex-wrap gap-1.5">
                  {(detail?.experiences || []).map(e => <Badge key={e} variant="outline" className="text-xs">{e}</Badge>)}
                  {(!detail?.experiences || detail.experiences.length === 0) && <span className="text-xs text-muted-foreground">Belirtilmemiş</span>}
                </div>
              </div>
              <div>
                <Label className="text-xs font-semibold mb-2 block">Sunduğu Hizmetler</Label>
                <div className="flex flex-wrap gap-1.5">
                  {(detail?.offered_services || []).map(e => <Badge key={e} variant="outline" className="text-xs">{e}</Badge>)}
                  {(!detail?.offered_services || detail.offered_services.length === 0) && <span className="text-xs text-muted-foreground">Belirtilmemiş</span>}
                </div>
              </div>
            </TabsContent>

            {/* 3. Satış İstatistiği */}
            <TabsContent value="stats" className="mt-3">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-primary/5 border border-primary/10">
                  <p className="text-2xl font-bold text-primary">{staffAppointments.length}</p>
                  <p className="text-xs text-muted-foreground">Toplam Randevu</p>
                </div>
                <div className="p-4 rounded-xl bg-green-500/5 border border-green-500/10">
                  <p className="text-2xl font-bold text-green-600">{completedCount}</p>
                  <p className="text-xs text-muted-foreground">Tamamlanan</p>
                </div>
                <div className="p-4 rounded-xl bg-destructive/5 border border-destructive/10">
                  <p className="text-2xl font-bold text-destructive">{cancelledCount}</p>
                  <p className="text-xs text-muted-foreground">İptal Edilen</p>
                </div>
                <div className="p-4 rounded-xl bg-accent/10 border border-accent/20">
                  <p className="text-2xl font-bold">₺{totalRevenue.toLocaleString('tr-TR')}</p>
                  <p className="text-xs text-muted-foreground">Toplam Gelir</p>
                </div>
              </div>
            </TabsContent>

            {/* 4. Prim & Ödüller */}
            <TabsContent value="bonus" className="space-y-3 mt-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><Label className="text-xs text-muted-foreground">Prim Tipi</Label><p className="font-medium">{detail?.bonus_type === 'percentage' ? 'Yüzdelik' : 'Sabit'}</p></div>
                <div><Label className="text-xs text-muted-foreground">Prim Oranı/Tutarı</Label><p className="font-medium">{detail?.bonus_type === 'percentage' ? `%${detail?.bonus_rate}` : `₺${detail?.bonus_rate || 0}`}</p></div>
                <div className="col-span-2"><Label className="text-xs text-muted-foreground">Ödül Tanımı</Label><p className="font-medium">{detail?.reward_description || '-'}</p></div>
              </div>
            </TabsContent>

            {/* 5. Avanslar / Kesintiler / Maaş */}
            <TabsContent value="advances" className="mt-3">
              {staffPayments.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Henüz ödeme kaydı yok</p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {staffPayments.map((p: any) => (
                    <div key={p.id} className="flex items-center justify-between p-2 rounded-lg border text-sm">
                      <div>
                        <p className="font-medium">{p.payment_type === 'salary' ? 'Maaş' : p.payment_type === 'advance' ? 'Avans' : p.payment_type === 'bonus' ? 'Prim' : p.payment_type}</p>
                        <p className="text-xs text-muted-foreground">{p.description || ''}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold tabular-nums">₺{Number(p.amount).toLocaleString('tr-TR')}</p>
                        <p className="text-xs text-muted-foreground">{new Date(p.payment_date).toLocaleDateString('tr-TR')}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* 6. Maaş / Prim Bilgileri */}
            <TabsContent value="salary" className="space-y-3 mt-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><Label className="text-xs text-muted-foreground">Aylık Maaş</Label><p className="font-bold text-lg">₺{(salary?.monthly_salary || 0).toLocaleString('tr-TR')}</p></div>
                <div><Label className="text-xs text-muted-foreground">Ödeme Periyodu</Label><p className="font-medium">{detail?.payment_period === 'weekly' ? 'Haftalık' : 'Aylık'}</p></div>
                <div className="col-span-2"><Label className="text-xs text-muted-foreground">Notlar</Label><p className="font-medium">{detail?.salary_notes || '-'}</p></div>
              </div>
            </TabsContent>

            {/* 7. İşlem Hareketleri */}
            <TabsContent value="history" className="mt-3">
              {staffAppointments.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Henüz işlem yok</p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {staffAppointments.slice(0, 20).map((a: any) => (
                    <div key={a.id} className="flex items-center justify-between p-2 rounded-lg border text-sm">
                      <div>
                        <p className="font-medium">{customers.find((c: any) => c.id === a.customer_id)?.name || '-'}</p>
                        <p className="text-xs text-muted-foreground">{services.find((sv: any) => sv.id === a.service_id)?.name || '-'}</p>
                      </div>
                      <div className="text-right">
                        <Badge variant={a.status === 'tamamlandi' ? 'default' : a.status === 'iptal' ? 'destructive' : 'secondary'} className="text-[10px]">
                          {a.status === 'tamamlandi' ? 'Tamamlandı' : a.status === 'iptal' ? 'İptal' : 'Bekliyor'}
                        </Badge>
                        <p className="text-xs text-muted-foreground mt-0.5">{new Date(a.start_time).toLocaleDateString('tr-TR')}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* 8. Yetkilendirme */}
            <TabsContent value="permissions" className="mt-3">
              <div className="space-y-2">
                {PERMISSION_KEYS.map(p => (
                  <div key={p.key} className="flex items-center justify-between p-2 rounded-lg border">
                    <span className="text-sm font-medium">{p.label}</span>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs ${detail?.permissions?.[p.key] ? 'text-green-600' : 'text-destructive'}`}>
                        {detail?.permissions?.[p.key] ? 'Görebilir ✓' : 'Göremez ✗'}
                      </span>
                      <Switch
                        checked={!!detail?.permissions?.[p.key]}
                        onCheckedChange={() => togglePermission(p.key)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
