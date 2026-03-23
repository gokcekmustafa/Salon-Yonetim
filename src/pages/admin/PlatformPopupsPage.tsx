import { PopupManager } from '@/components/popup/PopupManager';

export default function PlatformPopupsPage() {
  return (
    <div className="page-container animate-in">
      <PopupManager mode="super_admin" />
    </div>
  );
}
