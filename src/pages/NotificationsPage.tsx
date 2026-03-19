import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Megaphone, AlertTriangle, Info, CheckCheck, ArrowLeft, Clock, Circle, ClipboardList, LifeBuoy, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format, formatDistanceToNow, parseISO } from 'date-fns';
import { tr } from 'date-fns/locale';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
  salon_id: string | null;
}

const getNotificationRoute = (type: string): string | null => {
  switch (type) {
    case 'registration': return '/admin/salonlar';
    case 'ticket': return '/admin/salonlar';
    case 'subscription_alert': return '/admin/salonlar';
    default: return null;
  }
};

export default function NotificationsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(200);
    setNotifications((data as Notification[]) || []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Realtime
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('notifications-page')
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        setNotifications(prev => [payload.new as Notification, ...prev]);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const selected = notifications.find(n => n.id === selectedId) || null;

  const openNotification = async (n: Notification) => {
    setSelectedId(n.id);
    if (!n.is_read) {
      await supabase.from('notifications').update({ is_read: true }).eq('id', n.id);
      setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, is_read: true } : x));
    }
  };

  const markAllAsRead = async () => {
    if (!user) return;
    const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id);
    if (unreadIds.length === 0) return;
    await supabase.from('notifications').update({ is_read: true }).in('id', unreadIds);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const typeIcon = (type: string, size = 'h-4 w-4') => {
    switch (type) {
      case 'subscription_alert': return <AlertTriangle className={`${size} text-warning`} />;
      case 'announcement': return <Megaphone className={`${size} text-primary`} />;
      default: return <Info className={`${size} text-info`} />;
    }
  };

  const typeLabel = (type: string) => {
    switch (type) {
      case 'subscription_alert': return 'Abonelik Uyarısı';
      case 'announcement': return 'Duyuru';
      default: return 'Bildirim';
    }
  };

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border/60 shrink-0">
        <div className="flex items-center gap-3">
          <Bell className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-bold">Bildirimler</h1>
          {unreadCount > 0 && (
            <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
              {unreadCount} okunmamış
            </Badge>
          )}
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={markAllAsRead}>
            <CheckCheck className="h-3.5 w-3.5" /> Tümünü Okundu İşaretle
          </Button>
        )}
      </div>

      {/* Mail-like split layout */}
      <div className="flex-1 flex min-h-0">
        {/* Left: notification list */}
        <div className={`border-r border-border/60 flex flex-col ${selected ? 'hidden md:flex md:w-[340px] lg:w-[380px]' : 'w-full'} shrink-0`}>
          <ScrollArea className="flex-1">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <Bell className="h-10 w-10 mb-3 opacity-30" />
                <p className="text-sm">Henüz bildirim yok</p>
              </div>
            ) : (
              <div className="divide-y divide-border/40">
                {notifications.map(n => (
                  <button
                    key={n.id}
                    onClick={() => openNotification(n)}
                    className={`w-full text-left px-4 py-3.5 transition-colors flex items-start gap-3 hover:bg-muted/50
                      ${selectedId === n.id ? 'bg-accent/60' : ''}
                      ${!n.is_read ? 'bg-primary/5' : ''}`}
                  >
                    <div className="shrink-0 mt-0.5">{typeIcon(n.type)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={`text-sm truncate ${!n.is_read ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>
                          {n.title}
                        </p>
                        {!n.is_read && <Circle className="h-2 w-2 fill-primary text-primary shrink-0" />}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{n.message}</p>
                      <p className="text-[10px] text-muted-foreground/60 mt-1">
                        {formatDistanceToNow(parseISO(n.created_at), { addSuffix: true, locale: tr })}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Right: reading pane */}
        <div className={`flex-1 flex flex-col ${!selected ? 'hidden md:flex' : ''}`}>
          {selected ? (
            <>
              {/* Back button (mobile) */}
              <div className="md:hidden px-4 py-2 border-b border-border/60">
                <Button variant="ghost" size="sm" className="gap-1.5 text-xs" onClick={() => setSelectedId(null)}>
                  <ArrowLeft className="h-3.5 w-3.5" /> Geri
                </Button>
              </div>

              <ScrollArea className="flex-1">
                <div className="max-w-2xl mx-auto px-6 py-8">
                  {/* Type badge */}
                  <div className="flex items-center gap-2 mb-4">
                    {typeIcon(selected.type, 'h-5 w-5')}
                    <Badge variant="secondary" className="text-[10px]">
                      {typeLabel(selected.type)}
                    </Badge>
                  </div>

                  {/* Title */}
                  <h2 className="text-xl font-bold text-foreground mb-2">{selected.title}</h2>

                  {/* Meta */}
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mb-6">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {format(parseISO(selected.created_at), 'd MMMM yyyy, HH:mm', { locale: tr })}
                    </span>
                  </div>

                  {/* Divider */}
                  <div className="h-px bg-border/60 mb-6" />

                  {/* Body */}
                  <div className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                    {selected.message}
                  </div>
                </div>
              </ScrollArea>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
              <Bell className="h-12 w-12 mb-3 opacity-20" />
              <p className="text-sm">Okumak için bir bildirim seçin</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
