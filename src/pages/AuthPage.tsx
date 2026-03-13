import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Sparkles, Mail, Lock, Loader2, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useBranding } from '@/hooks/useBranding';

export default function AuthPage() {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { branding } = useBranding();

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: loginPassword,
    });
    setLoading(false);
    if (error) {
      toast({ title: 'Giriş başarısız', description: error.message, variant: 'destructive' });
    } else {
      navigate('/');
    }
  };


  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative" style={{ background: 'var(--gradient-hero)' }}>
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          {branding.logo_url ? (
            <img src={branding.logo_url} alt="Logo" className="h-16 w-16 rounded-2xl object-contain shadow-lg mb-4" />
          ) : (
            <div className="h-16 w-16 rounded-2xl flex items-center justify-center shadow-lg mb-4 btn-gradient">
              <Sparkles className="h-8 w-8 text-primary-foreground" />
            </div>
          )}
          <h1 className="text-2xl font-bold font-display text-foreground tracking-tight">{branding.company_name}</h1>
          <p className="text-sm text-muted-foreground mt-1.5">{branding.app_name}</p>
        </div>

        <Card className="border-border/40 shadow-elevated backdrop-blur-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Hoş Geldiniz</CardTitle>
            <CardDescription>Hesabınıza giriş yapın</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="login-email" className="text-xs font-semibold">E-posta</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input id="login-email" type="email" placeholder="ornek@email.com" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} className="pl-10 h-11" required />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="login-password" className="text-xs font-semibold">Şifre</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input id="login-password" type="password" placeholder="••••••••" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} className="pl-10 h-11" required />
                </div>
              </div>
              <Button type="submit" className="w-full h-11 btn-gradient rounded-xl text-sm font-semibold gap-2" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><span>Giriş Yap</span><ArrowRight className="h-4 w-4" /></>}
              </Button>
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
