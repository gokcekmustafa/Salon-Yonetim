import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { User, Upload, Camera, Loader2, Eye, EyeOff, Save, Pencil, X } from 'lucide-react';

export function ProfileSettings() {
  const { user, profile } = useAuth();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Password fields
  const [changingPassword, setChangingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);

  useEffect(() => {
    setFullName(profile?.full_name || '');
    setPhone(profile?.phone || '');
    setEmail(user?.email || '');
    setUsername(profile?.username || '');
    setAvatarUrl(profile?.avatar_url || null);
  }, [profile, user]);

  const displayAvatar = avatarPreview || avatarUrl;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Sadece resim dosyaları yüklenebilir'); return; }
    if (file.size > 2 * 1024 * 1024) { toast.error('Dosya boyutu 2MB\'dan küçük olmalıdır'); return; }
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    if (!fullName.trim()) { toast.error('Ad Soyad zorunludur'); return; }
    setSaving(true);

    try {
      let newAvatarUrl = avatarUrl;

      if (avatarFile) {
        const ext = avatarFile.name.split('.').pop() || 'png';
        const path = `${user.id}/avatar-${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from('salon-logos')
          .upload(path, avatarFile, { cacheControl: '3600', upsert: true });

        if (uploadError) {
          toast.error('Fotoğraf yüklenemedi: ' + uploadError.message);
          setSaving(false);
          return;
        }

        const { data: { publicUrl } } = supabase.storage.from('salon-logos').getPublicUrl(path);
        newAvatarUrl = publicUrl;
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName.trim(),
          phone: phone.trim() || null,
          avatar_url: newAvatarUrl,
        })
        .eq('user_id', user.id);

      if (error) {
        toast.error('Profil güncellenemedi: ' + error.message);
      } else {
        toast.success('Profil güncellendi');
        setAvatarUrl(newAvatarUrl);
        setAvatarFile(null);
        setAvatarPreview(null);
        setEditing(false);
      }
    } catch {
      toast.error('Beklenmeyen bir hata oluştu');
    }
    setSaving(false);
  };

  const handleChangePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      toast.error('Yeni şifre en az 6 karakter olmalıdır');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Yeni şifreler eşleşmiyor');
      return;
    }
    if (!currentPassword) {
      toast.error('Mevcut şifrenizi girin');
      return;
    }

    setPwSaving(true);
    try {
      // Verify current password by attempting sign in
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: user?.email || '',
        password: currentPassword,
      });

      if (verifyError) {
        toast.error('Mevcut şifre yanlış');
        setPwSaving(false);
        return;
      }

      const { error } = await supabase.functions.invoke('manage-passwords', {
        body: { action: 'change_own_password', new_password: newPassword },
      });

      if (error) {
        toast.error('Şifre değiştirilemedi');
      } else {
        toast.success('Şifre başarıyla değiştirildi');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setChangingPassword(false);
      }
    } catch {
      toast.error('Beklenmeyen bir hata oluştu');
    }
    setPwSaving(false);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            <div>
              <CardTitle>Profil Bilgileri</CardTitle>
              <CardDescription>Kişisel bilgilerinizi görüntüleyin ve düzenleyin</CardDescription>
            </div>
          </div>
          {!editing && (
            <Button variant="outline" size="sm" onClick={() => setEditing(true)} className="gap-1.5">
              <Pencil className="h-3.5 w-3.5" /> Düzenle
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Avatar */}
        <div className="flex items-center gap-4">
          <div className="relative group">
            <div className="h-20 w-20 rounded-full border-2 border-dashed border-border bg-muted/50 flex items-center justify-center overflow-hidden">
              {displayAvatar ? (
                <img src={displayAvatar} alt="Profil" className="h-full w-full object-cover rounded-full" />
              ) : (
                <User className="h-8 w-8 text-muted-foreground/40" />
              )}
            </div>
            {editing && (
              <button
                onClick={() => fileRef.current?.click()}
                className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-md hover:scale-110 transition-transform"
              >
                <Camera className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          {editing && (
            <div className="space-y-1">
              <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} className="gap-1.5 text-xs">
                <Upload className="h-3.5 w-3.5" /> Fotoğraf Yükle
              </Button>
              <p className="text-[11px] text-muted-foreground">PNG, JPG. Maks 2MB.</p>
            </div>
          )}
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
        </div>

        {/* Profile fields */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label className="text-xs font-semibold">Ad Soyad</Label>
            <Input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              disabled={!editing}
              placeholder="Ad Soyad"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-semibold">Telefon</Label>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={!editing}
              placeholder="05XX XXX XX XX"
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label className="text-xs font-semibold">E-posta</Label>
            <Input value={email} disabled className="bg-muted/50" />
            <p className="text-[11px] text-muted-foreground">E-posta değişikliği için yönetici ile iletişime geçin.</p>
          </div>
        </div>

        {editing && (
          <div className="flex gap-2">
            <Button onClick={handleSaveProfile} disabled={saving} className="gap-1.5">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Kaydet
            </Button>
            <Button variant="ghost" onClick={() => {
              setEditing(false);
              setFullName(profile?.full_name || '');
              setPhone(profile?.phone || '');
              setAvatarPreview(null);
              setAvatarFile(null);
            }}>
              <X className="h-4 w-4 mr-1" /> İptal
            </Button>
          </div>
        )}

        <Separator />

        {/* Password change */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-semibold">Şifre Değiştir</Label>
            {!changingPassword && (
              <Button variant="outline" size="sm" onClick={() => setChangingPassword(true)}>
                Şifre Değiştir
              </Button>
            )}
          </div>

          {changingPassword && (
            <div className="space-y-3 p-4 rounded-lg border border-border bg-muted/30">
              <div className="space-y-2">
                <Label className="text-xs">Mevcut Şifre</Label>
                <div className="relative">
                  <Input
                    type={showCurrentPw ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="••••••••"
                    className="pr-10"
                  />
                  <button type="button" onClick={() => setShowCurrentPw(!showCurrentPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showCurrentPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Yeni Şifre</Label>
                <div className="relative">
                  <Input
                    type={showNewPw ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="pr-10"
                  />
                  <button type="button" onClick={() => setShowNewPw(!showNewPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showNewPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Yeni Şifre (Tekrar)</Label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleChangePassword} disabled={pwSaving} size="sm" className="gap-1.5">
                  {pwSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Şifreyi Güncelle
                </Button>
                <Button variant="ghost" size="sm" onClick={() => {
                  setChangingPassword(false);
                  setCurrentPassword('');
                  setNewPassword('');
                  setConfirmPassword('');
                }}>
                  İptal
                </Button>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
