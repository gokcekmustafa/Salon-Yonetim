import { useBranch } from '@/contexts/BranchContext';
import { useSalonData } from '@/hooks/useSalonData';
import { Building2, ChevronDown, Check, Lock } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function BranchSelector() {
  const { branches } = useSalonData();
  const { selectedBranchId, setSelectedBranchId, isStaffLocked } = useBranch();

  const activeBranches = branches.filter(b => b.is_active);

  // Don't show if only one branch
  if (activeBranches.length <= 1) return null;

  const selectedBranch = activeBranches.find(b => b.id === selectedBranchId);
  const label = selectedBranch ? selectedBranch.name : 'Tüm Şubeler';

  // Staff locked to branch - show read-only indicator
  if (isStaffLocked) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border/60 bg-muted/50 text-sm font-medium">
        <Building2 className="h-4 w-4 text-muted-foreground" />
        <span className="max-w-[120px] truncate">{label}</span>
        <Lock className="h-3 w-3 text-muted-foreground" />
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border/60 bg-background hover:bg-muted transition-colors text-sm font-medium">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <span className="max-w-[120px] truncate">{label}</span>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={8} className="min-w-48 rounded-[10px] border border-border/60 bg-background p-1.5 shadow-md">
        <DropdownMenuItem
          onClick={() => setSelectedBranchId(null)}
          className="rounded-lg px-2.5 py-2.5 text-sm flex items-center justify-between"
        >
          <span className="font-medium">Tüm Şubeler</span>
          {selectedBranchId === null && <Check className="h-4 w-4 text-primary" />}
        </DropdownMenuItem>
        {activeBranches.map(branch => (
          <DropdownMenuItem
            key={branch.id}
            onClick={() => setSelectedBranchId(branch.id)}
            className="rounded-lg px-2.5 py-2.5 text-sm flex items-center justify-between"
          >
            <span>{branch.name}</span>
            {selectedBranchId === branch.id && <Check className="h-4 w-4 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
