import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Users, Key, Loader2, Eye, EyeOff, Search, ShieldCheck } from 'lucide-react';
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

export function SuperAdminUserManager() {
  const [users, setUsers] = useState<EnrichedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<EnrichedUser | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

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

  const openReset = (user: EnrichedUser) => {
    setSelectedUser(user);
    setNewPassword('');
    setShowPassword(false);
    setDialogOpen(true);
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
        setDialogOpen(false);
      }
    } catch {
      toast.error('Şifre sıfırlama başarısız');
    }
    setSaving(false);
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
                <CardDescription>Tüm kullanıcıları görüntüleyin ve şifrelerini yönetin</CardDescription>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={fetchUsers} disabled={loading} className="gap-1.5 text-xs">
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Users className="h-3.5 w-3.5" />}
              Yenile
            </Button>
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
                    <TableHead className="w-12"></TableHead>
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
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openReset(user)}
                          className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Şifre sıfırla"
                        >
                          <Key className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
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
            <p className="text-xs text-muted-foreground">
              Kullanıcıya yeni şifresini güvenli bir şekilde bildirmeniz gerekecektir.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>İptal</Button>
            <Button onClick={handleReset} disabled={saving || newPassword.length < 6} className="btn-gradient">
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Şifreyi Sıfırla
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
