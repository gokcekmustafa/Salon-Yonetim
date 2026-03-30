import { useMemo } from 'react';
import { useSalonData as useRawSalonData } from '@/hooks/useSalonData';
import { useBranch } from '@/contexts/BranchContext';

export function useBranchFilteredData() {
  const data = useRawSalonData();
  const { selectedBranchId, isAllBranches, requireBranchForAction } = useBranch();

  const filteredStaff = useMemo(() => {
    if (isAllBranches) return data.staff;
    return data.staff.filter(s => s.branch_id === selectedBranchId);
  }, [data.staff, selectedBranchId, isAllBranches]);

  const filteredAppointments = useMemo(() => {
    if (isAllBranches) return data.appointments;
    return data.appointments.filter(a => a.branch_id === selectedBranchId);
  }, [data.appointments, selectedBranchId, isAllBranches]);

  const filteredCustomers = useMemo(() => {
    if (isAllBranches) return data.customers;
    return data.customers.filter(c => c.branch_id === selectedBranchId);
  }, [data.customers, selectedBranchId, isAllBranches]);

  const filteredPayments = useMemo(() => {
    if (isAllBranches) return data.payments;
    return data.payments.filter(p => p.branch_id === selectedBranchId);
  }, [data.payments, selectedBranchId, isAllBranches]);

  const addAppointment: typeof data.addAppointment = async (apptData) => {
    if (!requireBranchForAction()) throw new Error('Branch required');
    const branchId = isAllBranches ? apptData.branch_id : selectedBranchId!;
    return data.addAppointment({ ...apptData, branch_id: branchId });
  };

  const addStaff: typeof data.addStaff = async (staffData) => {
    if (!requireBranchForAction()) throw new Error('Branch required');
    const branchId = isAllBranches ? staffData.branch_id : selectedBranchId!;
    return data.addStaff({ ...staffData, branch_id: branchId });
  };

  const addCustomer: typeof data.addCustomer = async (customerData) => {
    if (!requireBranchForAction()) throw new Error('Branch required');
    const branchId = isAllBranches ? customerData.branch_id ?? null : selectedBranchId!;
    return data.addCustomer({ ...customerData, branch_id: branchId });
  };

  const addPayment: typeof data.addPayment = async (paymentData) => {
    if (!requireBranchForAction()) throw new Error('Branch required');
    const branchId = isAllBranches ? paymentData.branch_id ?? null : selectedBranchId!;
    return data.addPayment({ ...paymentData, branch_id: branchId });
  };

  return {
    ...data,
    customers: filteredCustomers,
    staff: filteredStaff,
    appointments: filteredAppointments,
    payments: filteredPayments,
    addCustomer,
    addAppointment,
    addPayment,
    addStaff,
  };
}
