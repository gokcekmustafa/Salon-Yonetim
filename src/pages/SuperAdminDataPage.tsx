import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Users, Calendar, Wallet, Search, Loader2, Shield, UserCheck, Scissors,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { tr } from 'date-fns/locale';
import DataExportImport, { ColumnMapping } from '@/components/DataExportImport';
import { toast } from 'sonner';

type SalonMap = Record<string, string>;

const CUSTOMER_COLUMNS: ColumnMapping[] = [
  { excelHeader: 'Ad Soyad', dbKey: 'name', required: true },
  { excelHeader: 'Telefon', dbKey: 'phone', required: true },
  { excelHeader: 'TC Kimlik No', dbKey: 'tc_kimlik_no' },
  { excelHeader: 'Doğum Tarihi', dbKey: 'birth_date' },
  { excelHeader: 'Adres', dbKey: 'address' },
  { excelHeader: '2. Telefon', dbKey: 'secondary_phone' },
  { excelHeader: 'Notlar', dbKey: 'notes' },
  { excelHeader: 'Salon', dbKey: 'salon_name' },
];

const STAFF_COLUMNS: ColumnMapping[] = [
  { excelHeader: 'Ad Soyad', dbKey: 'name', required: true },
  { excelHeader: 'Telefon', dbKey: 'phone' },
  { excelHeader: 'Aktif', dbKey: 'is_active' },
  { excelHeader: 'Salon', dbKey: 'salon_name' },
];

const APPOINTMENT_COLUMNS: ColumnMapping[] = [
  { excelHeader: 'Tarih', dbKey: 'start_time', required: true },
  { excelHeader: 'Müşteri', dbKey: 'customer_name' },
  { excelHeader: 'Hizmet', dbKey: 'service_name' },
  { excelHeader: 'Personel', dbKey: 'staff_name' },
  { excelHeader: 'Durum', dbKey: 'status' },
  { excelHeader: 'Salon', dbKey: 'salon_name' },
];

const PAYMENT_COLUMNS: ColumnMapping[] = [
  { excelHeader: 'Tarih', dbKey: 'payment_date', required: true },
  { excelHeader: 'Tutar', dbKey: 'amount', required: true },
  { excelHeader: 'Ödeme Türü', dbKey: 'payment_type' },
  { excelHeader: 'Salon', dbKey: 'salon_name' },
];

const SERVICE_COLUMNS: ColumnMapping[] = [
  { excelHeader: 'Hizmet Adı', dbKey: 'name', required: true },
  { excelHeader: 'Süre (dk)', dbKey: 'duration', required: true },
  { excelHeader: 'Fiyat (₺)', dbKey: 'price', required: true },
  { excelHeader: 'Salon', dbKey: 'salon_name' },
];

export default function SuperAdminDataPage() {
  const [loading, setLoading] = useState(true);
  const [salonMap, setSalonMap] = useState<SalonMap>({});
  const [salons, setSalons] = useState<{ id: string; name: string }[]>([]);
  const [importSalonId, setImportSalonId] = useState<string>('');
  const [customers, setCustomers] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [searchCustomers, setSearchCustomers] = useState('');
  const [searchAppointments, setSearchAppointments] = useState('');
  const [searchPayments, setSearchPayments] = useState('');
  const [searchStaff, setSearchStaff] = useState('');

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    const [salonsRes, custRes, aptRes, payRes, staffRes, svcRes] = await Promise.all([
      supabase.from('salons').select('id, name'),
      supabase.from('customers').select('*').order('name').limit(500),
      supabase.from('appointments').select('*').order('start_time', { ascending: false }).limit(500),
      supabase.from('payments').select('*').order('payment_date', { ascending: false }).limit(500),
      supabase.from('staff').select('*').order('name').limit(500),
      supabase.from('services').select('*').order('name').limit(500),
    ]);

    const salonsList = salonsRes.data || [];
    const map: SalonMap = {};
    salonsList.forEach(s => { map[s.id] = s.name; });
    setSalonMap(map);
    setSalons(salonsList);
    if (salonsList.length > 0 && !importSalonId) setImportSalonId(salonsList[0].id);
    setCustomers(custRes.data || []);
    setAppointments(aptRes.data || []);
    setPayments(payRes.data || []);
    setStaffList(staffRes.data || []);
    setServices(svcRes.data || []);
    setLoading(false);
  };

  const getSalonName = (id: string) => salonMap[id] || '—';
  const getCustomerName = (id: string) => customers.find(c => c.id === id)?.name || '—';
  const getStaffName = (id: string) => staffList.find(s => s.id === id)?.name || '—';
  const getServiceName = (id: string) => services.find(s => s.id === id)?.name || '—';

  const statusLabel: Record<string, string> = { bekliyor: 'Bekliyor', tamamlandi: 'Tamamlandı', iptal: 'İptal' };
  const statusVariant = (s: string): 'default' | 'secondary' | 'destructive' =>
    s === 'tamamlandi' ? 'default' : s === 'iptal' ? 'destructive' : 'secondary';

  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(searchCustomers.toLowerCase()) ||
    (c.phone || '').includes(searchCustomers) ||
    getSalonName(c.salon_id).toLowerCase().includes(searchCustomers.toLowerCase())
  );

  const filteredAppointments = appointments.filter(a =>
    getCustomerName(a.customer_id).toLowerCase().includes(searchAppointments.toLowerCase()) ||
    getStaffName(a.staff_id).toLowerCase().includes(searchAppointments.toLowerCase()) ||
    getSalonName(a.salon_id).toLowerCase().includes(searchAppointments.toLowerCase())
  );

  const filteredPayments = payments.filter(p =>
    getSalonName(p.salon_id).toLowerCase().includes(searchPayments.toLowerCase())
  );

  const filteredStaff = staffList.filter(s =>
    s.name.toLowerCase().includes(searchStaff.toLowerCase()) ||
    getSalonName(s.salon_id).toLowerCase().includes(searchStaff.toLowerCase())
  );

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );

  const salonSelector = (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground whitespace-nowrap">İçe aktarılacak salon:</span>
      <Select value={importSalonId} onValueChange={setImportSalonId}>
        <SelectTrigger className="h-8 w-48 text-xs">
          <SelectValue placeholder="Salon seçin" />
        </SelectTrigger>
        <SelectContent>
          {salons.map(s => (
            <SelectItem key={s.id} value={s.id} className="text-xs">{s.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <div className="page-container animate-in">
      {/* Hero */}
      <div className="rounded-2xl p-6 lg:p-8 border border-border/40" style={{ background: 'var(--gradient-hero)' }}>
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl btn-gradient flex items-center justify-center">
            <Shield className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Tüm Platform Verileri</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Tüm salonların verilerini tek panelden görüntüleyin, dışa/içe aktarın</p>
          </div>
        </div>
      </div>

      {/* Salon selector for imports */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <span className="text-xs text-muted-foreground whitespace-nowrap">İçe aktarılacak salon:</span>
        <Select value={importSalonId} onValueChange={setImportSalonId}>
          <SelectTrigger className="h-8 w-full sm:w-48 text-xs">
            <SelectValue placeholder="Salon seçin" />
          </SelectTrigger>
          <SelectContent>
            {salons.map(s => (
              <SelectItem key={s.id} value={s.id} className="text-xs">{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="customers" className="space-y-4">
        <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
          <TabsList className="h-11 w-max">
            <TabsTrigger value="customers" className="gap-1.5 text-sm">
              <Users className="h-3.5 w-3.5" /> Müşteriler <Badge variant="secondary" className="ml-1 text-[10px]">{customers.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="appointments" className="gap-1.5 text-sm">
              <Calendar className="h-3.5 w-3.5" /> Randevular <Badge variant="secondary" className="ml-1 text-[10px]">{appointments.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="payments" className="gap-1.5 text-sm">
              <Wallet className="h-3.5 w-3.5" /> Ödemeler <Badge variant="secondary" className="ml-1 text-[10px]">{payments.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="staff" className="gap-1.5 text-sm">
              <UserCheck className="h-3.5 w-3.5" /> Personel <Badge variant="secondary" className="ml-1 text-[10px]">{staffList.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="services" className="gap-1.5 text-sm">
              <Scissors className="h-3.5 w-3.5" /> Hizmetler <Badge variant="secondary" className="ml-1 text-[10px]">{services.length}</Badge>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Customers Tab */}
        <TabsContent value="customers" className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative max-w-sm flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Müşteri veya salon ara..." value={searchCustomers} onChange={e => setSearchCustomers(e.target.value)} className="pl-10 h-10" />
            </div>
            <DataExportImport
              title="Tüm Müşteriler"
              filePrefix="tum-musteriler"
              columns={CUSTOMER_COLUMNS}
              data={customers}
              toExportRow={(c) => ({
                'Ad Soyad': c.name,
                'Telefon': c.phone || '',
                'TC Kimlik No': c.tc_kimlik_no || '',
                'Doğum Tarihi': c.birth_date || '',
                'Adres': c.address || '',
                '2. Telefon': c.secondary_phone || '',
                'Notlar': c.notes || '',
                'Salon': getSalonName(c.salon_id),
              })}
              fromImportRow={(row) => ({
                name: row['Ad Soyad'],
                phone: row['Telefon'] || null,
                tc_kimlik_no: row['TC Kimlik No'] || null,
                birth_date: row['Doğum Tarihi'] || null,
                address: row['Adres'] || null,
                secondary_phone: row['2. Telefon'] || null,
                notes: row['Notlar'] || null,
              })}
              onImport={async (rows) => {
                if (!importSalonId) { toast.error('Lütfen bir salon seçin'); return { success: 0, errors: 1 }; }
                let success = 0, errors = 0;
                for (const row of rows) {
                  const insertData = { ...row, salon_id: importSalonId } as any;
                  const { error } = await supabase.from('customers').insert(insertData);
                  if (error) errors++; else success++;
                }
                fetchAll();
                return { success, errors };
              }}
              summaryLines={[`Toplam: ${customers.length} müşteri`]}
            />
          </div>
          <Card className="shadow-soft border-border/60 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="font-semibold">Ad Soyad</TableHead>
                  <TableHead className="font-semibold">Telefon</TableHead>
                  <TableHead className="font-semibold">Salon</TableHead>
                  <TableHead className="hidden lg:table-cell font-semibold">Kayıt Tarihi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCustomers.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-12 text-muted-foreground text-sm">Müşteri bulunamadı</TableCell></TableRow>
                ) : filteredCustomers.slice(0, 100).map(c => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <span className="text-xs font-bold text-primary">{c.name.charAt(0)}</span>
                        </div>
                        <span className="font-medium text-sm">{c.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">{c.phone || '—'}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px] font-semibold">{getSalonName(c.salon_id)}</Badge>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-muted-foreground text-sm">
                      {format(parseISO(c.created_at), 'd MMM yyyy', { locale: tr })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* Appointments Tab */}
        <TabsContent value="appointments" className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative max-w-sm flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Müşteri, personel veya salon ara..." value={searchAppointments} onChange={e => setSearchAppointments(e.target.value)} className="pl-10 h-10" />
            </div>
            <DataExportImport
              title="Tüm Randevular"
              filePrefix="tum-randevular"
              columns={APPOINTMENT_COLUMNS}
              data={appointments}
              toExportRow={(a) => ({
                'Tarih': a.start_time ? format(parseISO(a.start_time), 'd MMM yyyy HH:mm', { locale: tr }) : '',
                'Müşteri': getCustomerName(a.customer_id),
                'Hizmet': getServiceName(a.service_id),
                'Personel': getStaffName(a.staff_id),
                'Durum': statusLabel[a.status] || a.status,
                'Salon': getSalonName(a.salon_id),
              })}
              fromImportRow={() => null}
              onImport={async () => ({ success: 0, errors: 0 })}
              summaryLines={[`Toplam: ${appointments.length} randevu`]}
            />
          </div>
          <Card className="shadow-soft border-border/60 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="font-semibold">Tarih</TableHead>
                  <TableHead className="font-semibold">Müşteri</TableHead>
                  <TableHead className="hidden md:table-cell font-semibold">Hizmet</TableHead>
                  <TableHead className="hidden md:table-cell font-semibold">Personel</TableHead>
                  <TableHead className="font-semibold">Salon</TableHead>
                  <TableHead className="font-semibold">Durum</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAppointments.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground text-sm">Randevu bulunamadı</TableCell></TableRow>
                ) : filteredAppointments.slice(0, 100).map(a => (
                  <TableRow key={a.id}>
                    <TableCell className="text-sm tabular-nums">
                      {format(parseISO(a.start_time), 'd MMM yyyy HH:mm', { locale: tr })}
                    </TableCell>
                    <TableCell className="font-medium text-sm">{getCustomerName(a.customer_id)}</TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground text-sm">{getServiceName(a.service_id)}</TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground text-sm">{getStaffName(a.staff_id)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px] font-semibold">{getSalonName(a.salon_id)}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(a.status)} className="text-[10px] font-semibold">{statusLabel[a.status] || a.status}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* Payments Tab */}
        <TabsContent value="payments" className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative max-w-sm flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Salon ara..." value={searchPayments} onChange={e => setSearchPayments(e.target.value)} className="pl-10 h-10" />
            </div>
            <DataExportImport
              title="Tüm Ödemeler"
              filePrefix="tum-odemeler"
              columns={PAYMENT_COLUMNS}
              data={payments}
              toExportRow={(p) => ({
                'Tarih': p.payment_date ? format(parseISO(p.payment_date), 'd MMM yyyy HH:mm', { locale: tr }) : '',
                'Tutar': Number(p.amount),
                'Ödeme Türü': p.payment_type === 'nakit' ? 'Nakit' : 'Kart',
                'Salon': getSalonName(p.salon_id),
              })}
              fromImportRow={() => null}
              onImport={async () => ({ success: 0, errors: 0 })}
              summaryLines={[
                `Toplam: ${payments.length} ödeme`,
                `Toplam Tutar: ₺${payments.reduce((s, p) => s + Number(p.amount), 0).toLocaleString('tr-TR')}`,
              ]}
            />
          </div>
          <Card className="shadow-soft border-border/60 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="font-semibold">Tarih</TableHead>
                  <TableHead className="font-semibold">Salon</TableHead>
                  <TableHead className="font-semibold">Ödeme Türü</TableHead>
                  <TableHead className="text-right font-semibold">Tutar</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPayments.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-12 text-muted-foreground text-sm">Ödeme bulunamadı</TableCell></TableRow>
                ) : filteredPayments.slice(0, 100).map(p => (
                  <TableRow key={p.id}>
                    <TableCell className="text-muted-foreground text-sm tabular-nums">
                      {format(parseISO(p.payment_date), 'd MMM yyyy HH:mm', { locale: tr })}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px] font-semibold">{getSalonName(p.salon_id)}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-[10px] font-semibold">
                        {p.payment_type === 'nakit' ? 'Nakit' : 'Kart'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-bold tabular-nums">
                      ₺{Number(p.amount).toLocaleString('tr-TR')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* Staff Tab */}
        <TabsContent value="staff" className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative max-w-sm flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Personel veya salon ara..." value={searchStaff} onChange={e => setSearchStaff(e.target.value)} className="pl-10 h-10" />
            </div>
            <DataExportImport
              title="Tüm Personel"
              filePrefix="tum-personel"
              columns={STAFF_COLUMNS}
              data={staffList}
              toExportRow={(s) => ({
                'Ad Soyad': s.name,
                'Telefon': s.phone || '',
                'Aktif': s.is_active ? 'Evet' : 'Hayır',
                'Salon': getSalonName(s.salon_id),
              })}
              fromImportRow={(row) => ({
                name: row['Ad Soyad'],
                phone: row['Telefon'] || null,
                is_active: (row['Aktif'] || 'Evet').toLowerCase() !== 'hayır',
              })}
              onImport={async (rows) => {
                if (!importSalonId) { toast.error('Lütfen bir salon seçin'); return { success: 0, errors: 1 }; }
                let success = 0, errors = 0;
                for (const row of rows) {
                  const insertData = { ...row, salon_id: importSalonId } as any;
                  const { error } = await supabase.from('staff').insert(insertData);
                  if (error) errors++; else success++;
                }
                fetchAll();
                return { success, errors };
              }}
              summaryLines={[`Toplam: ${staffList.length} personel`]}
            />
          </div>
          <Card className="shadow-soft border-border/60 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="font-semibold">Ad Soyad</TableHead>
                  <TableHead className="font-semibold">Telefon</TableHead>
                  <TableHead className="font-semibold">Salon</TableHead>
                  <TableHead className="font-semibold">Durum</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStaff.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-12 text-muted-foreground text-sm">Personel bulunamadı</TableCell></TableRow>
                ) : filteredStaff.slice(0, 100).map(s => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <UserCheck className="h-4 w-4 text-primary" />
                        </div>
                        <span className="font-medium text-sm">{s.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">{s.phone || '—'}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px] font-semibold">{getSalonName(s.salon_id)}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={s.is_active ? 'default' : 'secondary'} className="text-[10px] font-semibold">
                        {s.is_active ? 'Aktif' : 'Pasif'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* Services Tab */}
        <TabsContent value="services" className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <DataExportImport
              title="Tüm Hizmetler"
              filePrefix="tum-hizmetler"
              columns={SERVICE_COLUMNS}
              data={services}
              toExportRow={(s) => ({
                'Hizmet Adı': s.name,
                'Süre (dk)': s.duration,
                'Fiyat (₺)': s.price,
                'Salon': getSalonName(s.salon_id),
              })}
              fromImportRow={(row) => ({
                name: row['Hizmet Adı'],
                duration: Number(row['Süre (dk)']) || 60,
                price: Number(row['Fiyat (₺)']) || 0,
              })}
              onImport={async (rows) => {
                if (!importSalonId) { toast.error('Lütfen bir salon seçin'); return { success: 0, errors: 1 }; }
                let success = 0, errors = 0;
                for (const row of rows) {
                  const insertData = { ...row, salon_id: importSalonId } as any;
                  const { error } = await supabase.from('services').insert(insertData);
                  if (error) errors++; else success++;
                }
                fetchAll();
                return { success, errors };
              }}
              summaryLines={[`Toplam: ${services.length} hizmet`]}
            />
          </div>
          <Card className="shadow-soft border-border/60 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="font-semibold">Hizmet Adı</TableHead>
                  <TableHead className="font-semibold">Süre</TableHead>
                  <TableHead className="font-semibold">Fiyat</TableHead>
                  <TableHead className="font-semibold">Salon</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {services.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-12 text-muted-foreground text-sm">Hizmet bulunamadı</TableCell></TableRow>
                ) : services.slice(0, 100).map(s => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Scissors className="h-4 w-4 text-primary" />
                        </div>
                        <span className="font-medium text-sm">{s.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">{s.duration} dk</TableCell>
                    <TableCell className="font-bold tabular-nums">₺{Number(s.price).toLocaleString('tr-TR')}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px] font-semibold">{getSalonName(s.salon_id)}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}