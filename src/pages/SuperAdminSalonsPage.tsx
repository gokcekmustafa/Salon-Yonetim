import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import {
  Plus, Search, Building2, Users, Calendar, CreditCard,
  MoreHorizontal, Edit, Trash2, Eye, Loader2, Crown,
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type Salon = {
  id: string;
  name: string;
  slug: string;
  phone: string | null;
  address: string | null;
  subscription_plan: 'free' | 'starter' | 'professional' | 'enterprise';
  subscription_expires_at: string | null;
  is_active: boolean;
  owner_user_id: string | null;
  created_at: string;
};

type SalonStats = {
  salon_id: string;
  staff_count: number;
  customer_count: number;
  appointment_count: number;
};

const planColors: Record<string, string> = {
  free: 'bg-muted text-muted-foreground',
  starter: 'bg-blue-100 text-blue-700',
  professional: 'bg-primary/10 text-primary',
  enterprise: 'bg-amber-100 text-amber-700',
};

const planLabels: Record<string, string> = {
  free: 'Ücretsiz',
  starter: 'Başlangıç',
  professional: 'Profesyonel',
  enterprise: 'Kurumsal',
};

export default function SuperAdminSalonsPage() {
  const { isSuperAdmin } = useAuth();
  const { toast } = useToast();

  const [salons, setSalons] = useState<Salon[]>([]);
  const [stats, setStats] = useState<Record<string, SalonStats>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Salon | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formName, setFormName] = useState('');
  const [formSlug, setFormSlug] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formPlan, setFormPlan] = useState<string>('free');
  const [formActive, setFormActive] = useState(true);

  const fetchSalons = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('salons')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast({ title: 'Hata', description: error.message, variant: 'destructive' });
    } else {
      setSalons(data || []);
      // Fetch stats for each salon
      const statsMap: Record<string, SalonStats> = {};
      for (const salon of data || []) {
        const [staffRes, custRes, aptRes] = await Promise.all([
          supabase.from('staff').select('id', { count: 'exact', head: true }).eq('salon_id', salon.id),
          supabase.from('customers').select('id', { count: 'exact', head: true }).eq('salon_id', salon.id),
          supabase.from('appointments').select('id', { count: 'exact', head: true }).eq('salon_id', salon.id),
        ]);
        statsMap[salon.id] = {
          salon_id: salon.id,
          staff_count: staffRes.count || 0,
          customer_count: custRes.count || 0,
          appointment_count: aptRes.count || 0,
        };
      }
      setStats(statsMap);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (isSuperAdmin) fetchSalons();
  }, [isSuperAdmin]);

  const openCreate = () => {
    setEditing(null);
    setFormName('');
    setFormSlug('');
    setFormPhone('');
    setFormAddress('');
    setFormPlan('free');
    setFormActive(true);
    setDialogOpen(true);
  };

  const openEdit = (salon: Salon) => {
    setEditing(salon);
    setFormName(salon.name);
    setFormSlug(salon.slug);
    setFormPhone(salon.phone || '');
    setFormAddress(salon.address || '');
    setFormPlan(salon.subscription_plan);
    setFormActive(salon.is_active);
    setDialogOpen(true);
  };

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[çÇ]/g, 'c').replace(/[ğĞ]/g, 'g').replace(/[ıİ]/g, 'i')
      .replace(/[öÖ]/g, 'o').replace(/[şŞ]/g, 's').replace(/[üÜ]/g, 'u')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  };

  const handleNameChange = (val: string) => {
    setFormName(val);
    if (!editing) setFormSlug(generateSlug(val));
  };

  const handleSave = async () => {
    if (!formName.trim() || !formSlug.trim()) {
      toast({ title: 'Hata', description: 'Salon adı ve slug zorunludur', variant: 'destructive' });
      return;
    }
    setSaving(true);

    if (editing) {
      const { error } = await supabase
        .from('salons')
        .update({
          name: formName.trim(),
          slug: formSlug.trim(),
          phone: formPhone.trim() || null,
          address: formAddress.trim() || null,
          subscription_plan: formPlan as Salon['subscription_plan'],
          is_active: formActive,
        })
        .eq('id', editing.id);

      if (error) {
        toast({ title: 'Hata', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Başarılı', description: 'Salon güncellendi' });
        setDialogOpen(false);
        fetchSalons();
      }
    } else {
      const { error } = await supabase
        .from('salons')
        .insert({
          name: formName.trim(),
          slug: formSlug.trim(),
          phone: formPhone.trim() || null,
          address: formAddress.trim() || null,
          subscription_plan: formPlan as Salon['subscription_plan'],
          is_active: formActive,
        });

      if (error) {
        toast({ title: 'Hata', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Başarılı', description: 'Yeni salon oluşturuldu' });
        setDialogOpen(false);
        fetchSalons();
      }
    }
    setSaving(false);
  };

  const handleDelete = async (salon: Salon) => {
    if (!confirm(`"${salon.name}" salonunu silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.`)) return;
    const { error } = await supabase.from('salons').delete().eq('id', salon.id);
    if (error) {
      toast({ title: 'Hata', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Başarılı', description: 'Salon silindi' });
      fetchSalons();
    }
  };

  const toggleActive = async (salon: Salon) => {
    const { error } = await supabase
      .from('salons')
      .update({ is_active: !salon.is_active })
      .eq('id', salon.id);
    if (!error) fetchSalons();
  };

  const filtered = salons.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.slug.toLowerCase().includes(search.toLowerCase())
  );

  const totalStats = {
    salons: salons.length,
    active: salons.filter(s => s.is_active).length,
    totalStaff: Object.values(stats).reduce((a, s) => a + s.staff_count, 0),
    totalCustomers: Object.values(stats).reduce((a, s) => a + s.customer_count, 0),
  };

  return (
    <div className="page-container animate-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground flex items-center gap-2">
            <Crown className="h-6 w-6 text-primary" />
            Platform Yönetimi
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Tüm salonları yönetin ve izleyin</p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" /> Yeni Salon
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card className="stat-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/8"><Building2 className="h-5 w-5 text-primary" /></div>
              <div>
                <p className="text-2xl font-bold">{totalStats.salons}</p>
                <p className="text-xs text-muted-foreground">Toplam Salon</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="stat-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-success/10"><Eye className="h-5 w-5 text-success" /></div>
              <div>
                <p className="text-2xl font-bold">{totalStats.active}</p>
                <p className="text-xs text-muted-foreground">Aktif Salon</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="stat-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-50"><Users className="h-5 w-5 text-blue-600" /></div>
              <div>
                <p className="text-2xl font-bold">{totalStats.totalStaff}</p>
                <p className="text-xs text-muted-foreground">Toplam Personel</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="stat-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-50"><Calendar className="h-5 w-5 text-amber-600" /></div>
              <div>
                <p className="text-2xl font-bold">{totalStats.totalCustomers}</p>
                <p className="text-xs text-muted-foreground">Toplam Müşteri</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Salon ara..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <Building2 className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground">Henüz salon bulunmuyor</p>
          <Button onClick={openCreate} variant="outline" className="mt-3">
            <Plus className="h-4 w-4 mr-2" /> İlk Salonu Oluştur
          </Button>
        </div>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Salon</TableHead>
                <TableHead className="hidden md:table-cell">Slug</TableHead>
                <TableHead className="hidden lg:table-cell">Plan</TableHead>
                <TableHead className="hidden md:table-cell text-center">Personel</TableHead>
                <TableHead className="hidden md:table-cell text-center">Müşteri</TableHead>
                <TableHead className="hidden lg:table-cell text-center">Randevu</TableHead>
                <TableHead className="text-center">Durum</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(salon => {
                const s = stats[salon.id] || { staff_count: 0, customer_count: 0, appointment_count: 0 };
                return (
                  <TableRow key={salon.id} className="group">
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">{salon.name}</p>
                        <p className="text-xs text-muted-foreground">{salon.phone || '—'}</p>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded">/{salon.slug}</code>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <Badge variant="secondary" className={planColors[salon.subscription_plan]}>
                        {planLabels[salon.subscription_plan]}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-center text-sm">{s.staff_count}</TableCell>
                    <TableCell className="hidden md:table-cell text-center text-sm">{s.customer_count}</TableCell>
                    <TableCell className="hidden lg:table-cell text-center text-sm">{s.appointment_count}</TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant="secondary"
                        className={salon.is_active ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}
                        onClick={() => toggleActive(salon)}
                        style={{ cursor: 'pointer' }}
                      >
                        {salon.is_active ? 'Aktif' : 'Pasif'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(salon)}>
                            <Edit className="h-4 w-4 mr-2" /> Düzenle
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDelete(salon)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" /> Sil
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Salon Düzenle' : 'Yeni Salon Oluştur'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Salon Adı</Label>
              <Input value={formName} onChange={e => handleNameChange(e.target.value)} placeholder="Güzellik Salonu" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">URL Slug</Label>
              <Input value={formSlug} onChange={e => setFormSlug(e.target.value)} placeholder="guzellik-salonu" />
              <p className="text-xs text-muted-foreground">Online randevu linki: /book/{formSlug || 'slug'}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Telefon</Label>
                <Input type="tel" value={formPhone} onChange={e => setFormPhone(e.target.value)} placeholder="0212 555 1234" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Abonelik</Label>
                <Select value={formPlan} onValueChange={setFormPlan}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free">Ücretsiz</SelectItem>
                    <SelectItem value="starter">Başlangıç</SelectItem>
                    <SelectItem value="professional">Profesyonel</SelectItem>
                    <SelectItem value="enterprise">Kurumsal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Adres</Label>
              <Input value={formAddress} onChange={e => setFormAddress(e.target.value)} placeholder="İstanbul, Türkiye" />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium">Aktif</Label>
              <Switch checked={formActive} onCheckedChange={setFormActive} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>İptal</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editing ? 'Güncelle' : 'Oluştur'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
