import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Users, Key, Loader2, Eye, EyeOff, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface StaffUser {
  user_id: string;
  full_name: string | null;
  phone: string | null;
  role: string;
  branch_id: string | null;
}

export function StaffPasswordManager() {
  const { currentSalonId, isSuperAdmin, isSalonAdmin } = useAuth();
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<StaffUser | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const canManage = isSuperAdmin || isSalonAdmin;

  useEffect(() => {
    if (!canManage) { setLoading(false); return; }
    if (!currentSalonId) { setLoading(false); setStaffUsers([]); return; }
    fetchStaffUsers();
  }, [currentSalonId, canManage]);

  const fetchStaffUsers = async () => {
    setLoading(true);
    try {
      const res = await supabase.functions.invoke('manage-passwords', {
        body: { action: 'list_salon_staff_users', salon_id: currentSalonId },
      });

      if (res.data?.staff_users) {
        setStaffUsers(res.data.staff_users);
      }
    } catch {
      toast.error('Personel listesi yüklenemedi');
    }
    setLoading(false);
  };

  const openReset = (staff: StaffUser) => {
    setSelectedStaff(staff);
    setNewPassword('');
    setShowPassword(false);
    setDialogOpen(true);
  };

  const handleReset = async () => {
    if (!selectedStaff || !newPassword || newPassword.length < 6) {
      toast.error('Şifre en az 6 karakter olmalıdır');
      return;
    }
    setSaving(true);
    try {
      const res = await supabase.functions.invoke('manage-passwords', {
        body: {
          action: 'salon_admin_reset_staff_password',
          staff_user_id: selectedStaff.user_id,
          salon_id: currentSalonId,
          new_password: newPassword,
        },
      });

      if (res.error || res.data?.error) {
        toast.error(res.data?.error || 'Şifre sıfırlama başarısız');
      } else {
        toast.success(`${selectedStaff.full_name || 'Personel'} şifresi sıfırlandı`);
        setDialogOpen(false);
      }
    } catch {
      toast.error('Şifre sıfırlama başarısız');
    }
    setSaving(false);
  };

  if (!canManage) return null;

  const roleLabel = (role: string) => {
    switch (role) {
      case 'salon_admin': return 'Admin';
      case 'staff': return 'Personel';
      case 'super_admin': return 'Super Admin';
      default: return role;
    }
  };

  const roleColor = (role: string) => {
    switch (role) {
      case 'salon_admin': return 'bg-info/10 text-info';
      case 'super_admin': return 'bg-primary/10 text-primary';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <div>
              <CardTitle>Personel Şifre Yönetimi</CardTitle>
              <CardDescription>Salon personelinin şifrelerini yönetin</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : staffUsers.length === 0 ? (
            <div className="text-center py-8">
              <Users className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Hesabı olan personel bulunamadı</p>
              <p className="text-xs text-muted-foreground/70 mt-1">Personeli sisteme davet etmek için kayıt oluşturun</p>
            </div>
          ) : (
            <div className="space-y-2">
              {staffUsers.map(staff => (
                <div
                  key={staff.user_id}
                  className="flex items-center justify-between p-3 rounded-lg border border-border/60 hover:border-border transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center">
                      <span className="text-xs font-bold text-muted-foreground">
                        {(staff.full_name || '?')[0].toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-medium">{staff.full_name || 'İsimsiz'}</p>
                      <p className="text-xs text-muted-foreground">{staff.phone || '—'}</p>
                    </div>
                    <Badge variant="secondary" className={`text-[10px] font-semibold ${roleColor(staff.role)}`}>
                      {roleLabel(staff.role)}
                    </Badge>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openReset(staff)}
                    className="gap-1.5 text-xs h-8"
                  >
                    <Key className="h-3.5 w-3.5" /> Şifre Sıfırla
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Şifre Sıfırla</DialogTitle>
            <DialogDescription>
              {selectedStaff?.full_name || 'Personel'} için yeni şifre belirleyin
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
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
              Personele yeni şifresini bildirmeniz gerekecektir.
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
