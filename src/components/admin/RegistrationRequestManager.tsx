import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { ClipboardList, Check, X, Loader2, Eye, Search } from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';

type RegistrationRequest = {
  id: string;
  full_name: string;
  personal_phone: string;
  identity_number: string;
  identity_type: string;
  birth_date: string;
  email: string;
  roles: string[];
  company_name: string;
  company_phone: string;
  company_phone_secondary: string | null;
  city: string;
  district: string;
  neighborhood: string;
  address: string;
  username: string;
  status: string;
  notes: string | null;
  created_at: string;
};

const statusColors: Record<string, string> = {
  pending: 'bg-warning/10 text-warning',
  approved: 'bg-success/10 text-success',
  rejected: 'bg-destructive/10 text-destructive',
};
const statusLabels: Record<string, string> = {
  pending: 'Beklemede',
  approved: 'Onaylandı',
  rejected: 'Reddedildi',
};

export function RegistrationRequestManager() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<RegistrationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<RegistrationRequest | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [rejectNotes, setRejectNotes] = useState('');
  const [ownerPassword, setOwnerPassword] = useState('');

  const fetchRequests = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from('company_registration_requests')
      .select('*')
      .neq('status', 'approved')
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Başvurular yüklenemedi');
    } else {
      setRequests(data || []);
    }
    setLoading(false);
  };

  useEffect(() => { fetchRequests(); }, []);

  const openDetail = (req: RegistrationRequest) => {
    setSelected(req);
    setRejectNotes('');
    setOwnerPassword('Salon123!');
    setDetailOpen(true);
  };

  const handleApprove = async () => {
    if (!selected || !user) return;
    if (!ownerPassword || ownerPassword.length < 6) {
      toast.error('Sahip şifresi en az 6 karakter olmalıdır');
      return;
    }

    setApproving(true);
    try {
      // Create salon with owner via edge function
      const res = await supabase.functions.invoke('manage-passwords', {
        body: {
          action: 'create_salon_with_owner',
          salon_name: selected.company_name,
          slug: selected.username,
          phone: selected.company_phone || null,
          address: `${selected.neighborhood}, ${selected.district}, ${selected.city} - ${selected.address}`,
          subscription_plan: 'free',
          owner_email: selected.email,
          owner_password: ownerPassword,
          owner_full_name: selected.full_name,
        },
      });

      if (res.error || res.data?.error) {
        toast.error(res.data?.error || 'Salon oluşturulamadı');
        setApproving(false);
        return;
      }

      // Update request status
      await (supabase as any)
        .from('company_registration_requests')
        .update({
          status: 'approved',
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', selected.id);

      toast.success('Başvuru onaylandı ve salon oluşturuldu');
      setDetailOpen(false);
      fetchRequests();
    } catch {
      toast.error('Onay işlemi başarısız');
    }
    setApproving(false);
  };

  const handleReject = async () => {
    if (!selected || !user) return;
    setRejecting(true);

    const { error } = await (supabase as any)
      .from('company_registration_requests')
      .update({
        status: 'rejected',
        notes: rejectNotes || null,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', selected.id);

    if (error) {
      toast.error('Reddetme işlemi başarısız');
    } else {
      toast.success('Başvuru reddedildi');
      setDetailOpen(false);
      fetchRequests();
    }
    setRejecting(false);
  };

  const filtered = requests.filter(r =>
    r.company_name.toLowerCase().includes(search.toLowerCase()) ||
    r.full_name.toLowerCase().includes(search.toLowerCase()) ||
    r.email.toLowerCase().includes(search.toLowerCase())
  );

  const pendingCount = requests.filter(r => r.status === 'pending').length;

  return (
    <>
      <Card className="border-border/60">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <ClipboardList className="h-5 w-5 text-primary" />
              Firma Kayıt Başvuruları
              {pendingCount > 0 && (
                <Badge variant="secondary" className="bg-warning/10 text-warning text-xs">
                  {pendingCount} beklemede
                </Badge>
              )}
            </CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Ara..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Başvuru bulunamadı</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Firma</TableHead>
                  <TableHead>Yetkili</TableHead>
                  <TableHead className="hidden md:table-cell">E-posta</TableHead>
                  <TableHead className="hidden md:table-cell">Şehir</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead className="hidden md:table-cell">Tarih</TableHead>
                  <TableHead className="text-right">İşlem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((req) => (
                  <TableRow key={req.id} className="group">
                    <TableCell className="font-medium">{req.company_name}</TableCell>
                    <TableCell>{req.full_name}</TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{req.email}</TableCell>
                    <TableCell className="hidden md:table-cell text-sm">{req.city}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={`text-[10px] font-semibold ${statusColors[req.status] || ''}`}>
                        {statusLabels[req.status] || req.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                      {format(new Date(req.created_at), 'dd.MM.yyyy')}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => openDetail(req)}>
                        <Eye className="h-3.5 w-3.5" /> Detay
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-primary" />
              Başvuru Detayı
            </DialogTitle>
          </DialogHeader>

          {selected && (
            <div className="space-y-4">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Firma Yetkilisi</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-muted-foreground">Ad Soyad:</span> {selected.full_name}</div>
                  <div><span className="text-muted-foreground">Telefon:</span> {selected.personal_phone}</div>
                  <div><span className="text-muted-foreground">{selected.identity_type === 'tc' ? 'TC Kimlik' : 'Pasaport'}:</span> {selected.identity_number}</div>
                  <div><span className="text-muted-foreground">Doğum:</span> {format(new Date(selected.birth_date), 'dd.MM.yyyy')}</div>
                  <div className="col-span-2"><span className="text-muted-foreground">E-posta:</span> {selected.email}</div>
                  <div className="col-span-2"><span className="text-muted-foreground">Görevler:</span> {selected.roles.join(', ')}</div>
                </div>
              </div>

              <Separator />

              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Firma Bilgileri</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-muted-foreground">Firma:</span> {selected.company_name}</div>
                  <div><span className="text-muted-foreground">Telefon:</span> {selected.company_phone}</div>
                  {selected.company_phone_secondary && (
                    <div><span className="text-muted-foreground">Yedek Tel:</span> {selected.company_phone_secondary}</div>
                  )}
                  <div><span className="text-muted-foreground">Kullanıcı Adı:</span> {selected.username}</div>
                  <div className="col-span-2"><span className="text-muted-foreground">Konum:</span> {selected.neighborhood}, {selected.district}, {selected.city}</div>
                  <div className="col-span-2"><span className="text-muted-foreground">Adres:</span> {selected.address}</div>
                </div>
              </div>

              {selected.status === 'pending' && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Onay İşlemi</h3>
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold">Sahip Şifresi (ilk giriş için)</Label>
                      <Input
                        value={ownerPassword}
                        onChange={(e) => setOwnerPassword(e.target.value)}
                        placeholder="En az 6 karakter"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold">Red Notu (opsiyonel)</Label>
                      <Textarea
                        value={rejectNotes}
                        onChange={(e) => setRejectNotes(e.target.value)}
                        placeholder="Reddetme sebebi..."
                        rows={2}
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          <DialogFooter>
            {selected?.status === 'pending' ? (
              <div className="flex gap-2 w-full">
                <Button
                  variant="destructive"
                  onClick={handleReject}
                  disabled={rejecting || approving}
                  className="flex-1"
                >
                  {rejecting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <X className="h-4 w-4 mr-1" />}
                  Reddet
                </Button>
                <Button
                  onClick={handleApprove}
                  disabled={approving || rejecting}
                  className="flex-1 btn-gradient"
                >
                  {approving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Check className="h-4 w-4 mr-1" />}
                  Onayla
                </Button>
              </div>
            ) : (
              <Button variant="outline" onClick={() => setDetailOpen(false)}>Kapat</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
