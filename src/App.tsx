import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/contexts/AuthContext";
import { BranchProvider } from "@/contexts/BranchContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppLayout from "@/components/AppLayout";
import SalonLayout from "@/components/SalonLayout";
import Dashboard from "./pages/Dashboard";
import CustomersPage from "./pages/CustomersPage";
import AppointmentsPage from "./pages/AppointmentsPage";
import LeadsPage from "./pages/LeadsPage";
import ServicesPage from "./pages/ServicesPage";
import StaffPage from "./pages/StaffPage";
import BranchesPage from "./pages/BranchesPage";
import PaymentsPage from "./pages/PaymentsPage";
import SettingsPage from "./pages/SettingsPage";
import BookingPage from "./pages/BookingPage";
import ReportsPage from "./pages/ReportsPage";
import CashPage from "./pages/CashPage";
import AuthPage from "./pages/AuthPage";
import CompanyRegistrationPage from "./pages/CompanyRegistrationPage";
import InstallmentsPage from "./pages/InstallmentsPage";
import ContractsPage from "./pages/ContractsPage";
import StaffPerformancePage from "./pages/StaffPerformancePage";
import StaffSalaryPage from "./pages/StaffSalaryPage";
import RoomsPage from "./pages/RoomsPage";
import ProductsPage from "./pages/ProductsPage";
import SuperAdminSalonsPage from "./pages/SuperAdminSalonsPage";
import SuperAdminDataPage from "./pages/SuperAdminDataPage";
import StandardRoomsPage from "./pages/admin/StandardRoomsPage";
import StandardServicesPage from "./pages/admin/StandardServicesPage";
import PlatformAnnouncementsPage from "./pages/admin/PlatformAnnouncementsPage";
import PlatformPopupsPage from "./pages/admin/PlatformPopupsPage";
import UserManagementPage from "./pages/admin/UserManagementPage";
import PlatformStaffPage from "./pages/admin/PlatformStaffPage";
import NotificationsPage from "./pages/NotificationsPage";
import AuditPage from "./pages/AuditPage";
import SupportPage from "./pages/SupportPage";
import NotFound from "./pages/NotFound";
import { useAuth } from '@/contexts/AuthContext';

const queryClient = new QueryClient();

function RoleLayout({ children }: { children: React.ReactNode }) {
  const { isSuperAdmin, isManagingSalon } = useAuth();
  if (isSuperAdmin && !isManagingSalon) return <AppLayout>{children}</AppLayout>;
  return <SalonLayout>{children}</SalonLayout>;
}

const AdminRoute = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute anyRole={['super_admin', 'salon_admin', 'staff']}>
    <RoleLayout>{children}</RoleLayout>
  </ProtectedRoute>
);

const FinanceRoute = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute anyRole={['super_admin', 'salon_admin', 'staff']}>
    <RoleLayout>{children}</RoleLayout>
  </ProtectedRoute>
);

const SuperAdminRoute = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute requiredRole="super_admin">
    <AppLayout>{children}</AppLayout>
  </ProtectedRoute>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
      <TooltipProvider>
        <AuthProvider>
          <BranchProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/auth" element={<AuthPage />} />
              <Route path="/firma-kayit" element={<CompanyRegistrationPage />} />
              <Route path="/book/:salonSlug" element={<BookingPage />} />
              <Route path="/admin/salonlar" element={<SuperAdminRoute><SuperAdminSalonsPage /></SuperAdminRoute>} />
              <Route path="/admin/veriler" element={<SuperAdminRoute><SuperAdminDataPage /></SuperAdminRoute>} />
              <Route path="/admin/standart-odalar" element={<SuperAdminRoute><StandardRoomsPage /></SuperAdminRoute>} />
              <Route path="/admin/standart-hizmetler" element={<SuperAdminRoute><StandardServicesPage /></SuperAdminRoute>} />
              <Route path="/admin/duyurular" element={<SuperAdminRoute><PlatformAnnouncementsPage /></SuperAdminRoute>} />
              <Route path="/admin/popuplar" element={<SuperAdminRoute><PlatformPopupsPage /></SuperAdminRoute>} />
              <Route path="/admin/kullanicilar" element={<SuperAdminRoute><UserManagementPage /></SuperAdminRoute>} />
              <Route path="/admin/platform-personelleri" element={<SuperAdminRoute><PlatformStaffPage /></SuperAdminRoute>} />
              <Route path="/" element={<AdminRoute><Dashboard /></AdminRoute>} />
              <Route path="/musteriler" element={<AdminRoute><CustomersPage /></AdminRoute>} />
              <Route path="/randevular" element={<AdminRoute><AppointmentsPage /></AdminRoute>} />
              <Route path="/hizmetler" element={<AdminRoute><ServicesPage /></AdminRoute>} />
              <Route path="/personel" element={<AdminRoute><StaffPage /></AdminRoute>} />
              <Route path="/subeler" element={<FinanceRoute><BranchesPage /></FinanceRoute>} />
              <Route path="/odalar" element={<AdminRoute><RoomsPage /></AdminRoute>} />
              <Route path="/urunler" element={<AdminRoute><ProductsPage /></AdminRoute>} />
              <Route path="/bildirimler" element={<AdminRoute><NotificationsPage /></AdminRoute>} />
              <Route path="/izleme" element={<FinanceRoute><AuditPage /></FinanceRoute>} />
              <Route path="/izleme-gunluk" element={<Navigate to="/izleme" replace />} />
              <Route path="/destek" element={<AdminRoute><SupportPage /></AdminRoute>} />
              <Route path="/destek-iletisim" element={<Navigate to="/destek" replace />} />
              <Route path="/adaylar" element={<AdminRoute><LeadsPage /></AdminRoute>} />
              <Route path="/sozlesmeler" element={<AdminRoute><ContractsPage /></AdminRoute>} />
              <Route path="/performans" element={<FinanceRoute><StaffPerformancePage /></FinanceRoute>} />
              <Route path="/maas" element={<FinanceRoute><StaffSalaryPage /></FinanceRoute>} />
              <Route path="/kasa" element={<FinanceRoute><PaymentsPage /></FinanceRoute>} />
              <Route path="/odemeler" element={<Navigate to="/kasa" replace />} />
              <Route path="/taksitler" element={<FinanceRoute><InstallmentsPage /></FinanceRoute>} />
              <Route path="/kasa-yonetimi" element={<FinanceRoute><CashPage /></FinanceRoute>} />
              <Route path="/odeme-al" element={<Navigate to="/kasa-yonetimi?islem=odeme-al" replace />} />
              <Route path="/odeme-yap" element={<Navigate to="/kasa-yonetimi?islem=odeme-yap" replace />} />
              <Route path="/gelir-gir" element={<Navigate to="/kasa-yonetimi?islem=gelir-gir" replace />} />
              <Route path="/gider-gir" element={<Navigate to="/kasa-yonetimi?islem=gider-gir" replace />} />
              <Route path="/raporlar" element={<FinanceRoute><ReportsPage /></FinanceRoute>} />
              <Route path="/ayarlar" element={<FinanceRoute><SettingsPage /></FinanceRoute>} />
              <Route path="/:salonSlug" element={<BookingPage />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
          </BranchProvider>
        </AuthProvider>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
