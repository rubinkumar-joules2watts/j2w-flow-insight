-- Create role enum
CREATE TYPE public.app_role AS ENUM ('cto', 'program_manager', 'tech_lead');

-- Create user_roles table
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

-- CLIENTS
CREATE TABLE public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- PROJECTS
CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES public.clients(id),
  name text NOT NULL,
  code text,
  service_type text,
  revenue_model text,
  project_type text,
  delivery_manager text,
  client_spoc text,
  handled_by text,
  status text DEFAULT 'Planning',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- MILESTONES
CREATE TABLE public.milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  milestone_code text,
  description text,
  planned_start date,
  planned_end date,
  actual_start date,
  actual_end_eta date,
  completion_pct integer DEFAULT 0 CHECK (completion_pct BETWEEN 0 AND 100),
  status text DEFAULT 'Pending',
  milestone_flag text DEFAULT 'grey',
  deliverables text,
  days_variance integer,
  blocker boolean DEFAULT false,
  blocker_owner text,
  remarks text,
  invoice_status text DEFAULT 'Pending',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.milestones ENABLE ROW LEVEL SECURITY;

-- TEAM MEMBERS
CREATE TABLE public.team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  initials text,
  role text NOT NULL,
  reports_to text,
  member_type text DEFAULT 'Full-time',
  engagement_pct integer DEFAULT 50 CHECK (engagement_pct BETWEEN 0 AND 100),
  color_hex text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

-- PROJECT ASSIGNMENTS
CREATE TABLE public.project_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  team_member_id uuid REFERENCES public.team_members(id) ON DELETE CASCADE,
  role_on_project text,
  allocated_hours_per_week integer,
  start_date date,
  end_date date,
  created_at timestamptz DEFAULT now(),
  UNIQUE(project_id, team_member_id)
);
ALTER TABLE public.project_assignments ENABLE ROW LEVEL SECURITY;

-- AUDIT LOG
CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  record_id uuid,
  action text NOT NULL,
  changed_by text,
  changed_fields jsonb,
  old_values jsonb,
  new_values jsonb,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Updated at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_milestones_updated_at BEFORE UPDATE ON public.milestones FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_team_members_updated_at BEFORE UPDATE ON public.team_members FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS Policies
CREATE POLICY "Authenticated users can read roles" ON public.user_roles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Read clients" ON public.clients FOR SELECT USING (true);
CREATE POLICY "Insert clients" ON public.clients FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Update clients" ON public.clients FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Read projects" ON public.projects FOR SELECT USING (true);
CREATE POLICY "Insert projects" ON public.projects FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Update projects" ON public.projects FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Delete projects" ON public.projects FOR DELETE TO authenticated USING (true);

CREATE POLICY "Read milestones" ON public.milestones FOR SELECT USING (true);
CREATE POLICY "Insert milestones" ON public.milestones FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Update milestones" ON public.milestones FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Delete milestones" ON public.milestones FOR DELETE TO authenticated USING (true);

CREATE POLICY "Read team_members" ON public.team_members FOR SELECT USING (true);
CREATE POLICY "Insert team_members" ON public.team_members FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Update team_members" ON public.team_members FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Read assignments" ON public.project_assignments FOR SELECT USING (true);
CREATE POLICY "Insert assignments" ON public.project_assignments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Delete assignments" ON public.project_assignments FOR DELETE TO authenticated USING (true);
CREATE POLICY "Update assignments" ON public.project_assignments FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Read audit_log" ON public.audit_log FOR SELECT USING (true);
CREATE POLICY "Insert audit_log" ON public.audit_log FOR INSERT TO authenticated WITH CHECK (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.projects;
ALTER PUBLICATION supabase_realtime ADD TABLE public.milestones;
ALTER PUBLICATION supabase_realtime ADD TABLE public.project_assignments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.team_members;