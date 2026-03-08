import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { MonitorSmartphone, Plus, Loader2, Trash2, Edit, Eye, EyeOff, Link2, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format, parseISO } from 'date-fns';
import { tr } from 'date-fns/locale';

interface PopupAnnouncement {
  id: string;
  title: string;
  message: string;
  link_url: string | null;
  link_label: string | null;
  duration_seconds: number;
  is_active: boolean;
  target_type: string;
  salon_id: string | null;
  created_at: string;
}

interface PopupManagerProps {
  mode: 'super_admin' | 'salon_admin';
  salonId?: string | null;
}

export function PopupManager({ mode, salonId }: PopupManagerProps) {
  const { user } = useAuth();
  const [popups, setPopups] = useState<PopupAnnouncement[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [linkLabel, setLinkLabel] = useState('');
  const [duration, setDuration] = useState(10);

  useEffect(() => { fetchPopups(); }, [mode, salonId]);

  const fetchPopups = async () => {
    setLoading(true);
    let query = supabase.from('popup_announcements' as any).select('*').order('created_at', { ascending: false });
    if (mode === 'salon_admin' && salonId) {
      query = query.eq('salon_id', salonId);
    } else if (mode === 'super_admin') {
      query = query.is('salon_id', null);
    }
    const { data } = await query;
    setPopups((data as PopupAnnouncement[]) || []);
    setLoading(false);
  };

  const openCreate = () => {
    setEditingId(null);
    setTitle(''); setMessage(''); setLinkUrl(''); setLinkLabel(''); setDuration(10);
    setDialogOpen(true);
  };

  const openEdit = (p: PopupAnnouncement) => {
    setEditingId(p.id);
    setTitle(p.title); setMessage(p.message);
    setLinkUrl(p.link_url || ''); setLinkLabel(p.link_label || '');
    setDuration(p.duration_seconds);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!title.trim() || !message.trim() || !user) {
      toast.error('Başlık ve mesaj zorunludur');
      return;
    }
    setSaving(true);

    const payload: Record<string, unknown> = {
      title: title.trim(),
      message: message.trim(),
      link_url: linkUrl.trim() || null,
      link_label: linkLabel.trim() || null,
      duration_seconds: duration,
      is_active: true,
      target_type: mode === 'salon_admin' ? 'salon_customers' : 'all_salons',
      salon_id: mode === 'salon_admin' ? salonId : null,
      created_by: user.id,
    };

    let error;
    if (editingId) {
      ({ error } = await supabase.from('popup_announcements' as any).update(payload as any).eq('id', editingId));
    } else {
      ({ error } = await supabase.from('popup_announcements' as any).insert(payload as any));
    }

    if (error) toast.error(error.message);
    else {
      toast.success(editingId ? 'Popup güncellendi' : 'Popup oluşturuldu');
      setDialogOpen(false);
      fetchPopups();
    }
    setSaving(false);
  };

  const toggleActive = async (id: string, current: boolean) => {
    const { error } = await supabase.from('popup_announcements' as any).update({ is_active: !current } as any).eq('id', id);
    if (error) toast.error(error.message);
    else {
      setPopups(prev => prev.map(p => p.id === id ? { ...p, is_active: !current } : p));
      toast.success(!current ? 'Popup aktif edildi' : 'Popup pasif edildi');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bu popup duyurusunu silmek istediğinizden emin misiniz?')) return;
    const { error } = await supabase.from('popup_announcements' as any).delete().eq('id', id);
    if (error) toast.error(error.message);
    else { toast.success('Popup silindi'); fetchPopups(); }
  };

  return (
    <Card className="shadow-soft border-border/60">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MonitorSmartphone className="h-5 w-5 text-primary" />
            <div>
              <CardTitle>{mode === 'super_admin' ? 'Platform Popup Duyuruları' : 'Salon Popup Duyuruları'}</CardTitle>
              <CardDescription>
                {mode === 'super_admin' ? 'Tüm salon dashboard\'larında popup olarak gösterilir' : 'Salon kullanıcılarına popup duyuru gönderin'}
              </CardDescription>
            </div>
          </div>
          <Button size="sm" onClick={openCreate} className="gap-1.5 text-xs btn-gradient">
            <Plus className="h-3.5 w-3.5" /> Yeni Popup
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : popups.length === 0 ? (
          <div className="text-center py-8">
            <MonitorSmartphone className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Henüz popup duyurusu yok</p>
          </div>
        ) : (
          <div className="space-y-3">
            {popups.map(p => (
              <div key={p.id} className="p-4 rounded-xl border border-border/60 hover:border-border transition-colors group">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="text-sm font-semibold truncate">{p.title}</h4>
                      <Badge variant={p.is_active ? 'default' : 'secondary'} className="text-[10px] shrink-0">
                        {p.is_active ? 'Aktif' : 'Pasif'}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{p.message}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-[10px] text-muted-foreground/60 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {p.duration_seconds}sn
                      </span>
                      {p.link_url && (
                        <span className="text-[10px] text-primary flex items-center gap-1">
                          <Link2 className="h-3 w-3" /> {p.link_label || 'Link'}
                        </span>
                      )}
                      <span className="text-[10px] text-muted-foreground/60">
                        {format(parseISO(p.created_at), 'd MMM yyyy', { locale: tr })}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Switch checked={p.is_active} onCheckedChange={() => toggleActive(p.id, p.is_active)} />
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(p)}>
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleDelete(p.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MonitorSmartphone className="h-5 w-5 text-primary" />
              {editingId ? 'Popup Düzenle' : 'Yeni Popup'}
            </DialogTitle>
            <DialogDescription>
              {mode === 'super_admin' ? 'Tüm salonlarda gösterilecek popup' : 'Salon kullanıcılarına popup'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Başlık *</Label>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Popup başlığı" className="h-10" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Mesaj *</Label>
              <Textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="Popup içeriği..." rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Link URL (opsiyonel)</Label>
                <Input value={linkUrl} onChange={e => setLinkUrl(e.target.value)} placeholder="https://..." className="h-10" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Link Etiketi</Label>
                <Input value={linkLabel} onChange={e => setLinkLabel(e.target.value)} placeholder="Detaylar" className="h-10" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Görüntülenme Süresi (saniye)</Label>
              <Input type="number" min={3} max={60} value={duration} onChange={e => setDuration(parseInt(e.target.value) || 10)} className="h-10 w-32" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>İptal</Button>
            <Button onClick={handleSave} disabled={saving || !title.trim() || !message.trim()} className="btn-gradient">
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingId ? 'Güncelle' : 'Oluştur'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
