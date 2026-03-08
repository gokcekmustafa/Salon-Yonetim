import { useAuth } from '@/contexts/AuthContext';
import { OnlineUsersPanel } from '@/components/admin/OnlineUsersPanel';
import { AuditLogViewer } from '@/components/admin/AuditLogViewer';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Activity, FileText } from 'lucide-react';

export default function AuditPage() {
  const { isSuperAdmin, isSalonAdmin, currentSalonId } = useAuth();

  const mode = isSuperAdmin ? 'super_admin' : 'salon_admin';

  return (
    <div className="page-container animate-in">
      <div>
        <h1 className="page-title">İzleme & Günlük</h1>
        <p className="page-subtitle">Çevrimiçi kullanıcılar ve işlem geçmişi</p>
      </div>

      <Tabs defaultValue="online" className="space-y-4">
        <TabsList>
          <TabsTrigger value="online" className="gap-1.5">
            <Activity className="h-4 w-4" /> Çevrimiçi
          </TabsTrigger>
          <TabsTrigger value="audit" className="gap-1.5">
            <FileText className="h-4 w-4" /> İşlem Günlüğü
          </TabsTrigger>
        </TabsList>

        <TabsContent value="online">
          <OnlineUsersPanel />
        </TabsContent>

        <TabsContent value="audit">
          <AuditLogViewer
            mode={mode}
            salonId={mode === 'salon_admin' ? currentSalonId : undefined}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
