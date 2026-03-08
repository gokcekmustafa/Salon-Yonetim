import { ShieldOff } from 'lucide-react';

export function NoPermission({ feature }: { feature: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="h-16 w-16 rounded-2xl bg-destructive/10 flex items-center justify-center mb-4">
        <ShieldOff className="h-8 w-8 text-destructive" />
      </div>
      <h2 className="text-lg font-semibold mb-1">Erişim Engellendi</h2>
      <p className="text-sm text-muted-foreground max-w-sm">
        <span className="font-medium">{feature}</span> özelliğine erişim izniniz bulunmamaktadır.
        Lütfen salon yöneticinize başvurun.
      </p>
    </div>
  );
}
