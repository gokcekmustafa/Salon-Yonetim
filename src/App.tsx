import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SalonProvider } from "@/contexts/SalonContext";
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
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <SalonProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Public booking page */}
            <Route path="/book/:salonSlug" element={<BookingPage />} />

            {/* Admin panel */}
            <Route path="/" element={
              <AppLayout>
                <Dashboard />
              </AppLayout>
            } />
            <Route path="/musteriler" element={<AppLayout><CustomersPage /></AppLayout>} />
            <Route path="/randevular" element={<AppLayout><AppointmentsPage /></AppLayout>} />
            <Route path="/hizmetler" element={<AppLayout><ServicesPage /></AppLayout>} />
            <Route path="/personel" element={<AppLayout><StaffPage /></AppLayout>} />
            <Route path="/subeler" element={<AppLayout><BranchesPage /></AppLayout>} />
            <Route path="/kasa" element={<AppLayout><PaymentsPage /></AppLayout>} />
            <Route path="/raporlar" element={<AppLayout><ReportsPage /></AppLayout>} />
            <Route path="/online-randevu" element={<AppLayout><BookingPage /></AppLayout>} />
            <Route path="/ayarlar" element={<AppLayout><SettingsPage /></AppLayout>} />

            {/* Public salon slug - must be LAST to avoid catching admin routes */}
            <Route path="/:salonSlug" element={<BookingPage />} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </SalonProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;