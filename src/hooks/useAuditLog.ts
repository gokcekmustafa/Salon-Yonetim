import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCallback } from 'react';
import { useSalonData } from '@/hooks/useSalonData';

interface AuditLogEntry {
  action: string;
  target_type: string;
  target_id?: string;
  target_label?: string;
  details?: Record<string, any>;
}

export function useAuditLog() {
  const { user, profile, roles, currentSalonId } = useAuth();
  const { salon } = useSalonData();

  const logAction = useCallback(async (entry: AuditLogEntry) => {
    if (!user) return;

    const roleName = roles.includes('super_admin')
      ? 'Super Admin'
      : roles.includes('salon_admin')
      ? 'Salon Admin'
      : 'Personel';

    await supabase.from('audit_logs').insert({
      user_id: user.id,
      user_name: profile?.full_name || user.email || 'Bilinmiyor',
      user_role: roleName,
      salon_id: currentSalonId,
      salon_name: salon?.name || null,
      action: entry.action,
      target_type: entry.target_type,
      target_id: entry.target_id || null,
      target_label: entry.target_label || null,
      details: entry.details || {},
    });
  }, [user, profile, roles, currentSalonId, salon]);

  return { logAction };
}
