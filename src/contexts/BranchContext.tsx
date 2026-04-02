import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface BranchContextType {
  selectedBranchId: string | null;
  setSelectedBranchId: (id: string | null) => void;
  isAllBranches: boolean;
  isStaffLocked: boolean;
  isSingleBranch: boolean;
  activeBranches: { id: string; name: string }[];
  requireBranchForAction: () => boolean;
  /** Returns the effective branch_id for writes (auto-selected for single-branch salons) */
  getEffectiveBranchId: () => string | null;
}

const BranchContext = createContext<BranchContextType>({
  selectedBranchId: null,
  setSelectedBranchId: () => {},
  isAllBranches: true,
  isStaffLocked: false,
  isSingleBranch: false,
  activeBranches: [],
  requireBranchForAction: () => true,
  getEffectiveBranchId: () => null,
});

export const useBranch = () => useContext(BranchContext);

export const BranchProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isStaff, isSuperAdmin, isSalonAdmin, currentBranchId, currentSalonId } = useAuth();
  const [selectedBranchId, setSelectedBranchIdInternal] = useState<string | null>(null);
  const [activeBranches, setActiveBranches] = useState<{ id: string; name: string }[]>([]);

  const isStaffOnly = isStaff && !isSuperAdmin && !isSalonAdmin;
  const isStaffLocked = isStaffOnly && !!currentBranchId;
  const isSingleBranch = activeBranches.length === 1;

  // Fetch active branches for the current salon
  useEffect(() => {
    if (!currentSalonId) {
      setActiveBranches([]);
      return;
    }

    const fetchBranches = async () => {
      const { data } = await supabase
        .from('branches')
        .select('id, name')
        .eq('salon_id', currentSalonId)
        .eq('is_active', true)
        .order('name');
      setActiveBranches(data || []);
    };

    fetchBranches();
  }, [currentSalonId]);

  // Auto-select: staff locked to their branch
  useEffect(() => {
    if (isStaffOnly && currentBranchId) {
      setSelectedBranchIdInternal(currentBranchId);
    }
  }, [isStaffOnly, currentBranchId]);

  // Auto-select: single branch salon
  useEffect(() => {
    if (activeBranches.length === 1 && !isStaffLocked) {
      setSelectedBranchIdInternal(activeBranches[0].id);
    }
  }, [activeBranches, isStaffLocked]);

  const setSelectedBranchId = (id: string | null) => {
    if (isStaffLocked) return;
    // Don't allow deselecting when single branch
    if (isSingleBranch && id === null) return;
    setSelectedBranchIdInternal(id);
  };

  const isAllBranches = selectedBranchId === null;

  const requireBranchForAction = useCallback(() => {
    // Single branch: always OK (auto-selected)
    if (isSingleBranch) return true;
    // Super admin can operate without branch
    if (isSuperAdmin) return true;
    // Branch is selected
    if (!isAllBranches) return true;

    toast.warning('Lütfen önce bir şube seçin', {
      description: 'İşlem yapabilmek için belirli bir şube seçmelisiniz.',
    });
    return false;
  }, [isAllBranches, isSuperAdmin, isSingleBranch]);

  const getEffectiveBranchId = useCallback(() => {
    if (selectedBranchId) return selectedBranchId;
    if (isSingleBranch) return activeBranches[0]?.id || null;
    return null;
  }, [selectedBranchId, isSingleBranch, activeBranches]);

  return (
    <BranchContext.Provider value={{
      selectedBranchId,
      setSelectedBranchId,
      isAllBranches,
      isStaffLocked,
      isSingleBranch,
      activeBranches,
      requireBranchForAction,
      getEffectiveBranchId,
    }}>
      {children}
    </BranchContext.Provider>
  );
};
