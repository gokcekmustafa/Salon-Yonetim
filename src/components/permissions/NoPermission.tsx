import { ShieldOff, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export function NoPermission({ feature }: { feature: string }) {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="h-16 w-16 rounded-2xl bg-destructive/10 flex items-center justify-center mb-4">
        <ShieldOff className="h-8 w-8 text-destructive" />
      </div>
      <h2 className="text-lg font-semibold mb-1">Bu sayfaya erişim yetkiniz yok</h2>
      <p className="text-sm text-muted-foreground max-w-sm mb-4">
        <span className="font-medium">{feature}</span> sayfasına erişim izniniz bulunmamaktadır.
        Lütfen salon yöneticinize başvurun.
      </p>
      <Button variant="outline" onClick={() => navigate('/')} className="gap-2">
        <ArrowLeft className="h-4 w-4" /> Geri Dön
      </Button>
    </div>
  );
}
