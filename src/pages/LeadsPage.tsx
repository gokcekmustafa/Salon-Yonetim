import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { NoPermission } from '@/components/permissions/NoPermission';
import { useSalonData } from '@/hooks/useSalonData';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { tr } from 'date-fns/locale';
import {
  Plus, Search, UserPlus, Phone, Mail, MessageSquare, Loader2, StickyNote,
  ArrowRightLeft, ChevronRight, Trash2, Send, Handshake, XCircle, Eye, Clock
} from 'lucide-react';

type LeadStatus = 'new' | 'contacted' | 'proposal_sent' | 'negotiation' | 'won' | 'lost';

type Lead = {
  id: string; salon_id: string; name: string; email: string | null;
  phone: string | null; status: LeadStatus; source: string | null;
  notes_summary: string | null; created_by: string;
  converted_customer_id: string | null;
  assigned_staff_id: string | null;
  created_at: string; updated_at: string;
};

type LeadNote = {
  id: string; lead_id: string; salon_id: string; content: string;
  note_type: string; created_by: string; created_at: string;
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  new: { label: 'Yeni', color: 'bg-info/10 text-info border-info/20', icon: <UserPlus className="h-3 w-3" /> },
  contacted: { label: 'İletişime Geçildi', color: 'bg-warning/10 text-warning border-warning/20', icon: <Phone className="h-3 w-3" /> },
  proposal_sent: { label: 'Teklif Gönderildi', color: 'bg-primary/10 text-primary border-primary/20', icon: <Send className="h-3 w-3" /> },
  negotiation: { label: 'Görüşme', color: 'bg-info/10 text-info border-info/20', icon: <Handshake className="h-3 w-3" /> },
  won: { label: 'Kazanıldı', color: 'bg-success/10 text-success border-success/20', icon: <ArrowRightLeft className="h-3 w-3" /> },
  lost: { label: 'Kaybedildi', color: 'bg-destructive/10 text-destructive border-destructive/20', icon: <XCircle className="h-3 w-3" /> },
};

const NOTE_TYPES = [
  { value: 'general', label: 'Genel Not' },
  { value: 'meeting', label: 'Görüşme Detayı' },
  { value: 'proposal', label: 'Teklif / Öneri' },
  { value: 'important', label: 'Önemli Bilgi' },
];

const NOTE_TYPE_COLORS: Record<string, string> = {
  general: 'bg-muted text-muted-foreground',
  meeting: 'bg-info/10 text-info',
  proposal: 'bg-primary/10 text-primary',
  important: 'bg-warning/10 text-warning',
};

export default function LeadsPage() {
  const { hasPermission } = usePermissions();
  const { user, currentSalonId, isSuperAdmin } = useAuth();
  const { addCustomer, staff: salonStaff } = useSalonData();

  const activeStaff = salonStaff.filter(s => s.is_active);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [notes, setNotes] = useState<LeadNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [staffFilter, setStaffFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Create/Edit lead dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Lead | null>(null);
  const [form, setForm] = useState({ name: '', email: '', phone: '', source: '', status: 'new' as LeadStatus });
  const [saving, setSaving] = useState(false);

  // Detail sheet
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Note form
  const [noteContent, setNoteContent] = useState('');
  const [noteType, setNoteType] = useState('general');
  const [addingNote, setAddingNote] = useState(false);

  const salonId = currentSalonId;

  const fetchLeads = async () => {
    setLoading(true);
    let query = supabase.from('leads').select('*').order('created_at', { ascending: false });
    if (!isSuperAdmin && salonId) query = query.eq('salon_id', salonId);
    const { data } = await query;
    setLeads((data as Lead[]) || []);
    setLoading(false);
  };

  const fetchNotes = async (leadId: string) => {
    const { data } = await supabase
      .from('lead_notes')
      .select('*')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false });
    setNotes((data as LeadNote[]) || []);
  };

  useEffect(() => { fetchLeads(); }, [salonId, isSuperAdmin]);

  if (!hasPermission('can_manage_leads')) return <NoPermission feature="Aday Müşteri Yönetimi" />;

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', email: '', phone: '', source: '', status: 'new' });
    setDialogOpen(true);
  };

  const openEdit = (lead: Lead) => {
    setEditing(lead);
    setForm({
      name: lead.name,
      email: lead.email || '',
      phone: lead.phone || '',
      source: lead.source || '',
      status: lead.status,
    });
    setDialogOpen(true);
  };

  const openDetail = (lead: Lead) => {
    setSelectedLead(lead);
    fetchNotes(lead.id);
    setNoteContent('');
    setNoteType('general');
    setSheetOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('İsim zorunludur'); return; }
    if (!salonId || !user) return;
    setSaving(true);

    const payload = {
      name: form.name.trim(),
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      source: form.source.trim() || null,
      status: form.status,
      salon_id: salonId,
      created_by: user.id,
    };

    const { error } = editing
      ? await supabase.from('leads').update(payload).eq('id', editing.id)
      : await supabase.from('leads').insert(payload);

    if (error) toast.error(error.message);
    else { toast.success(editing ? 'Aday güncellendi' : 'Yeni aday eklendi'); setDialogOpen(false); fetchLeads(); }
    setSaving(false);
  };

  const handleStatusChange = async (lead: Lead, newStatus: LeadStatus) => {
    const { error } = await supabase.from('leads').update({ status: newStatus as any }).eq('id', lead.id);
    if (!error) {
      fetchLeads();
      if (selectedLead?.id === lead.id) setSelectedLead({ ...lead, status: newStatus });
      toast.success('Durum güncellendi');
    }
  };

  const handleAddNote = async () => {
    if (!noteContent.trim() || !selectedLead || !salonId || !user) return;
    setAddingNote(true);
    const { error } = await supabase.from('lead_notes').insert({
      lead_id: selectedLead.id,
      salon_id: salonId,
      content: noteContent.trim(),
      note_type: noteType,
      created_by: user.id,
    });
    if (error) toast.error(error.message);
    else {
      toast.success('Not eklendi');
      setNoteContent('');
      setNoteType('general');
      fetchNotes(selectedLead.id);
    }
    setAddingNote(false);
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!confirm('Bu notu silmek istiyor musunuz?')) return;
    const { error } = await supabase.from('lead_notes').delete().eq('id', noteId);
    if (!error && selectedLead) { fetchNotes(selectedLead.id); toast.success('Not silindi'); }
  };

  const handleConvert = async (lead: Lead) => {
    if (!salonId) return;
    if (lead.converted_customer_id) { toast.error('Bu aday zaten müşteriye dönüştürülmüş'); return; }
    if (!confirm(`"${lead.name}" adayını müşteriye dönüştürmek istiyor musunuz?`)) return;

    const result = await addCustomer({
      name: lead.name,
      phone: lead.phone || '',
      notes: `Aday müşteriden dönüştürüldü. Kaynak: ${lead.source || '-'}`,
    });

    if (result?.error) { toast.error(result.error.message); return; }

    await supabase.from('leads').update({
      status: 'won',
      converted_customer_id: result?.id || null,
    }).eq('id', lead.id);

    toast.success('Aday müşteriye dönüştürüldü!');
    fetchLeads();
    setSheetOpen(false);
  };

  const handleDelete = async (lead: Lead) => {
    if (!confirm(`"${lead.name}" adayını silmek istiyor musunuz?`)) return;
    const { error } = await supabase.from('leads').delete().eq('id', lead.id);
    if (!error) { toast.success('Aday silindi'); fetchLeads(); setSheetOpen(false); }
  };

  const filtered = leads.filter(l => {
    const matchesSearch = l.name.toLowerCase().includes(search.toLowerCase()) ||
      (l.phone || '').includes(search) ||
      (l.email || '').toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || l.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Pipeline stats
  const statusCounts = Object.keys(STATUS_CONFIG).reduce((acc, s) => {
    acc[s] = leads.filter(l => l.status === s).length;
    return acc;
  }, {} as Record<string, number>);

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );

  return (
    <div className="page-container animate-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Aday Müşteriler</h1>
          <p className="page-subtitle">Potansiyel müşterileri yönetin ve takip edin</p>
        </div>
        <Button onClick={openCreate} className="gap-2 btn-gradient">
          <Plus className="h-4 w-4" /> Yeni Aday
        </Button>
      </div>

      {/* Pipeline Stats */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
        {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
          <button
            key={key}
            onClick={() => setStatusFilter(statusFilter === key ? 'all' : key)}
            className={`p-3 rounded-xl border text-center transition-all ${
              statusFilter === key ? 'ring-2 ring-primary/50 border-primary/30' : 'border-border/60 hover:border-border'
            }`}
          >
            <p className="text-lg font-bold tabular-nums">{statusCounts[key]}</p>
            <p className="text-[10px] font-medium text-muted-foreground">{cfg.label}</p>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Aday ara..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10 h-10" />
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <UserPlus className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground font-medium">Aday müşteri bulunmuyor</p>
          <Button onClick={openCreate} variant="outline" className="mt-4 gap-2"><Plus className="h-4 w-4" /> İlk Adayı Ekle</Button>
        </div>
      ) : (
        <Card className="shadow-soft border-border/60 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="font-semibold">Aday</TableHead>
                <TableHead className="hidden md:table-cell font-semibold">İletişim</TableHead>
                <TableHead className="font-semibold">Durum</TableHead>
                <TableHead className="hidden lg:table-cell font-semibold">Kaynak</TableHead>
                <TableHead className="hidden md:table-cell font-semibold">Tarih</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(lead => {
                const sc = STATUS_CONFIG[lead.status] || STATUS_CONFIG.new;
                return (
                  <TableRow key={lead.id} className="group cursor-pointer hover:bg-muted/30" onClick={() => openDetail(lead)}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                          <UserPlus className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <p className="font-semibold text-sm">{lead.name}</p>
                          {lead.converted_customer_id && (
                            <Badge variant="outline" className="text-[9px] mt-0.5 bg-success/10 text-success border-success/20">Dönüştürüldü</Badge>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div className="space-y-0.5">
                        {lead.phone && <p className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" />{lead.phone}</p>}
                        {lead.email && <p className="text-xs text-muted-foreground flex items-center gap-1"><Mail className="h-3 w-3" />{lead.email}</p>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-[10px] font-semibold gap-1 ${sc.color}`}>
                        {sc.icon} {sc.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <span className="text-xs text-muted-foreground">{lead.source || '—'}</span>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <span className="text-xs text-muted-foreground">
                        {format(parseISO(lead.created_at), 'd MMM yyyy', { locale: tr })}
                      </span>
                    </TableCell>
                    <TableCell>
                      <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Aday Düzenle' : 'Yeni Aday Ekle'}</DialogTitle>
            <DialogDescription>Potansiyel müşteri bilgilerini girin</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-semibold">İsim *</Label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Müşteri adı" className="h-10" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Telefon</Label>
                <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="05XX XXX XXXX" className="h-10" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold">E-posta</Label>
                <Input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="email@ornek.com" className="h-10" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Kaynak</Label>
                <Input value={form.source} onChange={e => setForm({ ...form, source: e.target.value })} placeholder="Instagram, Referans..." className="h-10" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Durum</Label>
                <Select value={form.status} onValueChange={v => setForm({ ...form, status: v as LeadStatus })}>
                  <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>İptal</Button>
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editing ? 'Güncelle' : 'Ekle'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lead Detail Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          {selectedLead && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <UserPlus className="h-5 w-5 text-primary" />
                  {selectedLead.name}
                </SheetTitle>
                <SheetDescription>Aday detayları ve notlar</SheetDescription>
              </SheetHeader>

              <div className="mt-6 space-y-6">
                {/* Contact Info */}
                <div className="space-y-2">
                  {selectedLead.phone && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span>{selectedLead.phone}</span>
                    </div>
                  )}
                  {selectedLead.email && (
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span>{selectedLead.email}</span>
                    </div>
                  )}
                  {selectedLead.source && (
                    <div className="flex items-center gap-2 text-sm">
                      <Eye className="h-4 w-4 text-muted-foreground" />
                      <span>Kaynak: {selectedLead.source}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>{format(parseISO(selectedLead.created_at), 'd MMMM yyyy HH:mm', { locale: tr })}</span>
                  </div>
                </div>

                {/* Status */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold">Durum</Label>
                  <Select value={selectedLead.status} onValueChange={v => handleStatusChange(selectedLead, v as LeadStatus)}>
                    <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  {!selectedLead.converted_customer_id && (
                    <Button onClick={() => handleConvert(selectedLead)} variant="outline" className="gap-2 flex-1 text-success hover:text-success">
                      <ArrowRightLeft className="h-4 w-4" /> Müşteriye Dönüştür
                    </Button>
                  )}
                  <Button onClick={() => openEdit(selectedLead)} variant="outline" className="gap-2">
                    Düzenle
                  </Button>
                  <Button onClick={() => handleDelete(selectedLead)} variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                {selectedLead.converted_customer_id && (
                  <Badge className="bg-success/10 text-success border-success/20" variant="outline">
                    ✓ Müşteriye dönüştürüldü
                  </Badge>
                )}

                <Separator />

                {/* Notes Section */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <StickyNote className="h-4 w-4" /> Notlar
                  </h3>

                  {/* Add Note Form */}
                  <div className="space-y-3 p-3 rounded-lg border border-border/60 bg-muted/20">
                    <div className="flex items-center gap-2">
                      <Select value={noteType} onValueChange={setNoteType}>
                        <SelectTrigger className="h-8 w-40 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {NOTE_TYPES.map(t => (
                            <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Textarea
                      value={noteContent}
                      onChange={e => setNoteContent(e.target.value)}
                      placeholder="Not ekleyin... (görüşme detayı, teklif, önemli bilgi)"
                      rows={3}
                      className="text-sm"
                    />
                    <Button onClick={handleAddNote} disabled={addingNote || !noteContent.trim()} size="sm" className="gap-1.5">
                      {addingNote ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                      Not Ekle
                    </Button>
                  </div>

                  {/* Notes List */}
                  <div className="space-y-2">
                    {notes.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-4">Henüz not eklenmemiş</p>
                    ) : (
                      notes.map(note => (
                        <div key={note.id} className="p-3 rounded-lg border border-border/60 space-y-2">
                          <div className="flex items-center justify-between">
                            <Badge variant="secondary" className={`text-[10px] ${NOTE_TYPE_COLORS[note.note_type] || ''}`}>
                              {NOTE_TYPES.find(t => t.value === note.note_type)?.label || note.note_type}
                            </Badge>
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] text-muted-foreground">
                                {format(parseISO(note.created_at), 'd MMM HH:mm', { locale: tr })}
                              </span>
                              <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive/50 hover:text-destructive" onClick={() => handleDeleteNote(note.id)}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                          <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
