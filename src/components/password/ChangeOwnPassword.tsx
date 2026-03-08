import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Lock, Loader2, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

export function ChangeOwnPassword() {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast.error('Şifre en az 6 karakter olmalıdır');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Şifreler eşleşmiyor');
      return;
    }

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke('manage-passwords', {
        body: { action: 'change_own_password', new_password: newPassword },
      });

      if (res.error || res.data?.error) {
        toast.error(res.data?.error || res.error?.message || 'Hata oluştu');
      } else {
        toast.success('Şifreniz başarıyla değiştirildi');
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch {
      toast.error('Şifre değiştirme başarısız');
    }
    setLoading(false);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Lock className="h-5 w-5 text-primary" />
          <div>
            <CardTitle>Şifre Değiştir</CardTitle>
            <CardDescription>Hesabınızın şifresini güncelleyin</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4 max-w-sm">
          <div className="space-y-2">
            <Label className="text-xs font-semibold">Yeni Şifre</Label>
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="En az 6 karakter"
                className="h-10 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-semibold">Şifreyi Onayla</Label>
            <Input
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="Şifreyi tekrar girin"
              className="h-10"
            />
          </div>
          <Button type="submit" disabled={loading || !newPassword || !confirmPassword} className="btn-gradient">
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Şifreyi Değiştir
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
