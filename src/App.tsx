import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/contexts/AuthContext";
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
import InstallmentsPage from "./pages/InstallmentsPage";
// SessionsPage merged into AppointmentsPage
import ContractsPage from "./pages/ContractsPage";
import StaffPerformancePage from "./pages/StaffPerformancePage";
import StaffSalaryPage from "./pages/StaffSalaryPage";
import SuperAdminSalonsPage from "./pages/SuperAdminSalonsPage";
import SuperAdminDataPage from "./pages/SuperAdminDataPage";
import NotificationsPage from "./pages/NotificationsPage";
import AuditPage from "./pages/AuditPage";
import SupportPage from "./pages/SupportPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const AdminRoute = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute anyRole={['super_admin', 'salon_admin', 'staff']}>
    <AppLayout>{children}</AppLayout>
  </ProtectedRoute>
);

const FinanceRoute = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute anyRole={['super_admin', 'salon_admin']}>
    <AppLayout>{children}</AppLayout>
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
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              {/* Public */}
              <Route path="/auth" element={<AuthPage />} />
              <Route path="/book/:salonSlug" element={<BookingPage />} />

              {/* Super Admin */}
              <Route path="/admin/salonlar" element={<SuperAdminRoute><SuperAdminSalonsPage /></SuperAdminRoute>} />
              <Route path="/admin/veriler" element={<SuperAdminRoute><SuperAdminDataPage /></SuperAdminRoute>} />

              {/* Admin panel - all authenticated users */}
              <Route path="/" element={<AdminRoute><Dashboard /></AdminRoute>} />
              <Route path="/musteriler" element={<AdminRoute><CustomersPage /></AdminRoute>} />
              <Route path="/randevular" element={<AdminRoute><AppointmentsPage /></AdminRoute>} />
              <Route path="/hizmetler" element={<AdminRoute><ServicesPage /></AdminRoute>} />
              <Route path="/personel" element={<AdminRoute><StaffPage /></AdminRoute>} />
              <Route path="/subeler" element={<AdminRoute><BranchesPage /></AdminRoute>} />
              <Route path="/bildirimler" element={<AdminRoute><NotificationsPage /></AdminRoute>} />
              <Route path="/izleme" element={<FinanceRoute><AuditPage /></FinanceRoute>} />
              <Route path="/destek" element={<AdminRoute><SupportPage /></AdminRoute>} />
              <Route path="/adaylar" element={<AdminRoute><LeadsPage /></AdminRoute>} />
              {/* Sessions merged into /randevular */}
              <Route path="/sozlesmeler" element={<AdminRoute><ContractsPage /></AdminRoute>} />
              <Route path="/performans" element={<FinanceRoute><StaffPerformancePage /></FinanceRoute>} />
              <Route path="/maas" element={<FinanceRoute><StaffSalaryPage /></FinanceRoute>} />

              {/* Finance - admin only */}
              <Route path="/kasa" element={<FinanceRoute><PaymentsPage /></FinanceRoute>} />
              <Route path="/taksitler" element={<FinanceRoute><InstallmentsPage /></FinanceRoute>} />
              <Route path="/kasa-yonetimi" element={<FinanceRoute><CashPage /></FinanceRoute>} />
              <Route path="/raporlar" element={<FinanceRoute><ReportsPage /></FinanceRoute>} />

              {/* Settings - admin only */}
              <Route path="/ayarlar" element={<FinanceRoute><SettingsPage /></FinanceRoute>} />

              {/* Public salon slug */}
              <Route path="/:salonSlug" element={<BookingPage />} />

              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
