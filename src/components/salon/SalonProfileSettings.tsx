import { useState, useRef } from 'react';
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
  const fileRef = useRef<HTMLInputElement>(null);

  const currentLogo = preview || logoUrl;

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
  };

  const uploadLogo = async (): Promise<string | null> => {
    if (!selectedFile) return logoUrl;
    const ext = selectedFile.name.split('.').pop() || 'png';
    const path = `${salonId}/logo-${Date.now()}.${ext}`;

    const { error } = await supabase.storage.from('salon-logos').upload(path, selectedFile, {
      cacheControl: '3600',
      upsert: true,
    });
    if (error) {
      toast.error('Logo yüklenemedi: ' + error.message);
      return null;
    }
    const { data: { publicUrl } } = supabase.storage.from('salon-logos').getPublicUrl(path);
    return publicUrl;
  };

  const handleSave = async () => {
    if (!name.trim()) { toast.error('Salon adı zorunludur'); return; }
    setSaving(true);

    let newLogoUrl = logoUrl;
    if (selectedFile) {
      const url = await uploadLogo();
      if (url === null && selectedFile) { setSaving(false); return; }
      newLogoUrl = url;
    }

    const { error } = await supabase.from('salons').update({
      name: name.trim(),
      logo_url: newLogoUrl,
    }).eq('id', salonId);

    if (error) {
      toast.error('Güncelleme başarısız: ' + error.message);
    } else {
      toast.success('Salon profili güncellendi');
      setSelectedFile(null);
      setPreview(null);
      onUpdated();
    }
    setSaving(false);
  };

  const handleRemoveLogo = async () => {
    setRemoving(true);
    const { error } = await supabase.from('salons').update({ logo_url: null }).eq('id', salonId);
    if (error) {
      toast.error('Logo kaldırılamadı');
    } else {
      toast.success('Logo kaldırıldı');
      setPreview(null);
      setSelectedFile(null);
      onUpdated();
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
                {currentLogo ? (
                  <img src={currentLogo} alt="Salon logo" className="h-full w-full object-cover rounded-xl" />
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
              {currentLogo && (
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
