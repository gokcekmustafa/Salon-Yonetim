import { useAuth } from '@/contexts/AuthContext';
import { useSalonData } from '@/hooks/useSalonData';
import { useNavigate, useLocation } from 'react-router-dom';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { PopupDisplay } from '@/components/popup/PopupDisplay';
import { useOnlineHeartbeat } from '@/hooks/useOnlineStatus';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LogOut, Building2, Menu, X } from 'lucide-react';
import { useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface SalonLayoutProps {
  children: React.ReactNode;
}

const navItems = [
  { title: 'Panel', url: '/' },
  { title: 'Randevular', url: '/randevular' },
  { title: 'Müşteriler', url: '/musteriler' },
  { title: 'Hizmetler', url: '/hizmetler' },
  { title: 'Personel Yönetimi', url: '/personel' },
  { title: 'Şubeler', url: '/subeler' },
  { title: 'Aday Müşteriler', url: '/adaylar' },
  { title: 'Sözleşmeler', url: '/sozlesmeler' },
  { title: 'Ödemeler', url: '/kasa' },
  { title: 'Kasa Yönetimi', url: '/kasa-yonetimi' },
  { title: 'Taksitler', url: '/taksitler' },
  { title: 'Raporlar', url: '/raporlar' },
  { title: 'Performans', url: '/performans' },
  { title: 'Maaş & Ödeme', url: '/maas' },
  { title: 'Bildirimler', url: '/bildirimler' },
  { title: 'Destek & İletişim', url: '/destek' },
  { title: 'İzleme & Günlük', url: '/izleme' },
  { title: 'Ayarlar', url: '/ayarlar' },
];

export default function SalonLayout({ children }: SalonLayoutProps) {
  const { profile, signOut } = useAuth();
  const { salon } = useSalonData();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  useOnlineHeartbeat();

  const initials = (profile?.full_name || 'U')
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const today = new Date().toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    weekday: 'long',
  });

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const isActive = (url: string) =>
    url === '/' ? location.pathname === '/' : location.pathname.startsWith(url);

  return (
    <div className="min-h-screen flex flex-col bg-[hsl(var(--salon-bg))]">
      {/* TopBar */}
      <header className="sticky top-0 z-40 bg-card border-b" style={{ borderColor: '#e8e8e8' }}>
        <div className="flex items-center justify-between h-16 px-4 lg:px-6">
          {/* Left: Logo + Salon name + Date */}
          <div className="flex items-center gap-3 min-w-0">
            {salon?.logo_url ? (
              <img src={salon.logo_url} alt="" className="h-9 w-9 rounded-lg object-cover shadow-sm shrink-0" />
            ) : (
              <div className="h-9 w-9 rounded-lg btn-gradient flex items-center justify-center shrink-0">
                <Building2 className="h-5 w-5 text-primary-foreground" />
              </div>
            )}
            <div className="hidden sm:block min-w-0">
              <p className="text-sm font-bold text-foreground truncate">{salon?.name || 'Salon'}</p>
              <p className="text-[11px] text-muted-foreground leading-none mt-0.5">{today}</p>
            </div>

            {/* Mobile menu toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden ml-2 p-1.5 rounded-md hover:bg-muted transition-colors"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>

          {/* Center: Nav links (desktop) */}
          <nav className="hidden lg:flex items-center gap-1">
            {navItems.map(item => (
              <button
                key={item.url}
                onClick={() => navigate(item.url)}
                className={`px-4 py-2 rounded-full text-[14px] font-medium transition-all duration-200 ${
                  isActive(item.url)
                    ? 'bg-[hsl(var(--salon-nav-active-bg))] text-[hsl(var(--salon-nav-active-text))] font-semibold'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                {item.title}
              </button>
            ))}
          </nav>

          {/* Right: Notification + Avatar */}
          <div className="flex items-center gap-1.5">
            <ThemeToggle />
            <NotificationBell />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="h-9 w-9 rounded-full bg-primary flex items-center justify-center transition-transform hover:scale-105 active:scale-95 ml-1">
                  <span className="text-xs font-bold text-primary-foreground">{initials}</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <div className="px-3 py-2.5">
                  <p className="text-sm font-semibold">{profile?.full_name || 'Kullanıcı'}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Salon Admin</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
                  <LogOut className="h-4 w-4 mr-2" />
                  Çıkış Yap
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Mobile nav */}
        {mobileMenuOpen && (
          <nav className="lg:hidden border-t px-4 py-3 flex flex-wrap gap-2" style={{ borderColor: '#e8e8e8' }}>
            {navItems.map(item => (
              <button
                key={item.url}
                onClick={() => {
                  navigate(item.url);
                  setMobileMenuOpen(false);
                }}
                className={`px-4 py-2 rounded-full text-[14px] font-medium transition-all duration-200 ${
                  isActive(item.url)
                    ? 'bg-[hsl(var(--salon-nav-active-bg))] text-[hsl(var(--salon-nav-active-text))] font-semibold'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                {item.title}
              </button>
            ))}
          </nav>
        )}
      </header>

      {/* Content */}
      <main className="flex-1 p-5 overflow-auto">
        {children}
      </main>

      <PopupDisplay />
    </div>
  );
}
