import { NavLink } from '@/components/NavLink';
import { useLocation } from 'react-router-dom';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from '@/components/ui/sidebar';
import {
  LayoutDashboard,
  Users,
  Calendar,
  Scissors,
  UserCheck,
  Wallet,
  Settings,
  Sparkles,
  Building2,
  BarChart3,
  Globe,
  ChevronRight,
} from 'lucide-react';

const mainMenu = [
  { title: 'Panel', url: '/', icon: LayoutDashboard },
  { title: 'Randevular', url: '/randevular', icon: Calendar },
  { title: 'Müşteriler', url: '/musteriler', icon: Users },
  { title: 'Hizmetler', url: '/hizmetler', icon: Scissors },
  { title: 'Personel', url: '/personel', icon: UserCheck },
  { title: 'Şubeler', url: '/subeler', icon: Building2 },
];

const financeMenu = [
  { title: 'Kasa', url: '/kasa', icon: Wallet },
  { title: 'Raporlar', url: '/raporlar', icon: BarChart3 },
];

const otherMenu = [
  { title: 'Online Randevu', url: '/online-randevu', icon: Globe },
  { title: 'Ayarlar', url: '/ayarlar', icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const location = useLocation();

  const renderMenu = (items: typeof mainMenu) => (
    <SidebarMenu>
      {items.map((item) => {
        const active = location.pathname === item.url;
        return (
          <SidebarMenuItem key={item.title}>
            <SidebarMenuButton
              asChild
              isActive={active}
              tooltip={item.title}
            >
              <NavLink
                to={item.url}
                end={item.url === '/'}
                className="group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all duration-150 hover:bg-sidebar-accent/60 text-sidebar-foreground"
                activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
              >
                <item.icon className="h-[18px] w-[18px] shrink-0" />
                {!collapsed && (
                  <>
                    <span className="flex-1">{item.title}</span>
                    {active && <ChevronRight className="h-3.5 w-3.5 opacity-50" />}
                  </>
                )}
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4 pb-2">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-sidebar-primary to-sidebar-primary/80 flex items-center justify-center shadow-sm">
            <Sparkles className="h-4.5 w-4.5 text-sidebar-primary-foreground" />
          </div>
          {!collapsed && (
            <div>
              <span className="text-base font-bold text-sidebar-accent-foreground font-display tracking-tight">
                SalonYönetim
              </span>
              <p className="text-[10px] text-sidebar-foreground/50 leading-none mt-0.5">Yönetim Paneli</p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 mt-2">
        <SidebarGroup>
          {!collapsed && <SidebarGroupLabel className="text-[10px] uppercase tracking-wider text-sidebar-foreground/40 font-semibold mb-1 px-3">Yönetim</SidebarGroupLabel>}
          <SidebarGroupContent>{renderMenu(mainMenu)}</SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          {!collapsed && <SidebarGroupLabel className="text-[10px] uppercase tracking-wider text-sidebar-foreground/40 font-semibold mb-1 px-3 mt-2">Finans</SidebarGroupLabel>}
          <SidebarGroupContent>{renderMenu(financeMenu)}</SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          {!collapsed && <SidebarGroupLabel className="text-[10px] uppercase tracking-wider text-sidebar-foreground/40 font-semibold mb-1 px-3 mt-2">Diğer</SidebarGroupLabel>}
          <SidebarGroupContent>{renderMenu(otherMenu)}</SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 pt-2">
        {!collapsed && (
          <div className="rounded-lg bg-sidebar-accent/30 p-3 text-center">
            <p className="text-[10px] text-sidebar-foreground/40">© 2026 SalonYönetim</p>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
