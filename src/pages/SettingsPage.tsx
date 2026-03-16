import { useNavigate } from 'react-router-dom';
import { Settings, Bell, PanelsTopLeft } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SalonProfileSettings } from '@/components/salon/SalonProfileSettings';
import { useSalonData } from '@/hooks/useSalonData';

export default function SettingsPage() {
  const navigate = useNavigate();
  const { salon, refetchSalon } = useSalonData();

  return (
    <div className="page-container animate-in space-y-6">
      <div>
        <h1 className="page-title">Ayarlar</h1>
        <p className="page-subtitle">Burada yalnızca genel ayarlar yer alır; modül sayfaları artık “Daha Fazla” menüsündedir.</p>
      </div>

      {salon && (
        <SalonProfileSettings
          salonId={salon.id}
          salonName={salon.name}
          logoUrl={salon.logo_url}
          onUpdated={refetchSalon}
        />
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="shadow-soft border-border/60">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-primary" />
              <div>
                <CardTitle>Bildirim tercihleri</CardTitle>
                <CardDescription>Bildirim listesini görüntüleyin ve okundu durumlarını yönetin.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={() => navigate('/bildirimler')}>Bildirimlere Git</Button>
          </CardContent>
        </Card>

        <Card className="shadow-soft border-border/60">
          <CardHeader>
            <div className="flex items-center gap-2">
              <PanelsTopLeft className="h-5 w-5 text-primary" />
              <div>
                <CardTitle>Navigasyon düzeni</CardTitle>
                <CardDescription>Navigasyonda görünür modüller “Daha Fazla” menüsünde anlık olarak yansıtılır.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-xl border border-border/60 bg-muted/30 p-4 text-sm text-muted-foreground">
              Navigasyon özelleştirme yapınız korunmuştur; görünür başlıklar üst menü ve “Daha Fazla” altında otomatik gösterilir.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
