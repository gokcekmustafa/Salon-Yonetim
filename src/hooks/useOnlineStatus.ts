import { useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const HEARTBEAT_INTERVAL = 30_000; // 30 seconds

export function useOnlineHeartbeat() {
  const { user, currentSalonId } = useAuth();

  const sendHeartbeat = useCallback(async () => {
    if (!user) return;

    const { error } = await supabase
      .from('user_online_status' as any)
      .upsert(
        {
          user_id: user.id,
          salon_id: currentSalonId,
          last_seen_at: new Date().toISOString(),
          is_online: true,
        },
        { onConflict: 'user_id' }
      );

    if (error) console.error('Heartbeat error:', error);
  }, [user, currentSalonId]);

  const setOffline = useCallback(async () => {
    if (!user) return;
    await supabase
      .from('user_online_status' as any)
      .update({ is_online: false, last_seen_at: new Date().toISOString() })
      .eq('user_id', user.id);
  }, [user]);

  useEffect(() => {
    if (!user) return;

    sendHeartbeat();
    const interval = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);

    const handleBeforeUnload = () => {
      setOffline();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      clearInterval(interval);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      setOffline();
    };
  }, [user, sendHeartbeat, setOffline]);
}
