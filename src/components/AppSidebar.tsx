import { NavLink } from '@/components/NavLink';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useBranding } from '@/hooks/useBranding';
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
  Shield,
  Bell,
  Activity,
  BadgeDollarSign,
  type LucideIcon,
} from 'lucide-react';
import type { SalonPermissions } from '@/hooks/usePermissions';

interface MenuItem {
  title: string;
  url: string;
  icon: LucideIcon;
  roles?: ('super_admin' | 'salon_admin' | 'staff')[];
  permissionKey?: keyof SalonPermissions;
}

const mainMenu: MenuItem[] = [
  { title: 'Panel', url: '/', icon: LayoutDashboard, permissionKey: 'can_view_dashboard' },
  { title: 'Randevular', url: '/randevular', icon: Calendar, permissionKey: 'can_manage_appointments' },
  { title: 'Müşteriler', url: '/musteriler', icon: Users, permissionKey: 'can_manage_customers' },
  { title: 'Hizmetler', url: '/hizmetler', icon: Scissors, permissionKey: 'can_manage_services' },
  { title: 'Personel', url: '/personel', icon: UserCheck, permissionKey: 'can_manage_staff' },
  { title: 'Şubeler', url: '/subeler', icon: Building2, permissionKey: 'can_add_branches' },
  { title: 'Aday Müşteriler', url: '/adaylar', icon: Users, permissionKey: 'can_manage_leads' },
];

const financeMenu: MenuItem[] = [
  { title: 'Kasa', url: '/kasa', icon: Wallet, roles: ['super_admin', 'salon_admin'], permissionKey: 'can_manage_payments' },
  { title: 'Raporlar', url: '/raporlar', icon: BarChart3, roles: ['super_admin', 'salon_admin'], permissionKey: 'can_manage_payments' },
];

const otherMenu: MenuItem[] = [
  { title: 'Bildirimler', url: '/bildirimler', icon: Bell },
  { title: 'İzleme & Günlük', url: '/izleme', icon: Activity, roles: ['super_admin', 'salon_admin'] },
  { title: 'Ayarlar', url: '/ayarlar', icon: Settings, roles: ['super_admin', 'salon_admin'] },
];

const superAdminMenu: MenuItem[] = [
  { title: 'Platform Yönetimi', url: '/admin/salonlar', icon: Shield, roles: ['super_admin'] },
  { title: 'Tüm Veriler', url: '/admin/veriler', icon: BarChart3, roles: ['super_admin'] },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const location = useLocation();
  const { roles, isSuperAdmin } = useAuth();
  const { hasPermission } = usePermissions();
  const { branding } = useBranding();

  const filterByRole = (items: MenuItem[]) =>
    items.filter(item => {
      // Role check
      if (item.roles && !item.roles.some(r => roles.includes(r))) return false;
      // Permission check (super admin bypasses)
      if (item.permissionKey && !isSuperAdmin && !hasPermission(item.permissionKey)) return false;
      return true;
    });

  const renderMenu = (items: MenuItem[]) => {
    const filtered = filterByRole(items);
    if (filtered.length === 0) return null;
    return (
      <SidebarMenu>
        {filtered.map((item) => {
          const active = location.pathname === item.url;
          return (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton asChild isActive={active} tooltip={item.title}>
                <NavLink
                  to={item.url}
                  end={item.url === '/'}
                  className="group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all duration-200 hover:bg-sidebar-accent/60 text-sidebar-foreground"
                  activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium shadow-sm"
                >
                  <item.icon className="h-[18px] w-[18px] shrink-0 transition-colors" />
                  {!collapsed && (
                    <>
                      <span className="flex-1 truncate">{item.title}</span>
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
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4 pb-2">
        <div className="flex items-center gap-2.5">
          {branding.logo_url ? (
            <img src={branding.logo_url} alt="" className="h-9 w-9 rounded-lg object-contain shadow-sm" />
          ) : (
            <div className="h-9 w-9 rounded-lg flex items-center justify-center shadow-sm btn-gradient">
              <Sparkles className="h-4.5 w-4.5 text-primary-foreground" />
            </div>
          )}
          {!collapsed && (
            <div>
              <span className="text-base font-bold text-sidebar-accent-foreground font-display tracking-tight">
                {branding.company_name}
              </span>
              <p className="text-[10px] text-sidebar-foreground/50 leading-none mt-0.5">{branding.app_name}</p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 mt-2">
        {roles.includes('super_admin') && (
          <SidebarGroup>
            {!collapsed && <SidebarGroupLabel className="text-[10px] uppercase tracking-wider text-sidebar-foreground/40 font-semibold mb-1 px-3">Platform</SidebarGroupLabel>}
            <SidebarGroupContent>{renderMenu(superAdminMenu)}</SidebarGroupContent>
          </SidebarGroup>
        )}

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
            <p className="text-[10px] text-sidebar-foreground/40">© 2026 {branding.company_name}</p>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
