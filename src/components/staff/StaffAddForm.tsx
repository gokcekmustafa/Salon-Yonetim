import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

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
  open: boolean;
  onOpenChange: (v: boolean) => void;
  branches: { id: string; name: string; is_active: boolean }[];
  onSuccess: () => void;
}

export default function StaffAddForm({ open, onOpenChange, branches, onSuccess }: Props) {
  const { currentSalonId } = useAuth();
  const [tab, setTab] = useState('personal');
  const [saving, setSaving] = useState(false);

  // Tab 1: Personal
  const [name, setName] = useState('');
  const [surname, setSurname] = useState('');
  const [tcNo, setTcNo] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [gender, setGender] = useState('');
  const [phone, setPhone] = useState('');
  const [secondaryPhone, setSecondaryPhone] = useState('');
  const [address, setAddress] = useState('');
  const [department, setDepartment] = useState('');
  const [startDate, setStartDate] = useState('');
  const [branchId, setBranchId] = useState(branches.filter(b => b.is_active)[0]?.id || '');

  // Tab 2: Services
  const [workingHours, setWorkingHours] = useState<Record<string, { active: boolean; start: string; end: string }>>(
    Object.fromEntries(DAYS.map(d => [d, { active: d !== 'Pazar', start: '09:00', end: '18:00' }]))
  );
  const [experiences, setExperiences] = useState<string[]>([]);
  const [offeredServices, setOfferedServices] = useState<string[]>([]);

  // Tab 3: Salary
  const [monthlySalary, setMonthlySalary] = useState('');
  const [bonusType, setBonusType] = useState('fixed');
  const [bonusRate, setBonusRate] = useState('');
  const [rewardDesc, setRewardDesc] = useState('');
  const [paymentPeriod, setPaymentPeriod] = useState('monthly');
  const [salaryNotes, setSalaryNotes] = useState('');

  // Tab 4: Permissions
  const [permissions, setPermissions] = useState<Record<string, boolean>>(
    Object.fromEntries(PERMISSION_KEYS.map(p => [p.key, true]))
  );

  const toggleExp = (v: string) => setExperiences(prev => prev.includes(v) ? prev.filter(e => e !== v) : [...prev, v]);
  const toggleOff = (v: string) => setOfferedServices(prev => prev.includes(v) ? prev.filter(e => e !== v) : [...prev, v]);

  const handleSave = async () => {
    if (!name.trim() || !phone.trim()) { toast.error('Ad ve telefon zorunludur.'); return; }
    if (!branchId) { toast.error('Şube seçin.'); return; }
    if (!currentSalonId) return;

    setSaving(true);
    try {
      // Create staff record
      const { data: staffData, error: staffError } = await supabase.from('staff')
        .insert({ name: `${name} ${surname}`.trim(), phone, salon_id: currentSalonId, branch_id: branchId, is_active: true })
        .select('id').single();

      if (staffError || !staffData) { toast.error('Personel oluşturulamadı: ' + staffError?.message); setSaving(false); return; }

      // Create staff_details
      await supabase.from('staff_details').insert({
        staff_id: staffData.id, salon_id: currentSalonId,
        surname, tc_no: tcNo || null, birth_date: birthDate || null, gender: gender || null,
        secondary_phone: secondaryPhone || null, address: address || null,
        department: department || null, start_date: startDate || null,
        working_hours: workingHours, experiences, offered_services: offeredServices,
        bonus_type: bonusType, bonus_rate: Number(bonusRate) || 0,
        reward_description: rewardDesc || null, payment_period: paymentPeriod,
        salary_notes: salaryNotes || null, permissions,
      });

      // Create salary record
      if (monthlySalary) {
        await supabase.from('staff_salaries').insert({
          staff_id: staffData.id, salon_id: currentSalonId,
          monthly_salary: Number(monthlySalary) || 0,
        });
      }

      toast.success('Personel eklendi.');
      onSuccess();
      onOpenChange(false);
      // Reset
      setName(''); setSurname(''); setTcNo(''); setBirthDate(''); setGender('');
      setPhone(''); setSecondaryPhone(''); setAddress(''); setDepartment(''); setStartDate('');
      setTab('personal');
    } catch (e) {
      toast.error('Bir hata oluştu.');
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Yeni Personel Ekle</DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab} className="mt-2">
          <TabsList className="w-full bg-muted/50 p-1">
            <TabsTrigger value="personal" className="text-xs flex-1">Kişisel Bilgiler</TabsTrigger>
            <TabsTrigger value="services" className="text-xs flex-1">Hizmet Bilgileri</TabsTrigger>
            <TabsTrigger value="salary" className="text-xs flex-1">Maaş / Prim</TabsTrigger>
            <TabsTrigger value="permissions" className="text-xs flex-1">Yetkilendirme</TabsTrigger>
          </TabsList>

          {/* TAB 1: Kişisel Bilgiler */}
          <TabsContent value="personal" className="space-y-4 mt-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Ad *</Label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ad" className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Soyad *</Label>
                <Input value={surname} onChange={e => setSurname(e.target.value)} placeholder="Soyad" className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">TC Kimlik / Pasaport No</Label>
                <Input value={tcNo} onChange={e => setTcNo(e.target.value)} placeholder="TC Kimlik No" className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Doğum Tarihi</Label>
                <Input type="date" value={birthDate} onChange={e => setBirthDate(e.target.value)} className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Cinsiyet</Label>
                <Select value={gender} onValueChange={setGender}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Seçin" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Erkek">Erkek</SelectItem>
                    <SelectItem value="Kadın">Kadın</SelectItem>
                    <SelectItem value="Belirtmek İstemiyorum">Belirtmek İstemiyorum</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Cep Telefonu *</Label>
                <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="0500 000 0000" type="tel" className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Ev / Yedek Telefon</Label>
                <Input value={secondaryPhone} onChange={e => setSecondaryPhone(e.target.value)} placeholder="0200 000 0000" className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Departman</Label>
                <Select value={department} onValueChange={setDepartment}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Departman seçin" /></SelectTrigger>
                  <SelectContent>
                    {DEPARTMENTS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">İşe Başlama Tarihi</Label>
                <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Şube *</Label>
                <Select value={branchId} onValueChange={setBranchId}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Şube seçin" /></SelectTrigger>
                  <SelectContent>
                    {branches.filter(b => b.is_active).map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Adres</Label>
              <Textarea value={address} onChange={e => setAddress(e.target.value)} placeholder="Adres" rows={2} />
            </div>
          </TabsContent>

          {/* TAB 2: Hizmet Bilgileri */}
          <TabsContent value="services" className="space-y-4 mt-3">
            <div>
              <Label className="text-xs font-semibold mb-2 block">Çalışma Günleri ve Saatleri</Label>
              <div className="space-y-2">
                {DAYS.map(day => (
                  <div key={day} className="flex items-center gap-3">
                    <span className="w-24 text-sm font-medium">{day}</span>
                    <Switch
                      checked={workingHours[day]?.active ?? false}
                      onCheckedChange={v => setWorkingHours(prev => ({ ...prev, [day]: { ...prev[day], active: v } }))}
                    />
                    {workingHours[day]?.active && (
                      <>
                        <Input type="time" value={workingHours[day]?.start || '09:00'} onChange={e => setWorkingHours(prev => ({ ...prev, [day]: { ...prev[day], start: e.target.value } }))} className="h-8 w-24" />
                        <span className="text-xs text-muted-foreground">-</span>
                        <Input type="time" value={workingHours[day]?.end || '18:00'} onChange={e => setWorkingHours(prev => ({ ...prev, [day]: { ...prev[day], end: e.target.value } }))} className="h-8 w-24" />
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold mb-2 block">Tanıtım ve Satış Tecrübeleri</Label>
              <div className="space-y-1.5">
                {EXPERIENCES.map(e => (
                  <label key={e} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox checked={experiences.includes(e)} onCheckedChange={() => toggleExp(e)} />
                    {e}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold mb-2 block">Sunduğu Hizmetler</Label>
              <div className="space-y-1.5">
                {OFFERED.map(o => (
                  <label key={o} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox checked={offeredServices.includes(o)} onCheckedChange={() => toggleOff(o)} />
                    {o}
                  </label>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* TAB 3: Maaş / Prim */}
          <TabsContent value="salary" className="space-y-4 mt-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Maaş (₺)</Label>
                <Input type="number" value={monthlySalary} onChange={e => setMonthlySalary(e.target.value)} placeholder="0" className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Prim Tipi</Label>
                <Select value={bonusType} onValueChange={setBonusType}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed">Sabit</SelectItem>
                    <SelectItem value="percentage">Yüzdelik</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Prim Oranı / Tutarı</Label>
                <Input type="number" value={bonusRate} onChange={e => setBonusRate(e.target.value)} placeholder="0" className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Ödeme Periyodu</Label>
                <Select value={paymentPeriod} onValueChange={setPaymentPeriod}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Aylık</SelectItem>
                    <SelectItem value="weekly">Haftalık</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Ödül Tanımı</Label>
              <Input value={rewardDesc} onChange={e => setRewardDesc(e.target.value)} placeholder="Ödül açıklaması" className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Notlar</Label>
              <Textarea value={salaryNotes} onChange={e => setSalaryNotes(e.target.value)} rows={2} />
            </div>
          </TabsContent>

          {/* TAB 4: Yetkilendirme */}
          <TabsContent value="permissions" className="mt-3">
            <p className="text-xs text-muted-foreground mb-3">Her yetki için Görebilir / Göremez seçimi yapın.</p>
            <div className="space-y-2">
              {PERMISSION_KEYS.map(p => (
                <div key={p.key} className="flex items-center justify-between p-2 rounded-lg border">
                  <span className="text-sm font-medium">{p.label}</span>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs ${permissions[p.key] ? 'text-green-600' : 'text-destructive'}`}>
                      {permissions[p.key] ? 'Görebilir ✓' : 'Göremez ✗'}
                    </span>
                    <Switch checked={permissions[p.key]} onCheckedChange={v => setPermissions(prev => ({ ...prev, [p.key]: v }))} />
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>İptal</Button>
          <Button onClick={handleSave} disabled={saving} className="btn-gradient">
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Kaydet
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
