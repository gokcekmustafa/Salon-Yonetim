import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useFormGuard } from '@/hooks/useFormGuard';
import { supabase } from '@/integrations/supabase/client';
import { useAuditLog } from '@/hooks/useAuditLog';
import { useAuth } from '@/contexts/AuthContext';
import { DbAppointment } from '@/hooks/useSalonData';
import { useBranchFilteredData } from '@/hooks/useBranchFilteredData';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Plus, ChevronLeft, ChevronRight, CalendarDays, CalendarRange, Users, Building2, DoorOpen, Pencil, Trash2, Loader2, Banknote, CreditCard, FileSpreadsheet, FileText, List, LayoutGrid, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { exportToExcel, exportToPDF } from '@/lib/exportUtils';
import { format, addMinutes, addDays, subDays, addWeeks, subWeeks, differenceInMinutes } from 'date-fns';
import { tr } from 'date-fns/locale';
import { toast } from 'sonner';
import DayCalendarView from '@/components/calendar/DayCalendarView';
import WeekCalendarView from '@/components/calendar/WeekCalendarView';
import { usePermissions } from '@/hooks/usePermissions';
import { NoPermission } from '@/components/permissions/NoPermission';
import { getEffectiveAppointmentStatus, type AppointmentUiStatus } from '@/lib/appointmentStatus';
import { useQuery } from '@tanstack/react-query';
import { StaffPageGuard } from '@/components/permissions/StaffPageGuard';

type ViewMode = 'day' | 'week';
type ListGroupMode = 'room' | 'staff' | 'list' | null;
type Room = { id: string; salon_id: string; name: string; is_active: boolean; room_number: string | null };
type AppointmentForm = {
  customerId: string;
  staffId: string;
  serviceIds: string[];
  roomId: string;
  date: string;
  time: string;
  duration: string;
};
type ServiceSaleLite = {
  service_id: string;
  customer_id: string | null;
  quantity: number;
  created_at: string;
};

const SESSION_STATUSES = [
  { value: 'waiting', label: 'Bekliyor' },
  { value: 'in_session', label: 'Seansta' },
  { value: 'completed', label: 'Tamamlandı' },
];

const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120];

export default function AppointmentsPage() {
  const { hasPermission } = usePermissions();
  const { currentSalonId, user, isSalonAdmin, isSuperAdmin } = useAuth();
  const { logAction } = useAuditLog();
  const {
    appointments, customers, staff, services, branches,
    addAppointment, updateAppointment, addPayment, hasConflict, refetch,
  } = useBranchFilteredData();

  const [searchParams, setSearchParams] = useSearchParams();
  const [viewMode, setViewMode] = useState<ViewMode>('day');
  const [listGroupMode, setListGroupMode] = useState<ListGroupMode>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [filteredStaffId, setFilteredStaffId] = useState<string | null>(null);
  const [filteredBranchId, setFilteredBranchId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  useFormGuard(dialogOpen);
  const [detailApt, setDetailApt] = useState<DbAppointment | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('');
  const [isRescheduling, setIsRescheduling] = useState(false);
  const canAdminManageAppointments = isSalonAdmin || isSuperAdmin;

  // Payment method selection for completing
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('cash');

  // Fetch cash boxes for auto-routing payments
  const { data: cashBoxes = [] } = useQuery({
    queryKey: ['cash_boxes', currentSalonId],
    queryFn: async () => {
      if (!currentSalonId) return [];
      const { data } = await supabase.from('cash_boxes').select('*').eq('salon_id', currentSalonId).eq('is_active', true);
      return data || [];
    },
    enabled: !!currentSalonId,
  });

  // Rooms
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomDialogOpen, setRoomDialogOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [roomName, setRoomName] = useState('');
  const [savingRoom, setSavingRoom] = useState(false);
  const [showRoomManager, setShowRoomManager] = useState(false);

  const [form, setForm] = useState<AppointmentForm>({
    customerId: '',
    staffId: '',
    serviceIds: [] as string[],
    roomId: 'none',
    date: format(new Date(), 'yyyy-MM-dd'),
    time: '09:00',
    duration: '60',
  });

  const activeStaff = staff.filter(s => s.is_active);
  const activeBranches = branches.filter(b => b.is_active);
  const activeRooms = rooms.filter(r => r.is_active);

  const { data: serviceSales = [] } = useQuery({
    queryKey: ['appointment_service_sales', currentSalonId],
    queryFn: async () => {
      if (!currentSalonId) return [] as ServiceSaleLite[];
      const { data } = await supabase
        .from('service_sales')
        .select('service_id, customer_id, quantity, created_at')
        .eq('salon_id', currentSalonId);
      return (data || []) as ServiceSaleLite[];
    },
    enabled: !!currentSalonId,
  });

  // Fetch service categories for accordion grouping
  type ServiceCategory = { id: string; name: string; salon_id: string; sort_order: number | null };
  const [serviceCategories, setServiceCategories] = useState<ServiceCategory[]>([]);
  useEffect(() => {
    if (!currentSalonId) return;
    supabase.from('service_categories').select('*').eq('salon_id', currentSalonId).order('sort_order')
      .then(({ data }) => setServiceCategories((data as ServiceCategory[]) || []));
  }, [currentSalonId]);

  // Group active services by category
  const categorizedServices = useMemo(() => {
    const activeServices = services.filter(s => s.is_active);
    const grouped: { category: ServiceCategory; services: typeof activeServices }[] = [];
    const uncategorized: typeof activeServices = [];

    for (const svc of activeServices) {
      const catId = (svc as any).category_id;
      if (catId) {
        const existing = grouped.find(g => g.category.id === catId);
        if (existing) {
          existing.services.push(svc);
        } else {
          const cat = serviceCategories.find(c => c.id === catId);
          if (cat) grouped.push({ category: cat, services: [svc] });
          else uncategorized.push(svc);
        }
      } else {
        uncategorized.push(svc);
      }
    }

    // Sort groups by sort_order
    grouped.sort((a, b) => (a.category.sort_order ?? 0) - (b.category.sort_order ?? 0));

    if (uncategorized.length > 0) {
      grouped.push({ category: { id: '__uncategorized', name: 'Diğer Hizmetler', salon_id: '', sort_order: 9999 }, services: uncategorized });
    }

    return grouped;
  }, [services, serviceCategories]);

  const filteredStaffList = filteredBranchId
    ? activeStaff.filter(s => s.branch_id === filteredBranchId)
    : activeStaff;

  const customerPurchasedServices = useMemo(() => {
    if (!form.customerId) return [] as Array<{
      serviceId: string;
      name: string;
      totalSold: number;
      usedCount: number;
      remainingCount: number;
      duration: number;
      price: number;
      lastSoldAt: string | null;
    }>;

    const grouped = new Map<string, {
      serviceId: string;
      name: string;
      totalSold: number;
      duration: number;
      price: number;
      lastSoldAt: string | null;
    }>();

    serviceSales
      .filter(sale => sale.customer_id === form.customerId)
      .forEach(sale => {
        const service = services.find(item => item.id === sale.service_id);
        if (!service) return;

        const current = grouped.get(sale.service_id) || {
          serviceId: sale.service_id,
          name: service.name,
          totalSold: 0,
          duration: service.duration,
          price: service.price,
          lastSoldAt: null,
        };

        current.totalSold += Number(sale.quantity || 1);
        if (!current.lastSoldAt || new Date(sale.created_at) > new Date(current.lastSoldAt)) {
          current.lastSoldAt = sale.created_at;
        }

        grouped.set(sale.service_id, current);
      });

    return Array.from(grouped.values())
      .map(item => {
        const usedCount = appointments.filter(appointment =>
          appointment.customer_id === form.customerId &&
          appointment.service_id === item.serviceId &&
          appointment.status !== 'iptal'
        ).length;

        return {
          ...item,
          usedCount,
          remainingCount: Math.max(item.totalSold - usedCount, 0),
        };
      })
      .sort((a, b) => {
        if (b.remainingCount !== a.remainingCount) return b.remainingCount - a.remainingCount;
        return new Date(b.lastSoldAt || 0).getTime() - new Date(a.lastSoldAt || 0).getTime();
      });
  }, [appointments, form.customerId, serviceSales, services]);

  // Fetch rooms
  const fetchRooms = useCallback(async () => {
    if (!currentSalonId) return;
    const { data } = await supabase.from('rooms').select('*').eq('salon_id', currentSalonId).order('name');
    setRooms((data as Room[]) || []);
  }, [currentSalonId]);

  useEffect(() => { fetchRooms(); }, [fetchRooms]);

  // Realtime for appointments
  useEffect(() => {
    const channel = supabase
      .channel('appointment-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, () => { refetch(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [refetch]);

  const navigatePrev = () => {
    if (viewMode === 'day') setCurrentDate(d => subDays(d, 1));
    else setCurrentDate(d => subWeeks(d, 1));
  };

  const navigateNext = () => {
    if (viewMode === 'day') setCurrentDate(d => addDays(d, 1));
    else setCurrentDate(d => addWeeks(d, 1));
  };

  const goToday = () => setCurrentDate(new Date());

  const openAdd = () => {
    setForm({
      customerId: '',
      staffId: filteredStaffId || '',
      serviceIds: [],
      roomId: 'none',
      date: format(currentDate, 'yyyy-MM-dd'),
      time: '09:00',
      duration: '60',
    });
    setDialogOpen(true);
  };

  // Auto-open new appointment dialog from URL param
  useEffect(() => {
    const shouldOpen = searchParams.get('yeniRandevu') === '1';
    const customerId = searchParams.get('customer_id') || '';
    const serviceIds = (searchParams.get('service_ids') || '')
      .split(',')
      .map(id => id.trim())
      .filter(Boolean);

    if (shouldOpen || customerId || serviceIds.length > 0) {
      setForm({
        customerId,
        staffId: filteredStaffId || '',
        serviceIds,
        roomId: 'none',
        date: format(currentDate, 'yyyy-MM-dd'),
        time: '09:00',
        duration: '60',
      });
      setDialogOpen(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, filteredStaffId, currentDate, setSearchParams]);

  // Multi-service totals
  const selectedServices = services.filter(s => form.serviceIds.includes(s.id));
  const totalDuration = selectedServices.reduce((sum, s) => sum + s.duration, 0);
  const totalPrice = selectedServices.reduce((sum, s) => sum + s.price, 0);

  // Existing appointment warning
  const existingCustomerAppointments = useMemo(() => {
    if (!form.customerId) return [];
    return appointments.filter(a =>
      a.customer_id === form.customerId &&
      a.status !== 'iptal' &&
      a.status !== 'tamamlandi' &&
      new Date(a.start_time) >= new Date()
    );
  }, [form.customerId, appointments]);

  // Duration mismatch warning
  const durationMismatch = form.serviceIds.length > 0 && totalDuration > 0 && Number(form.duration) !== totalDuration;

  // Auto-set duration from selected services
  useEffect(() => {
    if (totalDuration > 0) {
      setForm(f => ({ ...f, duration: String(totalDuration) }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalDuration]);

  const toggleService = (serviceId: string) => {
    setForm(f => ({
      ...f,
      serviceIds: f.serviceIds.includes(serviceId)
        ? f.serviceIds.filter(id => id !== serviceId)
        : [...f.serviceIds, serviceId],
    }));
  };

  const handleSave = async () => {
    if (!form.customerId || !form.staffId || form.serviceIds.length === 0) {
      toast.error('Lütfen müşteri, personel ve en az bir hizmet seçin.');
      return;
    }

    const staffMember = staff.find(s => s.id === form.staffId);
    let currentStart = new Date(`${form.date}T${form.time}`);
    let hasError = false;

    for (const serviceId of form.serviceIds) {
      const svc = services.find(s => s.id === serviceId);
      const dur = svc?.duration || 60;
      const end = addMinutes(currentStart, dur);

      if (hasConflict(form.staffId, currentStart.toISOString(), end.toISOString())) {
        toast.error(`Bu personelin ${format(currentStart, 'HH:mm')} saatinde başka bir randevusu var!`);
        hasError = true;
        break;
      }

      if (form.roomId !== 'none') {
        const roomConflict = appointments.some(a => {
          if (a.room_id !== form.roomId || a.status === 'iptal') return false;
          return currentStart < new Date(a.end_time) && end > new Date(a.start_time);
        });
        if (roomConflict) {
          toast.error(`Seçilen oda ${format(currentStart, 'HH:mm')} saatinde dolu!`);
          hasError = true;
          break;
        }
      }

      const error = await addAppointment({
        customer_id: form.customerId,
        staff_id: form.staffId,
        service_id: serviceId,
        branch_id: staffMember?.branch_id || '',
        start_time: currentStart.toISOString(),
        end_time: end.toISOString(),
        status: 'bekliyor',
        room_id: form.roomId !== 'none' ? form.roomId : null,
      });

      if (error) {
        toast.error('Randevu oluşturulamadı: ' + error.message);
        hasError = true;
        break;
      }

      currentStart = end; // next service starts where this one ends
    }

    if (!hasError) {
      const customerName = customers.find(c => c.id === form.customerId)?.name || '';
      logAction({ action: 'create', target_type: 'appointment', target_label: customerName, details: { services: form.serviceIds.length, date: form.date } });
      toast.success(`${form.serviceIds.length} randevu oluşturuldu.`);
      setDialogOpen(false);
      refetch();
    }
  };

  const handleAppointmentClick = (apt: DbAppointment) => {
    const latest = appointments.find(a => a.id === apt.id) || apt;
    setDetailApt(latest);
    setRescheduleDate(format(new Date(latest.start_time), 'yyyy-MM-dd'));
    setRescheduleTime(format(new Date(latest.start_time), 'HH:mm'));
    setDetailOpen(true);
  };

  const openCompleteDialog = () => {
    setSelectedPaymentMethod('cash');
    setCompleteDialogOpen(true);
  };

const handleComplete = async () => {
    if (!detailApt || !user) return;

    const completeError = await updateAppointment(detailApt.id, {
      status: 'tamamlandi',
      session_status: 'completed',
    });

    if (completeError) {
      toast.error('Randevu tamamlanamadı.');
      return;
    }

    setDetailApt(prev => (prev ? { ...prev, status: 'tamamlandi', session_status: 'completed' } : prev));

    const service = services.find(s => s.id === detailApt.service_id);
    if (service) {
      // Create payment record
      const paymentTypeMap: Record<string, string> = { cash: 'nakit', credit_card: 'kart', eft: 'havale' };
      await addPayment({ appointment_id: detailApt.id, amount: service.price, payment_type: paymentTypeMap[selectedPaymentMethod] || 'nakit' });

      // Route to correct cash box in cash_transactions
      const targetBox = cashBoxes.find(b => b.payment_method === selectedPaymentMethod);
      if (targetBox && currentSalonId) {
        await supabase.from('cash_transactions').insert({
          salon_id: currentSalonId,
          created_by: user.id,
          type: 'income',
          amount: service.price,
          description: `Randevu: ${customers.find(c => c.id === detailApt.customer_id)?.name || ''} — ${service.name}`,
          transaction_date: new Date().toISOString(),
          payment_method: selectedPaymentMethod,
          cash_box_id: targetBox.id,
        });
      }
    }
    const customerName = customers.find(c => c.id === detailApt.customer_id)?.name || '';
    logAction({ action: 'complete', target_type: 'appointment', target_id: detailApt.id, target_label: customerName, details: { payment_method: selectedPaymentMethod, amount: service?.price } });
    toast.success('Randevu tamamlandı, ödeme kasaya kaydedildi.');
    setCompleteDialogOpen(false);
    setDetailOpen(false);
    setDetailApt(null);
  };

  const handleCancelConfirm = async () => {
    if (!currentDetailApt || !canAdminManageAppointments) return;

    const error = await updateAppointment(currentDetailApt.id, { status: 'iptal' });
    if (error) {
      toast.error('Randevu iptal edilemedi.');
      setCancelConfirmOpen(false);
      return;
    }

    setDetailApt(prev => (prev && prev.id === currentDetailApt.id ? { ...prev, status: 'iptal' } : prev));
    setCancelConfirmOpen(false);
    toast.info('Randevu iptal edildi.');
  };

  const handleReactivate = async () => {
    if (!currentDetailApt || !canAdminManageAppointments) return;

    const error = await updateAppointment(currentDetailApt.id, { status: 'bekliyor' });
    if (error) {
      toast.error('Randevu aktif edilemedi.');
      return;
    }

    setDetailApt(prev => (prev && prev.id === currentDetailApt.id ? { ...prev, status: 'bekliyor' } : prev));
    toast.success('Randevu tekrar aktif edildi.');
  };

  const handleDeleteConfirm = async () => {
    if (!currentDetailApt || !canAdminManageAppointments) return;

    const { error } = await supabase.from('appointments').delete().eq('id', currentDetailApt.id);
    if (error) {
      toast.error('Randevu silinemedi.');
      setDeleteConfirmOpen(false);
      return;
    }

    setDeleteConfirmOpen(false);
    setDetailOpen(false);
    setDetailApt(null);
    refetch();
    toast.success('Randevu silindi.');
  };

  const handleReschedule = async () => {
    if (!currentDetailApt || !canAdminManageAppointments) return;
    if (!rescheduleDate || !rescheduleTime) {
      toast.error('Lütfen tarih ve saat seçin.');
      return;
    }

    const start = new Date(`${rescheduleDate}T${rescheduleTime}`);
    if (Number.isNaN(start.getTime())) {
      toast.error('Geçerli bir tarih/saat girin.');
      return;
    }

    const currentDuration = Math.max(
      differenceInMinutes(new Date(currentDetailApt.end_time), new Date(currentDetailApt.start_time)),
      15,
    );
    const end = addMinutes(start, currentDuration);

    if (hasConflict(currentDetailApt.staff_id, start.toISOString(), end.toISOString(), currentDetailApt.id)) {
      toast.error('Bu personelin seçilen saatte başka bir randevusu var!');
      return;
    }

    if (currentDetailApt.room_id) {
      const roomConflict = appointments.some(a => {
        if (a.id === currentDetailApt.id || a.room_id !== currentDetailApt.room_id || a.status === 'iptal') return false;
        return start < new Date(a.end_time) && end > new Date(a.start_time);
      });

      if (roomConflict) {
        toast.error('Seçilen oda bu saatte dolu!');
        return;
      }
    }

    setIsRescheduling(true);
    const error = await updateAppointment(currentDetailApt.id, {
      start_time: start.toISOString(),
      end_time: end.toISOString(),
    });
    setIsRescheduling(false);

    if (error) {
      toast.error('Randevu tarihi güncellenemedi.');
      return;
    }

    setDetailApt(prev =>
      prev && prev.id === currentDetailApt.id
        ? { ...prev, start_time: start.toISOString(), end_time: end.toISOString() }
        : prev,
    );

    toast.success('Randevu tarihi güncellendi.');
  };

  const updateSessionStatus = async (aptId: string, sessionStatus: string) => {
    const current = appointments.find(a => a.id === aptId) || detailApt;
    const nextStatus = current?.status === 'iptal' ? 'iptal' : sessionStatus === 'completed' ? 'tamamlandi' : 'bekliyor';

    const error = await updateAppointment(aptId, {
      session_status: sessionStatus,
      status: nextStatus,
    });

    if (error) {
      toast.error('Durum güncellenemedi.');
      return;
    }

    setDetailApt(prev => (prev && prev.id === aptId ? { ...prev, session_status: sessionStatus, status: nextStatus } : prev));
    toast.success('Durum güncellendi.');
  };

  const updateRoomAssignment = async (aptId: string, roomId: string) => {
    await supabase.from('appointments').update({ room_id: roomId === 'none' ? null : roomId }).eq('id', aptId);
    toast.success('Oda güncellendi.');
    refetch();
  };

  const getCustomerName = (id: string) => customers.find(c => c.id === id)?.name ?? '-';
  const getStaffName = (id: string) => staff.find(s => s.id === id)?.name ?? '-';
  const getServiceName = (id: string) => services.find(s => s.id === id)?.name ?? '-';
  const getServicePrice = (id: string) => services.find(s => s.id === id)?.price ?? 0;
  const getBranchName = (id: string) => branches.find(b => b.id === id)?.name ?? '-';
  const getRoomName = (id: string | null) => rooms.find(r => r.id === id)?.name ?? '-';

  const statusLabel: Record<AppointmentUiStatus, string> = {
    bekliyor: 'Bekliyor',
    in_session: 'Seansta',
    tamamlandi: 'Tamamlandı',
    iptal: 'İptal',
  };
  const statusVariant = (s: AppointmentUiStatus): 'default' | 'secondary' | 'destructive' =>
    s === 'tamamlandi' ? 'default' : s === 'iptal' ? 'destructive' : 'secondary';

const liveDetailApt = detailApt ? appointments.find(a => a.id === detailApt.id) : null;
  const currentDetailApt = detailApt ? ({ ...detailApt, ...(liveDetailApt || {}) } as DbAppointment) : null;
  const currentDetailStatus = currentDetailApt ? getEffectiveAppointmentStatus(currentDetailApt) : 'bekliyor';

  // Room CRUD
  const [roomNumber, setRoomNumber] = useState('');
  const handleSaveRoom = async () => {
    if (!roomName.trim() || !currentSalonId) return;
    setSavingRoom(true);
    if (editingRoom) {
      await supabase.from('rooms').update({ name: roomName.trim(), room_number: roomNumber.trim() || null } as any).eq('id', editingRoom.id);
      toast.success('Oda güncellendi');
    } else {
      await supabase.from('rooms').insert({ name: roomName.trim(), salon_id: currentSalonId, room_number: roomNumber.trim() || null } as any);
      toast.success('Oda eklendi');
    }
    setSavingRoom(false);
    setRoomDialogOpen(false);
    setRoomName('');
    setRoomNumber('');
    setEditingRoom(null);
    fetchRooms();
  };

  const deleteRoom = async (id: string) => {
    await supabase.from('rooms').delete().eq('id', id);
    toast.success('Oda silindi');
    fetchRooms();
  };

  if (!hasPermission('can_manage_appointments')) return <NoPermission feature="Randevu Yönetimi" />;

  return (
    <StaffPageGuard permissionKey="page_appointments" featureLabel="Randevular">
    <div className="page-container animate-in">
      {/* Header */}
      <div className="flex flex-col gap-3" style={{ minHeight: 'auto', contain: 'layout' }}>
        <div className="page-header" style={{ minHeight: '48px' }}>
          <div>
            <h1 className="page-title">Randevular</h1>
            <p className="page-subtitle">{format(currentDate, 'd MMMM yyyy', { locale: tr })}</p>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
            <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs" onClick={() => {
              const headers = ['Tarih', 'Müşteri', 'Personel', 'Hizmet', 'Durum'];
              const rows = appointments.map(a => ({
                'Tarih': format(new Date(a.start_time), 'd MMM yyyy HH:mm', { locale: tr }),
                'Müşteri': customers.find(c => c.id === a.customer_id)?.name || '-',
                'Personel': staff.find(s => s.id === a.staff_id)?.name || '-',
                'Hizmet': services.find(s => s.id === a.service_id)?.name || '-',
                'Durum': a.status === 'tamamlandi' ? 'Tamamlandı' : a.status === 'iptal' ? 'İptal' : 'Bekliyor',
              }));
              exportToExcel(rows, headers, 'randevular');
            }}>
              <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
            </Button>
            <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs" onClick={() => {
              const headers = ['Tarih', 'Müşteri', 'Personel', 'Hizmet', 'Durum'];
              const rows = appointments.map(a => [
                format(new Date(a.start_time), 'd MMM yyyy HH:mm', { locale: tr }),
                customers.find(c => c.id === a.customer_id)?.name || '-',
                staff.find(s => s.id === a.staff_id)?.name || '-',
                services.find(s => s.id === a.service_id)?.name || '-',
                a.status === 'tamamlandi' ? 'Tamamlandı' : a.status === 'iptal' ? 'İptal' : 'Bekliyor',
              ]);
              exportToPDF(rows, headers, 'Randevu Listesi', 'randevular', [`Toplam: ${appointments.length} randevu`]);
            }}>
              <FileText className="h-3.5 w-3.5" /> PDF
            </Button>
            <Button variant="outline" size="sm" className="h-9 gap-1.5 flex-1 sm:flex-initial" onClick={() => setShowRoomManager(!showRoomManager)}>
              <DoorOpen className="h-4 w-4" /> <span className="hidden xs:inline">Odalar</span>
            </Button>
            <Button onClick={openAdd} size="sm" className="h-9 flex-1 sm:flex-initial">
              <Plus className="h-4 w-4 mr-1.5" /> <span className="hidden xs:inline">Yeni</span> Randevu
            </Button>
          </div>
        </div>

        {/* Room Manager (collapsible) */}
        {showRoomManager && (
          <Card className="shadow-soft border-border/60">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <DoorOpen className="h-5 w-5 text-primary" />
                  <div><CardTitle className="text-base">Seans Odaları</CardTitle><CardDescription>Seans odalarını yönetin</CardDescription></div>
                </div>
                <Button size="sm" onClick={() => { setEditingRoom(null); setRoomName(''); setRoomNumber(''); setRoomDialogOpen(true); }} className="gap-1.5 h-8">
                  <Plus className="h-3.5 w-3.5" /> Oda Ekle
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {rooms.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Henüz oda eklenmemiş</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {rooms.map(r => (
                    <div key={r.id} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border/60 bg-muted/30">
                      <DoorOpen className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium">{r.name}</span>
                      {r.room_number && <span className="text-xs text-muted-foreground">#{r.room_number}</span>}
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setEditingRoom(r); setRoomName(r.name); setRoomNumber(r.room_number || ''); setRoomDialogOpen(true); }}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => deleteRoom(r.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Controls bar */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <div className="flex items-center gap-2">
            <div className="flex border rounded-lg overflow-hidden shrink-0">
              <TooltipProvider delayDuration={300}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => { setViewMode('day'); setListGroupMode(null); }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors ${
                        !listGroupMode && viewMode === 'day' ? 'bg-primary text-primary-foreground' : 'bg-card hover:bg-muted text-foreground'
                      }`}
                    >
                      <CalendarDays className="h-3.5 w-3.5" /> <span className="hidden xs:inline">Günlük</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="bg-foreground text-background text-xs rounded-md px-3 py-1.5" style={{ borderRadius: '6px', fontSize: '12px' }}>Seçili günün saatlik takvim görünümü</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => { setViewMode('week'); setListGroupMode(null); }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors ${
                        !listGroupMode && viewMode === 'week' ? 'bg-primary text-primary-foreground' : 'bg-card hover:bg-muted text-foreground'
                      }`}
                    >
                      <CalendarRange className="h-3.5 w-3.5" /> <span className="hidden xs:inline">Haftalık</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="bg-foreground text-background text-xs rounded-md px-3 py-1.5" style={{ borderRadius: '6px', fontSize: '12px' }}>7 günlük haftalık takvim görünümü</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setListGroupMode('room')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors ${
                        listGroupMode === 'room' ? 'bg-primary text-primary-foreground' : 'bg-card hover:bg-muted text-foreground'
                      }`}
                    >
                      <DoorOpen className="h-3.5 w-3.5" /> <span className="hidden xs:inline">Odaya Göre</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="bg-foreground text-background text-xs rounded-md px-3 py-1.5" style={{ borderRadius: '6px', fontSize: '12px' }}>Randevuları seans odalarına göre grupla</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setListGroupMode('staff')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors ${
                        listGroupMode === 'staff' ? 'bg-primary text-primary-foreground' : 'bg-card hover:bg-muted text-foreground'
                      }`}
                    >
                      <Users className="h-3.5 w-3.5" /> <span className="hidden xs:inline">Personele Göre</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="bg-foreground text-background text-xs rounded-md px-3 py-1.5" style={{ borderRadius: '6px', fontSize: '12px' }}>Randevuları personele göre grupla</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setListGroupMode('list')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors ${
                        listGroupMode === 'list' ? 'bg-primary text-primary-foreground' : 'bg-card hover:bg-muted text-foreground'
                      }`}
                    >
                      <List className="h-3.5 w-3.5" /> <span className="hidden xs:inline">Liste</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="bg-foreground text-background text-xs rounded-md px-3 py-1.5" style={{ borderRadius: '6px', fontSize: '12px' }}>Tüm randevuları düz liste olarak görüntüle</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" onClick={navigatePrev} className="h-8 w-8">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={goToday} className="h-8 text-xs">
                Bugün
              </Button>
              <Button variant="outline" size="icon" onClick={navigateNext} className="h-8 w-8">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2 sm:ml-auto">
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1.5">
                    <Building2 className="h-4 w-4 text-muted-foreground hidden sm:block" />
                    <Select
                      value={filteredBranchId || 'all'}
                      onValueChange={v => {
                        setFilteredBranchId(v === 'all' ? null : v);
                        setFilteredStaffId(null);
                      }}
                    >
                      <SelectTrigger className="h-8 w-32 sm:w-36 text-xs">
                        <SelectValue placeholder="Tüm Şubeler" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Tüm Şubeler</SelectItem>
                        {activeBranches.map(b => (
                          <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </TooltipTrigger>
                <TooltipContent className="bg-foreground text-background text-xs rounded-md px-3 py-1.5" style={{ borderRadius: '6px', fontSize: '12px' }}>Randevuları şubeye göre filtrele</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1.5">
                    <Users className="h-4 w-4 text-muted-foreground hidden sm:block" />
                    <Select
                      value={filteredStaffId || 'all'}
                      onValueChange={v => setFilteredStaffId(v === 'all' ? null : v)}
                    >
                      <SelectTrigger className="h-8 w-32 sm:w-36 text-xs">
                        <SelectValue placeholder="Tüm Personel" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Tüm Personel</SelectItem>
                        {filteredStaffList.map(s => (
                          <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </TooltipTrigger>
                <TooltipContent className="bg-foreground text-background text-xs rounded-md px-3 py-1.5" style={{ borderRadius: '6px', fontSize: '12px' }}>Randevuları personele göre filtrele</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </div>

      {/* Calendar or List View */}
      {listGroupMode ? (
        <div className="overflow-auto max-h-[calc(100vh-280px)] sm:max-h-[calc(100vh-240px)]">
          {(() => {
            const filtered = appointments.filter(a => {
              if (filteredStaffId && a.staff_id !== filteredStaffId) return false;
              if (filteredBranchId && a.branch_id !== filteredBranchId) return false;
              return true;
            });

            if (listGroupMode === 'list') {
              return (
                <Card className="shadow-soft border-border/60">
                  <CardContent className="p-0">
                    <div className="divide-y">
                      {filtered.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-8">Randevu bulunamadı</p>
                      ) : filtered.map(a => {
                        const effStatus = getEffectiveAppointmentStatus(a);
                        return (
                          <div key={a.id} className="flex items-center gap-3 p-3 hover:bg-muted/50 cursor-pointer" onClick={() => handleAppointmentClick(a)}>
                            <Badge variant={statusVariant(effStatus)} className="text-[10px] w-20 justify-center">{statusLabel[effStatus]}</Badge>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{getCustomerName(a.customer_id)}</p>
                              <p className="text-xs text-muted-foreground">{getServiceName(a.service_id)} • {getStaffName(a.staff_id)}</p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-sm font-medium">{format(new Date(a.start_time), 'HH:mm', { locale: tr })}</p>
                              <p className="text-xs text-muted-foreground">{format(new Date(a.start_time), 'd MMM', { locale: tr })}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              );
            }

            // Group by room or staff
            const groups: Record<string, typeof filtered> = {};
            filtered.forEach(a => {
              const key = listGroupMode === 'room' ? (a.room_id || 'unassigned') : a.staff_id;
              if (!groups[key]) groups[key] = [];
              groups[key].push(a);
            });

            const getGroupLabel = (key: string) => {
              if (listGroupMode === 'room') return key === 'unassigned' ? 'Oda Atanmamış' : getRoomName(key);
              return getStaffName(key);
            };

            return (
              <div className="space-y-4">
                {Object.entries(groups).map(([key, apts]) => (
                  <Card key={key} className="shadow-soft border-border/60">
                    <CardHeader className="pb-2 pt-3 px-4">
                      <div className="flex items-center gap-2">
                        {listGroupMode === 'room' ? <DoorOpen className="h-4 w-4 text-primary" /> : <Users className="h-4 w-4 text-primary" />}
                        <CardTitle className="text-sm">{getGroupLabel(key)}</CardTitle>
                        <Badge variant="secondary" className="text-[10px]">{apts.length}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="divide-y">
                        {apts.map(a => {
                          const effStatus = getEffectiveAppointmentStatus(a);
                          return (
                            <div key={a.id} className="flex items-center gap-3 p-3 hover:bg-muted/50 cursor-pointer" onClick={() => handleAppointmentClick(a)}>
                              <Badge variant={statusVariant(effStatus)} className="text-[10px] w-20 justify-center">{statusLabel[effStatus]}</Badge>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{getCustomerName(a.customer_id)}</p>
                                <p className="text-xs text-muted-foreground">
                                  {getServiceName(a.service_id)}
                                  {listGroupMode === 'room' && ` • ${getStaffName(a.staff_id)}`}
                                  {listGroupMode === 'staff' && a.room_id && ` • ${getRoomName(a.room_id)}`}
                                </p>
                              </div>
                              <div className="text-right shrink-0">
                                <p className="text-sm font-medium">{format(new Date(a.start_time), 'HH:mm', { locale: tr })}</p>
                                <p className="text-xs text-muted-foreground">{format(new Date(a.start_time), 'd MMM', { locale: tr })}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {Object.keys(groups).length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-8">Randevu bulunamadı</p>
                )}
              </div>
            );
          })()}
        </div>
      ) : (
        <div className="overflow-auto max-h-[calc(100vh-280px)] sm:max-h-[calc(100vh-240px)]">
          {viewMode === 'day' ? (
            <DayCalendarView
              date={currentDate}
              filteredStaffId={filteredStaffId}
              filteredBranchId={filteredBranchId}
              onAppointmentClick={handleAppointmentClick}
              rooms={rooms}
              appointments={appointments}
              staff={staff}
              customers={customers}
              services={services}
              branches={branches}
              updateAppointment={updateAppointment}
              hasConflict={hasConflict}
            />
          ) : (
            <WeekCalendarView
              date={currentDate}
              filteredStaffId={filteredStaffId}
              filteredBranchId={filteredBranchId}
              onAppointmentClick={handleAppointmentClick}
              appointments={appointments}
              staff={staff}
              customers={customers}
              services={services}
              updateAppointment={updateAppointment}
              hasConflict={hasConflict}
            />
          )}
        </div>
      )}

      {/* New Appointment Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Yeni Randevu</DialogTitle><DialogDescription>Randevu bilgilerini girin</DialogDescription></DialogHeader>

          {/* Existing appointment warning */}
          {existingCustomerAppointments.length > 0 && (
            <Alert variant="destructive" className="border-orange-300 bg-orange-50 text-orange-800 dark:bg-orange-950 dark:text-orange-200 dark:border-orange-800">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <span className="font-semibold">Bu müşterinin aktif randevusu var:</span>
                <ul className="mt-1 space-y-0.5 text-xs">
                  {existingCustomerAppointments.slice(0, 3).map(a => (
                    <li key={a.id}>
                      • {format(new Date(a.start_time), 'd MMM yyyy HH:mm', { locale: tr })} — {getServiceName(a.service_id)} ({getStaffName(a.staff_id)})
                    </li>
                  ))}
                  {existingCustomerAppointments.length > 3 && <li className="text-xs opacity-70">+{existingCustomerAppointments.length - 3} daha</li>}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Left column */}
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Müşteri</Label>
                <Select value={form.customerId} onValueChange={v => setForm(f => ({ ...f, customerId: v, serviceIds: f.customerId === v ? f.serviceIds : [] }))}>
                  <SelectTrigger><SelectValue placeholder="Müşteri seçin" /></SelectTrigger>
                  <SelectContent>{customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>

              {form.customerId && customerPurchasedServices.length > 0 && (
                <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
                  <Label className="text-xs font-semibold">Satıştan Gelen Hizmetler</Label>
                  <div className="flex flex-wrap gap-2">
                    {customerPurchasedServices.map(item => {
                      const isSelected = form.serviceIds.includes(item.serviceId);
                      return (
                        <Button key={item.serviceId} type="button" size="sm" variant={isSelected ? 'default' : 'outline'}
                          className="h-auto flex-col items-start gap-1 px-3 py-2 text-left" onClick={() => toggleService(item.serviceId)}>
                          <span>{item.name}</span>
                          <span className="text-[11px] font-normal opacity-80">
                            Satış: {item.totalSold} • Kullanılan: {item.usedCount}{item.remainingCount > 0 ? ` • Kalan: ${item.remainingCount}` : ''}
                          </span>
                        </Button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <Label>Personel</Label>
                <Select value={form.staffId} onValueChange={v => setForm(f => ({ ...f, staffId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Personel seçin" /></SelectTrigger>
                  <SelectContent>
                    {activeStaff.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name} ({getBranchName(s.branch_id || '')})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Oda</Label>
                <Select value={form.roomId} onValueChange={v => setForm(f => ({ ...f, roomId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Oda seçin" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Oda seçilmedi —</SelectItem>
                    {activeRooms.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label>Tarih</Label>
                  <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Saat</Label>
                  <Input type="time" value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Süre (dk)</Label>
                  <Select value={form.duration} onValueChange={v => setForm(f => ({ ...f, duration: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DURATION_OPTIONS.map(d => <SelectItem key={d} value={String(d)}>{d} dk</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Duration mismatch warning */}
              {durationMismatch && (
                <Alert className="border-amber-300 bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-800">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    Seçilen hizmetlerin toplam süresi <strong>{totalDuration} dk</strong>, randevu süresi <strong>{form.duration} dk</strong> olarak ayarlı. Süreleri kontrol edin.
                  </AlertDescription>
                </Alert>
              )}
            </div>

            {/* Right column — services */}
            <div className="space-y-1.5">
              <Label>Hizmet {form.serviceIds.length > 0 && <span className="text-xs text-muted-foreground ml-1">({form.serviceIds.length} seçili)</span>}</Label>
              <div className="max-h-[340px] overflow-y-auto rounded-lg border border-border p-1">
                {categorizedServices.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">Hizmet bulunamadı</p>
                ) : (
                  <Accordion type="multiple" className="w-full">
                    {categorizedServices.map(group => (
                      <AccordionItem key={group.category.id} value={group.category.id} className="border-b-0">
                        <AccordionTrigger className="py-2 px-2 text-sm font-semibold hover:no-underline hover:bg-muted/50 rounded-md">
                          <div className="flex items-center gap-2">
                            {group.category.name}
                            {group.services.some(s => form.serviceIds.includes(s.id)) && (
                              <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                                {group.services.filter(s => form.serviceIds.includes(s.id)).length}
                              </Badge>
                            )}
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="pb-1 pt-0 px-1">
                          <div className="grid grid-cols-2 gap-1">
                            {group.services.map(s => {
                              const isSelected = form.serviceIds.includes(s.id);
                              return (
                                <label key={s.id}
                                  className="flex items-start gap-1.5 p-2 rounded-md cursor-pointer transition-colors border"
                                  style={{
                                    backgroundColor: isSelected ? '#EEEDFE' : 'transparent',
                                    borderColor: isSelected ? 'hsl(var(--primary))' : 'hsl(var(--border))',
                                  }}>
                                  <Checkbox checked={isSelected} onCheckedChange={() => toggleService(s.id)} className="mt-0.5" />
                                  <div className="flex-1 min-w-0">
                                    <p className="truncate" style={{ fontSize: '12px', lineHeight: '1.3' }}>{s.name}</p>
                                    <p className="text-muted-foreground" style={{ fontSize: '11px' }}>{s.duration} dk • ₺{s.price}</p>
                                  </div>
                                </label>
                              );
                            })}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                )}
              </div>
              {form.serviceIds.length > 0 && (
                <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-sm">
                  <span className="text-muted-foreground">Toplam:</span>
                  <span className="font-semibold">{totalDuration} dk • ₺{totalPrice.toLocaleString('tr-TR')}</span>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>İptal</Button>
            <Button onClick={handleSave}>Kaydet</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Appointment Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={v => { setDetailOpen(v); if (!v) setDetailApt(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Randevu Detayı</DialogTitle><DialogDescription>Randevu bilgilerini görüntüleyin ve yönetin</DialogDescription></DialogHeader>
          {currentDetailApt && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 xs:grid-cols-2 gap-x-4 gap-y-3">
                <div>
                  <p className="text-xs text-muted-foreground">Müşteri</p>
                  <p className="font-medium text-sm">{getCustomerName(currentDetailApt.customer_id)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Personel</p>
                  <p className="font-medium text-sm">{getStaffName(currentDetailApt.staff_id)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Hizmet</p>
                  <p className="font-medium text-sm">{getServiceName(currentDetailApt.service_id)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Ücret</p>
                  <p className="font-medium text-sm">₺{getServicePrice(currentDetailApt.service_id).toLocaleString('tr-TR')}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Şube</p>
                  <p className="font-medium text-sm">{getBranchName(currentDetailApt.branch_id || '')}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Tarih & Saat</p>
                  <p className="font-medium text-sm">
                    {format(new Date(currentDetailApt.start_time), 'd MMM yyyy HH:mm', { locale: tr })} — {format(new Date(currentDetailApt.end_time), 'HH:mm', { locale: tr })}
                  </p>
                </div>
              </div>

              {canAdminManageAppointments && currentDetailApt.status !== 'iptal' && (
                <div className="space-y-2 rounded-lg border border-border/60 p-3">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase">Tarih & Saat Düzenle</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Input type="date" value={rescheduleDate} onChange={e => setRescheduleDate(e.target.value)} />
                    <Input type="time" value={rescheduleTime} onChange={e => setRescheduleTime(e.target.value)} />
                  </div>
                  <Button size="sm" variant="outline" onClick={handleReschedule} disabled={isRescheduling}>
                    {isRescheduling && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Tarihi Güncelle
                  </Button>
                </div>
              )}

              {/* Room Assignment */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase">Oda</Label>
                <Select
                  value={currentDetailApt.room_id || 'none'}
                  onValueChange={v => updateRoomAssignment(currentDetailApt.id, v)}
                >
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Atanmamış —</SelectItem>
                    {activeRooms.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Session Status */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase">Seans Durumu</Label>
                <div className="flex gap-2">
                  {SESSION_STATUSES.map(s => (
                    <Button
                      key={s.value}
                      size="sm"
                      variant={(currentDetailApt.session_status || 'waiting') === s.value ? 'default' : 'outline'}
                      className="text-xs flex-1"
                      onClick={() => updateSessionStatus(currentDetailApt.id, s.value)}
                    >
                      {s.label}
                    </Button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-1">Randevu Durumu</p>
                <Badge variant={statusVariant(currentDetailStatus)}>{statusLabel[currentDetailStatus]}</Badge>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            {canAdminManageAppointments && currentDetailApt?.status === 'iptal' && (
              <Button variant="outline" onClick={handleReactivate}>Tekrar Aktif Et</Button>
            )}
            {canAdminManageAppointments && currentDetailApt?.status !== 'iptal' && (
              <Button variant="destructive" onClick={() => setCancelConfirmOpen(true)}>İptal Et</Button>
            )}
            {canAdminManageAppointments && (
              <Button variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setDeleteConfirmOpen(true)}>
                <Trash2 className="h-4 w-4 mr-1" /> Sil
              </Button>
            )}
            {currentDetailApt?.status === 'bekliyor' && (
              <Button onClick={openCompleteDialog} className="btn-gradient">Tamamla & Ödeme Al</Button>
            )}
            <Button variant="ghost" onClick={() => setDetailOpen(false)}>Kapat</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={cancelConfirmOpen} onOpenChange={setCancelConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Randevuyu iptal et</AlertDialogTitle>
            <AlertDialogDescription>
              Bu randevuyu iptal etmek istediğinize emin misiniz? İptal edilen randevuyu daha sonra tekrar aktif edebilirsiniz.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Vazgeç</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancelConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Evet, İptal Et
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Randevuyu kalıcı olarak sil</AlertDialogTitle>
            <AlertDialogDescription>
              Bu randevu kalıcı olarak silinecektir ve geri alınamaz. Devam etmek istiyor musunuz?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Vazgeç</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Evet, Kalıcı Sil
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Payment Method Selection Dialog */}
      <Dialog open={completeDialogOpen} onOpenChange={setCompleteDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Ödeme Yöntemi Seçin</DialogTitle>
            <DialogDescription>
              {detailApt && services.find(s => s.id === detailApt.service_id) && (
                <>Tutar: <strong>₺{services.find(s => s.id === detailApt.service_id)!.price.toLocaleString('tr-TR')}</strong></>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-3 gap-3 py-4">
            {[
              { value: 'cash', label: 'Nakit', icon: Banknote },
              { value: 'eft', label: 'EFT/Havale', icon: Building2 },
              { value: 'credit_card', label: 'Kredi Kartı', icon: CreditCard },
            ].map(m => (
              <button
                key={m.value}
                onClick={() => setSelectedPaymentMethod(m.value)}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                  selectedPaymentMethod === m.value
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border hover:border-primary/40 text-muted-foreground hover:text-foreground'
                }`}
              >
                <m.icon className="h-6 w-6" />
                <span className="text-xs font-semibold">{m.label}</span>
              </button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompleteDialogOpen(false)}>İptal</Button>
            <Button onClick={handleComplete} className="btn-gradient gap-1.5">
              Tamamla & Kaydet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Room Dialog */}
      <Dialog open={roomDialogOpen} onOpenChange={setRoomDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingRoom ? 'Oda Düzenle' : 'Yeni Oda'}</DialogTitle>
            <DialogDescription>Seans odası adını girin</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Oda Adı</Label>
              <Input value={roomName} onChange={e => setRoomName(e.target.value)} placeholder="Ör: Oda 1" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Oda Numarası</Label>
              <Input value={roomNumber} onChange={e => setRoomNumber(e.target.value)} placeholder="Ör: 101" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoomDialogOpen(false)}>İptal</Button>
            <Button onClick={handleSaveRoom} disabled={savingRoom || !roomName.trim()}>
              {savingRoom && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Kaydet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </StaffPageGuard>
  );
}
