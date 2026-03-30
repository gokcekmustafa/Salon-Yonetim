import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface BranchContextType {
  selectedBranchId: string | null; // null = "Tüm Şubeler"
  setSelectedBranchId: (id: string | null) => void;
  isAllBranches: boolean;
  isStaffLocked: boolean;
  isBranchRequired: boolean; // true when admin must select a branch
}

const BranchContext = createContext<BranchContextType>({
  selectedBranchId: null,
  setSelectedBranchId: () => {},
  isAllBranches: true,
  isStaffLocked: false,
  isBranchRequired: false,
});

export const useBranch = () => useContext(BranchContext);

export const BranchProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isStaff, isSuperAdmin, isSalonAdmin, currentBranchId } = useAuth();
  const [selectedBranchId, setSelectedBranchIdInternal] = useState<string | null>(null);

  // Staff users are locked to their assigned branch
  const isStaffOnly = isStaff && !isSuperAdmin && !isSalonAdmin;
  const isStaffLocked = isStaffOnly && !!currentBranchId;

  // Salon admins must select a branch before operating
  const isBranchRequired = (isSalonAdmin && !isSuperAdmin) && selectedBranchId === null;

  // When staff logs in, lock them to their branch
  useEffect(() => {
    if (isStaffOnly && currentBranchId) {
      setSelectedBranchIdInternal(currentBranchId);
    }
  }, [isStaffOnly, currentBranchId]);

  const setSelectedBranchId = (id: string | null) => {
    // Staff cannot change branch
    if (isStaffLocked) return;
    // Salon admins cannot select "all branches"
    if ((isSalonAdmin && !isSuperAdmin) && id === null) return;
    setSelectedBranchIdInternal(id);
  };

  const isAllBranches = selectedBranchId === null;

  return (
    <BranchContext.Provider value={{ selectedBranchId, setSelectedBranchId, isAllBranches, isStaffLocked, isBranchRequired }}>
      {children}
    </BranchContext.Provider>
  );
};
