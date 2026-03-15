import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ServicesPage from './ServicesPage';
import BranchesPage from './BranchesPage';
import RoomsPage from './RoomsPage';
import ContractsPage from './ContractsPage';
import StaffSalaryPage from './StaffSalaryPage';

const settingsTabs = [
  { value: 'hizmetler', label: 'Hizmetler', content: <ServicesPage /> },
  { value: 'subeler', label: 'Şubeler', content: <BranchesPage /> },
  { value: 'odalar', label: 'Odalar', content: <RoomsPage /> },
  { value: 'sozlesmeler', label: 'Sözleşmeler', content: <ContractsPage /> },
  { value: 'maas', label: 'Maaş & Ödeme', content: <StaffSalaryPage /> },
];

export default function SettingsPage() {
  return (
    <div className="page-container animate-in space-y-6">
      <div>
        <h1 className="page-title">Ayarlar</h1>
        <p className="page-subtitle">Salon yönetim modüllerini tek yerden yönetin</p>
      </div>

      <Tabs defaultValue="hizmetler" className="space-y-6">
        <TabsList className="h-auto w-full justify-start overflow-x-auto rounded-xl p-1">
          {settingsTabs.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value} className="shrink-0 rounded-lg px-4 py-2">
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {settingsTabs.map((tab) => (
          <TabsContent key={tab.value} value={tab.value} className="mt-0">
            {tab.content}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
