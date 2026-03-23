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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { toast } from '@/hooks/use-toast';
import { FileText, Upload, Plus, Printer, Eye, Trash2, User, Banknote, CreditCard } from 'lucide-react';
import { format, addMonths } from 'date-fns';
import { tr } from 'date-fns/locale';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { StaffPageGuard } from '@/components/permissions/StaffPageGuard';

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
  contract_payment_type: string; total_amount: number;
  installment_count: number; installment_id: string | null;
};

export default function ContractsPage() {
  const { user, currentSalonId } = useAuth();
  const { customers, services } = useSalonData();
  const queryClient = useQueryClient();
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

  // Payment type fields
  const [paymentType, setPaymentType] = useState<'cash' | 'installment'>('cash');
  const [totalAmount, setTotalAmount] = useState('');
  const [installmentCount, setInstallmentCount] = useState('3');
  const [installmentStartDate, setInstallmentStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedCashBoxId, setSelectedCashBoxId] = useState('none');

  // Preview
  const [previewContract, setPreviewContract] = useState<CustomerContract | null>(null);

  const salonId = currentSalonId;

  // Cash boxes for cash payment
  const { data: cashBoxes = [] } = useQuery({
    queryKey: ['cash_boxes', salonId],
    queryFn: async () => {
      if (!salonId) return [];
      const { data } = await supabase.from('cash_boxes').select('*').eq('salon_id', salonId).eq('is_active', true);
      return data || [];
    },
    enabled: !!salonId,
  });

  // Installment payments for preview
  const { data: installmentPayments = [] } = useQuery({
    queryKey: ['contract_installment_payments', salonId],
    queryFn: async () => {
      if (!salonId) return [];
      const { data } = await supabase.from('installment_payments').select('*').eq('salon_id', salonId).order('due_date');
      return data || [];
    },
    enabled: !!salonId,
  });

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

  // Auto-set total amount from service price
  useEffect(() => {
    if (selectedService && !totalAmount) {
      setTotalAmount(String(selectedService.price));
    }
  }, [selectedServiceId]);

  const parsedTotal = parseFloat(totalAmount) || 0;
  const parsedCount = parseInt(installmentCount) || 3;
  const perInstallment = parsedCount > 0 ? Math.round((parsedTotal / parsedCount) * 100) / 100 : 0;

  // Generate preview installment schedule
  const installmentSchedule = Array.from({ length: parsedCount }, (_, i) => ({
    number: i + 1,
    amount: i === parsedCount - 1 ? Math.round((parsedTotal - perInstallment * (parsedCount - 1)) * 100) / 100 : perInstallment,
    dueDate: format(addMonths(new Date(installmentStartDate), i), 'yyyy-MM-dd'),
  }));

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
    odeme_turu: paymentType === 'cash' ? 'Peşin' : 'Taksit',
    toplam_tutar: `${parsedTotal} ₺`,
  } : {};

  const handleCreateContract = async () => {
    if (!salonId || !user || !selectedCustomerId || !selectedTemplateId) {
      toast({ title: 'Hata', description: 'Müşteri ve şablon seçiniz.', variant: 'destructive' });
      return;
    }
    if (parsedTotal <= 0) {
      toast({ title: 'Hata', description: 'Toplam tutar giriniz.', variant: 'destructive' });
      return;
    }

    let installmentId: string | null = null;

    // If installment, create installment plan first
    if (paymentType === 'installment') {
      const { data: inst, error: instErr } = await supabase.from('installments').insert({
        salon_id: salonId,
        customer_id: selectedCustomerId,
        total_amount: parsedTotal,
        installment_count: parsedCount,
        notes: `Sözleşme: ${selectedTemplate?.name || ''}`,
        created_by: user.id,
      } as any).select('id').single();

      if (instErr || !inst) {
        toast({ title: 'Hata', description: instErr?.message || 'Taksit planı oluşturulamadı.', variant: 'destructive' });
        return;
      }
      installmentId = inst.id;

      // Create installment payments
      const paymentsData = installmentSchedule.map((s) => ({
        installment_id: inst.id,
        salon_id: salonId,
        due_date: s.dueDate,
        amount: s.amount,
        installment_number: s.number,
      }));

      const { error: payErr } = await supabase.from('installment_payments').insert(paymentsData as any);
      if (payErr) {
        toast({ title: 'Hata', description: payErr.message, variant: 'destructive' });
        return;
      }
    }

    // If cash, record in cash_transactions
    if (paymentType === 'cash') {
      const { error: cashErr } = await supabase.from('cash_transactions').insert({
        salon_id: salonId,
        amount: parsedTotal,
        type: 'income',
        description: `Sözleşme ödemesi: ${selectedCustomer?.name} - ${selectedTemplate?.name || ''}`,
        created_by: user.id,
        cash_box_id: selectedCashBoxId === 'none' ? null : selectedCashBoxId,
        payment_method: 'cash',
      } as any);
      if (cashErr) {
        toast({ title: 'Uyarı', description: 'Kasa kaydı oluşturulamadı: ' + cashErr.message });
      }
    }

    // Create the contract
    const { error } = await supabase.from('customer_contracts').insert({
      salon_id: salonId, customer_id: selectedCustomerId,
      template_id: selectedTemplateId,
      template_name: selectedTemplate?.name || '',
      filled_data: filledData as any,
      signed_date: signedDate || null,
      notes: contractNotes.trim() || null,
      status: 'signed', created_by: user.id,
      contract_payment_type: paymentType,
      total_amount: parsedTotal,
      installment_count: paymentType === 'installment' ? parsedCount : 0,
      installment_id: installmentId,
    } as any);

    if (error) {
      toast({ title: 'Hata', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Başarılı', description: 'Sözleşme oluşturuldu.' });
      setShowContractDialog(false);
      resetContractForm();
      fetchData();
      queryClient.invalidateQueries({ queryKey: ['installments', salonId] });
      queryClient.invalidateQueries({ queryKey: ['installment_payments', salonId] });
      queryClient.invalidateQueries({ queryKey: ['contract_installment_payments', salonId] });
    }
  };

  const resetContractForm = () => {
    setSelectedCustomerId(''); setSelectedTemplateId(''); setSelectedServiceId('');
    setContractNotes(''); setSignedDate(format(new Date(), 'yyyy-MM-dd'));
    setPaymentType('cash'); setTotalAmount(''); setInstallmentCount('3');
    setInstallmentStartDate(format(new Date(), 'yyyy-MM-dd'));
    setSelectedCashBoxId('none');
  };

  const getContractInstallments = (contract: CustomerContract) => {
    if (!contract.installment_id) return [];
    return installmentPayments.filter((p: any) => p.installment_id === contract.installment_id);
  };

  const handlePrint = (contract: CustomerContract) => {
    const data = contract.filled_data as Record<string, string>;
    const instPayments = getContractInstallments(contract);

    let installmentTableHtml = '';
    if (contract.contract_payment_type === 'installment' && instPayments.length > 0) {
      installmentTableHtml = `
        <h2 style="font-size:16px;margin-top:30px;border-bottom:1px solid #999;padding-bottom:6px">Taksit Planı</h2>
        <table>
          <tr style="background:#e5e5e5"><td style="font-weight:bold">Taksit No</td><td style="font-weight:bold">Tutar</td><td style="font-weight:bold">Vade Tarihi</td><td style="font-weight:bold">Durum</td></tr>
          ${instPayments.map((p: any) => `
            <tr>
              <td>${p.installment_number}. Taksit</td>
              <td>₺${Number(p.amount).toLocaleString('tr-TR')}</td>
              <td>${format(new Date(p.due_date), 'dd MMM yyyy', { locale: tr })}</td>
              <td>${p.is_paid ? '✅ Ödendi' : '⏳ Bekliyor'}</td>
            </tr>
          `).join('')}
        </table>
      `;
    }

    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`
      <html><head><title>Sözleşme - ${data.musteri_adi || ''}</title>
      <style>body{font-family:Arial,sans-serif;padding:40px;max-width:800px;margin:auto}
      h1{font-size:20px;border-bottom:2px solid #333;padding-bottom:10px}
      h2{font-size:16px}
      table{width:100%;border-collapse:collapse;margin:20px 0}
      td{padding:8px 12px;border:1px solid #ddd}
      td:first-child{font-weight:bold;width:200px;background:#f5f5f5}
      .footer{margin-top:60px;display:flex;justify-content:space-between}
      .sig{border-top:1px solid #333;padding-top:8px;width:200px;text-align:center}
      .payment-badge{display:inline-block;padding:4px 12px;border-radius:4px;font-weight:bold;margin-top:4px}
      @media print{body{padding:20px}}</style></head><body>
      <h1>📋 ${contract.template_name}</h1>
      <table>
        <tr><td>Müşteri Adı</td><td>${data.musteri_adi || '-'}</td></tr>
        <tr><td>TC Kimlik No</td><td>${data.tc_kimlik_no || '-'}</td></tr>
        <tr><td>Telefon</td><td>${data.telefon || '-'}</td></tr>
        <tr><td>Adres</td><td>${data.adres || '-'}</td></tr>
        <tr><td>Hizmet</td><td>${data.hizmet || '-'}</td></tr>
        <tr><td>Toplam Tutar</td><td>₺${Number(contract.total_amount).toLocaleString('tr-TR')}</td></tr>
        <tr><td>Ödeme Türü</td><td>${contract.contract_payment_type === 'installment' ? 'Taksit (' + contract.installment_count + ' taksit)' : 'Peşin'}</td></tr>
        <tr><td>İmza Tarihi</td><td>${data.imza_tarihi || '-'}</td></tr>
      </table>
      ${installmentTableHtml}
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

  const paymentTypeLabel = (t: string) => t === 'installment' ? 'Taksit' : 'Peşin';

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  return (
    <StaffPageGuard permissionKey="page_contracts" featureLabel="Sözleşmeler">
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
            <Dialog open={showContractDialog} onOpenChange={(open) => { setShowContractDialog(open); if (!open) resetContractForm(); }}>
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

                  {/* Payment Type */}
                  <div className="space-y-3">
                    <Label className="text-sm font-semibold">Ödeme Türü</Label>
                    <RadioGroup value={paymentType} onValueChange={(v) => setPaymentType(v as 'cash' | 'installment')} className="flex gap-4">
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="cash" id="pay-cash" />
                        <Label htmlFor="pay-cash" className="flex items-center gap-1.5 cursor-pointer">
                          <Banknote className="h-4 w-4 text-green-600" /> Peşin
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="installment" id="pay-installment" />
                        <Label htmlFor="pay-installment" className="flex items-center gap-1.5 cursor-pointer">
                          <CreditCard className="h-4 w-4 text-primary" /> Taksit
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>

                  {/* Total Amount */}
                  <div>
                    <Label>Toplam Tutar (₺)</Label>
                    <Input type="number" min="0" step="0.01" value={totalAmount} onChange={e => setTotalAmount(e.target.value)} placeholder="0.00" />
                  </div>

                  {/* Cash: select cash box */}
                  {paymentType === 'cash' && (
                    <div>
                      <Label>Kasa</Label>
                      <Select value={selectedCashBoxId} onValueChange={setSelectedCashBoxId}>
                        <SelectTrigger><SelectValue placeholder="Kasa seçin" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">— Genel —</SelectItem>
                          {cashBoxes.map((cb: any) => (
                            <SelectItem key={cb.id} value={cb.id}>{cb.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Installment fields */}
                  {paymentType === 'installment' && (
                    <div className="space-y-4 p-4 rounded-lg border border-border bg-muted/30">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label>Taksit Sayısı</Label>
                          <Select value={installmentCount} onValueChange={setInstallmentCount}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {[2, 3, 4, 5, 6, 8, 10, 12].map(n => (
                                <SelectItem key={n} value={String(n)}>{n} Taksit</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>İlk Taksit Tarihi</Label>
                          <Input type="date" value={installmentStartDate} onChange={e => setInstallmentStartDate(e.target.value)} />
                        </div>
                      </div>

                      {parsedTotal > 0 && (
                        <div className="space-y-2">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Taksit Planı Önizleme</p>
                          <div className="space-y-1">
                            {installmentSchedule.map(s => (
                              <div key={s.number} className="flex items-center justify-between text-sm p-2 rounded bg-background border border-border/60">
                                <span className="text-muted-foreground">{s.number}. Taksit — {format(new Date(s.dueDate), 'd MMM yyyy', { locale: tr })}</span>
                                <span className="font-semibold">₺{s.amount.toLocaleString('tr-TR')}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

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
                    <TableHead>Ödeme</TableHead>
                    <TableHead>Tutar</TableHead>
                    <TableHead>Durum</TableHead>
                    <TableHead>İmza Tarihi</TableHead>
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
                        <TableCell>
                          <Badge variant={c.contract_payment_type === 'installment' ? 'outline' : 'secondary'} className="text-xs">
                            {paymentTypeLabel(c.contract_payment_type)}
                            {c.contract_payment_type === 'installment' && ` (${c.installment_count})`}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-semibold">₺{Number(c.total_amount || 0).toLocaleString('tr-TR')}</TableCell>
                        <TableCell><Badge variant={st.variant}>{st.label}</Badge></TableCell>
                        <TableCell>{c.signed_date ? format(new Date(c.signed_date), 'dd MMM yyyy', { locale: tr }) : '-'}</TableCell>
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
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Sözleşme Detayı</DialogTitle></DialogHeader>
          {previewContract && (() => {
            const data = previewContract.filled_data as Record<string, string>;
            const instPayments = getContractInstallments(previewContract);
            return (
    <StaffPageGuard permissionKey="page_contracts" featureLabel="Sözleşmeler">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="font-medium text-muted-foreground">Şablon:</span><p>{previewContract.template_name}</p></div>
                  <div><span className="font-medium text-muted-foreground">Durum:</span><p><Badge variant={statusLabel(previewContract.status).variant}>{statusLabel(previewContract.status).label}</Badge></p></div>
                  <div><span className="font-medium text-muted-foreground">Müşteri:</span><p>{data.musteri_adi || '-'}</p></div>
                  <div><span className="font-medium text-muted-foreground">TC:</span><p>{data.tc_kimlik_no || '-'}</p></div>
                  <div><span className="font-medium text-muted-foreground">Telefon:</span><p>{data.telefon || '-'}</p></div>
                  <div><span className="font-medium text-muted-foreground">Hizmet:</span><p>{data.hizmet || '-'}</p></div>
                  <div><span className="font-medium text-muted-foreground">Toplam Tutar:</span><p className="font-bold">₺{Number(previewContract.total_amount || 0).toLocaleString('tr-TR')}</p></div>
                  <div><span className="font-medium text-muted-foreground">Ödeme Türü:</span><p>
                    <Badge variant={previewContract.contract_payment_type === 'installment' ? 'outline' : 'secondary'}>
                      {paymentTypeLabel(previewContract.contract_payment_type)}
                    </Badge>
                  </p></div>
                  <div><span className="font-medium text-muted-foreground">İmza Tarihi:</span><p>{previewContract.signed_date ? format(new Date(previewContract.signed_date), 'dd MMM yyyy', { locale: tr }) : '-'}</p></div>
                </div>

                {/* Installment table in preview */}
                {previewContract.contract_payment_type === 'installment' && instPayments.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-semibold">Taksit Planı</p>
                    <div className="space-y-1">
                      {instPayments.map((p: any) => (
                        <div key={p.id} className="flex items-center justify-between text-xs p-2 rounded-lg border border-border/60 bg-muted/30">
                          <span>{p.installment_number}. Taksit — {format(new Date(p.due_date), 'd MMM yyyy', { locale: tr })}</span>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">₺{Number(p.amount).toLocaleString('tr-TR')}</span>
                            {p.is_paid ? (
                              <Badge variant="outline" className="text-[10px] text-green-600">Ödendi</Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px]">Bekliyor</Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

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
    </StaffPageGuard>
  );
}
