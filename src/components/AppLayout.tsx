import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { Bell, LogOut, Building2, ChevronDown } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useSalonData } from '@/hooks/useSalonData';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useNavigate } from 'react-router-dom';

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const { profile, roles, signOut, isSuperAdmin, currentSalonId } = useAuth();
  const { salon } = useSalonData();
  const navigate = useNavigate();

  const initials = (profile?.full_name || 'U')
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const roleBadge = roles.includes('super_admin')
    ? 'Super Admin'
    : roles.includes('salon_admin')
    ? 'Salon Admin'
    : 'Personel';

  const roleColor = roles.includes('super_admin')
    ? 'bg-primary/10 text-primary border-primary/20'
    : roles.includes('salon_admin')
    ? 'bg-info/10 text-info border-info/20'
    : 'bg-muted text-muted-foreground border-border';

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center justify-between border-b border-border/60 bg-card/80 backdrop-blur-lg px-4 lg:px-6 sticky top-0 z-30">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="text-muted-foreground hover:text-foreground transition-colors" />
              <div className="hidden sm:block h-5 w-px bg-border/60" />
              <Badge variant="outline" className={`hidden sm:inline-flex text-[10px] font-semibold px-2 py-0.5 ${roleColor}`}>
                {roleBadge}
              </Badge>
              {salon && (
                <>
                  <div className="hidden md:block h-5 w-px bg-border/60" />
                  <div className="hidden md:flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Building2 className="h-3.5 w-3.5" />
                    <span className="font-medium text-foreground/80">{salon.name}</span>
                  </div>
                </>
              )}
              {isSuperAdmin && currentSalonId && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="hidden sm:flex h-6 text-[10px] text-muted-foreground hover:text-foreground gap-1"
                  onClick={() => navigate('/admin/salonlar')}
                >
                  Değiştir <ChevronDown className="h-3 w-3" />
                </Button>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <ThemeToggle />
              <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-foreground relative">
                <Bell className="h-4 w-4" />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="h-9 w-9 rounded-full btn-gradient flex items-center justify-center transition-transform hover:scale-105 active:scale-95">
                    <span className="text-xs font-bold text-primary-foreground">{initials}</span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <div className="px-3 py-2.5">
                    <p className="text-sm font-semibold">{profile?.full_name || 'Kullanıcı'}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{roleBadge}</p>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
                    <LogOut className="h-4 w-4 mr-2" />
                    Çıkış Yap
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>
          <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
