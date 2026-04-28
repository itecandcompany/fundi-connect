
-- ROLES
CREATE TYPE public.app_role AS ENUM ('client', 'fundi', 'admin');
CREATE TYPE public.service_type AS ENUM ('plumber', 'electrician', 'carpenter', 'mechanic');
CREATE TYPE public.job_status AS ENUM ('searching', 'accepted', 'on_the_way', 'arrived', 'in_progress', 'completed', 'cancelled');

-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT,
  avatar_url TEXT,
  role app_role NOT NULL DEFAULT 'client',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- USER_ROLES (secure)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- FUNDIS (technician-specific details)
CREATE TABLE public.fundis (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  service service_type NOT NULL,
  hourly_rate NUMERIC(10,2) NOT NULL DEFAULT 15000,
  bio TEXT,
  is_available BOOLEAN NOT NULL DEFAULT false,
  current_lat DOUBLE PRECISION,
  current_lng DOUBLE PRECISION,
  rating NUMERIC(3,2) NOT NULL DEFAULT 5.0,
  total_jobs INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- JOBS
CREATE TABLE public.jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  fundi_id UUID REFERENCES auth.users ON DELETE SET NULL,
  service service_type NOT NULL,
  description TEXT,
  price NUMERIC(10,2) NOT NULL,
  commission NUMERIC(10,2) NOT NULL,
  status job_status NOT NULL DEFAULT 'searching',
  client_lat DOUBLE PRECISION NOT NULL,
  client_lng DOUBLE PRECISION NOT NULL,
  client_address TEXT,
  fundi_lat DOUBLE PRECISION,
  fundi_lng DOUBLE PRECISION,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX jobs_status_service_idx ON public.jobs(status, service);
CREATE INDEX jobs_client_idx ON public.jobs(client_id);
CREATE INDEX jobs_fundi_idx ON public.jobs(fundi_id);

-- JOB LOCATIONS (live pings)
CREATE TABLE public.job_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.jobs ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX job_locations_job_idx ON public.job_locations(job_id, created_at DESC);

-- TRANSACTIONS
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.jobs ON DELETE CASCADE,
  fundi_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL,
  commission NUMERIC(10,2) NOT NULL,
  fundi_earnings NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RATINGS
CREATE TABLE public.ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL UNIQUE REFERENCES public.jobs ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  fundi_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  stars INT NOT NULL CHECK (stars BETWEEN 1 AND 5),
  review TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ENABLE RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fundis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;

-- PROFILES POLICIES
CREATE POLICY "Profiles are viewable by authenticated users" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- USER_ROLES POLICIES
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can insert own role on signup" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND role IN ('client','fundi'));

-- FUNDIS POLICIES
CREATE POLICY "Anyone authenticated can view fundis" ON public.fundis FOR SELECT TO authenticated USING (true);
CREATE POLICY "Fundi can insert own row" ON public.fundis FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Fundi can update own row" ON public.fundis FOR UPDATE TO authenticated USING (auth.uid() = id);

-- JOBS POLICIES
CREATE POLICY "Clients see own jobs; fundis see assigned or open matching" ON public.jobs FOR SELECT TO authenticated USING (
  auth.uid() = client_id
  OR auth.uid() = fundi_id
  OR (status = 'searching' AND public.has_role(auth.uid(), 'fundi'))
  OR public.has_role(auth.uid(), 'admin')
);
CREATE POLICY "Clients create own jobs" ON public.jobs FOR INSERT TO authenticated WITH CHECK (auth.uid() = client_id);
CREATE POLICY "Client or assigned fundi update" ON public.jobs FOR UPDATE TO authenticated USING (auth.uid() = client_id OR auth.uid() = fundi_id);

-- JOB_LOCATIONS POLICIES
CREATE POLICY "Participants can view job locations" ON public.job_locations FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = job_id AND (j.client_id = auth.uid() OR j.fundi_id = auth.uid()))
);
CREATE POLICY "Users post their own location for their job" ON public.job_locations FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = job_id AND (j.client_id = auth.uid() OR j.fundi_id = auth.uid()))
);

-- TRANSACTIONS POLICIES
CREATE POLICY "Fundi views own transactions, admin all" ON public.transactions FOR SELECT TO authenticated USING (auth.uid() = fundi_id OR public.has_role(auth.uid(),'admin'));

-- RATINGS POLICIES
CREATE POLICY "Anyone can view ratings" ON public.ratings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Client rates own completed jobs" ON public.ratings FOR INSERT TO authenticated WITH CHECK (auth.uid() = client_id);

-- TRIGGER: auto create profile + role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _role app_role;
BEGIN
  _role := COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'client');
  INSERT INTO public.profiles (id, full_name, phone, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.raw_user_meta_data->>'phone',
    _role
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, _role);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Enable realtime
ALTER TABLE public.jobs REPLICA IDENTITY FULL;
ALTER TABLE public.job_locations REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.jobs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.job_locations;
