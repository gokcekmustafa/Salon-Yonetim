import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

export default function SettingsPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-2xl font-bold">Ayarlar</h1>

      <Card>
        <CardHeader>
          <CardTitle>Salon Bilgileri</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Salon Adı</p>
            <p className="font-medium">Demo Güzellik Salonu</p>
          </div>
          <Separator />
          <div>
            <p className="text-sm font-medium text-muted-foreground">Telefon</p>
            <p className="font-medium">0212 555 1234</p>
          </div>
          <Separator />
          <div>
            <p className="text-sm font-medium text-muted-foreground">Adres</p>
            <p className="font-medium">Kadıköy, İstanbul</p>
          </div>
          <Separator />
          <div>
            <p className="text-sm font-medium text-muted-foreground">Çalışma Saatleri</p>
            <p className="font-medium">09:00 - 20:00</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Hakkında</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            SalonYönetim v1.0 — Güzellik salonları için modern yönetim sistemi.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
