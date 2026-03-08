import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Users, Calendar, Wallet, Search, Loader2, Shield, UserCheck, Scissors,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { tr } from 'date-fns/locale';

type SalonMap = Record<string, string>;

export default function SuperAdminDataPage() {
  const [loading, setLoading] = useState(true);
  const [salonMap, setSalonMap] = useState<SalonMap>({});
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

    const map: SalonMap = {};
    (salonsRes.data || []).forEach(s => { map[s.id] = s.name; });
    setSalonMap(map);
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
            <p className="text-sm text-muted-foreground mt-0.5">Tüm salonların verilerini tek panelden görüntüleyin</p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="customers" className="space-y-4">
        <TabsList className="h-11">
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
        </TabsList>

        {/* Customers Tab */}
        <TabsContent value="customers" className="space-y-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Müşteri veya salon ara..." value={searchCustomers} onChange={e => setSearchCustomers(e.target.value)} className="pl-10 h-10" />
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
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Müşteri, personel veya salon ara..." value={searchAppointments} onChange={e => setSearchAppointments(e.target.value)} className="pl-10 h-10" />
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
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Salon ara..." value={searchPayments} onChange={e => setSearchPayments(e.target.value)} className="pl-10 h-10" />
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
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Personel veya salon ara..." value={searchStaff} onChange={e => setSearchStaff(e.target.value)} className="pl-10 h-10" />
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
      </Tabs>
    </div>
  );
}
