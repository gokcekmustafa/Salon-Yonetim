import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, ShieldAlert, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'super_admin' | 'salon_admin' | 'staff';
  /** If true, at least one of the roles must match */
  anyRole?: ('super_admin' | 'salon_admin' | 'staff')[];
}

export default function ProtectedRoute({ children, requiredRole, anyRole }: ProtectedRouteProps) {
  const { user, loading, roles } = useAuth();
  const navigate = useNavigate();

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

  const hasRequiredRole = !requiredRole || roles.includes(requiredRole);
  const hasAnyRole = !anyRole || anyRole.length === 0 || anyRole.some(r => roles.includes(r));

  if (!hasRequiredRole || !hasAnyRole) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 text-center space-y-3">
          <div className="mx-auto h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
            <ShieldAlert className="h-6 w-6 text-destructive" />
          </div>
          <h1 className="text-lg font-semibold text-foreground">Bu sayfaya erişim yetkiniz yok</h1>
          <p className="text-sm text-muted-foreground">
            Hesabınız için rol/salon ataması eksik olabilir. Lütfen yöneticinizle iletişime geçin.
          </p>
          <Button variant="outline" onClick={() => navigate('/')} className="w-full gap-2">
            <ArrowLeft className="h-4 w-4" /> Geri Dön
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

