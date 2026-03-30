import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface BranchContextType {
  selectedBranchId: string | null;
  setSelectedBranchId: (id: string | null) => void;
  isAllBranches: boolean;
  isStaffLocked: boolean;
  requireBranchForAction: () => boolean;
}

const BranchContext = createContext<BranchContextType>({
  selectedBranchId: null,
  setSelectedBranchId: () => {},
  isAllBranches: true,
  isStaffLocked: false,
  requireBranchForAction: () => true,
});

export const useBranch = () => useContext(BranchContext);

export const BranchProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isStaff, isSuperAdmin, isSalonAdmin, currentBranchId } = useAuth();
  const [selectedBranchId, setSelectedBranchIdInternal] = useState<string | null>(null);

  const isStaffOnly = isStaff && !isSuperAdmin && !isSalonAdmin;
  const isStaffLocked = isStaffOnly && !!currentBranchId;

  useEffect(() => {
    if (isStaffOnly && currentBranchId) {
      setSelectedBranchIdInternal(currentBranchId);
    }
  }, [isStaffOnly, currentBranchId]);

  const setSelectedBranchId = (id: string | null) => {
    if (isStaffLocked) return;
    setSelectedBranchIdInternal(id);
  };

  const isAllBranches = selectedBranchId === null;

  const requireBranchForAction = useCallback(() => {
    if (isAllBranches && !isSuperAdmin) {
      toast.warning('Lütfen önce bir şube seçin', {
        description: 'İşlem yapabilmek için belirli bir şube seçmelisiniz.',
      });
      return false;
    }
    return true;
  }, [isAllBranches, isSuperAdmin]);

  return (
    <BranchContext.Provider value={{ selectedBranchId, setSelectedBranchId, isAllBranches, isStaffLocked, requireBranchForAction }}>
      {children}
    </BranchContext.Provider>
  );
};
