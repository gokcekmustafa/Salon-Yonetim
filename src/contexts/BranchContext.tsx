import React, { createContext, useContext, useState, useCallback } from 'react';

interface BranchContextType {
  selectedBranchId: string | null; // null = "Tüm Şubeler"
  setSelectedBranchId: (id: string | null) => void;
  isAllBranches: boolean;
}

const BranchContext = createContext<BranchContextType>({
  selectedBranchId: null,
  setSelectedBranchId: () => {},
  isAllBranches: true,
});

export const useBranch = () => useContext(BranchContext);

export const BranchProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);

  const isAllBranches = selectedBranchId === null;

  return (
    <BranchContext.Provider value={{ selectedBranchId, setSelectedBranchId, isAllBranches }}>
      {children}
    </BranchContext.Provider>
  );
};
