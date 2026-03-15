import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface PlatformPermissions {
  can_manage_salons: boolean;
  can_manage_users: boolean;
  can_manage_announcements: boolean;
  can_manage_popups: boolean;
  can_view_audit_logs: boolean;
  can_manage_data: boolean;
  can_manage_settings: boolean;
  can_view_reports: boolean;
}

const ALL_GRANTED: PlatformPermissions = {
  can_manage_salons: true,
  can_manage_users: true,
  can_manage_announcements: true,
  can_manage_popups: true,
  can_view_audit_logs: true,
  can_manage_data: true,
  can_manage_settings: true,
  can_view_reports: true,
};

export const PLATFORM_PERMISSION_LABELS: Record<keyof PlatformPermissions, string> = {
  can_manage_salons: 'Salon Yönetimi',
  can_manage_users: 'Kullanıcı Yönetimi',
  can_manage_announcements: 'Duyuru Yönetimi',
  can_manage_popups: 'Popup Yönetimi',
  can_view_audit_logs: 'Denetim Kayıtları',
  can_manage_data: 'Veri İçe/Dışa Aktarma',
  can_manage_settings: 'Platform Ayarları',
  can_view_reports: 'Raporlar',
};

export function usePlatformPermissions() {
  const { user, isSuperAdmin } = useAuth();
  const [permissions, setPermissions] = useState<PlatformPermissions>(ALL_GRANTED);
  const [isHelper, setIsHelper] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchPermissions = useCallback(async () => {
    if (!user || !isSuperAdmin) {
      setPermissions(ALL_GRANTED);
      setIsHelper(false);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('platform_staff_permissions')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error || !data) {
      // No row means this is the original super admin — all permissions
      setPermissions(ALL_GRANTED);
      setIsHelper(false);
    } else {
      setIsHelper(true);
      setPermissions({
        can_manage_salons: (data as any).can_manage_salons ?? true,
        can_manage_users: (data as any).can_manage_users ?? true,
        can_manage_announcements: (data as any).can_manage_announcements ?? true,
        can_manage_popups: (data as any).can_manage_popups ?? true,
        can_view_audit_logs: (data as any).can_view_audit_logs ?? true,
        can_manage_data: (data as any).can_manage_data ?? true,
        can_manage_settings: (data as any).can_manage_settings ?? true,
        can_view_reports: (data as any).can_view_reports ?? true,
      });
    }
    setLoading(false);
  }, [user, isSuperAdmin]);

  useEffect(() => { fetchPermissions(); }, [fetchPermissions]);

  const hasPlatformPermission = useCallback((key: keyof PlatformPermissions): boolean => {
    if (!isSuperAdmin) return false;
    if (!isHelper) return true; // Original super admin
    return permissions[key];
  }, [permissions, isSuperAdmin, isHelper]);

  return { permissions, isHelper, loading, hasPlatformPermission, refetch: fetchPermissions };
}
