import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import {
  LifeBuoy, Plus, MessageSquare, Lightbulb, AlertTriangle,
  Loader2, Clock, CheckCircle2, ArrowRight, Send,
} from 'lucide-react';

type TicketType = 'support' | 'suggestion' | 'complaint';
type TicketStatus = 'pending' | 'in_progress' | 'resolved';

interface Ticket {
  id: string;
  title: string;
  message: string;
  type: TicketType;
  status: TicketStatus;
  priority: string;
  created_at: string;
  updated_at: string;
}

interface Reply {
  id: string;
  ticket_id: string;
  user_id: string;
  user_name: string | null;
  user_role: string | null;
  message: string;
  created_at: string;
}

const typeLabels: Record<TicketType, string> = {
  support: 'Destek Talebi',
  suggestion: 'Öneri',
  complaint: 'Şikayet',
};

const typeIcons: Record<TicketType, React.ReactNode> = {
  support: <LifeBuoy className="h-4 w-4" />,
  suggestion: <Lightbulb className="h-4 w-4" />,
  complaint: <AlertTriangle className="h-4 w-4" />,
};

const typeColors: Record<TicketType, string> = {
  support: 'bg-info/10 text-info',
  suggestion: 'bg-success/10 text-success',
  complaint: 'bg-warning/10 text-warning',
};

const statusLabels: Record<TicketStatus, string> = {
  pending: 'Beklemede',
  in_progress: 'İşlemde',
  resolved: 'Çözüldü',
};

const statusColors: Record<TicketStatus, string> = {
  pending: 'bg-muted text-muted-foreground',
  in_progress: 'bg-info/10 text-info',
  resolved: 'bg-success/10 text-success',
};

const statusIcons: Record<TicketStatus, React.ReactNode> = {
  pending: <Clock className="h-3 w-3" />,
  in_progress: <ArrowRight className="h-3 w-3" />,
  resolved: <CheckCircle2 className="h-3 w-3" />,
};

export default function SupportPage() {
  const { user, currentSalonId, profile } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [repliesLoading, setRepliesLoading] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);

  // Create form
  const [formTitle, setFormTitle] = useState('');
  const [formMessage, setFormMessage] = useState('');
  const [formType, setFormType] = useState<TicketType>('support');
  const [creating, setCreating] = useState(false);

  const [activeTab, setActiveTab] = useState<string>('all');
  const [createTab, setCreateTab] = useState<TicketType>('support');

  const fetchTickets = async () => {
    if (!currentSalonId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('support_tickets')
      .select('*')
      .eq('salon_id', currentSalonId)
      .order('created_at', { ascending: false });
    if (!error) setTickets((data as any) || []);
    setLoading(false);
  };

  useEffect(() => { fetchTickets(); }, [currentSalonId]);

  const handleCreate = async () => {
    if (!formTitle.trim() || !formMessage.trim() || !currentSalonId || !user) return;
    setCreating(true);
    const { error } = await supabase.from('support_tickets').insert({
      salon_id: currentSalonId,
      created_by: user.id,
      title: formTitle.trim(),
      message: formMessage.trim(),
      type: formType,
    } as any);
    if (error) {
      toast.error('Talep oluşturulamadı: ' + error.message);
    } else {
      toast.success(formType === 'support' ? 'Destek talebiniz gönderildi' : formType === 'suggestion' ? 'Öneriniz başarıyla iletildi' : 'Şikayetiniz başarıyla iletildi');
      setCreateOpen(false);
      setFormTitle('');
      setFormMessage('');
      setFormType('support');
      setCreateTab('support');
      fetchTickets();
    }
    setCreating(false);
  };

  const openDetail = async (ticket: Ticket) => {
    setSelectedTicket(ticket);
    setDetailOpen(true);
    setRepliesLoading(true);
    setReplyText('');
    const { data } = await supabase
      .from('ticket_replies')
      .select('*')
      .eq('ticket_id', ticket.id)
      .order('created_at', { ascending: true });
    setReplies((data as any) || []);
    setRepliesLoading(false);
  };

  const handleReply = async () => {
    if (!replyText.trim() || !selectedTicket || !user) return;
    setSending(true);
    const { error } = await supabase.from('ticket_replies').insert({
      ticket_id: selectedTicket.id,
      user_id: user.id,
      user_name: profile?.full_name || user.email || '',
      user_role: 'salon_admin',
      message: replyText.trim(),
    } as any);
    if (error) {
      toast.error('Mesaj gönderilemedi');
    } else {
      setReplyText('');
      const { data } = await supabase
        .from('ticket_replies')
        .select('*')
        .eq('ticket_id', selectedTicket.id)
        .order('created_at', { ascending: true });
      setReplies((data as any) || []);
    }
    setSending(false);
  };

  const filtered = activeTab === 'all'
    ? tickets
    : tickets.filter(t => t.type === activeTab);

  const counts = {
    all: tickets.length,
    support: tickets.filter(t => t.type === 'support').length,
    suggestion: tickets.filter(t => t.type === 'suggestion').length,
    complaint: tickets.filter(t => t.type === 'complaint').length,
  };

  return (
    <div className="page-container animate-in">
      {/* Header */}
      <div className="rounded-2xl p-6 lg:p-8 border border-border/40" style={{ background: 'var(--gradient-hero)' }}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl btn-gradient flex items-center justify-center">
              <LifeBuoy className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Destek & İletişim</h1>
              <p className="text-sm text-muted-foreground mt-0.5">Destek talepleri, öneri ve şikayetlerinizi yönetin</p>
            </div>
          </div>
          <Button onClick={() => setCreateOpen(true)} className="gap-2 btn-gradient h-10 px-5 rounded-xl">
            <Plus className="h-4 w-4" /> Yeni Talep
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Toplam', value: counts.all, icon: MessageSquare, color: 'text-primary bg-primary/10' },
          { label: 'Destek', value: counts.support, icon: LifeBuoy, color: 'text-info bg-info/10' },
          { label: 'Öneri', value: counts.suggestion, icon: Lightbulb, color: 'text-success bg-success/10' },
          { label: 'Şikayet', value: counts.complaint, icon: AlertTriangle, color: 'text-warning bg-warning/10' },
        ].map(stat => (
          <div key={stat.label} className="stat-card p-4">
            <div className="flex items-center gap-3">
              <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${stat.color}`}><stat.icon className="h-5 w-5" /></div>
              <div>
                <p className="text-2xl font-bold tabular-nums">{stat.value}</p>
                <p className="text-[11px] text-muted-foreground font-medium">{stat.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs & Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">Tümü ({counts.all})</TabsTrigger>
          <TabsTrigger value="support">Destek ({counts.support})</TabsTrigger>
          <TabsTrigger value="suggestion">Öneri ({counts.suggestion})</TabsTrigger>
          <TabsTrigger value="complaint">Şikayet ({counts.complaint})</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16">
              <LifeBuoy className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground font-medium">Henüz talep bulunmuyor</p>
              <Button onClick={() => setCreateOpen(true)} variant="outline" className="mt-4 gap-2"><Plus className="h-4 w-4" /> İlk Talebi Oluştur</Button>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map(ticket => (
                <Card key={ticket.id} className="shadow-soft border-border/60 hover:shadow-md transition-shadow cursor-pointer" onClick={() => openDetail(ticket)}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${typeColors[ticket.type]}`}>
                          {typeIcons[ticket.type]}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-sm truncate">{ticket.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{ticket.message}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant="secondary" className={`text-[10px] font-semibold ${typeColors[ticket.type]}`}>
                              {typeLabels[ticket.type]}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground">
                              {new Date(ticket.created_at).toLocaleDateString('tr-TR')}
                            </span>
                          </div>
                        </div>
                      </div>
                      <Badge variant="secondary" className={`text-[10px] font-semibold gap-1 shrink-0 ${statusColors[ticket.status]}`}>
                        {statusIcons[ticket.status]}
                        {statusLabels[ticket.status]}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-primary" />
              Yeni Mesaj Oluştur
            </DialogTitle>
            <DialogDescription>Destek talebi, öneri ve şikayet formlarından birini doldurun</DialogDescription>
          </DialogHeader>
          <Tabs
            value={createTab}
            onValueChange={(value) => {
              const nextType = value as TicketType;
              setCreateTab(nextType);
              setFormType(nextType);
            }}
            className="space-y-4"
          >
            <TabsList className="grid h-auto w-full grid-cols-3">
              <TabsTrigger value="support">Destek Talebi</TabsTrigger>
              <TabsTrigger value="suggestion">Öneri</TabsTrigger>
              <TabsTrigger value="complaint">Şikayet</TabsTrigger>
            </TabsList>

            {(['support', 'suggestion', 'complaint'] as TicketType[]).map((type) => (
              <TabsContent key={type} value={type} className="space-y-4 mt-0">
                <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    {typeIcons[type]}
                    {typeLabels[type]} Formu
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {type === 'support' && 'Sorununuzu iletin; destek ekibi sizinle bu kayıt üzerinden ilgilensin.'}
                    {type === 'suggestion' && 'Geliştirme fikirlerinizi gönderin; superadmin panelinde doğrudan görünsün.'}
                    {type === 'complaint' && 'Yaşadığınız sorunu detaylı aktarın; çözüm süreci kayıt altına alınsın.'}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-semibold">Başlık *</Label>
                  <Input
                    value={createTab === type ? formTitle : ''}
                    onChange={e => {
                      setCreateTab(type);
                      setFormType(type);
                      setFormTitle(e.target.value);
                    }}
                    placeholder="Konu başlığı..."
                    className="h-10"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-semibold">Mesaj *</Label>
                  <Textarea
                    value={createTab === type ? formMessage : ''}
                    onChange={e => {
                      setCreateTab(type);
                      setFormType(type);
                      setFormMessage(e.target.value);
                    }}
                    placeholder="Detaylı açıklama yazın..."
                    rows={5}
                  />
                </div>
              </TabsContent>
            ))}
          </Tabs>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>İptal</Button>
            <Button onClick={handleCreate} disabled={creating || !formTitle.trim() || !formMessage.trim()} className="btn-gradient">
              {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Gönder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedTicket && typeIcons[selectedTicket.type]}
              <span className="truncate">{selectedTicket?.title}</span>
            </DialogTitle>
            <DialogDescription className="flex items-center gap-2">
              {selectedTicket && (
                <>
                  <Badge variant="secondary" className={`text-[10px] font-semibold ${typeColors[selectedTicket.type]}`}>
                    {typeLabels[selectedTicket.type]}
                  </Badge>
                  <Badge variant="secondary" className={`text-[10px] font-semibold gap-1 ${statusColors[selectedTicket.status]}`}>
                    {statusIcons[selectedTicket.status]}
                    {statusLabels[selectedTicket.status]}
                  </Badge>
                  <span className="text-[10px]">
                    {new Date(selectedTicket.created_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {/* Original message */}
          <div className="p-3 rounded-lg bg-muted/50 border border-border text-sm">
            {selectedTicket?.message}
          </div>

          {/* Replies */}
          <ScrollArea className="flex-1 max-h-[300px]">
            <div className="space-y-3 pr-2">
              {repliesLoading ? (
                <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
              ) : replies.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">Henüz yanıt yok</p>
              ) : (
                replies.map(reply => (
                  <div key={reply.id} className={`p-3 rounded-lg text-sm ${reply.user_role === 'super_admin' || reply.user_role === 'platform_staff' ? 'bg-primary/5 border border-primary/20 ml-4' : 'bg-muted/50 border border-border mr-4'}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold">{reply.user_name || 'Kullanıcı'}</span>
                      {(reply.user_role === 'super_admin' || reply.user_role === 'platform_staff') && (
                        <Badge variant="secondary" className="text-[9px] bg-primary/10 text-primary">Destek Ekibi</Badge>
                      )}
                      <span className="text-[10px] text-muted-foreground ml-auto">
                        {new Date(reply.created_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-sm">{reply.message}</p>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>

          {/* Reply input */}
          {selectedTicket?.status !== 'resolved' && (
            <div className="flex gap-2 pt-2 border-t">
              <Input
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                placeholder="Yanıt yazın..."
                className="h-10 flex-1"
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleReply()}
              />
              <Button onClick={handleReply} disabled={sending || !replyText.trim()} size="icon" className="h-10 w-10 shrink-0">
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
