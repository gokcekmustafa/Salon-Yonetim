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

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') sendHeartbeat();
      else setOffline();
    };

    const handleBeforeUnload = () => {
      // Use sendBeacon for reliable offline signal
      const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/user_online_status?user_id=eq.${user.id}`;
      const body = JSON.stringify({ is_online: false, last_seen_at: new Date().toISOString() });
      navigator.sendBeacon?.(url); // best-effort
      setOffline();
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      setOffline();
    };
  }, [user, sendHeartbeat, setOffline]);
}
