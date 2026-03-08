import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'super_admin' | 'salon_admin' | 'staff';
  /** If true, at least one of the roles must match */
  anyRole?: ('super_admin' | 'salon_admin' | 'staff')[];
}

export default function ProtectedRoute({ children, requiredRole, anyRole }: ProtectedRouteProps) {
  const { user, loading, roles } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (requiredRole && !roles.includes(requiredRole)) {
    return <Navigate to="/" replace />;
  }

  if (anyRole && anyRole.length > 0 && !anyRole.some(r => roles.includes(r))) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
