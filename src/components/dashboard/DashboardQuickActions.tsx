import { Calendar, Plus, UserCheck, BarChart3, CreditCard, Package, Wallet, UserSearch } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function DashboardQuickActions() {
  const navigate = useNavigate();

  const actions = [
    { label: 'Randevular', icon: Calendar, onClick: () => navigate('/randevular'), color: 'text-primary bg-primary/8 hover:bg-primary/15 border-primary/15' },
    { label: 'Yeni Müşteri', icon: Plus, onClick: () => navigate('/musteriler?yeni=1'), color: 'text-success bg-success/8 hover:bg-success/15 border-success/15' },
    { label: 'Müşteriler', icon: UserCheck, onClick: () => navigate('/musteriler'), color: 'text-accent bg-accent/8 hover:bg-accent/15 border-accent/15' },
    { label: 'Raporlar', icon: BarChart3, onClick: () => navigate('/raporlar'), color: 'text-warning bg-warning/8 hover:bg-warning/15 border-warning/15' },
    { label: 'Kasa Yönetimi', icon: CreditCard, onClick: () => navigate('/kasa-yonetimi'), color: 'text-info bg-info/8 hover:bg-info/15 border-info/15' },
    { label: 'Ürünler', icon: Package, onClick: () => navigate('/urunler'), color: 'text-primary bg-primary/8 hover:bg-primary/15 border-primary/15' },
    { label: 'Ödemeler', icon: Wallet, onClick: () => navigate('/kasa'), color: 'text-warning bg-warning/8 hover:bg-warning/15 border-warning/15' },
    { label: 'Personel', icon: UserCheck, onClick: () => navigate('/personel'), color: 'text-success bg-success/8 hover:bg-success/15 border-success/15' },
    { label: 'Aday Müşteriler', icon: UserSearch, onClick: () => navigate('/adaylar'), color: 'text-accent bg-accent/8 hover:bg-accent/15 border-accent/15' },
  ];

  return (
    <div className="grid grid-cols-3 gap-2">
      {actions.map(action => (
        <button
          key={action.label}
          onClick={action.onClick}
          className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-lg border transition-all duration-200 ${action.color}`}
        >
          <action.icon className="h-4 w-4" />
          <span className="text-[10px] font-semibold">{action.label}</span>
        </button>
      ))}
    </div>
  );
}
