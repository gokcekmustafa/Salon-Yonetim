export type AppointmentUiStatus = 'bekliyor' | 'in_session' | 'tamamlandi' | 'iptal';

type StatusInput = {
  status?: string | null;
  session_status?: string | null;
};

const STATUS_ALIASES: Record<string, AppointmentUiStatus> = {
  bekliyor: 'bekliyor',
  waiting: 'bekliyor',
  pending: 'bekliyor',
  in_session: 'in_session',
  seans: 'in_session',
  tamamlandi: 'tamamlandi',
  completed: 'tamamlandi',
  done: 'tamamlandi',
  iptal: 'iptal',
  cancelled: 'iptal',
  canceled: 'iptal',
};

const normalizeStatus = (value?: string | null): AppointmentUiStatus | undefined => {
  if (!value) return undefined;
  return STATUS_ALIASES[value.toLowerCase()];
};

export const getEffectiveAppointmentStatus = ({ status, session_status }: StatusInput): AppointmentUiStatus => {
  const normalizedStatus = normalizeStatus(status);
  const normalizedSessionStatus = normalizeStatus(session_status);

  if (normalizedStatus === 'iptal') return 'iptal';
  if (normalizedSessionStatus === 'in_session') return 'in_session';
  if (normalizedSessionStatus === 'bekliyor') return 'bekliyor';
  if (normalizedSessionStatus === 'tamamlandi') return 'tamamlandi';
  if (normalizedStatus === 'in_session') return 'in_session';
  if (normalizedStatus === 'tamamlandi') return 'tamamlandi';

  return 'bekliyor';
};
