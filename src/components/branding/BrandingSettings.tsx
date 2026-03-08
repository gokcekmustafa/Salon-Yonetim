import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Loader2, Upload, Trash2, Palette, Building, AppWindow, Image } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useBranding } from '@/hooks/useBranding';

export function BrandingSettings() {
  const { branding, updateBranding, refetch } = useBranding();
  const [companyName, setCompanyName] = useState(branding.company_name);
  const [appName, setAppName] = useState(branding.app_name);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Sync local state when branding data loads/changes
  useEffect(() => {
    setCompanyName(branding.company_name);
    setAppName(branding.app_name);
  }, [branding.company_name, branding.app_name]);

  const handleSaveNames = async () => {
    setSaving(true);
    const r1 = await updateBranding('company_name', companyName);
    const r2 = await updateBranding('app_name', appName);
    if (!r1.error && !r2.error) {
      toast.success('Marka ayarları güncellendi');
    } else {
      toast.error('Ayarlar kaydedilirken hata oluştu');
    }
    setSaving(false);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Lütfen bir resim dosyası seçin');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Dosya boyutu 2MB\'dan küçük olmalıdır');
      return;
    }

    // Show preview
    setPreviewUrl(URL.createObjectURL(file));
    setUploading(true);

    const ext = file.name.split('.').pop();
    const filePath = `logo.${ext}`;

    // Remove old logo first
    await supabase.storage.from('system-branding').remove([filePath]);

    const { error: uploadError } = await supabase.storage
      .from('system-branding')
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      toast.error('Logo yüklenirken hata oluştu');
      setUploading(false);
      setPreviewUrl(null);
      return;
    }

    const { data: urlData } = supabase.storage
      .from('system-branding')
      .getPublicUrl(filePath);

    const logoUrl = `${urlData.publicUrl}?t=${Date.now()}`;
    const { error } = await updateBranding('logo_url', logoUrl);
    if (!error) {
      toast.success('Logo güncellendi');
    }
    setPreviewUrl(null);
    setUploading(false);
    refetch();
  };

  const handleRemoveLogo = async () => {
    setSaving(true);
    // Try remove common extensions
    await supabase.storage.from('system-branding').remove(['logo.png', 'logo.jpg', 'logo.jpeg', 'logo.webp', 'logo.svg']);
    await updateBranding('logo_url', '');
    toast.success('Logo kaldırıldı');
    setSaving(false);
    refetch();
  };

  const displayLogo = previewUrl || branding.logo_url;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Palette className="h-5 w-5 text-primary" />
          <div>
            <CardTitle>Sistem Marka Ayarları</CardTitle>
            <CardDescription>Firma adı, uygulama adı ve logo ayarlarını düzenleyin</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Logo Section */}
        <div className="space-y-3">
          <Label className="flex items-center gap-2 text-sm font-medium">
            <Image className="h-4 w-4" /> Sistem Logosu
          </Label>
          <div className="flex items-center gap-4">
            <div className="h-20 w-20 rounded-xl border-2 border-dashed border-border flex items-center justify-center overflow-hidden bg-muted/30">
              {displayLogo ? (
                <img src={displayLogo} alt="Logo" className="h-full w-full object-contain p-1" />
              ) : (
                <Upload className="h-6 w-6 text-muted-foreground" />
              )}
            </div>
            <div className="flex flex-col gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleLogoUpload}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                {uploading ? 'Yükleniyor...' : 'Logo Yükle'}
              </Button>
              {branding.logo_url && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={handleRemoveLogo}
                  disabled={saving}
                >
                  <Trash2 className="h-4 w-4 mr-2" /> Logoyu Kaldır
                </Button>
              )}
              <p className="text-[11px] text-muted-foreground">PNG, JPG veya SVG. Maks 2MB.</p>
            </div>
          </div>
        </div>

        {/* Company Name */}
        <div className="space-y-2">
          <Label htmlFor="company_name" className="flex items-center gap-2 text-sm font-medium">
            <Building className="h-4 w-4" /> Firma Adı
          </Label>
          <Input
            id="company_name"
            value={companyName}
            onChange={e => setCompanyName(e.target.value)}
            placeholder="Firma adı girin"
          />
          <p className="text-[11px] text-muted-foreground">Tüm panellerde ve raporlarda görünecek firma adı.</p>
        </div>

        {/* App Name */}
        <div className="space-y-2">
          <Label htmlFor="app_name" className="flex items-center gap-2 text-sm font-medium">
            <AppWindow className="h-4 w-4" /> Uygulama Adı
          </Label>
          <Input
            id="app_name"
            value={appName}
            onChange={e => setAppName(e.target.value)}
            placeholder="Uygulama adı girin"
          />
          <p className="text-[11px] text-muted-foreground">Sidebar ve footer'da görünecek alt başlık.</p>
        </div>

        <Button onClick={handleSaveNames} disabled={saving} className="w-full sm:w-auto">
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Kaydet
        </Button>
      </CardContent>
    </Card>
  );
}
