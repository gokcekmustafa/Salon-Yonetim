import { useMemo } from 'react';
import { useSalonData as useRawSalonData } from '@/hooks/useSalonData';
import { useBranch } from '@/contexts/BranchContext';

export function useBranchFilteredData() {
  const data = useRawSalonData();
  const { selectedBranchId, isAllBranches } = useBranch();

  const filteredStaff = useMemo(() => {
    if (isAllBranches) return data.staff;
    return data.staff.filter(s => s.branch_id === selectedBranchId);
  }, [data.staff, selectedBranchId, isAllBranches]);

  const filteredAppointments = useMemo(() => {
    if (isAllBranches) return data.appointments;
    return data.appointments.filter(a => a.branch_id === selectedBranchId);
  }, [data.appointments, selectedBranchId, isAllBranches]);

  // For new records, use the selected branch
  const addAppointment: typeof data.addAppointment = async (apptData) => {
    const branchId = isAllBranches ? apptData.branch_id : selectedBranchId!;
    return data.addAppointment({ ...apptData, branch_id: branchId });
  };

  const addStaff: typeof data.addStaff = async (staffData) => {
    const branchId = isAllBranches ? staffData.branch_id : selectedBranchId!;
    return data.addStaff({ ...staffData, branch_id: branchId });
  };

  return {
    ...data,
    staff: filteredStaff,
    appointments: filteredAppointments,
    addAppointment,
    addStaff,
  };
}
