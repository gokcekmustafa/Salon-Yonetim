import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { DbStaff } from '@/hooks/useSalonData';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { User, Loader2, Pencil, Save, X, Camera, KeyRound, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

type StaffDetail = {
  id: string;
  staff_id: string;
  salon_id: string;
  surname: string | null;
  tc_no: string | null;
  birth_date: string | null;
  gender: string | null;
  secondary_phone: string | null;
  address: string | null;
  department: string | null;
  start_date: string | null;
  working_hours: Record<string, { active?: boolean; start?: string; end?: string }> | null;
  experiences: string[];
  offered_services: string[];
  bonus_type: string;
  bonus_rate: number;
  reward_description: string | null;
  payment_period: string;
  salary_notes: string | null;
  permissions: Record<string, boolean> | null;
  email: string | null;
  profile_photo_url: string | null;
};

type SalaryRow = {
  id?: string;
  monthly_salary: number;
};

type StaffFormState = {
  name: string;
  surname: string;
  phone: string;
  email: string;
  department: string;
  payment_period: string;
  salary_notes: string;
  monthly_salary: string;
  offered_services: string[];
  working_hours: Record<string, { active: boolean; start: string; end: string }>;
  profile_photo_url: string;
};

const DAYS = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
const OFFERED = ['LAZER EPİLASYON', 'CİLT BAKIMI', 'BÖLGESEL ZAYIFLAMA', 'KİRPİK LİFTİNG', 'ÇATLAK BAKIMI'];
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
  onUpdated?: () => void;
  branches: { id: string; name: string }[];
  appointments: any[];
  services: any[];
  customers: any[];
  payments: any[];
}

const createDefaultWorkingHours = () =>
  DAYS.reduce<Record<string, { active: boolean; start: string; end: string }>>((acc, day) => {
    acc[day] = { active: false, start: '09:00', end: '18:00' };
    return acc;
  }, {});

const buildFormState = (staff: DbStaff, detail: StaffDetail | null, salary: SalaryRow | null): StaffFormState => {
  const defaultHours = createDefaultWorkingHours();
  const mergedHours = DAYS.reduce<Record<string, { active: boolean; start: string; end: string }>>((acc, day) => {
    const source = detail?.working_hours?.[day];
    acc[day] = {
      active: Boolean(source?.active),
      start: source?.start || '09:00',
      end: source?.end || '18:00',
    };
    return acc;
  }, defaultHours);

  return {
    name: staff.name || '',
    surname: detail?.surname || '',
    phone: staff.phone || '',
    email: detail?.email || '',
    department: detail?.department || '',
    payment_period: detail?.payment_period || 'monthly',
    salary_notes: detail?.salary_notes || '',
    monthly_salary: String(salary?.monthly_salary || 0),
    offered_services: detail?.offered_services || [],
    working_hours: mergedHours,
    profile_photo_url: detail?.profile_photo_url || '',
  };
};

export default function StaffDetailCard({ staff: s, open, onOpenChange, onUpdated, branches, appointments, services, customers }: Props) {
  const { currentSalonId } = useAuth();
  const [detail, setDetail] = useState<StaffDetail | null>(null);
  const [salary, setSalary] = useState<SalaryRow | null>(null);
  const [staffPayments, setStaffPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [form, setForm] = useState<StaffFormState>(() => buildFormState(s, null, null));
  const fileRef = useRef<HTMLInputElement>(null);

  // Account state
  const [staffUsername, setStaffUsername] = useState('');
  const [staffPassword, setStaffPassword] = useState('');
  const [showStaffPassword, setShowStaffPassword] = useState(false);
  const [hasAccount, setHasAccount] = useState(false);
  const [existingUsername, setExistingUsername] = useState('');
  const [accountSaving, setAccountSaving] = useState(false);
  const [newPasswordForExisting, setNewPasswordForExisting] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);

  useEffect(() => {
    if (!open || !s) return;
    setLoading(true);
    setIsEditing(false);

    Promise.all([
      supabase.from('staff_details').select('*').eq('staff_id', s.id).maybeSingle(),
      supabase.from('staff_salaries').select('*').eq('staff_id', s.id).maybeSingle(),
      supabase.from('staff_payments').select('*').eq('staff_id', s.id).order('payment_date', { ascending: false }),
    ]).then(([detailRes, salaryRes, paymentsRes]) => {
      const nextDetail = (detailRes.data as StaffDetail | null) || null;
      const nextSalary = (salaryRes.data as SalaryRow | null) || null;
      setDetail(nextDetail);
      setSalary(nextSalary);
      setStaffPayments(paymentsRes.data || []);
      setForm(buildFormState(s, nextDetail, nextSalary));
      setLoading(false);
    });

    // Check if staff has an account
    if (s.user_id) {
      setHasAccount(true);
      supabase.from('profiles').select('username').eq('user_id', s.user_id).maybeSingle().then(({ data }) => {
        setExistingUsername(data?.username || '');
      });
    } else {
      setHasAccount(false);
      setExistingUsername('');
      setStaffUsername('');
      setStaffPassword('');
    }
  }, [open, s]);

  const staffAppointments = useMemo(() => appointments.filter(a => a.staff_id === s?.id), [appointments, s?.id]);
  const completedCount = staffAppointments.filter(a => a.status === 'tamamlandi').length;
  const cancelledCount = staffAppointments.filter(a => a.status === 'iptal').length;
  const totalRevenue = staffAppointments
    .filter(a => a.status === 'tamamlandi')
    .reduce((sum, a) => sum + (services.find((sv: any) => sv.id === a.service_id)?.price || 0), 0);

  const resetForm = () => {
    setForm(buildFormState(s, detail, salary));
    setIsEditing(false);
  };

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Sadece görsel yükleyebilirsiniz');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Profil fotoğrafı en fazla 2MB olabilir');
      return;
    }

    setUploadingPhoto(true);
    try {
      const ext = file.name.split('.').pop() || 'png';
      const path = `${s.salon_id}/staff/${s.id}-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('salon-logos').upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from('salon-logos').getPublicUrl(path);
      setForm(prev => ({ ...prev, profile_photo_url: data.publicUrl }));
      toast.success('Profil fotoğrafı hazır');
    } catch (error: any) {
      toast.error(error.message || 'Fotoğraf yüklenemedi');
    } finally {
      setUploadingPhoto(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error('Ad alanı zorunludur');
      return;
    }

    setSaving(true);
    try {
      const { error: staffError } = await supabase
        .from('staff')
        .update({ name: form.name.trim(), phone: form.phone.trim() || null })
        .eq('id', s.id);
      if (staffError) throw staffError;

      const detailPayload = {
        staff_id: s.id,
        salon_id: s.salon_id,
        surname: form.surname.trim() || null,
        department: form.department.trim() || null,
        payment_period: form.payment_period,
        salary_notes: form.salary_notes.trim() || null,
        offered_services: form.offered_services,
        working_hours: form.working_hours,
        email: form.email.trim() || null,
        profile_photo_url: form.profile_photo_url || null,
      };

      let savedDetail: StaffDetail | null = detail;
      if (detail?.id) {
        const { data, error } = await supabase
          .from('staff_details')
          .update(detailPayload)
          .eq('id', detail.id)
          .select('*')
          .single();
        if (error) throw error;
        savedDetail = data as StaffDetail;
      } else {
        const { data, error } = await supabase
          .from('staff_details')
          .insert(detailPayload)
          .select('*')
          .single();
        if (error) throw error;
        savedDetail = data as StaffDetail;
      }

      const salaryPayload = {
        salon_id: s.salon_id,
        staff_id: s.id,
        monthly_salary: Number(form.monthly_salary) || 0,
      };

      let savedSalary: SalaryRow | null = salary;
      if (salary?.id) {
        const { data, error } = await supabase
          .from('staff_salaries')
          .update(salaryPayload)
          .eq('id', salary.id)
          .select('*')
          .single();
        if (error) throw error;
        savedSalary = data as SalaryRow;
      } else {
        const { data, error } = await supabase
          .from('staff_salaries')
          .insert(salaryPayload)
          .select('*')
          .single();
        if (error) throw error;
        savedSalary = data as SalaryRow;
      }

      setDetail(savedDetail);
      setSalary(savedSalary);
      setIsEditing(false);
      onUpdated?.();
      toast.success('Personel bilgileri kaydedildi');
    } catch (error: any) {
      toast.error(error.message || 'Kaydetme sırasında hata oluştu');
    } finally {
      setSaving(false);
    }
  };

  const togglePermission = async (key: string) => {
    if (!detail) return;
    const permissions = { ...(detail.permissions || {}) };
    permissions[key] = !permissions[key];
    const { error } = await supabase.from('staff_details').update({ permissions }).eq('id', detail.id);
    if (error) {
      toast.error('Yetki güncellenemedi');
      return;
    }
    setDetail(prev => (prev ? { ...prev, permissions } : prev));
    toast.success('Yetki güncellendi');
  };

  const profileImage = form.profile_photo_url || detail?.profile_photo_url || '';
  const tabContentClass = 'mt-3 min-h-[430px]';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-primary/10 flex items-center justify-center">
              {profileImage ? (
                <img src={profileImage} alt={`${s?.name} profil fotoğrafı`} className="h-full w-full object-cover" />
              ) : (
                <User className="h-6 w-6 text-primary" />
              )}
            </div>
            <div>
              <DialogTitle className="text-lg">{form.name} {form.surname}</DialogTitle>
              <p className="text-sm text-muted-foreground">{detail?.department || form.department || 'Personel'} • {branches.find(b => b.id === s?.branch_id)?.name || '-'}</p>
            </div>
            <Badge variant={s?.is_active ? 'default' : 'secondary'} className="ml-auto">{s?.is_active ? 'Aktif' : 'Pasif'}</Badge>
          </div>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : (
          <Tabs defaultValue="personal" className="mt-2 flex flex-col">
            <div className="flex items-center justify-between gap-3">
              <TabsList className="flex h-auto flex-wrap gap-1 bg-muted/50 p-1">
                <TabsTrigger value="personal" className="text-xs">Kişisel</TabsTrigger>
                <TabsTrigger value="services" className="text-xs">Hizmet</TabsTrigger>
                <TabsTrigger value="stats" className="text-xs">Satış</TabsTrigger>
                <TabsTrigger value="bonus" className="text-xs">Prim</TabsTrigger>
                <TabsTrigger value="advances" className="text-xs">Avans/Maaş</TabsTrigger>
                <TabsTrigger value="salary" className="text-xs">Maaş Bilgi</TabsTrigger>
                <TabsTrigger value="history" className="text-xs">İşlemler</TabsTrigger>
                <TabsTrigger value="permissions" className="text-xs">Yetki</TabsTrigger>
                <TabsTrigger value="account" className="text-xs">Hesap</TabsTrigger>
              </TabsList>

              {isEditing ? (
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={resetForm}>
                    <X className="mr-1.5 h-4 w-4" /> Vazgeç
                  </Button>
                  <Button size="sm" className="btn-gradient" onClick={handleSave} disabled={saving || uploadingPhoto}>
                    {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}Kaydet
                  </Button>
                </div>
              ) : (
                <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                  <Pencil className="mr-1.5 h-4 w-4" /> Düzenle
                </Button>
              )}
            </div>

            <TabsContent value="personal" className={tabContentClass}>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-3 md:col-span-2">
                  <Label className="text-xs text-muted-foreground">Profil Fotoğrafı</Label>
                  <div className="flex items-center gap-4">
                    <div className="relative h-20 w-20 overflow-hidden rounded-2xl border border-border bg-muted/40 flex items-center justify-center">
                      {profileImage ? (
                        <img src={profileImage} alt={`${s?.name} profil fotoğrafı`} className="h-full w-full object-cover" />
                      ) : (
                        <User className="h-8 w-8 text-muted-foreground" />
                      )}
                    </div>
                    {isEditing && (
                      <div className="space-y-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploadingPhoto}>
                          {uploadingPhoto ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Camera className="mr-1.5 h-4 w-4" />}Fotoğraf Yükle
                        </Button>
                        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoSelect} />
                        <p className="text-xs text-muted-foreground">PNG/JPG, maksimum 2MB</p>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground">Ad</Label>
                  {isEditing ? <Input value={form.name} onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))} className="mt-1 h-10" /> : <p className="font-medium">{s?.name}</p>}
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Soyad</Label>
                  {isEditing ? <Input value={form.surname} onChange={(e) => setForm(prev => ({ ...prev, surname: e.target.value }))} className="mt-1 h-10" /> : <p className="font-medium">{detail?.surname || '-'}</p>}
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Telefon</Label>
                  {isEditing ? <Input value={form.phone} onChange={(e) => setForm(prev => ({ ...prev, phone: e.target.value }))} className="mt-1 h-10" /> : <p className="font-medium">{s?.phone || '-'}</p>}
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">E-posta</Label>
                  {isEditing ? <Input type="email" value={form.email} onChange={(e) => setForm(prev => ({ ...prev, email: e.target.value }))} className="mt-1 h-10" /> : <p className="font-medium">{detail?.email || '-'}</p>}
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Pozisyon</Label>
                  {isEditing ? <Input value={form.department} onChange={(e) => setForm(prev => ({ ...prev, department: e.target.value }))} className="mt-1 h-10" /> : <p className="font-medium">{detail?.department || '-'}</p>}
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Şube</Label>
                  <p className="font-medium">{branches.find(b => b.id === s?.branch_id)?.name || '-'}</p>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="services" className={tabContentClass}>
              <div className="space-y-5">
                <div>
                  <Label className="mb-2 block text-xs font-semibold">Çalışma Saatleri</Label>
                  <div className="space-y-2">
                    {DAYS.map((day) => {
                      const wh = form.working_hours[day];
                      return (
                        <div key={day} className="flex flex-wrap items-center gap-2 rounded-xl border border-border/60 px-3 py-2 text-sm">
                          <span className="w-24 font-medium">{day}</span>
                          {isEditing ? (
                            <>
                              <div className="flex items-center gap-2">
                                <Switch
                                  checked={wh.active}
                                  onCheckedChange={(checked) => setForm(prev => ({
                                    ...prev,
                                    working_hours: {
                                      ...prev.working_hours,
                                      [day]: { ...prev.working_hours[day], active: checked },
                                    },
                                  }))}
                                />
                                <span className="text-xs text-muted-foreground">Çalışıyor</span>
                              </div>
                              <Input
                                type="time"
                                value={wh.start}
                                onChange={(e) => setForm(prev => ({
                                  ...prev,
                                  working_hours: {
                                    ...prev.working_hours,
                                    [day]: { ...prev.working_hours[day], start: e.target.value },
                                  },
                                }))}
                                className="h-9 w-[132px]"
                                disabled={!wh.active}
                              />
                              <Input
                                type="time"
                                value={wh.end}
                                onChange={(e) => setForm(prev => ({
                                  ...prev,
                                  working_hours: {
                                    ...prev.working_hours,
                                    [day]: { ...prev.working_hours[day], end: e.target.value },
                                  },
                                }))}
                                className="h-9 w-[132px]"
                                disabled={!wh.active}
                              />
                            </>
                          ) : wh.active ? (
                            <span className="text-muted-foreground">{wh.start} - {wh.end}</span>
                          ) : (
                            <Badge variant="secondary" className="text-[10px]">Kapalı</Badge>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <Label className="mb-2 block text-xs font-semibold">Hizmetler</Label>
                  {isEditing ? (
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                      {OFFERED.map((service) => {
                        const checked = form.offered_services.includes(service);
                        return (
                          <label key={service} className="flex items-center gap-2 rounded-xl border border-border/60 px-3 py-2 text-sm">
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(nextChecked) => setForm(prev => ({
                                ...prev,
                                offered_services: nextChecked
                                  ? [...prev.offered_services, service]
                                  : prev.offered_services.filter(item => item !== service),
                              }))}
                            />
                            <span>{service}</span>
                          </label>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {(detail?.offered_services || []).map((item) => <Badge key={item} variant="outline" className="text-xs">{item}</Badge>)}
                      {(!detail?.offered_services || detail.offered_services.length === 0) && <span className="text-xs text-muted-foreground">Belirtilmemiş</span>}
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="stats" className={tabContentClass}>
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-xl border border-primary/10 bg-primary/5 p-4">
                  <p className="text-2xl font-bold text-primary">{staffAppointments.length}</p>
                  <p className="text-xs text-muted-foreground">Toplam Randevu</p>
                </div>
                <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
                  <p className="text-2xl font-bold text-foreground">{completedCount}</p>
                  <p className="text-xs text-muted-foreground">Tamamlanan</p>
                </div>
                <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
                  <p className="text-2xl font-bold text-foreground">{cancelledCount}</p>
                  <p className="text-xs text-muted-foreground">İptal Edilen</p>
                </div>
                <div className="rounded-xl border border-border/60 bg-accent/10 p-4">
                  <p className="text-2xl font-bold">₺{totalRevenue.toLocaleString('tr-TR')}</p>
                  <p className="text-xs text-muted-foreground">Toplam Gelir</p>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="bonus" className={tabContentClass}>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><Label className="text-xs text-muted-foreground">Prim Tipi</Label><p className="font-medium">{detail?.bonus_type === 'percentage' ? 'Yüzdelik' : 'Sabit'}</p></div>
                <div><Label className="text-xs text-muted-foreground">Prim Oranı/Tutarı</Label><p className="font-medium">{detail?.bonus_type === 'percentage' ? `%${detail?.bonus_rate}` : `₺${detail?.bonus_rate || 0}`}</p></div>
                <div className="col-span-2"><Label className="text-xs text-muted-foreground">Ödül Tanımı</Label><p className="font-medium">{detail?.reward_description || '-'}</p></div>
              </div>
            </TabsContent>

            <TabsContent value="advances" className={tabContentClass}>
              {staffPayments.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">Henüz ödeme kaydı yok</p>
              ) : (
                <div className="max-h-72 space-y-2 overflow-y-auto">
                  {staffPayments.map((p: any) => (
                    <div key={p.id} className="flex items-center justify-between rounded-lg border p-2 text-sm">
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

            <TabsContent value="salary" className={tabContentClass}>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <Label className="text-xs text-muted-foreground">Aylık Maaş</Label>
                  {isEditing ? (
                    <Input type="number" value={form.monthly_salary} onChange={(e) => setForm(prev => ({ ...prev, monthly_salary: e.target.value }))} className="mt-1 h-10" />
                  ) : (
                    <p className="text-lg font-bold">₺{(salary?.monthly_salary || 0).toLocaleString('tr-TR')}</p>
                  )}
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Ödeme Periyodu</Label>
                  {isEditing ? (
                    <div className="mt-1 flex gap-2">
                      <Button type="button" variant={form.payment_period === 'monthly' ? 'default' : 'outline'} size="sm" onClick={() => setForm(prev => ({ ...prev, payment_period: 'monthly' }))}>Aylık</Button>
                      <Button type="button" variant={form.payment_period === 'weekly' ? 'default' : 'outline'} size="sm" onClick={() => setForm(prev => ({ ...prev, payment_period: 'weekly' }))}>Haftalık</Button>
                    </div>
                  ) : (
                    <p className="font-medium">{detail?.payment_period === 'weekly' ? 'Haftalık' : 'Aylık'}</p>
                  )}
                </div>
                <div className="md:col-span-2">
                  <Label className="text-xs text-muted-foreground">Maaş Notları</Label>
                  {isEditing ? (
                    <Textarea value={form.salary_notes} onChange={(e) => setForm(prev => ({ ...prev, salary_notes: e.target.value }))} className="mt-1 min-h-28" />
                  ) : (
                    <p className="font-medium">{detail?.salary_notes || '-'}</p>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="history" className={tabContentClass}>
              {staffAppointments.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">Henüz işlem yok</p>
              ) : (
                <div className="max-h-72 space-y-2 overflow-y-auto">
                  {staffAppointments.slice(0, 20).map((a: any) => (
                    <div key={a.id} className="flex items-center justify-between rounded-lg border p-2 text-sm">
                      <div>
                        <p className="font-medium">{customers.find((c: any) => c.id === a.customer_id)?.name || '-'}</p>
                        <p className="text-xs text-muted-foreground">{services.find((sv: any) => sv.id === a.service_id)?.name || '-'}</p>
                      </div>
                      <div className="text-right">
                        <Badge variant={a.status === 'tamamlandi' ? 'default' : a.status === 'iptal' ? 'destructive' : 'secondary'} className="text-[10px]">
                          {a.status === 'tamamlandi' ? 'Tamamlandı' : a.status === 'iptal' ? 'İptal' : 'Bekliyor'}
                        </Badge>
                        <p className="mt-0.5 text-xs text-muted-foreground">{new Date(a.start_time).toLocaleDateString('tr-TR')}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="permissions" className={tabContentClass}>
              <div className="space-y-2">
                {PERMISSION_KEYS.map((p) => (
                  <div key={p.key} className="flex items-center justify-between rounded-lg border p-2">
                    <span className="text-sm font-medium">{p.label}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{detail?.permissions?.[p.key] ? 'Görebilir' : 'Göremez'}</span>
                      <Switch checked={!!detail?.permissions?.[p.key]} onCheckedChange={() => togglePermission(p.key)} />
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
