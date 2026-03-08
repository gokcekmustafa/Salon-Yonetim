import React, { createContext, useContext, useState, useCallback } from 'react';
import { Customer, Service, Staff, Appointment, Payment, Branch } from '@/types/salon';

interface SalonInfo {
  name: string;
  slug: string;
  phone: string;
  address: string;
}

interface SalonContextType {
  salon: SalonInfo;
  branches: Branch[];
  customers: Customer[];
  services: Service[];
  staff: Staff[];
  appointments: Appointment[];
  payments: Payment[];
  addBranch: (b: Omit<Branch, 'id'>) => void;
  updateBranch: (id: string, b: Partial<Branch>) => void;
  deleteBranch: (id: string) => void;
  addCustomer: (c: Omit<Customer, 'id' | 'createdAt'>) => void;
  updateCustomer: (id: string, c: Partial<Customer>) => void;
  deleteCustomer: (id: string) => void;
  addService: (s: Omit<Service, 'id'>) => void;
  updateService: (id: string, s: Partial<Service>) => void;
  deleteService: (id: string) => void;
  addStaff: (s: Omit<Staff, 'id'>) => void;
  updateStaff: (id: string, s: Partial<Staff>) => void;
  addAppointment: (a: Omit<Appointment, 'id'>) => void;
  updateAppointment: (id: string, a: Partial<Appointment>) => void;
  addPayment: (p: Omit<Payment, 'id'>) => void;
  hasConflict: (staffId: string, start: string, end: string, excludeId?: string) => boolean;
}

const SalonContext = createContext<SalonContextType | null>(null);

export const useSalon = () => {
  const ctx = useContext(SalonContext);
  if (!ctx) throw new Error('useSalon must be used within SalonProvider');
  return ctx;
};

const genId = () => crypto.randomUUID();

// Demo branches
const demoBranches: Branch[] = [
  { id: genId(), name: 'Kadıköy Şubesi', address: 'Kadıköy, İstanbul', phone: '0212 555 1234', active: true },
  { id: genId(), name: 'Beşiktaş Şubesi', address: 'Beşiktaş, İstanbul', phone: '0212 555 5678', active: true },
];

const demoCustomers: Customer[] = [
  { id: genId(), name: 'Ayşe Yılmaz', phone: '0532 111 2233', birthDate: '1990-03-15', notes: 'Düzenli müşteri', createdAt: '2024-01-10' },
  { id: genId(), name: 'Fatma Demir', phone: '0533 222 3344', birthDate: '1985-07-22', notes: '', createdAt: '2024-02-14' },
  { id: genId(), name: 'Zeynep Kaya', phone: '0534 333 4455', notes: 'Alerjik cilt', createdAt: '2024-03-01' },
];

const demoServices: Service[] = [
  { id: genId(), name: 'Saç Kesimi', duration: 45, price: 250 },
  { id: genId(), name: 'Saç Boyama', duration: 120, price: 800 },
  { id: genId(), name: 'Manikür', duration: 30, price: 150 },
  { id: genId(), name: 'Pedikür', duration: 45, price: 200 },
  { id: genId(), name: 'Cilt Bakımı', duration: 60, price: 500 },
];

const demoStaff: Staff[] = [
  { id: genId(), name: 'Elif Arslan', phone: '0535 444 5566', active: true, branchId: demoBranches[0].id },
  { id: genId(), name: 'Merve Çelik', phone: '0536 555 6677', active: true, branchId: demoBranches[0].id },
  { id: genId(), name: 'Selin Öztürk', phone: '0537 666 7788', active: false, branchId: demoBranches[1].id },
];

const defaultSalon: SalonInfo = {
  name: 'Güzellik Salonu',
  slug: 'guzellik-salonu',
  phone: '0212 555 1234',
  address: 'İstanbul',
};

export const SalonProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [salon] = useState<SalonInfo>(defaultSalon);
  const [branches, setBranches] = useState<Branch[]>(demoBranches);
  const [customers, setCustomers] = useState<Customer[]>(demoCustomers);
  const [services, setServices] = useState<Service[]>(demoServices);
  const [staff, setStaff] = useState<Staff[]>(demoStaff);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);

  const addBranch = useCallback((b: Omit<Branch, 'id'>) => {
    setBranches(prev => [...prev, { ...b, id: genId() }]);
  }, []);

  const updateBranch = useCallback((id: string, b: Partial<Branch>) => {
    setBranches(prev => prev.map(x => x.id === id ? { ...x, ...b } : x));
  }, []);

  const deleteBranch = useCallback((id: string) => {
    setBranches(prev => prev.filter(x => x.id !== id));
  }, []);

  const addCustomer = useCallback((c: Omit<Customer, 'id' | 'createdAt'>) => {
    setCustomers(prev => [...prev, { ...c, id: genId(), createdAt: new Date().toISOString().split('T')[0] }]);
  }, []);

  const updateCustomer = useCallback((id: string, c: Partial<Customer>) => {
    setCustomers(prev => prev.map(x => x.id === id ? { ...x, ...c } : x));
  }, []);

  const deleteCustomer = useCallback((id: string) => {
    setCustomers(prev => prev.filter(x => x.id !== id));
  }, []);

  const addService = useCallback((s: Omit<Service, 'id'>) => {
    setServices(prev => [...prev, { ...s, id: genId() }]);
  }, []);

  const updateService = useCallback((id: string, s: Partial<Service>) => {
    setServices(prev => prev.map(x => x.id === id ? { ...x, ...s } : x));
  }, []);

  const deleteService = useCallback((id: string) => {
    setServices(prev => prev.filter(x => x.id !== id));
  }, []);

  const addStaff = useCallback((s: Omit<Staff, 'id'>) => {
    setStaff(prev => [...prev, { ...s, id: genId() }]);
  }, []);

  const updateStaff = useCallback((id: string, s: Partial<Staff>) => {
    setStaff(prev => prev.map(x => x.id === id ? { ...x, ...s } : x));
  }, []);

  const hasConflict = useCallback((staffId: string, start: string, end: string, excludeId?: string) => {
    return appointments.some(a => {
      if (a.id === excludeId || a.staffId !== staffId || a.status === 'iptal') return false;
      return new Date(start) < new Date(a.endTime) && new Date(end) > new Date(a.startTime);
    });
  }, [appointments]);

  const addAppointment = useCallback((a: Omit<Appointment, 'id'>) => {
    setAppointments(prev => [...prev, { ...a, id: genId() }]);
  }, []);

  const updateAppointment = useCallback((id: string, a: Partial<Appointment>) => {
    setAppointments(prev => prev.map(x => x.id === id ? { ...x, ...a } : x));
  }, []);

  const addPayment = useCallback((p: Omit<Payment, 'id'>) => {
    setPayments(prev => [...prev, { ...p, id: genId() }]);
  }, []);

  return (
    <SalonContext.Provider value={{
      salon, branches, customers, services, staff, appointments, payments,
      addBranch, updateBranch, deleteBranch,
      addCustomer, updateCustomer, deleteCustomer,
      addService, updateService, deleteService,
      addStaff, updateStaff,
      addAppointment, updateAppointment,
      addPayment, hasConflict,
    }}>
      {children}
    </SalonContext.Provider>
  );
};
