import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { SalonProvider } from "@/contexts/SalonContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppLayout from "@/components/AppLayout";
import Dashboard from "./pages/Dashboard";
import CustomersPage from "./pages/CustomersPage";
import AppointmentsPage from "./pages/AppointmentsPage";
import ServicesPage from "./pages/ServicesPage";
import StaffPage from "./pages/StaffPage";
import BranchesPage from "./pages/BranchesPage";
import PaymentsPage from "./pages/PaymentsPage";
import SettingsPage from "./pages/SettingsPage";
import BookingPage from "./pages/BookingPage";
import ReportsPage from "./pages/ReportsPage";
import AuthPage from "./pages/AuthPage";
import SuperAdminSalonsPage from "./pages/SuperAdminSalonsPage";
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
    <TooltipProvider>
      <AuthProvider>
        <SalonProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              {/* Public */}
              <Route path="/auth" element={<AuthPage />} />
              <Route path="/book/:salonSlug" element={<BookingPage />} />

              {/* Super Admin */}
              <Route path="/admin/salonlar" element={<SuperAdminRoute><SuperAdminSalonsPage /></SuperAdminRoute>} />

              {/* Admin panel - all authenticated users */}
              <Route path="/" element={<AdminRoute><Dashboard /></AdminRoute>} />
              <Route path="/musteriler" element={<AdminRoute><CustomersPage /></AdminRoute>} />
              <Route path="/randevular" element={<AdminRoute><AppointmentsPage /></AdminRoute>} />
              <Route path="/hizmetler" element={<AdminRoute><ServicesPage /></AdminRoute>} />
              <Route path="/personel" element={<AdminRoute><StaffPage /></AdminRoute>} />
              <Route path="/subeler" element={<AdminRoute><BranchesPage /></AdminRoute>} />

              {/* Finance - admin only */}
              <Route path="/kasa" element={<FinanceRoute><PaymentsPage /></FinanceRoute>} />
              <Route path="/raporlar" element={<FinanceRoute><ReportsPage /></FinanceRoute>} />

              {/* Settings - admin only */}
              <Route path="/ayarlar" element={<FinanceRoute><SettingsPage /></FinanceRoute>} />
              <Route path="/online-randevu" element={<AdminRoute><BookingPage /></AdminRoute>} />

              {/* Public salon slug */}
              <Route path="/:salonSlug" element={<BookingPage />} />

              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </SalonProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
