import { useState } from 'react';
import { useSalon } from '@/contexts/SalonContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Calendar as CalendarIcon } from 'lucide-react';
import { format, parseISO, addMinutes, startOfDay, endOfDay, isSameDay } from 'date-fns';
import { tr } from 'date-fns/locale';
import { toast } from 'sonner';

export default function AppointmentsPage() {
  const { appointments, customers, staff, services, addAppointment, updateAppointment, hasConflict, addPayment } = useSalon();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const [form, setForm] = useState({
    customerId: '',
    staffId: '',
    serviceId: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    time: '09:00',
  });

  const activeStaff = staff.filter(s => s.active);

  const dayAppointments = appointments
    .filter(a => {
      try { return isSameDay(parseISO(a.startTime), parseISO(selectedDate)); } catch { return false; }
    })
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

  const openAdd = () => {
    setForm({ customerId: '', staffId: '', serviceId: '', date: selectedDate, time: '09:00' });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.customerId || !form.staffId || !form.serviceId) {
      toast.error('Lütfen tüm alanları doldurun.');
      return;
    }
    const service = services.find(s => s.id === form.serviceId);
    if (!service) return;

    const start = new Date(`${form.date}T${form.time}`);
    const end = addMinutes(start, service.duration);

    if (hasConflict(form.staffId, start.toISOString(), end.toISOString())) {
      toast.error('Bu personelin seçilen saatte başka bir randevusu var!');
      return;
    }

    addAppointment({
      customerId: form.customerId,
      staffId: form.staffId,
      serviceId: form.serviceId,
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      status: 'bekliyor',
    });
    toast.success('Randevu oluşturuldu.');
    setDialogOpen(false);
  };

  const handleComplete = (id: string) => {
    const apt = appointments.find(a => a.id === id);
    if (!apt) return;
    updateAppointment(id, { status: 'tamamlandi' });
    const service = services.find(s => s.id === apt.serviceId);
    if (service) {
      addPayment({
        appointmentId: id,
        amount: service.price,
        type: 'nakit',
        date: new Date().toISOString(),
      });
    }
    toast.success('Randevu tamamlandı, ödeme kaydedildi.');
  };

  const handleCancel = (id: string) => {
    updateAppointment(id, { status: 'iptal' });
    toast.info('Randevu iptal edildi.');
  };

  const getCustomerName = (id: string) => customers.find(c => c.id === id)?.name ?? '-';
  const getStaffName = (id: string) => staff.find(s => s.id === id)?.name ?? '-';
  const getServiceName = (id: string) => services.find(s => s.id === id)?.name ?? '-';

  const statusLabel: Record<string, string> = { bekliyor: 'Bekliyor', tamamlandi: 'Tamamlandı', iptal: 'İptal' };
  const statusVariant = (s: string): 'default' | 'secondary' | 'destructive' =>
    s === 'tamamlandi' ? 'default' : s === 'iptal' ? 'destructive' : 'secondary';

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Randevular</h1>
        <div className="flex gap-2 items-center">
          <Input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="w-44" />
          <Button onClick={openAdd}><Plus className="h-4 w-4 mr-1" /> Yeni Randevu</Button>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        {format(parseISO(selectedDate), 'd MMMM yyyy, EEEE', { locale: tr })} — {dayAppointments.length} randevu
      </p>

      {dayAppointments.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Bu tarihte randevu bulunmamaktadır.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {dayAppointments.map(apt => (
            <Card key={apt.id}>
              <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-4">
                  <div className="text-center min-w-[60px]">
                    <p className="text-lg font-bold text-primary">{format(parseISO(apt.startTime), 'HH:mm')}</p>
                    <p className="text-xs text-muted-foreground">{format(parseISO(apt.endTime), 'HH:mm')}</p>
                  </div>
                  <div>
                    <p className="font-medium">{getCustomerName(apt.customerId)}</p>
                    <p className="text-sm text-muted-foreground">{getServiceName(apt.serviceId)} • {getStaffName(apt.staffId)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={statusVariant(apt.status)}>{statusLabel[apt.status]}</Badge>
                  {apt.status === 'bekliyor' && (
                    <>
                      <Button size="sm" onClick={() => handleComplete(apt.id)}>Tamamla</Button>
                      <Button size="sm" variant="outline" onClick={() => handleCancel(apt.id)}>İptal</Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Yeni Randevu</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Müşteri</Label>
              <Select value={form.customerId} onValueChange={v => setForm(f => ({ ...f, customerId: v }))}>
                <SelectTrigger><SelectValue placeholder="Müşteri seçin" /></SelectTrigger>
                <SelectContent>{customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Personel</Label>
              <Select value={form.staffId} onValueChange={v => setForm(f => ({ ...f, staffId: v }))}>
                <SelectTrigger><SelectValue placeholder="Personel seçin" /></SelectTrigger>
                <SelectContent>{activeStaff.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Hizmet</Label>
              <Select value={form.serviceId} onValueChange={v => setForm(f => ({ ...f, serviceId: v }))}>
                <SelectTrigger><SelectValue placeholder="Hizmet seçin" /></SelectTrigger>
                <SelectContent>{services.map(s => <SelectItem key={s.id} value={s.id}>{s.name} — ₺{s.price}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Tarih</Label><Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} /></div>
              <div><Label>Saat</Label><Input type="time" value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>İptal</Button>
            <Button onClick={handleSave}>Kaydet</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
