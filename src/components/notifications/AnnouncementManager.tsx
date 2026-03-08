import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Megaphone, Plus, Loader2, Trash2, Calendar, Users, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format, parseISO } from 'date-fns';
import { tr } from 'date-fns/locale';

interface Announcement {
  id: string;
  title: string;
  message: string;
  target_type: string;
  target_salon_ids: string[];
  scheduled_at: string;
  is_active: boolean;
  created_at: string;
  salon_id: string | null;
}

interface SalonOption {
  id: string;
  name: string;
}

interface AnnouncementManagerProps {
  mode: 'super_admin' | 'salon_admin';
  salonId?: string | null;
}

export function AnnouncementManager({ mode, salonId }: AnnouncementManagerProps) {
  const { user } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [salons, setSalons] = useState<SalonOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [targetType, setTargetType] = useState('all_salons');
  const [selectedSalonIds, setSelectedSalonIds] = useState<string[]>([]);
  const [scheduledAt, setScheduledAt] = useState('');

  useEffect(() => {
    fetchAnnouncements();
    if (mode === 'super_admin') fetchSalons();
  }, [mode, salonId]);

  const fetchSalons = async () => {
    const { data } = await supabase.from('salons').select('id, name').order('name');
    setSalons(data || []);
  };

  const fetchAnnouncements = async () => {
    setLoading(true);
    let query = supabase.from('announcements').select('*').order('created_at', { ascending: false });
    
    if (mode === 'salon_admin' && salonId) {
      query = query.eq('salon_id', salonId);
    } else if (mode === 'super_admin') {
      query = query.is('salon_id', null);
    }

    const { data } = await query;
    setAnnouncements((data as Announcement[]) || []);
    setLoading(false);
  };

  const openCreate = () => {
    setTitle('');
    setMessage('');
    setTargetType(mode === 'salon_admin' ? 'salon_customers' : 'all_salons');
    setSelectedSalonIds([]);
    setScheduledAt('');
    setDialogOpen(true);
  };

  const handleCreate = async () => {
    if (!title.trim() || !message.trim()) {
      toast.error('Başlık ve mesaj zorunludur');
      return;
    }
    if (!user) return;

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        title: title.trim(),
        message: message.trim(),
        sender_user_id: user.id,
        sender_type: mode,
        target_type: targetType,
        is_active: true,
      };

      if (mode === 'salon_admin' && salonId) {
        payload.salon_id = salonId;
        payload.target_type = 'salon_customers';
      }

      if (targetType === 'selected_salons') {
        payload.target_salon_ids = selectedSalonIds;
      }

      if (scheduledAt) {
        payload.scheduled_at = new Date(scheduledAt).toISOString();
      }

      const { error } = await supabase.from('announcements').insert(payload as any);

      if (error) {
        toast.error(error.message);
      } else {
        // Create notifications for target users
        await createNotifications(payload);
        toast.success('Duyuru oluşturuldu');
        setDialogOpen(false);
        fetchAnnouncements();
      }
    } catch {
      toast.error('Duyuru oluşturulamadı');
    }
    setSaving(false);
  };

  const createNotifications = async (announcement: Record<string, unknown>) => {
    try {
      let targetUserIds: string[] = [];

      if (announcement.target_type === 'all_salons') {
        // Get all salon members + all super admins
        const [membersRes, rolesRes] = await Promise.all([
          supabase.from('salon_members').select('user_id'),
          supabase.from('user_roles').select('user_id').eq('role', 'super_admin'),
        ]);
        const memberIds = (membersRes.data || []).map(m => m.user_id);
        const adminIds = (rolesRes.data || []).map(r => r.user_id);
        targetUserIds = [...new Set([...memberIds, ...adminIds])];
      } else if (announcement.target_type === 'selected_salons') {
        const ids = announcement.target_salon_ids as string[];
        const { data } = await supabase.from('salon_members').select('user_id').in('salon_id', ids);
        targetUserIds = [...new Set((data || []).map(m => m.user_id))];
      } else if (announcement.target_type === 'salon_customers' && salonId) {
        const { data } = await supabase.from('salon_members').select('user_id').eq('salon_id', salonId);
        targetUserIds = [...new Set((data || []).map(m => m.user_id))];
      }

      if (targetUserIds.length > 0) {
        const notifications = targetUserIds.map(uid => ({
          user_id: uid,
          title: announcement.title as string,
          message: announcement.message as string,
          type: 'announcement',
          salon_id: (announcement.salon_id as string) || null,
        }));

        await supabase.from('notifications').insert(notifications as any);
      }
    } catch (err) {
      console.error('Failed to create notifications:', err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bu duyuruyu silmek istediğinizden emin misiniz?')) return;
    const { error } = await supabase.from('announcements').delete().eq('id', id);
    if (error) toast.error(error.message);
    else { toast.success('Duyuru silindi'); fetchAnnouncements(); }
  };

  const toggleSalonSelection = (salonId: string) => {
    setSelectedSalonIds(prev =>
      prev.includes(salonId) ? prev.filter(id => id !== salonId) : [...prev, salonId]
    );
  };

  const targetLabel = (type: string) => {
    switch (type) {
      case 'all_salons': return 'Tüm Salonlar';
      case 'selected_salons': return 'Seçili Salonlar';
      case 'salon_customers': return 'Salon Müşterileri';
      default: return type;
    }
  };

  return (
    <Card className="shadow-soft border-border/60">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-primary" />
            <div>
              <CardTitle>{mode === 'super_admin' ? 'Platform Duyuruları' : 'Salon Duyuruları'}</CardTitle>
              <CardDescription>
                {mode === 'super_admin' ? 'Tüm salonlara veya seçili salonlara duyuru gönderin' : 'Salonunuzun müşterilerine duyuru gönderin'}
              </CardDescription>
            </div>
          </div>
          <Button size="sm" onClick={openCreate} className="gap-1.5 text-xs btn-gradient">
            <Plus className="h-3.5 w-3.5" /> Yeni Duyuru
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : announcements.length === 0 ? (
          <div className="text-center py-8">
            <Megaphone className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Henüz duyuru yok</p>
          </div>
        ) : (
          <div className="space-y-3">
            {announcements.map(a => (
              <div key={a.id} className="p-4 rounded-xl border border-border/60 hover:border-border transition-colors group">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="text-sm font-semibold truncate">{a.title}</h4>
                      <Badge variant="secondary" className="text-[10px] shrink-0">
                        {targetLabel(a.target_type)}
                      </Badge>
                      {!a.is_active && (
                        <Badge variant="destructive" className="text-[10px]">Pasif</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{a.message}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-[10px] text-muted-foreground/60 flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {format(parseISO(a.created_at), 'd MMM yyyy HH:mm', { locale: tr })}
                      </span>
                      {a.scheduled_at && new Date(a.scheduled_at) > new Date() && (
                        <Badge variant="outline" className="text-[10px] text-warning">
                          Planlanmış: {format(parseISO(a.scheduled_at), 'd MMM HH:mm', { locale: tr })}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                    onClick={() => handleDelete(a.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Megaphone className="h-5 w-5 text-primary" />
              Yeni Duyuru
            </DialogTitle>
            <DialogDescription>
              {mode === 'super_admin' ? 'Salonlara duyuru gönderin' : 'Müşterilerinize duyuru gönderin'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Başlık *</Label>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Duyuru başlığı" className="h-10" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Mesaj *</Label>
              <Textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="Duyuru içeriği..." rows={3} />
            </div>

            {mode === 'super_admin' && (
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Hedef</Label>
                <Select value={targetType} onValueChange={setTargetType}>
                  <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all_salons">Tüm Salonlar</SelectItem>
                    <SelectItem value="selected_salons">Seçili Salonlar</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {targetType === 'selected_salons' && (
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Salonlar</Label>
                <div className="max-h-40 overflow-y-auto space-y-2 rounded-lg border border-border/60 p-3">
                  {salons.map(s => (
                    <label key={s.id} className="flex items-center gap-2 cursor-pointer text-sm">
                      <Checkbox
                        checked={selectedSalonIds.includes(s.id)}
                        onCheckedChange={() => toggleSalonSelection(s.id)}
                      />
                      <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                      {s.name}
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-xs font-semibold">Zamanla (opsiyonel)</Label>
              <Input
                type="datetime-local"
                value={scheduledAt}
                onChange={e => setScheduledAt(e.target.value)}
                className="h-10"
              />
              <p className="text-xs text-muted-foreground">Boş bırakılırsa hemen gönderilir</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>İptal</Button>
            <Button onClick={handleCreate} disabled={saving || !title.trim() || !message.trim()} className="btn-gradient">
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Duyuru Gönder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}