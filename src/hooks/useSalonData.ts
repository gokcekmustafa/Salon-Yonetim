import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

// DB row types matching Supabase schema
export type DbBranch = {
  id: string; salon_id: string; name: string; address: string | null;
  phone: string | null; is_active: boolean; created_at: string; updated_at: string;
};
export type DbCustomer = {
  id: string; salon_id: string; name: string; phone: string | null;
  birth_date: string | null; notes: string | null; created_at: string; updated_at: string;
  tc_kimlik_no: string | null; address: string | null; secondary_phone: string | null;
  source_type: string | null; source_detail: string | null; customer_type: string;
};
export type DbService = {
  id: string; salon_id: string; name: string; duration: number;
  price: number; is_active: boolean; created_at: string; updated_at: string;
};
export type DbStaff = {
  id: string; salon_id: string; branch_id: string | null; user_id: string | null;
  name: string; phone: string | null; is_active: boolean; created_at: string; updated_at: string;
};
export type DbAppointment = {
  id: string; salon_id: string; branch_id: string | null; customer_id: string;
  staff_id: string; service_id: string; start_time: string; end_time: string;
  status: string; notes: string | null; created_at: string; updated_at: string;
  room_id: string | null; session_status: string;
};
export type DbPayment = {
  id: string; salon_id: string; appointment_id: string | null; amount: number;
  payment_type: string; payment_date: string; created_at: string;
};
export type DbNotificationSettings = {
  id: string; salon_id: string; whatsapp_enabled: boolean; sms_enabled: boolean;
  reminder_hours_before: number; message_template: string | null;
};
export type DbSalon = {
  id: string; name: string; slug: string; phone: string | null;
  address: string | null; is_active: boolean; logo_url: string | null;
  subscription_plan: string; subscription_expires_at: string | null;
  online_booking_active: boolean;
};

export function useSalonData() {
  const { user, currentSalonId, isSuperAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [branches, setBranches] = useState<DbBranch[]>([]);
  const [customers, setCustomers] = useState<DbCustomer[]>([]);
  const [services, setServices] = useState<DbService[]>([]);
  const [staff, setStaff] = useState<DbStaff[]>([]);
  const [appointments, setAppointments] = useState<DbAppointment[]>([]);
  const [payments, setPayments] = useState<DbPayment[]>([]);
  const [notificationSettings, setNotificationSettings] = useState<DbNotificationSettings | null>(null);
  const [salon, setSalon] = useState<DbSalon | null>(null);

  const salonId = currentSalonId;

  const fetchAll = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);

    // If super admin without a selected salon, show empty
    if (isSuperAdmin && !salonId) {
      setLoading(false);
      return;
    }

    if (!salonId) { setLoading(false); return; }

    const [salonRes, branchRes, custRes, svcRes, staffRes, aptRes, payRes, notifRes] = await Promise.all([
      supabase.from('salons').select('id, name, slug, phone, address, is_active, logo_url, subscription_plan, subscription_expires_at, online_booking_active').eq('id', salonId).single(),
      supabase.from('branches').select('*').eq('salon_id', salonId).order('name'),
      supabase.from('customers').select('*').eq('salon_id', salonId).order('name'),
      supabase.from('services').select('*').eq('salon_id', salonId).order('name'),
      supabase.from('staff').select('*').eq('salon_id', salonId).order('name'),
      supabase.from('appointments').select('*').eq('salon_id', salonId).order('start_time', { ascending: false }),
      supabase.from('payments').select('*').eq('salon_id', salonId).order('payment_date', { ascending: false }),
      supabase.from('notification_settings').select('*').eq('salon_id', salonId).single(),
    ]);

    if (salonRes.data) setSalon(salonRes.data);
    setBranches(branchRes.data || []);
    setCustomers(custRes.data || []);
    setServices(svcRes.data || []);
    setStaff(staffRes.data || []);
    setAppointments(aptRes.data || []);
    setPayments(payRes.data || []);
    if (notifRes.data) setNotificationSettings(notifRes.data);

    setLoading(false);
  }, [user, salonId, isSuperAdmin]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // CRUD helpers
  const addBranch = async (data: { name: string; address: string; phone: string; is_active: boolean }) => {
    if (!salonId) return;
    const { error } = await supabase.from('branches').insert({ ...data, salon_id: salonId });
    if (!error) fetchAll();
    return error;
  };

  const updateBranch = async (id: string, data: Partial<DbBranch>) => {
    const { error } = await supabase.from('branches').update(data).eq('id', id);
    if (!error) fetchAll();
    return error;
  };

  const deleteBranch = async (id: string) => {
    const { error } = await supabase.from('branches').delete().eq('id', id);
    if (!error) fetchAll();
    return error;
  };

  const addCustomer = async (data: { name: string; phone: string; birth_date?: string; notes?: string; tc_kimlik_no?: string; address?: string; secondary_phone?: string; source_type?: string; source_detail?: string }) => {
    if (!salonId) return { id: '', error: null };
    const { data: inserted, error } = await supabase
      .from('customers').insert({ ...data, salon_id: salonId }).select('id').single();
    if (!error) fetchAll();
    return { id: inserted?.id || '', error };
  };

  const updateCustomer = async (id: string, data: Partial<DbCustomer>) => {
    const { error } = await supabase.from('customers').update(data).eq('id', id);
    if (!error) fetchAll();
    return error;
  };

  const deleteCustomer = async (id: string) => {
    const { error } = await supabase.from('customers').delete().eq('id', id);
    if (!error) fetchAll();
    return error;
  };

  const addService = async (data: { name: string; duration: number; price: number }) => {
    if (!salonId) return;
    const { error } = await supabase.from('services').insert({ ...data, salon_id: salonId });
    if (!error) fetchAll();
    return error;
  };

  const updateService = async (id: string, data: Partial<DbService>) => {
    const { error } = await supabase.from('services').update(data).eq('id', id);
    if (!error) fetchAll();
    return error;
  };

  const deleteService = async (id: string) => {
    const { error } = await supabase.from('services').delete().eq('id', id);
    if (!error) fetchAll();
    return error;
  };

  const addStaff = async (data: { name: string; phone: string; is_active: boolean; branch_id: string }) => {
    if (!salonId) return;
    const { error } = await supabase.from('staff').insert({ ...data, salon_id: salonId });
    if (!error) fetchAll();
    return error;
  };

  const updateStaff = async (id: string, data: Partial<DbStaff>) => {
    const { error } = await supabase.from('staff').update(data).eq('id', id);
    if (!error) fetchAll();
    return error;
  };

  const addAppointment = async (data: {
    customer_id: string; staff_id: string; service_id: string;
    branch_id: string; start_time: string; end_time: string; status: string;
  }) => {
    if (!salonId) return;
    const { error } = await supabase.from('appointments').insert({ ...data, salon_id: salonId });
    if (!error) fetchAll();
    return error;
  };

  const updateAppointment = async (id: string, data: Partial<DbAppointment>) => {
    const { error } = await supabase.from('appointments').update(data).eq('id', id);
    if (!error) fetchAll();
    return error;
  };

  const addPayment = async (data: { appointment_id: string; amount: number; payment_type: string }) => {
    if (!salonId) return;
    const { error } = await supabase.from('payments').insert({ ...data, salon_id: salonId });
    if (!error) fetchAll();
    return error;
  };

  const updateNotificationSettings = async (data: Partial<DbNotificationSettings>) => {
    if (!notificationSettings) return;
    const { error } = await supabase.from('notification_settings').update(data).eq('id', notificationSettings.id);
    if (!error) fetchAll();
    return error;
  };

  const hasConflict = (staffId: string, start: string, end: string, excludeId?: string) => {
    return appointments.some(a => {
      if (a.id === excludeId || a.staff_id !== staffId || a.status === 'iptal') return false;
      return new Date(start) < new Date(a.end_time) && new Date(end) > new Date(a.start_time);
    });
  };

  // Light refetch that only updates salon data without resetting loading state
  const refetchSalon = useCallback(async () => {
    if (!salonId) return;
    const { data } = await supabase
      .from('salons')
      .select('id, name, slug, phone, address, is_active, logo_url, subscription_plan, subscription_expires_at, online_booking_active')
      .eq('id', salonId)
      .single();
    if (data) setSalon(data);
  }, [salonId]);

  return {
    loading, salon, branches, customers, services, staff, appointments, payments, notificationSettings,
    addBranch, updateBranch, deleteBranch,
    addCustomer, updateCustomer, deleteCustomer,
    addService, updateService, deleteService,
    addStaff, updateStaff,
    addAppointment, updateAppointment,
    addPayment, hasConflict,
    updateNotificationSettings,
    refetch: fetchAll,
    refetchSalon,
  };
}
