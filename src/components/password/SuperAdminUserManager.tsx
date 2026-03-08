import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Users, Key, Loader2, Eye, EyeOff, Search, ShieldCheck, Plus, UserPlus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface EnrichedUser {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  full_name: string | null;
  phone: string | null;
  roles: string[];
  memberships: { salon_id: string; salon_name: string; role: string }[];
}

interface SalonOption {
  id: string;
  name: string;
}

export function SuperAdminUserManager() {
  const [users, setUsers] = useState<EnrichedUser[]>([]);
  const [salons, setSalons] = useState<SalonOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Password reset dialog
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<EnrichedUser | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Create user dialog
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createEmail, setCreateEmail] = useState('');
  const [createFullName, setCreateFullName] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [createRole, setCreateRole] = useState<string>('salon_admin');
  const [createSalonId, setCreateSalonId] = useState<string>('');
  const [createSalonRole, setCreateSalonRole] = useState<string>('salon_admin');
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchUsers();
    fetchSalons();
  }, []);

  const fetchSalons = async () => {
    const { data } = await supabase.from('salons').select('id, name').order('name');
    setSalons(data || []);
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await supabase.functions.invoke('manage-passwords', {
        body: { action: 'list_users' },
      });
      if (res.data?.users) {
        setUsers(res.data.users);
      } else if (res.data?.error) {
        toast.error(res.data.error);
      }
    } catch {
      toast.error('Kullanıcılar yüklenemedi');
    }
    setLoading(false);
  };

  // Password reset
  const openReset = (user: EnrichedUser) => {
    setSelectedUser(user);
    setNewPassword('');
    setShowPassword(false);
    setResetDialogOpen(true);
  };

  const handleReset = async () => {
    if (!selectedUser || !newPassword || newPassword.length < 6) {
      toast.error('Şifre en az 6 karakter olmalıdır');
      return;
    }
    setSaving(true);
    try {
      const res = await supabase.functions.invoke('manage-passwords', {
        body: {
          action: 'admin_reset_password',
          target_user_id: selectedUser.id,
          new_password: newPassword,
        },
      });
      if (res.error || res.data?.error) {
        toast.error(res.data?.error || 'Şifre sıfırlama başarısız');
      } else {
        toast.success(`${selectedUser.full_name || selectedUser.email} şifresi sıfırlandı`);
        setResetDialogOpen(false);
      }
    } catch {
      toast.error('Şifre sıfırlama başarısız');
    }
    setSaving(false);
  };

  // Create user
  const openCreate = () => {
    setCreateEmail('');
    setCreateFullName('');
    setCreatePassword('');
    setCreateRole('salon_admin');
    setCreateSalonId('');
    setCreateSalonRole('salon_admin');
    setShowCreatePassword(false);
    setCreateDialogOpen(true);
  };

  const handleCreate = async () => {
    if (!createEmail.trim() || !createPassword || createPassword.length < 6) {
      toast.error('E-posta ve şifre (min 6 karakter) zorunludur');
      return;
    }

    // Basic email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(createEmail.trim())) {
      toast.error('Geçerli bir e-posta adresi girin');
      return;
    }

    setCreating(true);
    try {
      const body: Record<string, string> = {
        action: 'create_user',
        email: createEmail.trim(),
        password: createPassword,
        full_name: createFullName.trim() || createEmail.trim(),
        role: createRole,
      };

      if (createSalonId && createRole !== 'super_admin') {
        body.salon_id = createSalonId;
        body.salon_role = createSalonRole;
      }

      const res = await supabase.functions.invoke('manage-passwords', { body });

      if (res.error || res.data?.error) {
        toast.error(res.data?.error || 'Kullanıcı oluşturulamadı');
      } else {
        toast.success(`${createFullName || createEmail} başarıyla oluşturuldu`);
        setCreateDialogOpen(false);
        fetchUsers();
      }
    } catch {
      toast.error('Kullanıcı oluşturulamadı');
    }
    setCreating(false);
  };

  // Delete user
  const handleDelete = async (user: EnrichedUser) => {
    if (!confirm(`"${user.full_name || user.email}" kullanıcısını silmek istediğinizden emin misiniz?`)) return;
    try {
      const res = await supabase.functions.invoke('manage-passwords', {
        body: { action: 'delete_user', target_user_id: user.id },
      });
      if (res.error || res.data?.error) {
        toast.error(res.data?.error || 'Kullanıcı silinemedi');
      } else {
        toast.success('Kullanıcı silindi');
        fetchUsers();
      }
    } catch {
      toast.error('Kullanıcı silinemedi');
    }
  };

  const filtered = users.filter(u =>
    (u.full_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (u.email || '').toLowerCase().includes(search.toLowerCase())
  );

  const roleLabel = (role: string) => {
    switch (role) {
      case 'super_admin': return 'Super Admin';
      case 'salon_admin': return 'Salon Admin';
      case 'staff': return 'Personel';
      default: return role;
    }
  };

  const roleColor = (role: string) => {
    switch (role) {
      case 'super_admin': return 'bg-primary/10 text-primary';
      case 'salon_admin': return 'bg-info/10 text-info';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <>
      <Card className="shadow-soft border-border/60">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <div>
                <CardTitle>Kullanıcı Yönetimi</CardTitle>
                <CardDescription>Tüm kullanıcıları görüntüleyin, oluşturun ve şifrelerini yönetin</CardDescription>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={fetchUsers} disabled={loading} className="gap-1.5 text-xs">
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Users className="h-3.5 w-3.5" />}
                Yenile
              </Button>
              <Button size="sm" onClick={openCreate} className="gap-1.5 text-xs btn-gradient">
                <UserPlus className="h-3.5 w-3.5" /> Yeni Kullanıcı
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Kullanıcı ara..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-10 h-10"
            />
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Kullanıcı bulunamadı</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border/60">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="font-semibold">Kullanıcı</TableHead>
                    <TableHead className="font-semibold hidden md:table-cell">E-posta</TableHead>
                    <TableHead className="font-semibold">Roller</TableHead>
                    <TableHead className="font-semibold hidden lg:table-cell">Salonlar</TableHead>
                    <TableHead className="w-24"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(user => (
                    <TableRow key={user.id} className="group">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <span className="text-xs font-bold text-primary">
                              {(user.full_name || user.email || '?')[0].toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <p className="text-sm font-medium">{user.full_name || '—'}</p>
                            <p className="text-xs text-muted-foreground md:hidden">{user.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <span className="text-sm text-muted-foreground">{user.email}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {user.roles.map(role => (
                            <Badge key={role} variant="secondary" className={`text-[10px] font-semibold ${roleColor(role)}`}>
                              {roleLabel(role)}
                            </Badge>
                          ))}
                          {user.roles.length === 0 && (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <div className="flex flex-wrap gap-1">
                          {user.memberships.map(m => (
                            <Badge key={m.salon_id} variant="outline" className="text-[10px]">
                              {m.salon_name}
                            </Badge>
                          ))}
                          {user.memberships.length === 0 && (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openReset(user)}
                            className="h-8 w-8"
                            title="Şifre sıfırla"
                          >
                            <Key className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(user)}
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            title="Kullanıcıyı sil"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Password Reset Dialog */}
      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Şifre Sıfırla</DialogTitle>
            <DialogDescription>
              {selectedUser?.full_name || selectedUser?.email || 'Kullanıcı'} için yeni şifre belirleyin
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-muted/50 border border-border text-sm">
              <p className="font-medium">{selectedUser?.full_name || '—'}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{selectedUser?.email}</p>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Yeni Şifre</Label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="En az 6 karakter"
                  className="h-10 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetDialogOpen(false)}>İptal</Button>
            <Button onClick={handleReset} disabled={saving || newPassword.length < 6} className="btn-gradient">
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Şifreyi Sıfırla
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create User Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" />
              Yeni Kullanıcı Oluştur
            </DialogTitle>
            <DialogDescription>
              Platform için yeni kullanıcı oluşturun ve rol atayın
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2 col-span-2">
                <Label className="text-xs font-semibold">Ad Soyad</Label>
                <Input
                  value={createFullName}
                  onChange={e => setCreateFullName(e.target.value)}
                  placeholder="Ahmet Yılmaz"
                  className="h-10"
                />
              </div>
              <div className="space-y-2 col-span-2">
                <Label className="text-xs font-semibold">E-posta *</Label>
                <Input
                  type="email"
                  value={createEmail}
                  onChange={e => setCreateEmail(e.target.value)}
                  placeholder="kullanici@ornek.com"
                  className="h-10"
                />
              </div>
              <div className="space-y-2 col-span-2">
                <Label className="text-xs font-semibold">Şifre *</Label>
                <div className="relative">
                  <Input
                    type={showCreatePassword ? 'text' : 'password'}
                    value={createPassword}
                    onChange={e => setCreatePassword(e.target.value)}
                    placeholder="En az 6 karakter"
                    className="h-10 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCreatePassword(!showCreatePassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showCreatePassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold">Sistem Rolü</Label>
              <Select value={createRole} onValueChange={setCreateRole}>
                <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="super_admin">Super Admin</SelectItem>
                  <SelectItem value="salon_admin">Salon Admin</SelectItem>
                  <SelectItem value="staff">Personel</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {createRole !== 'super_admin' && (
              <>
                <div className="space-y-2">
                  <Label className="text-xs font-semibold">Salon Ata</Label>
                  <Select value={createSalonId} onValueChange={setCreateSalonId}>
                    <SelectTrigger className="h-10"><SelectValue placeholder="Salon seçin (opsiyonel)" /></SelectTrigger>
                    <SelectContent>
                      {salons.map(s => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {createSalonId && (
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">Salon İçi Rol</Label>
                    <Select value={createSalonRole} onValueChange={setCreateSalonRole}>
                      <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="salon_admin">Salon Admin</SelectItem>
                        <SelectItem value="staff">Personel</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </>
            )}

            <p className="text-xs text-muted-foreground">
              Oluşturulan kullanıcıya giriş bilgilerini güvenli bir şekilde iletmeniz gerekecektir.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>İptal</Button>
            <Button
              onClick={handleCreate}
              disabled={creating || !createEmail.trim() || createPassword.length < 6}
              className="btn-gradient"
            >
              {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Kullanıcı Oluştur
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
