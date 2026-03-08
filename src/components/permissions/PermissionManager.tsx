import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Shield, Calendar, Users, UserCheck, Wallet, LayoutDashboard, Bell, MessageSquare, Building2, Scissors, UserPlus, Globe } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { PERMISSION_LABELS, type SalonPermissions } from '@/hooks/usePermissions';

const ICONS: Record<string, React.ReactNode> = {
  can_manage_appointments: <Calendar className="h-4 w-4" />,
  can_manage_customers: <Users className="h-4 w-4" />,
  can_manage_staff: <UserCheck className="h-4 w-4" />,
  can_manage_payments: <Wallet className="h-4 w-4" />,
  can_view_dashboard: <LayoutDashboard className="h-4 w-4" />,
  can_manage_announcements: <Bell className="h-4 w-4" />,
  can_manage_popups: <MessageSquare className="h-4 w-4" />,
  can_add_branches: <Building2 className="h-4 w-4" />,
  can_manage_services: <Scissors className="h-4 w-4" />,
  can_manage_leads: <UserPlus className="h-4 w-4" />,
};

const ALL_KEYS = Object.keys(PERMISSION_LABELS) as (keyof SalonPermissions)[];

const makeDefaults = (val: boolean): SalonPermissions => {
  const obj = {} as SalonPermissions;
  ALL_KEYS.forEach(k => { obj[k] = val; });
  return obj;
};

interface PermissionManagerProps {
  salonId: string;
  salonName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PermissionManager({ salonId, salonName, open, onOpenChange }: PermissionManagerProps) {
  const [permissions, setPermissions] = useState<SalonPermissions | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !salonId) return;
    setLoading(true);
    supabase
      .from('salon_permissions')
      .select('*')
      .eq('salon_id', salonId)
      .single()
      .then(({ data }) => {
        if (data) {
          const p = makeDefaults(true);
          ALL_KEYS.forEach(k => { p[k] = (data as any)[k] ?? true; });
          setPermissions(p);
        } else {
          setPermissions(makeDefaults(true));
        }
        setLoading(false);
      });
  }, [open, salonId]);

  const togglePermission = (key: keyof SalonPermissions) => {
    if (!permissions) return;
    setPermissions({ ...permissions, [key]: !permissions[key] });
  };

  const handleSave = async () => {
    if (!permissions) return;
    setSaving(true);

    const { error } = await supabase
      .from('salon_permissions')
      .upsert({
        salon_id: salonId,
        ...permissions,
        updated_at: new Date().toISOString(),
      } as any, { onConflict: 'salon_id' });

    if (error) {
      toast.error('İzinler kaydedilemedi: ' + error.message);
    } else {
      toast.success(`"${salonName}" izinleri güncellendi`);
      onOpenChange(false);
    }
    setSaving(false);
  };

  const activeCount = permissions
    ? Object.values(permissions).filter(Boolean).length
    : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            İzin Yönetimi
          </DialogTitle>
          <DialogDescription>
            <span className="font-semibold text-foreground">{salonName}</span> için izinleri düzenleyin
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : permissions ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Badge variant="outline" className="text-xs">
                {activeCount}/{ALL_KEYS.length} izin aktif
              </Badge>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setPermissions(makeDefaults(true))}>
                  Tümünü Aç
                </Button>
                <Button variant="ghost" size="sm" className="text-xs h-7 text-destructive hover:text-destructive" onClick={() => setPermissions(makeDefaults(false))}>
                  Tümünü Kapat
                </Button>
              </div>
            </div>

            <div className="space-y-1">
              {ALL_KEYS.map(key => (
                <div
                  key={key}
                  className="flex items-center justify-between p-3 rounded-lg border border-border/60 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${
                      permissions[key] ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                    }`}>
                      {ICONS[key] || <Shield className="h-4 w-4" />}
                    </div>
                    <Label className="text-sm font-medium cursor-pointer">{PERMISSION_LABELS[key]}</Label>
                  </div>
                  <Switch
                    checked={permissions[key]}
                    onCheckedChange={() => togglePermission(key)}
                  />
                </div>
              ))}
            </div>

            <Button onClick={handleSave} disabled={saving} className="w-full gap-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              İzinleri Kaydet
            </Button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
