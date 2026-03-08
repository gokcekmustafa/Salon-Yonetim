import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface SalonPermissions {
  can_manage_appointments: boolean;
  can_manage_customers: boolean;
  can_manage_staff: boolean;
  can_manage_payments: boolean;
  can_view_dashboard: boolean;
  can_manage_announcements: boolean;
  can_manage_popups: boolean;
  can_add_branches: boolean;
  can_manage_services: boolean;
  can_manage_leads: boolean;
}

const ALL_GRANTED: SalonPermissions = {
  can_manage_appointments: true,
  can_manage_customers: true,
  can_manage_staff: true,
  can_manage_payments: true,
  can_view_dashboard: true,
  can_manage_announcements: true,
  can_manage_popups: true,
  can_add_branches: true,
  can_manage_services: true,
  can_manage_leads: true,
};

export const PERMISSION_LABELS: Record<keyof SalonPermissions, string> = {
  can_manage_appointments: 'Randevu Yönetimi',
  can_manage_customers: 'Müşteri Yönetimi',
  can_manage_staff: 'Personel Yönetimi',
  can_manage_payments: 'Kasa / Ödemeler',
  can_view_dashboard: 'Panel Görüntüleme',
  can_manage_announcements: 'Duyuru Yönetimi',
  can_manage_popups: 'Popup Yönetimi',
  can_add_branches: 'Şube Ekleme',
  can_manage_services: 'Hizmet Yönetimi',
  can_manage_leads: 'Aday Müşteri Yönetimi',
};

export const PERMISSION_ICONS: Record<keyof SalonPermissions, string> = {
  can_manage_appointments: 'Calendar',
  can_manage_customers: 'Users',
  can_manage_staff: 'UserCheck',
  can_manage_payments: 'Wallet',
  can_view_dashboard: 'LayoutDashboard',
  can_manage_announcements: 'Bell',
  can_manage_popups: 'MessageSquare',
  can_add_branches: 'Building2',
  can_manage_services: 'Scissors',
  can_manage_leads: 'UserPlus',
};

export function usePermissions() {
  const { user, currentSalonId, isSuperAdmin } = useAuth();
  const [permissions, setPermissions] = useState<SalonPermissions>(ALL_GRANTED);
  const [loading, setLoading] = useState(true);

  const fetchPermissions = useCallback(async () => {
    // Super admins always have all permissions
    if (isSuperAdmin) {
      setPermissions(ALL_GRANTED);
      setLoading(false);
      return;
    }

    if (!user || !currentSalonId) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('salon_permissions')
      .select('*')
      .eq('salon_id', currentSalonId)
      .single();

    if (error || !data) {
      // If no permissions row, default all to true
      setPermissions(ALL_GRANTED);
    } else {
      setPermissions({
        can_manage_appointments: data.can_manage_appointments,
        can_manage_customers: data.can_manage_customers,
        can_manage_staff: data.can_manage_staff,
        can_manage_payments: data.can_manage_payments,
        can_view_dashboard: data.can_view_dashboard,
        can_manage_announcements: data.can_manage_announcements,
        can_manage_popups: data.can_manage_popups,
        can_add_branches: data.can_add_branches,
        can_manage_services: data.can_manage_services,
      });
    }
    setLoading(false);
  }, [user, currentSalonId, isSuperAdmin]);

  useEffect(() => { fetchPermissions(); }, [fetchPermissions]);

  const hasPermission = useCallback((key: keyof SalonPermissions): boolean => {
    if (isSuperAdmin) return true;
    return permissions[key];
  }, [permissions, isSuperAdmin]);

  return { permissions, loading, hasPermission, refetch: fetchPermissions };
}
