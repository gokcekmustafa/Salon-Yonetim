
-- =============================================
-- MULTI-TENANT SaaS SCHEMA
-- =============================================

-- 1. Role enum
CREATE TYPE public.app_role AS ENUM ('super_admin', 'salon_admin', 'staff');

-- 2. Subscription plan enum
CREATE TYPE public.subscription_plan AS ENUM ('free', 'starter', 'professional', 'enterprise');

-- 3. Timestamp update function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- =============================================
-- PROFILES TABLE
-- =============================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- USER ROLES TABLE
-- =============================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE(user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- =============================================
-- SECURITY DEFINER FUNCTIONS (avoid RLS recursion)
-- =============================================
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- =============================================
-- SALONS TABLE
-- =============================================
CREATE TABLE public.salons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  phone TEXT,
  address TEXT,
  logo_url TEXT,
  subscription_plan subscription_plan NOT NULL DEFAULT 'free',
  subscription_expires_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  owner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.salons ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_salons_slug ON public.salons(slug);
CREATE INDEX idx_salons_owner ON public.salons(owner_user_id);

CREATE TRIGGER update_salons_updated_at
  BEFORE UPDATE ON public.salons
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- SALON MEMBERS (links users to salons with role context)
-- =============================================
CREATE TABLE public.salon_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  branch_id UUID,
  role app_role NOT NULL DEFAULT 'staff',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(salon_id, user_id)
);

ALTER TABLE public.salon_members ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_salon_members_user ON public.salon_members(user_id);
CREATE INDEX idx_salon_members_salon ON public.salon_members(salon_id);

-- =============================================
-- BRANCHES TABLE
-- =============================================
CREATE TABLE public.branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_branches_salon ON public.branches(salon_id);

CREATE TRIGGER update_branches_updated_at
  BEFORE UPDATE ON public.branches
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- FK for salon_members.branch_id
ALTER TABLE public.salon_members
  ADD CONSTRAINT fk_salon_members_branch
  FOREIGN KEY (branch_id) REFERENCES public.branches(id) ON DELETE SET NULL;

-- =============================================
-- SERVICES TABLE
-- =============================================
CREATE TABLE public.services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  duration INTEGER NOT NULL,
  price NUMERIC(10,2) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_services_salon ON public.services(salon_id);

CREATE TRIGGER update_services_updated_at
  BEFORE UPDATE ON public.services
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- STAFF TABLE
-- =============================================
CREATE TABLE public.staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  phone TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_staff_salon ON public.staff(salon_id);
CREATE INDEX idx_staff_branch ON public.staff(branch_id);

CREATE TRIGGER update_staff_updated_at
  BEFORE UPDATE ON public.staff
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- CUSTOMERS TABLE
-- =============================================
CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  birth_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_customers_salon ON public.customers(salon_id);
CREATE INDEX idx_customers_phone ON public.customers(phone);

CREATE TRIGGER update_customers_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- APPOINTMENTS TABLE
-- =============================================
CREATE TABLE public.appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'bekliyor' CHECK (status IN ('bekliyor', 'tamamlandi', 'iptal')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_appointments_salon ON public.appointments(salon_id);
CREATE INDEX idx_appointments_staff ON public.appointments(staff_id);
CREATE INDEX idx_appointments_customer ON public.appointments(customer_id);
CREATE INDEX idx_appointments_time ON public.appointments(start_time, end_time);

CREATE TRIGGER update_appointments_updated_at
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- PAYMENTS TABLE
-- =============================================
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  amount NUMERIC(10,2) NOT NULL,
  payment_type TEXT NOT NULL DEFAULT 'nakit' CHECK (payment_type IN ('nakit', 'kart')),
  payment_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_payments_salon ON public.payments(salon_id);
CREATE INDEX idx_payments_appointment ON public.payments(appointment_id);

-- =============================================
-- NOTIFICATION SETTINGS TABLE
-- =============================================
CREATE TABLE public.notification_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID NOT NULL UNIQUE REFERENCES public.salons(id) ON DELETE CASCADE,
  whatsapp_enabled BOOLEAN NOT NULL DEFAULT false,
  sms_enabled BOOLEAN NOT NULL DEFAULT false,
  reminder_hours_before INTEGER NOT NULL DEFAULT 24,
  message_template TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_notification_settings_updated_at
  BEFORE UPDATE ON public.notification_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- RLS POLICIES
-- =============================================

-- PROFILES
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- USER_ROLES
CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admin can insert roles" ON public.user_roles
  FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admin can update roles" ON public.user_roles
  FOR UPDATE USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admin can delete roles" ON public.user_roles
  FOR DELETE USING (public.has_role(auth.uid(), 'super_admin'));

-- SALONS
CREATE POLICY "Super admin can do all on salons" ON public.salons
  FOR ALL USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Salon members can view own salon" ON public.salons
  FOR SELECT USING (
    id IN (SELECT salon_id FROM public.salon_members WHERE user_id = auth.uid())
  );
CREATE POLICY "Salon owner can update" ON public.salons
  FOR UPDATE USING (owner_user_id = auth.uid());
CREATE POLICY "Public can view active salons for booking" ON public.salons
  FOR SELECT TO anon USING (is_active = true);

-- SALON_MEMBERS
CREATE POLICY "Super admin manages all members" ON public.salon_members
  FOR ALL USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Members view own salon members" ON public.salon_members
  FOR SELECT USING (
    salon_id IN (SELECT sm.salon_id FROM public.salon_members sm WHERE sm.user_id = auth.uid())
  );

-- BRANCHES
CREATE POLICY "Super admin manages all branches" ON public.branches
  FOR ALL USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Salon members view own branches" ON public.branches
  FOR SELECT USING (
    salon_id IN (SELECT salon_id FROM public.salon_members WHERE user_id = auth.uid())
  );
CREATE POLICY "Salon admin manages own branches" ON public.branches
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.salon_members sm WHERE sm.user_id = auth.uid() AND sm.salon_id = branches.salon_id AND sm.role = 'salon_admin')
  );
CREATE POLICY "Salon admin updates own branches" ON public.branches
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.salon_members sm WHERE sm.user_id = auth.uid() AND sm.salon_id = branches.salon_id AND sm.role = 'salon_admin')
  );
CREATE POLICY "Salon admin deletes own branches" ON public.branches
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.salon_members sm WHERE sm.user_id = auth.uid() AND sm.salon_id = branches.salon_id AND sm.role = 'salon_admin')
  );
CREATE POLICY "Public views active branches" ON public.branches
  FOR SELECT TO anon USING (is_active = true);

-- SERVICES
CREATE POLICY "Super admin manages all services" ON public.services
  FOR ALL USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Salon members view own services" ON public.services
  FOR SELECT USING (
    salon_id IN (SELECT salon_id FROM public.salon_members WHERE user_id = auth.uid())
  );
CREATE POLICY "Salon admin manages own services" ON public.services
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.salon_members sm WHERE sm.user_id = auth.uid() AND sm.salon_id = services.salon_id AND sm.role = 'salon_admin')
  );
CREATE POLICY "Salon admin updates own services" ON public.services
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.salon_members sm WHERE sm.user_id = auth.uid() AND sm.salon_id = services.salon_id AND sm.role = 'salon_admin')
  );
CREATE POLICY "Salon admin deletes own services" ON public.services
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.salon_members sm WHERE sm.user_id = auth.uid() AND sm.salon_id = services.salon_id AND sm.role = 'salon_admin')
  );
CREATE POLICY "Public views active services" ON public.services
  FOR SELECT TO anon USING (is_active = true);

-- STAFF
CREATE POLICY "Super admin manages all staff" ON public.staff
  FOR ALL USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Salon members view own staff" ON public.staff
  FOR SELECT USING (
    salon_id IN (SELECT salon_id FROM public.salon_members WHERE user_id = auth.uid())
  );
CREATE POLICY "Salon admin manages own staff" ON public.staff
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.salon_members sm WHERE sm.user_id = auth.uid() AND sm.salon_id = staff.salon_id AND sm.role = 'salon_admin')
  );
CREATE POLICY "Salon admin updates own staff" ON public.staff
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.salon_members sm WHERE sm.user_id = auth.uid() AND sm.salon_id = staff.salon_id AND sm.role = 'salon_admin')
  );
CREATE POLICY "Public views active staff" ON public.staff
  FOR SELECT TO anon USING (is_active = true);

-- CUSTOMERS
CREATE POLICY "Super admin manages all customers" ON public.customers
  FOR ALL USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Salon members view own customers" ON public.customers
  FOR SELECT USING (
    salon_id IN (SELECT salon_id FROM public.salon_members WHERE user_id = auth.uid())
  );
CREATE POLICY "Salon staff manages own customers" ON public.customers
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.salon_members sm WHERE sm.user_id = auth.uid() AND sm.salon_id = customers.salon_id)
  );
CREATE POLICY "Salon staff updates own customers" ON public.customers
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.salon_members sm WHERE sm.user_id = auth.uid() AND sm.salon_id = customers.salon_id)
  );
CREATE POLICY "Public creates customers for booking" ON public.customers
  FOR INSERT TO anon WITH CHECK (true);

-- APPOINTMENTS
CREATE POLICY "Super admin manages all appointments" ON public.appointments
  FOR ALL USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Salon members view own appointments" ON public.appointments
  FOR SELECT USING (
    salon_id IN (SELECT salon_id FROM public.salon_members WHERE user_id = auth.uid())
  );
CREATE POLICY "Salon staff manages own appointments" ON public.appointments
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.salon_members sm WHERE sm.user_id = auth.uid() AND sm.salon_id = appointments.salon_id)
  );
CREATE POLICY "Salon staff updates own appointments" ON public.appointments
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.salon_members sm WHERE sm.user_id = auth.uid() AND sm.salon_id = appointments.salon_id)
  );
CREATE POLICY "Public creates appointments for booking" ON public.appointments
  FOR INSERT TO anon WITH CHECK (true);

-- PAYMENTS
CREATE POLICY "Super admin manages all payments" ON public.payments
  FOR ALL USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Salon admin manages own payments" ON public.payments
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.salon_members sm WHERE sm.user_id = auth.uid() AND sm.salon_id = payments.salon_id AND sm.role = 'salon_admin')
  );
CREATE POLICY "Salon admin inserts own payments" ON public.payments
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.salon_members sm WHERE sm.user_id = auth.uid() AND sm.salon_id = payments.salon_id AND sm.role = 'salon_admin')
  );

-- NOTIFICATION SETTINGS
CREATE POLICY "Super admin manages all notifications" ON public.notification_settings
  FOR ALL USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Salon admin manages own notifications" ON public.notification_settings
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.salon_members sm WHERE sm.user_id = auth.uid() AND sm.salon_id = notification_settings.salon_id AND sm.role = 'salon_admin')
  );

-- =============================================
-- TRIGGERS
-- =============================================

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email));
  
  -- First user becomes super_admin
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'super_admin') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'super_admin');
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto-create notification settings on salon create
CREATE OR REPLACE FUNCTION public.handle_new_salon()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notification_settings (salon_id, message_template)
  VALUES (NEW.id, 'Merhaba {müşteri_adı}, {tarih} tarihinde saat {saat}''de {hizmet} randevunuz bulunmaktadır. {salon_adı}');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_salon_created
  AFTER INSERT ON public.salons
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_salon();
