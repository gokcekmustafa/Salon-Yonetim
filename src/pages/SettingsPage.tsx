import { Settings } from 'lucide-react';
import { SalonProfileSettings } from '@/components/salon/SalonProfileSettings';
import { ProfileSettings } from '@/components/settings/ProfileSettings';
import { GeneralSettings } from '@/components/settings/GeneralSettings';
import { NotificationPreferences } from '@/components/settings/NotificationPreferences';
import { useSalonData } from '@/hooks/useSalonData';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function SettingsPage() {
  const { salon, refetchSalon } = useSalonData();

  return (
    <div className="page-container animate-in space-y-6">
      <div>
        <h1 className="page-title">Ayarlar</h1>
        <p className="page-subtitle">Profil, salon ve bildirim ayarlarınızı yönetin.</p>
      </div>

      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="grid w-full grid-cols-3 sm:w-auto sm:inline-grid">
          <TabsTrigger value="profile">Profil</TabsTrigger>
          <TabsTrigger value="general">Genel Ayarlar</TabsTrigger>
          <TabsTrigger value="notifications">Bildirimler</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-6 mt-4">
          <ProfileSettings />
          {salon && (
            <SalonProfileSettings
              salonId={salon.id}
              salonName={salon.name}
              logoUrl={salon.logo_url}
              onUpdated={refetchSalon}
            />
          )}
        </TabsContent>

        <TabsContent value="general" className="mt-4">
          {salon && (
            <GeneralSettings
              salonId={salon.id}
              salonName={salon.name}
              salonAddress={salon.address}
              salonPhone={salon.phone}
              onUpdated={refetchSalon}
            />
          )}
        </TabsContent>

        <TabsContent value="notifications" className="mt-4">
          {salon && <NotificationPreferences salonId={salon.id} />}
        </TabsContent>
      </Tabs>
    </div>
  );
}
