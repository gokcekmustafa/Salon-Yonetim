import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ShieldCheck, Loader2, Settings2, Users } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { PLATFORM_PERMISSION_LABELS, type PlatformPermissions } from '@/hooks/usePlatformPermissions';

interface HelperUser {
  user_id: string;
  full_name: string | null;
  email: string;
  permissions: PlatformPermissions & { id: string };
}

const ALL_KEYS = Object.keys(PLATFORM_PERMISSION_LABELS) as (keyof PlatformPermissions)[];

export function PlatformStaffManager() {
  const [helpers, setHelpers] = useState<HelperUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedHelper, setSelectedHelper] = useState<HelperUser | null>(null);
  const [editPerms, setEditPerms] = useState<PlatformPermissions | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchHelpers = async () => {
    setLoading(true);
    try {
      // Get all platform_staff_permissions entries
      const { data: permsData, error } = await supabase
        .from('platform_staff_permissions')
        .select('*')
        .eq('is_helper', true);

      if (error || !permsData || permsData.length === 0) {
        setHelpers([]);
        setLoading(false);
        return;
      }

      // Get user info via edge function
      const res = await supabase.functions.invoke('manage-passwords', {
        body: { action: 'list_users' },
      });

      const allUsers = res.data?.users || [];

      const helperList: HelperUser[] = permsData.map((p: any) => {
        const user = allUsers.find((u: any) => u.id === p.user_id);
        return {
          user_id: p.user_id,
          full_name: user?.full_name || null,
          email: user?.email || '—',
          permissions: {
            id: p.id,
            can_manage_salons: p.can_manage_salons,
            can_manage_users: p.can_manage_users,
            can_manage_announcements: p.can_manage_announcements,
            can_manage_popups: p.can_manage_popups,
            can_view_audit_logs: p.can_view_audit_logs,
            can_manage_data: p.can_manage_data,
            can_manage_settings: p.can_manage_settings,
            can_view_reports: p.can_view_reports,
          },
        };
      });

      setHelpers(helperList);
    } catch {
      toast.error('Platform personelleri yüklenemedi');
    }
    setLoading(false);
  };

  useEffect(() => { fetchHelpers(); }, []);

  const openEdit = (helper: HelperUser) => {
    setSelectedHelper(helper);
    const { id, ...perms } = helper.permissions;
    setEditPerms(perms);
    setEditDialogOpen(true);
  };

  const handleSave = async () => {
    if (!selectedHelper || !editPerms) return;
    setSaving(true);

    const { error } = await supabase
      .from('platform_staff_permissions')
      .update({
        ...editPerms,
        updated_at: new Date().toISOString(),
      } as any)
      .eq('id', selectedHelper.permissions.id);

    if (error) {
      toast.error('İzinler kaydedilemedi: ' + error.message);
    } else {
      toast.success(`${selectedHelper.full_name || selectedHelper.email} izinleri güncellendi`);
      setEditDialogOpen(false);
      fetchHelpers();
    }
    setSaving(false);
  };

  const handleRemoveHelper = async (helper: HelperUser) => {
    if (!confirm(`"${helper.full_name || helper.email}" yardımcı personel yetkisini kaldırmak istediğinizden emin misiniz?`)) return;

    const { error } = await supabase
      .from('platform_staff_permissions')
      .delete()
      .eq('id', helper.permissions.id);

    if (error) {
      toast.error('Yetki kaldırılamadı');
    } else {
      toast.success('Yardımcı personel yetkisi kaldırıldı');
      fetchHelpers();
    }
  };

  const activeCount = (perms: PlatformPermissions) =>
    ALL_KEYS.filter(k => perms[k]).length;

  return (
    <>
      <Card className="shadow-soft border-border/60">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <div>
                <CardTitle>Platform Yardımcı Personelleri</CardTitle>
                <CardDescription>Super admin yardımcılarının yetkilerini yönetin</CardDescription>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={fetchHelpers} disabled={loading} className="gap-1.5 text-xs">
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Users className="h-3.5 w-3.5" />}
              Yenile
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : helpers.length === 0 ? (
            <div className="text-center py-8">
              <Users className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Henüz yardımcı personel eklenmemiş</p>
              <p className="text-xs text-muted-foreground mt-1">
                Kullanıcı Yönetimi'nden bir kullanıcıyı "Super Admin" rolüyle oluşturun,<br />
                ardından burada yetkileri otomatik olarak görünecektir.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border/60">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="font-semibold">Personel</TableHead>
                    <TableHead className="font-semibold">Yetkiler</TableHead>
                    <TableHead className="w-24"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {helpers.map(helper => (
                    <TableRow key={helper.user_id} className="group">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <span className="text-xs font-bold text-primary">
                              {(helper.full_name || helper.email || '?')[0].toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <p className="text-sm font-medium">{helper.full_name || '—'}</p>
                            <p className="text-xs text-muted-foreground">{helper.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">
                          {activeCount(helper.permissions)}/{ALL_KEYS.length} yetki aktif
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(helper)} className="h-8 w-8" title="Yetkileri Düzenle">
                            <Settings2 className="h-4 w-4" />
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

      {/* Edit Permissions Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Yetki Yönetimi
            </DialogTitle>
            <DialogDescription>
              <span className="font-semibold text-foreground">{selectedHelper?.full_name || selectedHelper?.email}</span> için platform yetkilerini düzenleyin
            </DialogDescription>
          </DialogHeader>

          {editPerms && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Badge variant="outline" className="text-xs">
                  {activeCount(editPerms)}/{ALL_KEYS.length} yetki aktif
                </Badge>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => {
                    const all = {} as PlatformPermissions;
                    ALL_KEYS.forEach(k => { all[k] = true; });
                    setEditPerms(all);
                  }}>Tümünü Aç</Button>
                  <Button variant="ghost" size="sm" className="text-xs h-7 text-destructive hover:text-destructive" onClick={() => {
                    const all = {} as PlatformPermissions;
                    ALL_KEYS.forEach(k => { all[k] = false; });
                    setEditPerms(all);
                  }}>Tümünü Kapat</Button>
                </div>
              </div>

              <div className="space-y-1">
                {ALL_KEYS.map(key => (
                  <div key={key} className="flex items-center justify-between p-3 rounded-lg border border-border/60 hover:bg-muted/30 transition-colors">
                    <Label className="text-sm font-medium cursor-pointer">{PLATFORM_PERMISSION_LABELS[key]}</Label>
                    <Switch
                      checked={editPerms[key]}
                      onCheckedChange={() => setEditPerms({ ...editPerms, [key]: !editPerms[key] })}
                    />
                  </div>
                ))}
              </div>

              <Button onClick={handleSave} disabled={saving} className="w-full gap-2">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Yetkileri Kaydet
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
