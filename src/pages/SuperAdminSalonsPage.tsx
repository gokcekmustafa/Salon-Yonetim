import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import {
  Plus, Search, Building2, Users, Calendar, Eye, Loader2, Crown,
  MoreHorizontal, Edit, Trash2, LogIn, EyeOff, UserPlus, Upload, X, Camera, Shield,
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useNavigate } from 'react-router-dom';
import { SuperAdminUserManager } from '@/components/password/SuperAdminUserManager';
import { AnnouncementManager } from '@/components/notifications/AnnouncementManager';
import { SubscriptionAlertSettings } from '@/components/notifications/SubscriptionAlertSettings';
import { PopupManager } from '@/components/popup/PopupManager';
import { PermissionManager } from '@/components/permissions/PermissionManager';
import { PlatformStaffManager } from '@/components/admin/PlatformStaffManager';
import { TicketManager } from '@/components/admin/TicketManager';
import { RegistrationRequestManager } from '@/components/admin/RegistrationRequestManager';
import { StandardRoomManager } from '@/components/admin/StandardRoomManager';
import { StandardServiceManager } from '@/components/admin/StandardServiceManager';
import { usePlatformPermissions } from '@/hooks/usePlatformPermissions';

type Salon = {
  id: string; name: string; slug: string; phone: string | null; address: string | null;
  logo_url: string | null;
  subscription_plan: 'free' | 'starter' | 'professional' | 'enterprise';
  is_active: boolean; created_at: string;
};

type SalonStats = { staff_count: number; customer_count: number; appointment_count: number; };

const planColors: Record<string, string> = {
  free: 'bg-muted text-muted-foreground', starter: 'bg-info/10 text-info',
  professional: 'bg-primary/10 text-primary', enterprise: 'bg-warning/10 text-warning',
};
const planLabels: Record<string, string> = {
  free: 'Ücretsiz', starter: 'Başlangıç', professional: 'Profesyonel', enterprise: 'Kurumsal',
};

export default function SuperAdminSalonsPage() {
  const { isSuperAdmin, startManagingSalon } = useAuth();
  const { hasPlatformPermission, isHelper } = usePlatformPermissions();
  const navigate = useNavigate();

  const [salons, setSalons] = useState<Salon[]>([]);
  const [stats, setStats] = useState<Record<string, SalonStats>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Salon | null>(null);
  const [saving, setSaving] = useState(false);

  // Salon fields
  const [formName, setFormName] = useState('');
  const [formSlug, setFormSlug] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formPlan, setFormPlan] = useState<string>('free');
  const [formActive, setFormActive] = useState(true);
  const [formExpiry, setFormExpiry] = useState('');

  // Owner fields (only for new salon creation)
  const [ownerEmail, setOwnerEmail] = useState('');
  const [ownerPassword, setOwnerPassword] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [showOwnerPassword, setShowOwnerPassword] = useState(false);

  // Logo state
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [editingLogoUrl, setEditingLogoUrl] = useState<string | null>(null);
  const logoFileRef = useRef<HTMLInputElement>(null);

  // Permission manager state
  const [permDialogOpen, setPermDialogOpen] = useState(false);
  const [permSalon, setPermSalon] = useState<{ id: string; name: string } | null>(null);
  const fetchSalons = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('salons').select('*').order('created_at', { ascending: false });
    if (error) {
      toast.error('Salonlar yüklenemedi: ' + error.message);
    } else {
      setSalons(data || []);
      const statsMap: Record<string, SalonStats> = {};
      for (const salon of data || []) {
        const [staffRes, custRes, aptRes] = await Promise.all([
          supabase.from('staff').select('id', { count: 'exact', head: true }).eq('salon_id', salon.id),
          supabase.from('customers').select('id', { count: 'exact', head: true }).eq('salon_id', salon.id),
          supabase.from('appointments').select('id', { count: 'exact', head: true }).eq('salon_id', salon.id),
        ]);
        statsMap[salon.id] = {
          staff_count: staffRes.count || 0,
          customer_count: custRes.count || 0,
          appointment_count: aptRes.count || 0,
        };
      }
      setStats(statsMap);
    }
    setLoading(false);
  };

  useEffect(() => { if (isSuperAdmin) fetchSalons(); }, [isSuperAdmin]);

  const openCreate = () => {
    setEditing(null); setFormName(''); setFormSlug(''); setFormPhone(''); setFormAddress('');
    setFormPlan('free'); setFormActive(true); setFormExpiry('');
    setOwnerEmail(''); setOwnerPassword(''); setOwnerName(''); setShowOwnerPassword(false);
    setLogoPreview(null); setLogoFile(null); setEditingLogoUrl(null);
    setDialogOpen(true);
  };

  const openEdit = (salon: Salon) => {
    setEditing(salon); setFormName(salon.name); setFormSlug(salon.slug);
    setFormPhone(salon.phone || ''); setFormAddress(salon.address || '');
    setFormPlan(salon.subscription_plan); setFormActive(salon.is_active);
    setFormExpiry((salon as any).subscription_expires_at ? (salon as any).subscription_expires_at.split('T')[0] : '');
    setLogoPreview(null); setLogoFile(null); setEditingLogoUrl(salon.logo_url);
    setDialogOpen(true);
  };

  const generateSlug = (name: string) =>
    name.toLowerCase()
      .replace(/[çÇ]/g, 'c').replace(/[ğĞ]/g, 'g').replace(/[ıİ]/g, 'i')
      .replace(/[öÖ]/g, 'o').replace(/[şŞ]/g, 's').replace(/[üÜ]/g, 'u')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const handleNameChange = (val: string) => {
    setFormName(val);
    if (!editing) setFormSlug(generateSlug(val));
  };

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Sadece resim dosyaları yüklenebilir'); return; }
    if (file.size > 2 * 1024 * 1024) { toast.error('Dosya boyutu 2MB\'dan küçük olmalıdır'); return; }
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const uploadLogo = async (salonId: string): Promise<string | null> => {
    if (!logoFile) return editingLogoUrl;
    const ext = logoFile.name.split('.').pop() || 'png';
    const path = `${salonId}/logo-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('salon-logos').upload(path, logoFile, { cacheControl: '3600', upsert: true });
    if (error) { toast.error('Logo yüklenemedi: ' + error.message); return null; }
    const { data: { publicUrl } } = supabase.storage.from('salon-logos').getPublicUrl(path);
    return publicUrl;
  };

  const handleSave = async () => {
    if (!formName.trim() || !formSlug.trim()) { toast.error('Salon adı ve slug zorunludur'); return; }

    // For new salon with owner, use the edge function
    if (!editing && ownerEmail.trim()) {
      if (!ownerPassword || ownerPassword.length < 6) {
        toast.error('Sahip şifresi en az 6 karakter olmalıdır');
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail.trim())) {
        toast.error('Geçerli bir e-posta adresi girin');
        return;
      }

      setSaving(true);
      try {
        const res = await supabase.functions.invoke('manage-passwords', {
          body: {
            action: 'create_salon_with_owner',
            salon_name: formName.trim(),
            slug: formSlug.trim(),
            phone: formPhone.trim() || null,
            address: formAddress.trim() || null,
            subscription_plan: formPlan,
            owner_email: ownerEmail.trim(),
            owner_password: ownerPassword,
            owner_full_name: ownerName.trim() || ownerEmail.trim(),
          },
        });

        if (res.error || res.data?.error) {
          toast.error(res.data?.error || 'Salon oluşturulamadı');
        } else {
          // Upload logo if selected (need salon id from response)
          if (logoFile && res.data?.salon_id) {
            const logoUrl = await uploadLogo(res.data.salon_id);
            if (logoUrl) {
              await supabase.from('salons').update({ logo_url: logoUrl }).eq('id', res.data.salon_id);
            }
          }
          toast.success(res.data?.message || 'Salon ve sahip hesabı oluşturuldu');
          setDialogOpen(false);
          fetchSalons();
        }
      } catch {
        toast.error('Salon oluşturulamadı');
      }
      setSaving(false);
      return;
    }

    // Standard create/edit
    setSaving(true);

    let logoUrl = editingLogoUrl;
    if (logoFile && editing) {
      const url = await uploadLogo(editing.id);
      if (url === null && logoFile) { setSaving(false); return; }
      logoUrl = url;
    }

    const payload = {
      name: formName.trim(), slug: formSlug.trim(),
      phone: formPhone.trim() || null, address: formAddress.trim() || null,
      subscription_plan: formPlan as Salon['subscription_plan'], is_active: formActive,
      subscription_expires_at: formExpiry ? new Date(formExpiry).toISOString() : null,
      logo_url: logoUrl,
    };

    const { error } = editing
      ? await supabase.from('salons').update(payload).eq('id', editing.id)
      : await supabase.from('salons').insert(payload);

    if (error) { toast.error(error.message); }
    else { toast.success(editing ? 'Salon güncellendi' : 'Yeni salon oluşturuldu'); setDialogOpen(false); fetchSalons(); }
    setSaving(false);
  };

  const handleDelete = async (salon: Salon) => {
    if (!confirm(`"${salon.name}" salonunu silmek istediğinizden emin misiniz?`)) return;
    const { error } = await supabase.from('salons').delete().eq('id', salon.id);
    if (error) toast.error(error.message);
    else { toast.success('Salon silindi'); fetchSalons(); }
  };

  const toggleActive = async (salon: Salon) => {
    const { error } = await supabase.from('salons').update({ is_active: !salon.is_active }).eq('id', salon.id);
    if (!error) fetchSalons();
  };

  const manageSalon = (salon: Salon) => {
    startManagingSalon(salon.id);
    navigate('/');
  };

  const filtered = salons.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) || s.slug.toLowerCase().includes(search.toLowerCase())
  );

  const totalStats = {
    salons: salons.length,
    active: salons.filter(s => s.is_active).length,
    totalStaff: Object.values(stats).reduce((a, s) => a + s.staff_count, 0),
    totalCustomers: Object.values(stats).reduce((a, s) => a + s.customer_count, 0),
  };

  return (
    <div className="page-container animate-in">
      {/* Hero header */}
      <div className="rounded-2xl p-6 lg:p-8 border border-border/40" style={{ background: 'var(--gradient-hero)' }}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl btn-gradient flex items-center justify-center">
              <Crown className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Platform Yönetimi</h1>
              <p className="text-sm text-muted-foreground mt-0.5">Tüm salonları yönetin ve izleyin</p>
            </div>
          </div>
          <Button onClick={openCreate} className="gap-2 btn-gradient h-10 px-5 rounded-xl">
            <Plus className="h-4 w-4" /> Yeni Salon
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Toplam Salon', value: totalStats.salons, icon: Building2, color: 'text-primary bg-primary/10' },
          { label: 'Aktif Salon', value: totalStats.active, icon: Eye, color: 'text-success bg-success/10' },
          { label: 'Toplam Personel', value: totalStats.totalStaff, icon: Users, color: 'text-info bg-info/10' },
          { label: 'Toplam Müşteri', value: totalStats.totalCustomers, icon: Calendar, color: 'text-warning bg-warning/10' },
        ].map(stat => (
          <div key={stat.label} className="stat-card p-4">
            <div className="flex items-center gap-3">
              <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${stat.color}`}><stat.icon className="h-5 w-5" /></div>
              <div>
                <p className="text-2xl font-bold tabular-nums">{stat.value}</p>
                <p className="text-[11px] text-muted-foreground font-medium">{stat.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Salon ara..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10 h-10" />
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Building2 className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground font-medium">Henüz salon bulunmuyor</p>
          <Button onClick={openCreate} variant="outline" className="mt-4 gap-2"><Plus className="h-4 w-4" /> İlk Salonu Oluştur</Button>
        </div>
      ) : (
        <Card className="shadow-soft border-border/60 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="font-semibold">Salon</TableHead>
                <TableHead className="hidden md:table-cell font-semibold">Slug</TableHead>
                <TableHead className="hidden lg:table-cell font-semibold">Plan</TableHead>
                <TableHead className="hidden md:table-cell text-center font-semibold">Personel</TableHead>
                <TableHead className="hidden md:table-cell text-center font-semibold">Müşteri</TableHead>
                <TableHead className="text-center font-semibold">Durum</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(salon => {
                const s = stats[salon.id] || { staff_count: 0, customer_count: 0, appointment_count: 0 };
                return (
                  <TableRow key={salon.id} className="group">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden">
                          {salon.logo_url ? (
                            <img src={salon.logo_url} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <Building2 className="h-4 w-4 text-primary" />
                          )}
                        </div>
                        <div>
                          <p className="font-semibold text-sm">{salon.name}</p>
                          <p className="text-xs text-muted-foreground">{salon.phone || '—'}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell"><code className="text-xs bg-muted px-2 py-0.5 rounded-md font-mono">/{salon.slug}</code></TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <Badge variant="secondary" className={`text-[10px] font-semibold ${planColors[salon.subscription_plan]}`}>{planLabels[salon.subscription_plan]}</Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-center text-sm tabular-nums">{s.staff_count}</TableCell>
                    <TableCell className="hidden md:table-cell text-center text-sm tabular-nums">{s.customer_count}</TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant="secondary"
                        className={`text-[10px] font-semibold cursor-pointer transition-colors ${salon.is_active ? 'bg-success/10 text-success hover:bg-success/20' : 'bg-destructive/10 text-destructive hover:bg-destructive/20'}`}
                        onClick={() => toggleActive(salon)}
                      >
                        {salon.is_active ? 'Aktif' : 'Pasif'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => manageSalon(salon)}>
                          <LogIn className="h-3.5 w-3.5" />
                          Salonu Yönet
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"><MoreHorizontal className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEdit(salon)}><Edit className="h-4 w-4 mr-2" /> Düzenle</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => { setPermSalon({ id: salon.id, name: salon.name }); setPermDialogOpen(true); }}><Shield className="h-4 w-4 mr-2" /> İzinler</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDelete(salon)} className="text-destructive focus:text-destructive"><Trash2 className="h-4 w-4 mr-2" /> Sil</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Registration Requests */}
      {hasPlatformPermission('can_manage_salons') && <RegistrationRequestManager />}

      {/* Standard Rooms */}
      {hasPlatformPermission('can_manage_salons') && <StandardRoomManager />}

      {/* Subscription Alert Settings */}
      {hasPlatformPermission('can_manage_settings') && <SubscriptionAlertSettings />}

      {/* Announcements */}
      {hasPlatformPermission('can_manage_announcements') && <AnnouncementManager mode="super_admin" />}

      {/* Popup Announcements */}
      {hasPlatformPermission('can_manage_popups') && <PopupManager mode="super_admin" />}

      {/* User Management */}
      {hasPlatformPermission('can_manage_users') && <SuperAdminUserManager />}

      {/* Platform Staff Manager - only for non-helper super admins */}
      {!isHelper && <PlatformStaffManager />}

      {/* Ticket Manager */}
      <TicketManager />

      {/* Create/Edit Salon Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {editing ? <Edit className="h-5 w-5 text-primary" /> : <UserPlus className="h-5 w-5 text-primary" />}
              {editing ? 'Salon Düzenle' : 'Yeni Salon ve Sahip Hesabı Oluştur'}
            </DialogTitle>
            <DialogDescription>
              {editing ? 'Salon bilgilerini güncelleyin' : 'Yeni salon oluşturun ve salon sahibi hesabını ayarlayın'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Salon Info */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Salon Bilgileri</h3>
              {/* Logo Upload */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Salon Logosu</Label>
                <div className="flex items-center gap-3">
                  <div className="relative group">
                    <div className="h-16 w-16 rounded-xl border-2 border-dashed border-border bg-muted/50 flex items-center justify-center overflow-hidden">
                      {(logoPreview || editingLogoUrl) ? (
                        <img src={logoPreview || editingLogoUrl!} alt="Logo" className="h-full w-full object-cover rounded-xl" />
                      ) : (
                        <Building2 className="h-6 w-6 text-muted-foreground/40" />
                      )}
                    </div>
                    <button onClick={() => logoFileRef.current?.click()} className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-md hover:scale-110 transition-transform">
                      <Camera className="h-3 w-3" />
                    </button>
                  </div>
                  <div className="space-y-1">
                    <Button variant="outline" size="sm" onClick={() => logoFileRef.current?.click()} className="gap-1.5 text-xs h-7">
                      <Upload className="h-3 w-3" /> Yükle
                    </Button>
                    {(logoPreview || editingLogoUrl) && (
                      <Button variant="ghost" size="sm" onClick={() => { setLogoPreview(null); setLogoFile(null); setEditingLogoUrl(null); }} className="gap-1.5 text-xs h-7 text-destructive hover:text-destructive">
                        <X className="h-3 w-3" /> Kaldır
                      </Button>
                    )}
                    <p className="text-[10px] text-muted-foreground">PNG, JPG. Maks 2MB</p>
                  </div>
                </div>
                <input ref={logoFileRef} type="file" accept="image/*" className="hidden" onChange={handleLogoSelect} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Salon Adı *</Label>
                <Input value={formName} onChange={e => handleNameChange(e.target.value)} placeholder="Güzellik Salonu" className="h-10" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold">URL Slug</Label>
                <Input value={formSlug} onChange={e => setFormSlug(e.target.value)} placeholder="guzellik-salonu" className="h-10" />
                <p className="text-xs text-muted-foreground">Online randevu linki: /book/{formSlug || 'slug'}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold">Telefon</Label>
                  <Input type="tel" value={formPhone} onChange={e => setFormPhone(e.target.value)} placeholder="0212 555 1234" className="h-10" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-semibold">Abonelik</Label>
                  <Select value={formPlan} onValueChange={setFormPlan}>
                    <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="free">Ücretsiz</SelectItem>
                      <SelectItem value="starter">Başlangıç</SelectItem>
                      <SelectItem value="professional">Profesyonel</SelectItem>
                      <SelectItem value="enterprise">Kurumsal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {editing && (
                <div className="space-y-2">
                  <Label className="text-xs font-semibold">Abonelik Bitiş Tarihi</Label>
                  <Input type="date" value={formExpiry} onChange={e => setFormExpiry(e.target.value)} className="h-10" />
                  <p className="text-xs text-muted-foreground">Boş bırakılırsa süresiz olur</p>
                </div>
              )}
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Adres</Label>
                <Input value={formAddress} onChange={e => setFormAddress(e.target.value)} placeholder="İstanbul, Türkiye" className="h-10" />
              </div>
              {editing && (
                <div className="flex items-center justify-between py-1">
                  <Label className="text-xs font-semibold">Aktif</Label>
                  <Switch checked={formActive} onCheckedChange={setFormActive} />
                </div>
              )}
            </div>

            {/* Owner Account (only for new salon) */}
            {!editing && (
              <>
                <Separator />
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Salon Sahibi Hesabı</h3>
                  <p className="text-xs text-muted-foreground">
                    Salon sahibi için bir giriş hesabı oluşturun. Salon sahibi ilk girişte şifresini değiştirebilir.
                  </p>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">Sahip Adı</Label>
                    <Input value={ownerName} onChange={e => setOwnerName(e.target.value)} placeholder="Ahmet Yılmaz" className="h-10" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">E-posta *</Label>
                    <Input type="email" value={ownerEmail} onChange={e => setOwnerEmail(e.target.value)} placeholder="sahip@salon.com" className="h-10" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">Şifre *</Label>
                    <div className="relative">
                      <Input
                        type={showOwnerPassword ? 'text' : 'password'}
                        value={ownerPassword}
                        onChange={e => setOwnerPassword(e.target.value)}
                        placeholder="En az 6 karakter"
                        className="h-10 pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowOwnerPassword(!showOwnerPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showOwnerPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Giriş bilgilerini salon sahibine güvenli bir şekilde iletmeniz gerekecektir.
                  </p>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>İptal</Button>
            <Button onClick={handleSave} disabled={saving} className="btn-gradient">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {editing ? 'Güncelle' : 'Salon Oluştur'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Permission Manager Dialog */}
      {permSalon && (
        <PermissionManager
          salonId={permSalon.id}
          salonName={permSalon.name}
          open={permDialogOpen}
          onOpenChange={setPermDialogOpen}
        />
      )}
    </div>
  );
}