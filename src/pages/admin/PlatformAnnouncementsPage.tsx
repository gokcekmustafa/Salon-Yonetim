import { AnnouncementManager } from '@/components/notifications/AnnouncementManager';

export default function PlatformAnnouncementsPage() {
  return (
    <div className="page-container animate-in">
      <AnnouncementManager mode="super_admin" />
    </div>
  );
}
