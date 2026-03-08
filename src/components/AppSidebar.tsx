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
} from 'lucide-react';

const mainMenu = [
  { title: 'Panel', url: '/', icon: LayoutDashboard },
  { title: 'Müşteriler', url: '/musteriler', icon: Users },
  { title: 'Randevular', url: '/randevular', icon: Calendar },
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
      {items.map((item) => (
        <SidebarMenuItem key={item.title}>
          <SidebarMenuButton
            asChild
            isActive={location.pathname === item.url}
            tooltip={item.title}
          >
            <NavLink
              to={item.url}
              end={item.url === '/'}
              className="hover:bg-sidebar-accent/50"
              activeClassName="bg-sidebar-accent text-sidebar-primary font-semibold"
            >
              <item.icon className="h-4 w-4" />
              {!collapsed && <span>{item.title}</span>}
            </NavLink>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-sidebar-primary flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-sidebar-primary-foreground" />
          </div>
          {!collapsed && (
            <span className="text-lg font-bold text-sidebar-foreground">
              SalonYönetim
            </span>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          {!collapsed && <SidebarGroupLabel>Yönetim</SidebarGroupLabel>}
          <SidebarGroupContent>{renderMenu(mainMenu)}</SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          {!collapsed && <SidebarGroupLabel>Finans</SidebarGroupLabel>}
          <SidebarGroupContent>{renderMenu(financeMenu)}</SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          {!collapsed && <SidebarGroupLabel>Diğer</SidebarGroupLabel>}
          <SidebarGroupContent>{renderMenu(otherMenu)}</SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4">
        {!collapsed && (
          <p className="text-xs text-sidebar-foreground/50">© 2026 SalonYönetim</p>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
