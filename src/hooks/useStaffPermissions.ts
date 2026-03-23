import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export const STAFF_PAGE_PERMISSIONS = [
  { key: 'page_appointments', label: 'Randevular', path: '/randevular' },
  { key: 'page_customers', label: 'Müşteriler', path: '/musteriler' },
  { key: 'page_services', label: 'Hizmetler', path: '/hizmetler' },
  { key: 'page_cash', label: 'Kasa Yönetimi', path: '/kasa' },
  { key: 'page_reports', label: 'Raporlar', path: '/raporlar' },
  { key: 'page_installments', label: 'Taksitler', path: '/taksitler' },
  { key: 'page_performance', label: 'Performans', path: '/performans' },
  { key: 'page_branches', label: 'Şubeler', path: '/subeler' },
  { key: 'page_salary', label: 'Maaş & Ödeme', path: '/maas' },
  { key: 'page_staff', label: 'Personel Yönetimi', path: '/personel' },
  { key: 'page_leads', label: 'Aday Müşteriler', path: '/adaylar' },
  { key: 'page_contracts', label: 'Sözleşmeler', path: '/sozlesmeler' },
  { key: 'page_payments', label: 'Ödemeler', path: '/kasa-yonetimi' },
  { key: 'page_rooms', label: 'Odalar', path: '/odalar' },
] as const;

export type StaffPagePermissionKey = typeof STAFF_PAGE_PERMISSIONS[number]['key'];

export function useStaffPermissions() {
  const { user, isStaff, isSuperAdmin, isSalonAdmin, currentSalonId } = useAuth();
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  const fetchPermissions = useCallback(async () => {
    // Admins always have all permissions
    if (isSuperAdmin || isSalonAdmin || !isStaff || !user || !currentSalonId) {
      setPermissions({});
      setLoading(false);
      return;
    }

    // Find staff record for this user
    const { data: staffRow } = await supabase
      .from('staff')
      .select('id')
      .eq('user_id', user.id)
      .eq('salon_id', currentSalonId)
      .maybeSingle();

    if (!staffRow) {
      setPermissions({});
      setLoading(false);
      return;
    }

    const { data: detail } = await supabase
      .from('staff_details')
      .select('permissions')
      .eq('staff_id', staffRow.id)
      .maybeSingle();

    setPermissions((detail?.permissions as Record<string, boolean>) || {});
    setLoading(false);
  }, [user, isStaff, isSuperAdmin, isSalonAdmin, currentSalonId]);

  useEffect(() => { fetchPermissions(); }, [fetchPermissions]);

  const hasPagePermission = useCallback((key: string): boolean => {
    if (isSuperAdmin || isSalonAdmin) return true;
    // If no permissions set at all, default all to true (backward compat)
    if (Object.keys(permissions).length === 0) return true;
    return permissions[key] !== false;
  }, [permissions, isSuperAdmin, isSalonAdmin]);

  return { permissions, loading, hasPagePermission, refetch: fetchPermissions };
}
