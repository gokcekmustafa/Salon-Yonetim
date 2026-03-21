import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useBranding } from '@/hooks/useBranding';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { TURKEY_CITIES, getDistrictsByCity, getNeighborhoodsByDistrict } from '@/lib/turkeyLocations';

type FormState = {
  fullName: string;
  personalPhone: string;
  identityNumber: string;
  birthYear: string;
  birthMonth: string;
  birthDay: string;
  email: string;
  roles: string[];
  companyName: string;
  companyPhone: string;
  city: string;
  district: string;
  neighborhood: string;
  address: string;
  username: string;
};

const ROLE_OPTIONS = ['Estetisyen', 'Satış Temsilcisi', 'Aracı'];
const USERNAME_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PHONE_REGEX = /^05\d{2} \d{3} \d{2} \d{2}$/;

const INITIAL_FORM: FormState = {
  fullName: '',
  personalPhone: '',
  identityNumber: '',
  birthYear: '',
  birthMonth: '',
  birthDay: '',
  email: '',
  roles: [],
  companyName: '',
  companyPhone: '',
  city: '',
  district: '',
  neighborhood: '',
  address: '',
  username: '',
};

const MONTHS = [
  { value: '01', label: 'Ocak' }, { value: '02', label: 'Şubat' }, { value: '03', label: 'Mart' },
  { value: '04', label: 'Nisan' }, { value: '05', label: 'Mayıs' }, { value: '06', label: 'Haziran' },
  { value: '07', label: 'Temmuz' }, { value: '08', label: 'Ağustos' }, { value: '09', label: 'Eylül' },
  { value: '10', label: 'Ekim' }, { value: '11', label: 'Kasım' }, { value: '12', label: 'Aralık' },
];

function getYearOptions() {
  const years: string[] = [];
  for (let y = 2005; y >= 1940; y--) years.push(String(y));
  return years;
}

function getDayOptions(year: string, month: string) {
  if (!year || !month) return Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0'));
  const daysInMonth = new Date(Number(year), Number(month), 0).getDate();
  return Array.from({ length: daysInMonth }, (_, i) => String(i + 1).padStart(2, '0'));
}

function slugifyCompanyName(value: string) {
  return value
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 32)
    .replace(/^-+|-+$/g, '') || 'firma';
}

function formatTurkishPhone(value: string) {
  let digits = value.replace(/\D/g, '');
  if (digits.startsWith('5')) digits = `0${digits}`;
  if (digits.length > 0 && !digits.startsWith('0')) digits = `0${digits}`;
  digits = digits.slice(0, 11);

  const p1 = digits.slice(0, 4);
  const p2 = digits.slice(4, 7);
  const p3 = digits.slice(7, 9);
  const p4 = digits.slice(9, 11);

  return [p1, p2, p3, p4].filter(Boolean).join(' ');
}

export default function CompanyRegistrationPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const { branding } = useBranding();

  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [manualUsernameEdit, setManualUsernameEdit] = useState(false);
  const [usernameChecking, setUsernameChecking] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);

  const districts = useMemo(() => getDistrictsByCity(form.city), [form.city]);
  const neighborhoods = useMemo(
    () => getNeighborhoodsByDistrict(form.city, form.district),
    [form.city, form.district]
  );

  useEffect(() => {
    if (!manualUsernameEdit) {
      const suggestion = slugifyCompanyName(form.companyName);
      setForm((prev) => ({ ...prev, username: suggestion }));
    }
  }, [form.companyName, manualUsernameEdit]);

  useEffect(() => {
    if (form.district && !districts.includes(form.district)) {
      setForm((prev) => ({ ...prev, district: '', neighborhood: '' }));
    }
  }, [districts, form.district]);

  useEffect(() => {
    if (form.neighborhood && !neighborhoods.includes(form.neighborhood)) {
      setForm((prev) => ({ ...prev, neighborhood: '' }));
    }
  }, [neighborhoods, form.neighborhood]);

  useEffect(() => {
    const username = form.username.trim();

    if (username.length < 3 || !USERNAME_REGEX.test(username)) {
      setUsernameAvailable(null);
      setUsernameChecking(false);
      return;
    }

    const timeout = setTimeout(async () => {
      setUsernameChecking(true);
      const { data, error } = await supabase.rpc('is_company_username_available', { _username: username });
      setUsernameChecking(false);

      if (error) {
        setUsernameAvailable(false);
        return;
      }

      setUsernameAvailable(Boolean(data));
    }, 350);

    return () => clearTimeout(timeout);
  }, [form.username]);

  if (!authLoading && user) {
    return <Navigate to="/" replace />;
  }

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const toggleRole = (role: string, checked: boolean) => {
    const nextRoles = checked ? [...form.roles, role] : form.roles.filter((item) => item !== role);
    setField('roles', nextRoles);
  };

  const validate = () => {
    const nextErrors: Record<string, string> = {};

    if (!form.fullName.trim()) nextErrors.fullName = 'Ad Soyad zorunludur.';
    if (!PHONE_REGEX.test(form.personalPhone)) nextErrors.personalPhone = 'Telefon formatı 05XX XXX XX XX olmalıdır.';
    if (!form.email.trim()) nextErrors.email = 'E-mail zorunludur.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) nextErrors.email = 'Geçerli bir e-mail girin.';

    const identity = form.identityNumber.trim();
    if (!identity) {
      nextErrors.identityNumber = 'T.C Kimlik / Pasaport No zorunludur.';
    } else if (/^\d+$/.test(identity)) {
      if (!/^\d{11}$/.test(identity)) {
        nextErrors.identityNumber = 'T.C Kimlik No 11 hane olmalıdır.';
      }
    } else if (!/^[A-Za-z0-9]{6,20}$/.test(identity)) {
      nextErrors.identityNumber = 'Pasaport no alfanumerik ve 6-20 karakter olmalıdır.';
    }

    // birthDate is optional — no validation needed
    if (form.roles.length === 0) nextErrors.roles = 'En az bir görev seçmelisiniz.';

    if (!form.companyName.trim()) nextErrors.companyName = 'Firma adı zorunludur.';
    if (!PHONE_REGEX.test(form.companyPhone)) nextErrors.companyPhone = 'Firma telefonu formatı 05XX XXX XX XX olmalıdır.';
    if (form.companyPhoneSecondary && !PHONE_REGEX.test(form.companyPhoneSecondary)) {
      nextErrors.companyPhoneSecondary = 'Yedek telefon formatı 05XX XXX XX XX olmalıdır.';
    }

    if (!form.city) nextErrors.city = 'İl seçimi zorunludur.';
    if (!form.district) nextErrors.district = 'İlçe seçimi zorunludur.';
    if (!form.neighborhood) nextErrors.neighborhood = 'Mahalle seçimi zorunludur.';
    if (!form.address.trim()) nextErrors.address = 'Adres zorunludur.';

    const username = form.username.trim();
    if (!username) nextErrors.username = 'Kullanıcı adı zorunludur.';
    else if (!USERNAME_REGEX.test(username)) {
      nextErrors.username = 'Kullanıcı adı küçük harf, rakam ve tire içerebilir.';
    } else if (usernameAvailable === false) {
      nextErrors.username = 'Bu kullanıcı adı kullanılamıyor.';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const getIdentityType = (identity: string) => (/^\d{11}$/.test(identity) ? 'tc' : 'passport');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const isValid = validate();
    if (!isValid) return;

    if (usernameChecking) {
      toast({ title: 'Lütfen bekleyin', description: 'Kullanıcı adı uygunluğu kontrol ediliyor.' });
      return;
    }

    setSubmitting(true);

    const payload = {
      full_name: form.fullName.trim(),
      personal_phone: form.personalPhone,
      identity_number: form.identityNumber.trim(),
      identity_type: getIdentityType(form.identityNumber.trim()),
      birth_date: form.birthDate ? format(form.birthDate, 'yyyy-MM-dd') : null,
      email: form.email.trim().toLowerCase(),
      roles: form.roles,
      company_name: form.companyName.trim(),
      company_phone: form.companyPhone,
      company_phone_secondary: form.companyPhoneSecondary || null,
      city: form.city,
      district: form.district,
      neighborhood: form.neighborhood,
      address: form.address.trim(),
      username: form.username.trim(),
      status: 'pending',
    };

    const client = supabase as any;
    const { error } = await client.from('company_registration_requests').insert(payload);

    setSubmitting(false);

    if (error) {
      toast({ title: 'Kayıt başarısız', description: error.message, variant: 'destructive' });
      return;
    }

    toast({
      title: 'Başvurunuz alındı',
      description: 'Başvurunuz onay için yönetime iletildi.',
    });

    setForm(INITIAL_FORM);
    setManualUsernameEdit(false);
    setUsernameAvailable(null);
    setErrors({});
  };

  return (
    <div className="min-h-screen bg-background py-8 px-4" style={{ background: 'var(--gradient-hero)' }}>
      <div className="mx-auto w-full max-w-5xl">
        <Card className="border-border/60 shadow-elevated">
          <CardHeader>
            <CardTitle className="text-2xl font-display">Firma Kayıt</CardTitle>
            <CardDescription>{branding.app_name} için başvuru formunu doldurun.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-8">
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                <section className="space-y-4">
                  <div>
                    <h2 className="text-base font-semibold">Firma Yetkilisi Bilgileri</h2>
                    <Separator className="mt-2" />
                  </div>

                  <div className="space-y-2">
                    <Label>Adı Soyadı *</Label>
                    <Input value={form.fullName} onChange={(e) => setField('fullName', e.target.value)} />
                    {errors.fullName && <p className="text-xs text-destructive">{errors.fullName}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label>Telefon *</Label>
                    <Input
                      placeholder="05XX XXX XX XX"
                      value={form.personalPhone}
                      onChange={(e) => setField('personalPhone', formatTurkishPhone(e.target.value))}
                    />
                    {errors.personalPhone && <p className="text-xs text-destructive">{errors.personalPhone}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label>T.C Kimlik / Pasaport No *</Label>
                    <Input value={form.identityNumber} onChange={(e) => setField('identityNumber', e.target.value.trim())} />
                    {errors.identityNumber && <p className="text-xs text-destructive">{errors.identityNumber}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label>Doğum Tarihi</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button type="button" variant="outline" className={cn('w-full justify-start text-left font-normal', !form.birthDate && 'text-muted-foreground')}>
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {form.birthDate ? format(form.birthDate, 'dd.MM.yyyy') : 'Tarih seçin'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={form.birthDate}
                          onSelect={(date) => setField('birthDate', date)}
                          disabled={(date) => date > new Date()}
                          captionLayout="dropdown-buttons"
                          fromYear={1940}
                          toYear={new Date().getFullYear()}
                          initialFocus
                          className={cn('p-3 pointer-events-auto')}
                        />
                      </PopoverContent>
                    </Popover>
                    {errors.birthDate && <p className="text-xs text-destructive">{errors.birthDate}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label>E-mail *</Label>
                    <Input type="email" value={form.email} onChange={(e) => setField('email', e.target.value)} />
                    {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label>İşletmede Aldığınız Görev *</Label>
                    <div className="space-y-2 rounded-lg border border-border p-3 bg-card">
                      {ROLE_OPTIONS.map((role) => (
                        <label key={role} className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={form.roles.includes(role)}
                            onCheckedChange={(checked) => toggleRole(role, Boolean(checked))}
                          />
                          <span>{role}</span>
                        </label>
                      ))}
                    </div>
                    {errors.roles && <p className="text-xs text-destructive">{errors.roles}</p>}
                  </div>
                </section>

                <section className="space-y-4">
                  <div>
                    <h2 className="text-base font-semibold">Firma Bilgileri</h2>
                    <Separator className="mt-2" />
                  </div>

                  <div className="space-y-2">
                    <Label>Firma Adı *</Label>
                    <Input value={form.companyName} onChange={(e) => setField('companyName', e.target.value)} />
                    {errors.companyName && <p className="text-xs text-destructive">{errors.companyName}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label>Firma Telefonu *</Label>
                    <Input
                      placeholder="05XX XXX XX XX"
                      value={form.companyPhone}
                      onChange={(e) => setField('companyPhone', formatTurkishPhone(e.target.value))}
                    />
                    {errors.companyPhone && <p className="text-xs text-destructive">{errors.companyPhone}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label>Firma Telefonu Yedek</Label>
                    <Input
                      placeholder="05XX XXX XX XX"
                      value={form.companyPhoneSecondary}
                      onChange={(e) => setField('companyPhoneSecondary', formatTurkishPhone(e.target.value))}
                    />
                    {errors.companyPhoneSecondary && <p className="text-xs text-destructive">{errors.companyPhoneSecondary}</p>}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="space-y-2">
                      <Label>İl *</Label>
                      <Select
                        value={form.city}
                        onValueChange={(value) => setField('city', value)}
                      >
                        <SelectTrigger><SelectValue placeholder="İl seçin" /></SelectTrigger>
                        <SelectContent>
                          {TURKEY_CITIES.map((city) => (
                            <SelectItem key={city} value={city}>{city}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {errors.city && <p className="text-xs text-destructive">{errors.city}</p>}
                    </div>

                    <div className="space-y-2">
                      <Label>İlçe *</Label>
                      <Select
                        value={form.district}
                        onValueChange={(value) => setField('district', value)}
                        disabled={!form.city}
                      >
                        <SelectTrigger><SelectValue placeholder="İlçe seçin" /></SelectTrigger>
                        <SelectContent>
                          {districts.map((district) => (
                            <SelectItem key={district} value={district}>{district}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {errors.district && <p className="text-xs text-destructive">{errors.district}</p>}
                    </div>

                    <div className="space-y-2">
                      <Label>Mahalle *</Label>
                      <Select
                        value={form.neighborhood}
                        onValueChange={(value) => setField('neighborhood', value)}
                        disabled={!form.district}
                      >
                        <SelectTrigger><SelectValue placeholder="Mahalle seçin" /></SelectTrigger>
                        <SelectContent>
                          {neighborhoods.map((neighborhood) => (
                            <SelectItem key={neighborhood} value={neighborhood}>{neighborhood}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {errors.neighborhood && <p className="text-xs text-destructive">{errors.neighborhood}</p>}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Adres *</Label>
                    <Textarea
                      placeholder="Cadde, Bulvar, Sokak, Apartman, Kat, Daire"
                      value={form.address}
                      onChange={(e) => setField('address', e.target.value)}
                    />
                    {errors.address && <p className="text-xs text-destructive">{errors.address}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label>Kullanıcı Adı *</Label>
                    <Input
                      value={form.username}
                      onChange={(e) => {
                        setManualUsernameEdit(true);
                        setField('username', e.target.value.toLowerCase());
                      }}
                    />
                    {usernameChecking && <p className="text-xs text-muted-foreground">Kullanıcı adı kontrol ediliyor...</p>}
                    {!usernameChecking && usernameAvailable && USERNAME_REGEX.test(form.username.trim()) && (
                      <p className="text-xs text-success">Bu kullanıcı adını kullanabilirsiniz.</p>
                    )}
                    {!usernameChecking && usernameAvailable === false && (
                      <p className="text-xs text-destructive">Bu kullanıcı adı kullanımda.</p>
                    )}
                    {errors.username && <p className="text-xs text-destructive">{errors.username}</p>}
                  </div>
                </section>
              </div>

              <Separator />

              <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
                <Button type="submit" className="btn-gradient rounded-xl min-w-32" disabled={submitting}>
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Kayıt Ol'}
                </Button>
                <p className="text-sm text-muted-foreground">
                  Zaten hesabınız var mı?{' '}
                  <Link to="/auth" className="text-primary font-semibold hover:underline">
                    Firma Giriş
                  </Link>
                </p>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
