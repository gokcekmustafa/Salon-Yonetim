import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useSalonData } from '@/hooks/useSalonData';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/hooks/use-toast';
import { FileText, Upload, Plus, Printer, Eye, Trash2, Calendar, User } from 'lucide-react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';

type ContractTemplate = {
  id: string; salon_id: string; name: string; description: string | null;
  file_url: string; file_type: string; is_active: boolean;
  created_at: string; updated_at: string;
};

type CustomerContract = {
  id: string; salon_id: string; customer_id: string; template_id: string | null;
  template_name: string; filled_data: Record<string, string>; signed_date: string | null;
  notes: string | null; status: string; created_by: string;
  created_at: string; updated_at: string;
};

export default function ContractsPage() {
  const { user, currentSalonId } = useAuth();
  const { customers, services } = useSalonData();
  const [templates, setTemplates] = useState<ContractTemplate[]>([]);
  const [contracts, setContracts] = useState<CustomerContract[]>([]);
  const [loading, setLoading] = useState(true);

  // Template form
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateDesc, setTemplateDesc] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Contract form
  const [showContractDialog, setShowContractDialog] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [contractNotes, setContractNotes] = useState('');
  const [signedDate, setSignedDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  // Preview
  const [previewContract, setPreviewContract] = useState<CustomerContract | null>(null);

  const salonId = currentSalonId;

  const fetchData = async () => {
    if (!salonId) return;
    setLoading(true);
    const [tRes, cRes] = await Promise.all([
      supabase.from('contract_templates').select('*').eq('salon_id', salonId).order('created_at', { ascending: false }),
      supabase.from('customer_contracts').select('*').eq('salon_id', salonId).order('created_at', { ascending: false }),
    ]);
    setTemplates((tRes.data as ContractTemplate[]) || []);
    setContracts((cRes.data as CustomerContract[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [salonId]);

  const handleUploadTemplate = async () => {
    if (!salonId || !user || !fileRef.current?.files?.[0] || !templateName.trim()) {
      toast({ title: 'Hata', description: 'Şablon adı ve dosya gereklidir.', variant: 'destructive' });
      return;
    }
    setUploading(true);
    const file = fileRef.current.files[0];
    const ext = file.name.split('.').pop() || 'pdf';
    const path = `${salonId}/${Date.now()}_${file.name}`;

    const { error: uploadErr } = await supabase.storage.from('contract-files').upload(path, file);
    if (uploadErr) {
      toast({ title: 'Yükleme hatası', description: uploadErr.message, variant: 'destructive' });
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from('contract-files').getPublicUrl(path);

    const { error } = await supabase.from('contract_templates').insert({
      salon_id: salonId, name: templateName.trim(), description: templateDesc.trim() || null,
      file_url: urlData.publicUrl, file_type: ext,
    });

    if (error) {
      toast({ title: 'Hata', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Başarılı', description: 'Şablon yüklendi.' });
      setTemplateName(''); setTemplateDesc(''); setShowTemplateDialog(false);
      fetchData();
    }
    setUploading(false);
  };

  const deleteTemplate = async (id: string) => {
    const { error } = await supabase.from('contract_templates').delete().eq('id', id);
    if (!error) { toast({ title: 'Silindi' }); fetchData(); }
  };

  const selectedCustomer = customers.find(c => c.id === selectedCustomerId);
  const selectedService = services.find(s => s.id === selectedServiceId);
  const selectedTemplate = templates.find(t => t.id === selectedTemplateId);

  const filledData: Record<string, string> = selectedCustomer ? {
    musteri_adi: selectedCustomer.name,
    telefon: selectedCustomer.phone || '',
    tc_kimlik_no: selectedCustomer.tc_kimlik_no || '',
    adres: selectedCustomer.address || '',
    ikinci_telefon: selectedCustomer.secondary_phone || '',
    dogum_tarihi: selectedCustomer.birth_date || '',
    hizmet: selectedService?.name || '',
    hizmet_ucreti: selectedService ? `${selectedService.price} ₺` : '',
    imza_tarihi: signedDate,
  } : {};

  const handleCreateContract = async () => {
    if (!salonId || !user || !selectedCustomerId || !selectedTemplateId) {
      toast({ title: 'Hata', description: 'Müşteri ve şablon seçiniz.', variant: 'destructive' });
      return;
    }

    const { error } = await supabase.from('customer_contracts').insert({
      salon_id: salonId, customer_id: selectedCustomerId,
      template_id: selectedTemplateId,
      template_name: selectedTemplate?.name || '',
      filled_data: filledData as any,
      signed_date: signedDate || null,
      notes: contractNotes.trim() || null,
      status: 'signed', created_by: user.id,
    });

    if (error) {
      toast({ title: 'Hata', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Başarılı', description: 'Sözleşme oluşturuldu.' });
      setShowContractDialog(false);
      setSelectedCustomerId(''); setSelectedTemplateId(''); setSelectedServiceId('');
      setContractNotes(''); setSignedDate(format(new Date(), 'yyyy-MM-dd'));
      fetchData();
    }
  };

  const handlePrint = (contract: CustomerContract) => {
    const data = contract.filled_data as Record<string, string>;
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`
      <html><head><title>Sözleşme - ${data.musteri_adi || ''}</title>
      <style>body{font-family:Arial,sans-serif;padding:40px;max-width:800px;margin:auto}
      h1{font-size:20px;border-bottom:2px solid #333;padding-bottom:10px}
      table{width:100%;border-collapse:collapse;margin:20px 0}
      td{padding:8px 12px;border:1px solid #ddd}
      td:first-child{font-weight:bold;width:200px;background:#f5f5f5}
      .footer{margin-top:60px;display:flex;justify-content:space-between}
      .sig{border-top:1px solid #333;padding-top:8px;width:200px;text-align:center}
      @media print{body{padding:20px}}</style></head><body>
      <h1>📋 ${contract.template_name}</h1>
      <table>
        <tr><td>Müşteri Adı</td><td>${data.musteri_adi || '-'}</td></tr>
        <tr><td>TC Kimlik No</td><td>${data.tc_kimlik_no || '-'}</td></tr>
        <tr><td>Telefon</td><td>${data.telefon || '-'}</td></tr>
        <tr><td>Adres</td><td>${data.adres || '-'}</td></tr>
        <tr><td>Hizmet</td><td>${data.hizmet || '-'}</td></tr>
        <tr><td>Hizmet Ücreti</td><td>${data.hizmet_ucreti || '-'}</td></tr>
        <tr><td>İmza Tarihi</td><td>${data.imza_tarihi || '-'}</td></tr>
      </table>
      ${contract.notes ? `<p><strong>Notlar:</strong> ${contract.notes}</p>` : ''}
      <div class="footer">
        <div class="sig">Müşteri İmzası</div>
        <div class="sig">Salon Yetkilisi</div>
      </div>
      </body></html>
    `);
    w.document.close();
    w.print();
  };

  const statusLabel = (s: string) => {
    switch (s) {
      case 'draft': return { label: 'Taslak', variant: 'secondary' as const };
      case 'signed': return { label: 'İmzalandı', variant: 'default' as const };
      case 'archived': return { label: 'Arşiv', variant: 'outline' as const };
      default: return { label: s, variant: 'secondary' as const };
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  return (
    <div className="page-container animate-in space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Sözleşme Yönetimi</h1>
          <p className="text-muted-foreground text-sm">Şablon yükleyin, müşteri sözleşmelerini oluşturun ve yazdırın</p>
        </div>
      </div>

      <Tabs defaultValue="contracts" className="space-y-4">
        <TabsList>
          <TabsTrigger value="contracts">Sözleşmeler</TabsTrigger>
          <TabsTrigger value="templates">Şablonlar</TabsTrigger>
        </TabsList>

        {/* CONTRACTS TAB */}
        <TabsContent value="contracts" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={showContractDialog} onOpenChange={setShowContractDialog}>
              <DialogTrigger asChild>
                <Button><Plus className="h-4 w-4 mr-2" />Yeni Sözleşme</Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader><DialogTitle>Yeni Sözleşme Oluştur</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Şablon</Label>
                    <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                      <SelectTrigger><SelectValue placeholder="Şablon seçin" /></SelectTrigger>
                      <SelectContent>
                        {templates.filter(t => t.is_active).map(t => (
                          <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Müşteri</Label>
                    <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
                      <SelectTrigger><SelectValue placeholder="Müşteri seçin" /></SelectTrigger>
                      <SelectContent>
                        {customers.map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Hizmet (opsiyonel)</Label>
                    <Select value={selectedServiceId} onValueChange={setSelectedServiceId}>
                      <SelectTrigger><SelectValue placeholder="Hizmet seçin" /></SelectTrigger>
                      <SelectContent>
                        {services.filter(s => s.is_active).map(s => (
                          <SelectItem key={s.id} value={s.id}>{s.name} - {s.price}₺</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedCustomer && (
                    <Card className="bg-muted/50">
                      <CardHeader className="pb-2"><CardTitle className="text-sm">Otomatik Doldurulan Bilgiler</CardTitle></CardHeader>
                      <CardContent className="text-sm space-y-1">
                        <p><strong>Ad:</strong> {filledData.musteri_adi}</p>
                        {filledData.tc_kimlik_no && <p><strong>TC:</strong> {filledData.tc_kimlik_no}</p>}
                        {filledData.telefon && <p><strong>Tel:</strong> {filledData.telefon}</p>}
                        {filledData.adres && <p><strong>Adres:</strong> {filledData.adres}</p>}
                        {filledData.hizmet && <p><strong>Hizmet:</strong> {filledData.hizmet} ({filledData.hizmet_ucreti})</p>}
                      </CardContent>
                    </Card>
                  )}

                  <div>
                    <Label>İmza Tarihi</Label>
                    <Input type="date" value={signedDate} onChange={e => setSignedDate(e.target.value)} />
                  </div>

                  <div>
                    <Label>Notlar</Label>
                    <Textarea value={contractNotes} onChange={e => setContractNotes(e.target.value)} placeholder="Ek notlar..." />
                  </div>

                  <Button onClick={handleCreateContract} className="w-full">Sözleşme Oluştur</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {contracts.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>Henüz sözleşme oluşturulmamış.</p>
            </CardContent></Card>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Müşteri</TableHead>
                    <TableHead>Şablon</TableHead>
                    <TableHead>Durum</TableHead>
                    <TableHead>İmza Tarihi</TableHead>
                    <TableHead>Tarih</TableHead>
                    <TableHead className="text-right">İşlemler</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contracts.map(c => {
                    const cust = customers.find(cu => cu.id === c.customer_id);
                    const st = statusLabel(c.status);
                    return (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            {cust?.name || 'Silinmiş'}
                          </div>
                        </TableCell>
                        <TableCell>{c.template_name}</TableCell>
                        <TableCell><Badge variant={st.variant}>{st.label}</Badge></TableCell>
                        <TableCell>{c.signed_date ? format(new Date(c.signed_date), 'dd MMM yyyy', { locale: tr }) : '-'}</TableCell>
                        <TableCell>{format(new Date(c.created_at), 'dd MMM yyyy', { locale: tr })}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button size="sm" variant="ghost" onClick={() => setPreviewContract(c)}>
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => handlePrint(c)}>
                              <Printer className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>

        {/* TEMPLATES TAB */}
        <TabsContent value="templates" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog}>
              <DialogTrigger asChild>
                <Button><Upload className="h-4 w-4 mr-2" />Şablon Yükle</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Yeni Şablon Yükle</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Şablon Adı</Label>
                    <Input value={templateName} onChange={e => setTemplateName(e.target.value)} placeholder="Örn: Hizmet Sözleşmesi" />
                  </div>
                  <div>
                    <Label>Açıklama (opsiyonel)</Label>
                    <Textarea value={templateDesc} onChange={e => setTemplateDesc(e.target.value)} />
                  </div>
                  <div>
                    <Label>Dosya (PDF/Word)</Label>
                    <Input ref={fileRef} type="file" accept=".pdf,.doc,.docx" />
                  </div>
                  <Button onClick={handleUploadTemplate} disabled={uploading} className="w-full">
                    {uploading ? 'Yükleniyor...' : 'Yükle'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {templates.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">
              <Upload className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>Henüz şablon yüklenmemiş.</p>
            </CardContent></Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {templates.map(t => (
                <Card key={t.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <FileText className="h-5 w-5 text-primary" />
                        <CardTitle className="text-base">{t.name}</CardTitle>
                      </div>
                      <Badge variant={t.is_active ? 'default' : 'secondary'}>
                        {t.is_active ? 'Aktif' : 'Pasif'}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {t.description && <p className="text-sm text-muted-foreground mb-3">{t.description}</p>}
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(t.created_at), 'dd MMM yyyy', { locale: tr })}
                      </span>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" asChild>
                          <a href={t.file_url} target="_blank" rel="noopener noreferrer">
                            <Eye className="h-4 w-4" />
                          </a>
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => deleteTemplate(t.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Preview Dialog */}
      <Dialog open={!!previewContract} onOpenChange={() => setPreviewContract(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Sözleşme Detayı</DialogTitle></DialogHeader>
          {previewContract && (() => {
            const data = previewContract.filled_data as Record<string, string>;
            return (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="font-medium text-muted-foreground">Şablon:</span><p>{previewContract.template_name}</p></div>
                  <div><span className="font-medium text-muted-foreground">Durum:</span><p><Badge variant={statusLabel(previewContract.status).variant}>{statusLabel(previewContract.status).label}</Badge></p></div>
                  <div><span className="font-medium text-muted-foreground">Müşteri:</span><p>{data.musteri_adi || '-'}</p></div>
                  <div><span className="font-medium text-muted-foreground">TC:</span><p>{data.tc_kimlik_no || '-'}</p></div>
                  <div><span className="font-medium text-muted-foreground">Telefon:</span><p>{data.telefon || '-'}</p></div>
                  <div><span className="font-medium text-muted-foreground">Adres:</span><p>{data.adres || '-'}</p></div>
                  <div><span className="font-medium text-muted-foreground">Hizmet:</span><p>{data.hizmet || '-'}</p></div>
                  <div><span className="font-medium text-muted-foreground">Ücret:</span><p>{data.hizmet_ucreti || '-'}</p></div>
                  <div><span className="font-medium text-muted-foreground">İmza Tarihi:</span><p>{previewContract.signed_date ? format(new Date(previewContract.signed_date), 'dd MMM yyyy', { locale: tr }) : '-'}</p></div>
                </div>
                {previewContract.notes && <div><span className="font-medium text-muted-foreground text-sm">Notlar:</span><p className="text-sm">{previewContract.notes}</p></div>}
                <Button className="w-full" onClick={() => handlePrint(previewContract)}>
                  <Printer className="h-4 w-4 mr-2" />Yazdır
                </Button>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
