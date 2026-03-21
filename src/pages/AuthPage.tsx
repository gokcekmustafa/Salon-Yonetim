import { useState } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { User, Lock, Loader2, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useBranding } from '@/hooks/useBranding';
import { useAuth } from '@/contexts/AuthContext';
import salonumLogo from '@/assets/salonum_logo.png';

export default function AuthPage() {
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const { branding } = useBranding();

  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  if (!authLoading && user) {
    return <Navigate to="/" replace />;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Resolve username to email
      const { data: email, error: resolveError } = await supabase.rpc('get_email_by_username', {
        _username: loginUsername.trim().toLowerCase(),
      });

      if (resolveError || !email) {
        toast({ title: 'Giriş başarısız', description: 'Kullanıcı adı bulunamadı.', variant: 'destructive' });
        setLoading(false);
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: email as string,
        password: loginPassword,
      });

      if (error) {
        toast({ title: 'Giriş başarısız', description: 'Kullanıcı adı veya şifre hatalı.', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Giriş başarısız', description: 'Bir hata oluştu.', variant: 'destructive' });
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative" style={{ background: 'var(--gradient-hero)' }}>
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <img
            src={branding.logo_url || salonumLogo}
            alt="Logo"
            className="h-20 w-20 rounded-2xl object-contain shadow-lg mb-4"
          />
          <h1 className="text-2xl font-bold font-display tracking-tight gradient-text">{branding.company_name}</h1>
        </div>

        <Card className="border-border/40 shadow-elevated backdrop-blur-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Hoş Geldiniz</CardTitle>
            <CardDescription>Hesabınıza giriş yapın</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="login-username" className="text-xs font-semibold">Kullanıcı Adı</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input id="login-username" type="text" placeholder="kullaniciadi" value={loginUsername} onChange={e => setLoginUsername(e.target.value)} className="pl-10 h-11" required />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="login-password" className="text-xs font-semibold">Şifre</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input id="login-password" type={showPassword ? 'text' : 'password'} placeholder="••••••••" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} className="pl-10 pr-10 h-11" required />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Button type="submit" className="w-full h-11 btn-gradient rounded-xl text-sm font-semibold gap-2" disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><span>Firma Giriş</span><ArrowRight className="h-4 w-4" /></>}
                </Button>
                <Button asChild type="button" variant="outline" className="w-full h-11 rounded-xl text-sm font-semibold">
                  <Link to="/firma-kayit">Firma Kayıt</Link>
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-8">
          © 2026 {branding.company_name} • {branding.app_name}
        </p>
      </div>
    </div>
  );
}
