import { useAuth } from '@/contexts/AuthContext';
import { useStaffPermissions } from '@/hooks/useStaffPermissions';
import { NoPermission } from '@/components/permissions/NoPermission';
import { Loader2 } from 'lucide-react';

interface Props {
  permissionKey: string;
  featureLabel: string;
  children: React.ReactNode;
}

export function StaffPageGuard({ permissionKey, featureLabel, children }: Props) {
  const { isSuperAdmin, isSalonAdmin } = useAuth();
  const { hasPagePermission, loading } = useStaffPermissions();

  // Admins always pass
  if (isSuperAdmin || isSalonAdmin) return <>{children}</>;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!hasPagePermission(permissionKey)) {
    return <NoPermission feature={featureLabel} />;
  }

  return <>{children}</>;
}
