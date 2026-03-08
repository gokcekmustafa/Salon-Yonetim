import { useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useSalon } from '@/contexts/SalonContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Scissors, Clock, User, CalendarDays, CheckCircle2, ChevronLeft, Phone, MapPin, Building2 } from 'lucide-react';
import { format, addMinutes, addDays, isBefore, startOfDay } from 'date-fns';
import { tr } from 'date-fns/locale';
import { toast } from 'sonner';

type BookingStep = 'branch' | 'service' | 'staff' | 'datetime' | 'info';

export default function BookingPage() {
  const { salonSlug } = useParams<{ salonSlug: string }>();
  const { salon, services, staff, branches, appointments, addAppointment, addCustomer, customers, hasConflict } = useSalon();

  const [step, setStep] = useState<BookingStep>('branch');
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [booked, setBooked] = useState(false);

  const activeBranches = branches.filter(b => b.active);
  const branchStaff = staff.filter(s => s.active && s.branchId === selectedBranchId);
  const selectedService = services.find(s => s.id === selectedServiceId);
  const selectedStaff = staff.find(s => s.id === selectedStaffId);
  const selectedBranch = branches.find(b => b.id === selectedBranchId);

  const availableDates = useMemo(() => {
    const dates: Date[] = [];
    const today = startOfDay(new Date());
    for (let i = 0; i < 14; i++) {
      dates.push(addDays(today, i));
    }
    return dates;
  }, []);

  const timeSlots = useMemo(() => {
    if (!selectedStaffId || !selectedDate || !selectedService) return [];
    const slots: string[] = [];
    const date = new Date(selectedDate);
    for (let h = 9; h <= 20; h++) {
      for (let m = 0; m < 60; m += 30) {
        const start = new Date(date);
        start.setHours(h, m, 0, 0);
        const end = addMinutes(start, selectedService.duration);
        if (isBefore(start, new Date())) continue;
        if (end.getHours() > 21 || (end.getHours() === 21 && end.getMinutes() > 0)) continue;
        if (!hasConflict(selectedStaffId, start.toISOString(), end.toISOString())) {
          slots.push(format(start, 'HH:mm'));
        }
      }
    }
    return slots;
  }, [selectedStaffId, selectedDate, selectedService, hasConflict]);

  // Validate salon slug
  if (salonSlug && salonSlug !== salon.slug) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full text-center">
          <CardContent className="pt-8 pb-8 space-y-3">
            <Scissors className="h-12 w-12 mx-auto text-muted-foreground/40" />
            <h2 className="text-xl font-bold">Salon Bulunamadı</h2>
            <p className="text-muted-foreground text-sm">Bu adrese ait bir salon kayıtlı değil.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleBook = () => {
    if (!selectedService || !selectedStaffId || !selectedDate || !selectedTime || !customerName || !customerPhone) {
      toast.error('Lütfen tüm bilgileri doldurun.');
      return;
    }

    const existing = customers.find(c => c.phone === customerPhone.trim());
    let customerId: string;

    if (existing) {
      customerId = existing.id;
    } else {
      customerId = addCustomer({ name: customerName.trim(), phone: customerPhone.trim() });
    }

    const start = new Date(`${selectedDate}T${selectedTime}`);
    const end = addMinutes(start, selectedService.duration);

    if (hasConflict(selectedStaffId, start.toISOString(), end.toISOString())) {
      toast.error('Bu saat dolu! Lütfen başka bir saat seçin.');
      return;
    }

    addAppointment({
      customerId,
      staffId: selectedStaffId,
      serviceId: selectedServiceId,
      branchId: selectedBranchId,
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      status: 'bekliyor',
    });

    setBooked(true);
  };

  const allSteps: BookingStep[] = ['branch', 'service', 'staff', 'datetime', 'info'];
  const stepLabels = ['Şube', 'Hizmet', 'Personel', 'Tarih & Saat', 'Bilgiler'];

  const goBack = () => {
    const idx = allSteps.indexOf(step);
    if (idx > 0) setStep(allSteps[idx - 1]);
  };

  const resetBooking = () => {
    setBooked(false);
    setStep('branch');
    setSelectedBranchId('');
    setSelectedServiceId('');
    setSelectedStaffId('');
    setSelectedDate('');
    setSelectedTime('');
    setCustomerName('');
    setCustomerPhone('');
  };

  if (booked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full text-center">
          <CardContent className="pt-10 pb-10 space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-2xl font-bold">Randevunuz Oluşturuldu!</h2>
            <div className="text-sm text-muted-foreground space-y-1">
              <p><strong>{selectedService?.name}</strong></p>
              <p>{selectedStaff?.name} ile • {selectedBranch?.name}</p>
              <p>{selectedDate && format(new Date(selectedDate), 'd MMMM yyyy', { locale: tr })} — {selectedTime}</p>
            </div>
            <Separator />
            <p className="text-xs text-muted-foreground">
              {salon.name} • {salon.phone}
            </p>
            <Button variant="outline" onClick={resetBooking}>
              Yeni Randevu Al
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const stepIdx = allSteps.indexOf(step);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="max-w-2xl mx-auto px-4 py-6">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Scissors className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold">{salon.name}</h1>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {salon.address}</span>
                <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {salon.phone}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Progress */}
      <div className="max-w-2xl mx-auto px-4 py-4">
        <div className="flex items-center gap-1 text-xs">
          {allSteps.map((s, i) => {
            const isActive = i === stepIdx;
            const isDone = i < stepIdx;
            return (
              <div key={s} className="flex items-center gap-1 flex-1">
                <div className={`flex items-center gap-1 ${isActive ? 'text-primary font-semibold' : isDone ? 'text-primary/60' : 'text-muted-foreground'}`}>
                  <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold border-2 ${
                    isActive ? 'border-primary bg-primary text-primary-foreground' : isDone ? 'border-primary/60 bg-primary/10 text-primary' : 'border-muted-foreground/30'
                  }`}>
                    {isDone ? '✓' : i + 1}
                  </div>
                  <span className="hidden sm:inline">{stepLabels[i]}</span>
                </div>
                {i < allSteps.length - 1 && <div className={`flex-1 h-0.5 ${i < stepIdx ? 'bg-primary/40' : 'bg-border'}`} />}
              </div>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 pb-8">
        {step !== 'branch' && (
          <Button variant="ghost" size="sm" className="mb-3 -ml-2" onClick={goBack}>
            <ChevronLeft className="h-4 w-4 mr-1" /> Geri
          </Button>
        )}

        {/* Step 1: Branch */}
        {step === 'branch' && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Şube Seçin</h2>
            <div className="grid gap-3">
              {activeBranches.map(branch => (
                <Card
                  key={branch.id}
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    selectedBranchId === branch.id ? 'ring-2 ring-primary shadow-md' : ''
                  }`}
                  onClick={() => {
                    setSelectedBranchId(branch.id);
                    setSelectedStaffId('');
                    setStep('service');
                  }}
                >
                  <CardContent className="flex items-center gap-3 p-4">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Building2 className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{branch.name}</p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {branch.address}</span>
                        <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {branch.phone}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Service */}
        {step === 'service' && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Hizmet Seçin</h2>
            <div className="grid gap-3">
              {services.map(service => (
                <Card
                  key={service.id}
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    selectedServiceId === service.id ? 'ring-2 ring-primary shadow-md' : ''
                  }`}
                  onClick={() => {
                    setSelectedServiceId(service.id);
                    setStep('staff');
                  }}
                >
                  <CardContent className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Scissors className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{service.name}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" /> {service.duration} dk
                        </p>
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-sm font-semibold">₺{service.price}</Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Step 3: Staff (filtered by branch) */}
        {step === 'staff' && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Personel Seçin</h2>
            {branchStaff.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Bu şubede aktif personel bulunmamaktadır.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {branchStaff.map(member => (
                  <Card
                    key={member.id}
                    className={`cursor-pointer transition-all hover:shadow-md ${
                      selectedStaffId === member.id ? 'ring-2 ring-primary shadow-md' : ''
                    }`}
                    onClick={() => {
                      setSelectedStaffId(member.id);
                      setStep('datetime');
                    }}
                  >
                    <CardContent className="flex items-center gap-3 p-4">
                      <div className="h-11 w-11 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{member.name}</p>
                        <p className="text-xs text-muted-foreground">Müsait</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step 4: Date & Time */}
        {step === 'datetime' && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Tarih & Saat Seçin</h2>
            <div>
              <Label className="text-sm font-medium mb-2 block">Tarih</Label>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {availableDates.map(date => {
                  const dateStr = format(date, 'yyyy-MM-dd');
                  const isSelected = selectedDate === dateStr;
                  return (
                    <button
                      key={dateStr}
                      onClick={() => { setSelectedDate(dateStr); setSelectedTime(''); }}
                      className={`flex-shrink-0 flex flex-col items-center px-3 py-2 rounded-lg border-2 transition-all text-sm ${
                        isSelected
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border hover:border-primary/40 bg-card'
                      }`}
                    >
                      <span className="text-xs font-medium">{format(date, 'EEE', { locale: tr })}</span>
                      <span className="text-lg font-bold">{format(date, 'd')}</span>
                      <span className="text-xs">{format(date, 'MMM', { locale: tr })}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {selectedDate && (
              <div>
                <Label className="text-sm font-medium mb-2 block">Saat</Label>
                {timeSlots.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    Bu tarihte müsait saat bulunmamaktadır.
                  </p>
                ) : (
                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                    {timeSlots.map(time => (
                      <button
                        key={time}
                        onClick={() => setSelectedTime(time)}
                        className={`px-3 py-2 rounded-lg border-2 text-sm font-medium transition-all ${
                          selectedTime === time
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-border hover:border-primary/40 bg-card'
                        }`}
                      >
                        {time}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {selectedDate && selectedTime && (
              <Button className="w-full mt-2" onClick={() => setStep('info')}>
                Devam Et
              </Button>
            )}
          </div>
        )}

        {/* Step 5: Customer Info */}
        {step === 'info' && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Bilgileriniz</h2>
            <Card>
              <CardContent className="p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Şube</span>
                  <span className="font-medium">{selectedBranch?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Hizmet</span>
                  <span className="font-medium">{selectedService?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Personel</span>
                  <span className="font-medium">{selectedStaff?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tarih</span>
                  <span className="font-medium">{selectedDate && format(new Date(selectedDate), 'd MMMM yyyy', { locale: tr })}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Saat</span>
                  <span className="font-medium">{selectedTime}</span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Ücret</span>
                  <span className="font-bold text-primary">₺{selectedService?.price}</span>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Ad Soyad</Label>
                <Input
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                  placeholder="Adınız ve soyadınız"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Telefon</Label>
                <Input
                  value={customerPhone}
                  onChange={e => setCustomerPhone(e.target.value)}
                  placeholder="0500 000 0000"
                  type="tel"
                />
              </div>
            </div>

            <Button
              className="w-full"
              disabled={!customerName.trim() || !customerPhone.trim()}
              onClick={handleBook}
            >
              <CalendarDays className="h-4 w-4 mr-2" />
              Randevu Oluştur
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}