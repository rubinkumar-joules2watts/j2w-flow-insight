-- Create project_updates table
CREATE TABLE IF NOT EXISTS public.project_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  content text NOT NULL,
  activity_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.project_updates ENABLE ROW LEVEL SECURITY;

-- Policies for public access (consistent with other tables in this project)
CREATE POLICY "Public read project_updates" ON public.project_updates FOR SELECT USING (true);
CREATE POLICY "Public insert project_updates" ON public.project_updates FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Public update project_updates" ON public.project_updates FOR UPDATE TO public USING (true);
CREATE POLICY "Public delete project_updates" ON public.project_updates FOR DELETE TO public USING (true);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.project_updates;
