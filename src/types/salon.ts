export interface Customer {
  id: string;
  name: string;
  phone: string;
  birthDate?: string;
  notes?: string;
  createdAt: string;
}

export interface Branch {
  id: string;
  name: string;
  address: string;
  phone: string;
  active: boolean;
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
  branchId: string;
}

export type AppointmentStatus = 'bekliyor' | 'tamamlandi' | 'iptal';

export type ReminderChannel = 'whatsapp' | 'sms';
export type ReminderStatus = 'bekliyor' | 'gonderildi' | 'basarisiz';

export interface AppointmentReminder {
  channel: ReminderChannel;
  status: ReminderStatus;
  scheduledAt: string;
  sentAt?: string;
}

export interface Appointment {
  id: string;
  customerId: string;
  staffId: string;
  serviceId: string;
  branchId: string;
  startTime: string;
  endTime: string;
  status: AppointmentStatus;
  reminders?: AppointmentReminder[];
}

export type PaymentType = 'nakit' | 'kart';

export interface Payment {
  id: string;
  appointmentId: string;
  amount: number;
  type: PaymentType;
  date: string;
}

export interface NotificationSettings {
  whatsappEnabled: boolean;
  smsEnabled: boolean;
  reminderHoursBefore: number;
  messageTemplate: string;
}
