export interface Customer {
  id: string;
  name: string;
  phone: string;
  birthDate?: string;
  notes?: string;
  createdAt: string;
}

export interface Service {
  id: string;
  name: string;
  duration: number; // minutes
  price: number;
}

export interface Staff {
  id: string;
  name: string;
  phone: string;
  active: boolean;
}

export type AppointmentStatus = 'bekliyor' | 'tamamlandi' | 'iptal';

export interface Appointment {
  id: string;
  customerId: string;
  staffId: string;
  serviceId: string;
  startTime: string;
  endTime: string;
  status: AppointmentStatus;
}

export type PaymentType = 'nakit' | 'kart';

export interface Payment {
  id: string;
  appointmentId: string;
  amount: number;
  type: PaymentType;
  date: string;
}
