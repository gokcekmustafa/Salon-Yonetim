import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Building2, Upload, X, Loader2, Camera } from 'lucide-react';

interface SalonProfileSettingsProps {
  salonId: string;
  salonName: string;
  logoUrl: string | null;
  onUpdated: () => void;
}

export function SalonProfileSettings({ salonId, salonName, logoUrl, onUpdated }: SalonProfileSettingsProps) {
  const [name, setName] = useState(salonName);
  const [preview, setPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [currentLogoUrl, setCurrentLogoUrl] = useState<string | null>(logoUrl);
  const fileRef = useRef<HTMLInputElement>(null);

  // Sync props when they change
  useEffect(() => { setName(salonName); }, [salonName]);
  useEffect(() => { setCurrentLogoUrl(logoUrl); }, [logoUrl]);

  const displayLogo = preview || currentLogoUrl;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Sadece resim dosyaları yüklenebilir');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Dosya boyutu 2MB\'dan küçük olmalıdır');
      return;
    }
    setSelectedFile(file);
    setPreview(URL.createObjectURL(file));
    // Reset input so same file can be re-selected
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleSave = async () => {
    if (!name.trim()) { toast.error('Salon adı zorunludur'); return; }
    setSaving(true);

    try {
      let newLogoUrl = currentLogoUrl;

      // Upload logo if a new file was selected
      if (selectedFile) {
        const ext = selectedFile.name.split('.').pop() || 'png';
        const path = `${salonId}/logo-${Date.now()}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from('salon-logos')
          .upload(path, selectedFile, { cacheControl: '3600', upsert: true });

        if (uploadError) {
          console.error('Storage upload error:', uploadError);
          toast.error('Logo yüklenemedi: ' + uploadError.message);
          setSaving(false);
          return;
        }

        const { data: { publicUrl } } = supabase.storage
          .from('salon-logos')
          .getPublicUrl(path);
        newLogoUrl = publicUrl;
      }

      // Update salon record
      const { error: updateError, data } = await supabase
        .from('salons')
        .update({ name: name.trim(), logo_url: newLogoUrl })
        .eq('id', salonId)
        .select();

      if (updateError) {
        console.error('Salon update error:', updateError);
        toast.error('Güncelleme başarısız: ' + updateError.message);
      } else if (!data || data.length === 0) {
        console.error('Salon update returned no rows - RLS may be blocking');
        toast.error('Güncelleme yapılamadı. Yetkiniz olmayabilir.');
      } else {
        toast.success('Salon profili güncellendi');
        setSelectedFile(null);
        setPreview(null);
        setCurrentLogoUrl(newLogoUrl);
        onUpdated();
      }
    } catch (err) {
      console.error('Unexpected error during save:', err);
      toast.error('Beklenmeyen bir hata oluştu');
    }

    setSaving(false);
  };

  const handleRemoveLogo = async () => {
    setRemoving(true);
    try {
      const { error, data } = await supabase
        .from('salons')
        .update({ logo_url: null })
        .eq('id', salonId)
        .select();

      if (error) {
        toast.error('Logo kaldırılamadı: ' + error.message);
      } else if (!data || data.length === 0) {
        toast.error('Logo kaldırılamadı. Yetkiniz olmayabilir.');
      } else {
        toast.success('Logo kaldırıldı');
        setPreview(null);
        setSelectedFile(null);
        setCurrentLogoUrl(null);
        onUpdated();
      }
    } catch (err) {
      console.error('Error removing logo:', err);
      toast.error('Beklenmeyen bir hata oluştu');
    }
    setRemoving(false);
  };

  const hasChanges = name.trim() !== salonName || !!selectedFile;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" />
          <div>
            <CardTitle>Salon Profili</CardTitle>
            <CardDescription>Salon adını ve logosunu düzenleyin</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Logo Section */}
        <div className="space-y-3">
          <Label className="text-sm font-semibold">Salon Logosu</Label>
          <div className="flex items-center gap-4">
            <div className="relative group">
              <div className="h-20 w-20 rounded-xl border-2 border-dashed border-border bg-muted/50 flex items-center justify-center overflow-hidden transition-colors group-hover:border-primary/50">
                {displayLogo ? (
                  <img src={displayLogo} alt="Salon logo" className="h-full w-full object-cover rounded-xl" />
                ) : (
                  <Building2 className="h-8 w-8 text-muted-foreground/40" />
                )}
              </div>
              <button
                onClick={() => fileRef.current?.click()}
                className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-md hover:scale-110 transition-transform"
              >
                <Camera className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="space-y-1.5">
              <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} className="gap-1.5 text-xs">
                <Upload className="h-3.5 w-3.5" /> Logo Yükle
              </Button>
              {displayLogo && (
                <Button variant="ghost" size="sm" onClick={handleRemoveLogo} disabled={removing} className="gap-1.5 text-xs text-destructive hover:text-destructive">
                  {removing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />} Kaldır
                </Button>
              )}
              <p className="text-[11px] text-muted-foreground">PNG, JPG veya SVG. Maks 2MB.</p>
            </div>
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
          {preview && (
            <div className="p-3 rounded-lg bg-muted/50 border border-border">
              <p className="text-xs font-medium text-muted-foreground mb-2">Önizleme:</p>
              <div className="flex items-center gap-3">
                <img src={preview} alt="Preview" className="h-12 w-12 rounded-lg object-cover border" />
                <p className="text-sm font-medium">{selectedFile?.name}</p>
              </div>
            </div>
          )}
        </div>

        {/* Name Section */}
        <div className="space-y-2">
          <Label className="text-sm font-semibold">Salon Adı</Label>
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="Salon adını girin" className="h-10" />
        </div>

        <Button onClick={handleSave} disabled={saving || !hasChanges} className="w-full sm:w-auto gap-2">
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Değişiklikleri Kaydet
        </Button>
      </CardContent>
    </Card>
  );
}
