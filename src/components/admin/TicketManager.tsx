import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import {
  LifeBuoy, MessageSquare, Lightbulb, AlertTriangle,
  Loader2, Clock, CheckCircle2, ArrowRight, Send, Search,
} from 'lucide-react';

type TicketType = 'support' | 'suggestion' | 'complaint';
type TicketStatus = 'pending' | 'in_progress' | 'resolved';

interface Ticket {
  id: string;
  salon_id: string;
  created_by: string;
  assigned_to: string | null;
  title: string;
  message: string;
  type: TicketType;
  status: TicketStatus;
  priority: string;
  created_at: string;
  updated_at: string;
  salon_name?: string;
  creator_name?: string;
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

const typeLabels: Record<TicketType, string> = { support: 'Destek', suggestion: 'Öneri', complaint: 'Şikayet' };
const typeColors: Record<TicketType, string> = { support: 'bg-info/10 text-info', suggestion: 'bg-success/10 text-success', complaint: 'bg-warning/10 text-warning' };
const typeIcons: Record<TicketType, React.ReactNode> = { support: <LifeBuoy className="h-4 w-4" />, suggestion: <Lightbulb className="h-4 w-4" />, complaint: <AlertTriangle className="h-4 w-4" /> };
const statusLabels: Record<TicketStatus, string> = { pending: 'Beklemede', in_progress: 'İşlemde', resolved: 'Çözüldü' };
const statusColors: Record<TicketStatus, string> = { pending: 'bg-muted text-muted-foreground', in_progress: 'bg-info/10 text-info', resolved: 'bg-success/10 text-success' };
const statusIcons: Record<TicketStatus, React.ReactNode> = { pending: <Clock className="h-3 w-3" />, in_progress: <ArrowRight className="h-3 w-3" />, resolved: <CheckCircle2 className="h-3 w-3" /> };

export function TicketManager() {
  const { user, profile } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [repliesLoading, setRepliesLoading] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);

  const fetchTickets = async () => {
    try {
      setLoading(true);
      const { data: ticketsData, error } = await supabase
        .from('support_tickets')
        .select('*, salons(name)')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Ticket fetch error:', error);
        setTickets([]);
        setLoading(false);
        return;
      }

      if (!ticketsData || ticketsData.length === 0) {
        setTickets([]);
        setLoading(false);
        return;
      }

      // Get creator profiles
      const creatorIds = [...new Set(ticketsData.map((t: any) => t.created_by))];
      let profilesMap: Record<string, string> = {};
      
      if (creatorIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', creatorIds);
        if (profiles) {
          profiles.forEach((p: any) => { profilesMap[p.user_id] = p.full_name || '—'; });
        }
      }

      const enriched = ticketsData.map((t: any) => ({
        ...t,
        salon_name: t.salons?.name || '—',
        creator_name: profilesMap[t.created_by] || '—',
      }));
      setTickets(enriched);
    } catch (err) {
      console.error('Ticket fetch exception:', err);
      setTickets([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTickets(); }, []);

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

  const handleStatusChange = async (ticketId: string, newStatus: TicketStatus) => {
    const { error } = await supabase
      .from('support_tickets')
      .update({ status: newStatus, updated_at: new Date().toISOString() } as any)
      .eq('id', ticketId);
    if (error) {
      toast.error('Durum güncellenemedi');
    } else {
      toast.success(`Durum "${statusLabels[newStatus]}" olarak güncellendi`);
      if (selectedTicket?.id === ticketId) {
        setSelectedTicket({ ...selectedTicket, status: newStatus });
      }
      fetchTickets();
    }
  };

  const handleReply = async () => {
    if (!replyText.trim() || !selectedTicket || !user) return;
    setSending(true);
    const { error } = await supabase.from('ticket_replies').insert({
      ticket_id: selectedTicket.id,
      user_id: user.id,
      user_name: profile?.full_name || user.email || '',
      user_role: 'super_admin',
      message: replyText.trim(),
    } as any);
    if (error) {
      toast.error('Yanıt gönderilemedi');
    } else {
      setReplyText('');
      if (selectedTicket.status === 'pending') {
        await handleStatusChange(selectedTicket.id, 'in_progress');
      }
      const { data } = await supabase
        .from('ticket_replies')
        .select('*')
        .eq('ticket_id', selectedTicket.id)
        .order('created_at', { ascending: true });
      setReplies((data as any) || []);
    }
    setSending(false);
  };

  const filtered = tickets
    .filter(t => activeTab === 'all' || (activeTab === 'pending' && t.status === 'pending') || (activeTab === 'in_progress' && t.status === 'in_progress') || (activeTab === 'resolved' && t.status === 'resolved'))
    .filter(t => !search || t.title.toLowerCase().includes(search.toLowerCase()) || (t.salon_name || '').toLowerCase().includes(search.toLowerCase()));

  const counts = {
    all: tickets.length,
    pending: tickets.filter(t => t.status === 'pending').length,
    in_progress: tickets.filter(t => t.status === 'in_progress').length,
    resolved: tickets.filter(t => t.status === 'resolved').length,
  };

  return (
    <>
      <Card className="shadow-soft border-border/60">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <LifeBuoy className="h-5 w-5 text-primary" />
              <div>
                <CardTitle>Destek Talepleri</CardTitle>
                <CardDescription>Salonlardan gelen destek, öneri ve şikayetleri yönetin</CardDescription>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={fetchTickets} disabled={loading} className="gap-1.5 text-xs">
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MessageSquare className="h-3.5 w-3.5" />}
              Yenile
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Toplam', value: counts.all, color: 'text-primary' },
              { label: 'Beklemede', value: counts.pending, color: 'text-muted-foreground' },
              { label: 'İşlemde', value: counts.in_progress, color: 'text-info' },
              { label: 'Çözüldü', value: counts.resolved, color: 'text-success' },
            ].map(s => (
              <div key={s.label} className="text-center p-2 rounded-lg bg-muted/30">
                <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-[10px] text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Talep veya salon ara..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10 h-10" />
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="all">Tümü</TabsTrigger>
              <TabsTrigger value="pending">Beklemede ({counts.pending})</TabsTrigger>
              <TabsTrigger value="in_progress">İşlemde ({counts.in_progress})</TabsTrigger>
              <TabsTrigger value="resolved">Çözüldü</TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="mt-3">
              {loading ? (
                <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-12">
                  <LifeBuoy className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Talep bulunamadı</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-border/60">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="font-semibold">Talep</TableHead>
                        <TableHead className="font-semibold hidden md:table-cell">Salon</TableHead>
                        <TableHead className="font-semibold hidden lg:table-cell">Oluşturan</TableHead>
                        <TableHead className="font-semibold">Tür</TableHead>
                        <TableHead className="font-semibold">Durum</TableHead>
                        <TableHead className="font-semibold hidden md:table-cell">Tarih</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map(ticket => (
                        <TableRow key={ticket.id} className="cursor-pointer group" onClick={() => openDetail(ticket)}>
                          <TableCell>
                            <p className="text-sm font-medium truncate max-w-[200px]">{ticket.title}</p>
                            <p className="text-xs text-muted-foreground truncate max-w-[200px]">{ticket.message}</p>
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            <span className="text-sm">{ticket.salon_name}</span>
                          </TableCell>
                          <TableCell className="hidden lg:table-cell">
                            <span className="text-sm text-muted-foreground">{ticket.creator_name}</span>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className={`text-[10px] font-semibold gap-1 ${typeColors[ticket.type]}`}>
                              {typeIcons[ticket.type]}
                              {typeLabels[ticket.type]}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className={`text-[10px] font-semibold gap-1 ${statusColors[ticket.status]}`}>
                              {statusIcons[ticket.status]}
                              {statusLabels[ticket.status]}
                            </Badge>
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            <span className="text-xs text-muted-foreground">
                              {new Date(ticket.created_at).toLocaleDateString('tr-TR')}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedTicket && typeIcons[selectedTicket.type]}
              <span className="truncate">{selectedTicket?.title}</span>
            </DialogTitle>
            <DialogDescription className="flex flex-wrap items-center gap-2">
              {selectedTicket && (
                <>
                  <Badge variant="outline" className="text-[10px]">{selectedTicket.salon_name}</Badge>
                  <Badge variant="secondary" className={`text-[10px] font-semibold ${typeColors[selectedTicket.type]}`}>
                    {typeLabels[selectedTicket.type]}
                  </Badge>
                  <span className="text-[10px]">
                    {selectedTicket.creator_name} · {new Date(selectedTicket.created_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </span>
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {/* Status changer */}
          {selectedTicket && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-muted-foreground">Durum:</span>
              <Select value={selectedTicket.status} onValueChange={v => handleStatusChange(selectedTicket.id, v as TicketStatus)}>
                <SelectTrigger className="h-8 w-40 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">⏳ Beklemede</SelectItem>
                  <SelectItem value="in_progress">🔄 İşlemde</SelectItem>
                  <SelectItem value="resolved">✅ Çözüldü</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Original message */}
          <div className="p-3 rounded-lg bg-muted/50 border border-border text-sm">
            {selectedTicket?.message}
          </div>

          {/* Replies */}
          <ScrollArea className="flex-1 max-h-[250px]">
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
        </DialogContent>
      </Dialog>
    </>
  );
}
