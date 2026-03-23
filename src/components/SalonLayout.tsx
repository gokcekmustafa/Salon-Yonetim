import { useAuth } from '@/contexts/AuthContext';
import { useSalonData } from '@/hooks/useSalonData';
import { useNavigate, useLocation } from 'react-router-dom';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { PopupDisplay } from '@/components/popup/PopupDisplay';
import { useOnlineHeartbeat } from '@/hooks/useOnlineStatus';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useSalonNavigation } from '@/hooks/useSalonNavigation';
import { LogOut, Building2, Menu, X, LifeBuoy, Activity, Settings, ArrowLeft, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { BranchSelector } from '@/components/BranchSelector';
import { Button } from '@/components/ui/button';
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

export default function SalonLayout({ children }: SalonLayoutProps) {
  const { profile, signOut, isManagingSalon, stopManagingSalon } = useAuth();
  const { salon } = useSalonData();
  const { topbarItems, moreItems, hasMoreItems } = useSalonNavigation();
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

  const hasActiveMoreItem = moreItems.some((item) => isActive(item.url));

  const navButtonClass = (active: boolean) =>
    `px-4 py-2 rounded-full text-[14px] font-medium transition-all duration-200 ${
      active
        ? 'bg-[hsl(var(--salon-nav-active-bg))] text-[hsl(var(--salon-nav-active-text))] font-semibold'
        : 'text-muted-foreground hover:text-foreground hover:bg-muted'
    }`;

  const handleExitManagedSalon = () => {
    stopManagingSalon();
    navigate('/admin/salonlar');
  };

  const handleNavigate = (url: string) => {
    navigate(url);
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[hsl(var(--salon-bg))]">
      {isManagingSalon && (
        <div className="sticky top-0 z-50 border-b border-warning/30 bg-warning/15 backdrop-blur-sm">
          <div className="flex min-h-12 flex-col gap-2 px-4 py-2 sm:flex-row sm:items-center sm:justify-between lg:px-6">
            <p className="text-sm font-semibold text-warning-foreground">
              ⚠️ {salon?.name || 'Salon'} adına yönetiyorsunuz
            </p>
            <Button variant="outline" size="sm" className="border-warning/40 bg-background/80 text-foreground hover:bg-background" onClick={handleExitManagedSalon}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Superadmin Paneline Dön
            </Button>
          </div>
        </div>
      )}
      <header className={`sticky z-40 bg-card border-b ${isManagingSalon ? 'top-12' : 'top-0'}`} style={{ borderColor: '#e8e8e8' }}>
        <div className="flex items-center justify-between h-16 px-4 lg:px-6">
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
            <div className="hidden sm:block ml-2">
              <BranchSelector />
            </div>

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden ml-2 p-1.5 rounded-md hover:bg-muted transition-colors"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>

          <nav className="hidden lg:flex items-center gap-1">
            {topbarItems.map((item) => (
              <button
                key={item.key}
                onClick={() => navigate(item.url)}
                className={navButtonClass(isActive(item.url))}
              >
                {item.title}
              </button>
            ))}

            {hasMoreItems && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className={`${navButtonClass(hasActiveMoreItem)} flex items-center gap-1.5`}>
                    Daha Fazla
                    <ChevronDown className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  sideOffset={8}
                  className="min-w-52 rounded-[10px] border border-border/60 bg-background p-1.5 shadow-md"
                >
                  {moreItems.map((item) => (
                    <DropdownMenuItem
                      key={item.key}
                      onClick={() => navigate(item.url)}
                      className={`rounded-lg px-2.5 py-2.5 text-sm ${
                        isActive(item.url)
                          ? 'bg-[hsl(var(--salon-nav-active-bg))] text-[hsl(var(--salon-nav-active-text))]'
                          : 'focus:bg-[hsl(var(--salon-nav-active-bg))]'
                      }`}
                    >
                      {item.title}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </nav>

          <div className="flex items-center gap-1.5">
            <ThemeToggle />
            <NotificationBell />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="h-9 w-9 rounded-full bg-primary flex items-center justify-center transition-transform hover:scale-105 active:scale-95 ml-1">
                  <span className="text-xs font-bold text-primary-foreground">{initials}</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-3 py-2.5">
                  <p className="text-sm font-semibold">{profile?.full_name || 'Kullanıcı'}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Salon Admin</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/destek')}>
                  <LifeBuoy className="h-4 w-4 mr-2" />
                  Destek & İletişim
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/izleme')}>
                  <Activity className="h-4 w-4 mr-2" />
                  İzleme & Günlük
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/ayarlar')}>
                  <Settings className="h-4 w-4 mr-2" />
                  Ayarlar
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
                  <LogOut className="h-4 w-4 mr-2" />
                  Çıkış Yap
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {mobileMenuOpen && (
          <nav className="lg:hidden border-t px-4 py-3 flex flex-col gap-2" style={{ borderColor: '#e8e8e8' }}>
            <div className="sm:hidden mb-1">
              <BranchSelector />
            </div>
            <div className="flex flex-wrap gap-2">
            {topbarItems.map((item) => (
              <button
                key={item.key}
                onClick={() => handleNavigate(item.url)}
                className={navButtonClass(isActive(item.url))}
              >
                {item.title}
              </button>
            ))}

            {hasMoreItems && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className={`${navButtonClass(hasActiveMoreItem)} flex items-center gap-1.5`}>
                    Daha Fazla
                    <ChevronDown className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  sideOffset={8}
                  className="min-w-52 rounded-[10px] border border-border/60 bg-background p-1.5 shadow-md"
                >
                  {moreItems.map((item) => (
                    <DropdownMenuItem
                      key={item.key}
                      onClick={() => handleNavigate(item.url)}
                      className={`rounded-lg px-2.5 py-2.5 text-sm ${
                        isActive(item.url)
                          ? 'bg-[hsl(var(--salon-nav-active-bg))] text-[hsl(var(--salon-nav-active-text))]'
                          : 'focus:bg-[hsl(var(--salon-nav-active-bg))]'
                      }`}
                    >
                      {item.title}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            </div>
          </nav>
        )}
      </header>

      <main className="flex-1 p-5 overflow-auto">
        {children}
      </main>

      <PopupDisplay />
    </div>
  );
}
