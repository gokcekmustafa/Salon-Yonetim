import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Users, Circle, Clock, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';

interface OnlineUser {
  user_id: string;
  salon_id: string | null;
  last_seen_at: string;
  is_online: boolean;
  profile_name?: string;
  role_name?: string;
  salon_name?: string;
}

export function OnlineUsersPanel() {
  const [users, setUsers] = useState<OnlineUser[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOnlineUsers = async () => {
    setLoading(true);
    // Fetch online statuses
    const { data: statusData } = await supabase
      .from('user_online_status' as any)
      .select('*')
      .order('last_seen_at', { ascending: false });

    if (!statusData || statusData.length === 0) {
      setUsers([]);
      setLoading(false);
      return;
    }

    const userIds = (statusData as any[]).map((s: any) => s.user_id);
    const salonIds = (statusData as any[]).map((s: any) => s.salon_id).filter(Boolean);

    // Fetch profiles and roles in parallel
    const [profilesRes, rolesRes, salonsRes] = await Promise.all([
      supabase.from('profiles').select('user_id, full_name').in('user_id', userIds),
      supabase.from('user_roles').select('user_id, role').in('user_id', userIds),
      salonIds.length > 0
        ? supabase.from('salons').select('id, name').in('id', salonIds)
        : Promise.resolve({ data: [] }),
    ]);

    const profileMap = new Map((profilesRes.data || []).map(p => [p.user_id, p.full_name]));
    const roleMap = new Map((rolesRes.data || []).map(r => [r.user_id, r.role]));
    const salonMap = new Map(((salonsRes as any).data || []).map((s: any) => [s.id, s.name]));

    const roleLabels: Record<string, string> = {
      super_admin: 'Super Admin',
      salon_admin: 'Salon Admin',
      staff: 'Personel',
    };

    const enriched: OnlineUser[] = (statusData as any[]).map((s: any) => ({
      user_id: s.user_id,
      salon_id: s.salon_id,
      last_seen_at: s.last_seen_at,
      is_online: s.is_online,
      profile_name: profileMap.get(s.user_id) || 'Bilinmiyor',
      role_name: roleLabels[roleMap.get(s.user_id) || ''] || 'Kullanıcı',
      salon_name: s.salon_id ? salonMap.get(s.salon_id) || '-' : '-',
    }));

    setUsers(enriched);
    setLoading(false);
  };

  useEffect(() => {
    fetchOnlineUsers();
    const interval = setInterval(fetchOnlineUsers, 30_000);
    return () => clearInterval(interval);
  }, []);

  const onlineCount = users.filter(u => u.is_online).length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <div>
              <CardTitle className="text-lg">Çevrimiçi Kullanıcılar</CardTitle>
              <CardDescription>{onlineCount} kullanıcı aktif</CardDescription>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={fetchOnlineUsers} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {users.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">Henüz çevrimiçi kullanıcı yok</p>
        ) : (
          <div className="space-y-3">
            {users.map((u) => {
              const initials = (u.profile_name || 'U').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
              const isRecent = u.is_online || (Date.now() - new Date(u.last_seen_at).getTime() < 60_000);
              return (
                <div key={u.user_id} className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors">
                  <div className="relative">
                    <Avatar className="h-9 w-9">
                      <AvatarFallback className="text-xs font-semibold bg-primary/10 text-primary">{initials}</AvatarFallback>
                    </Avatar>
                    <Circle
                      className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 ${isRecent ? 'fill-emerald-500 text-emerald-500' : 'fill-muted-foreground/40 text-muted-foreground/40'}`}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{u.profile_name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">{u.role_name}</Badge>
                      {u.salon_name !== '-' && (
                        <span className="text-[10px] text-muted-foreground truncate">{u.salon_name}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground shrink-0">
                    <Clock className="h-3 w-3" />
                    {formatDistanceToNow(new Date(u.last_seen_at), { addSuffix: true, locale: tr })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
