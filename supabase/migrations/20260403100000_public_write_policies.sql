-- Allow unauthenticated frontend writes (public role)
-- NOTE: This is convenient for internal tools but reduces security.

-- CLIENTS
CREATE POLICY "Public insert clients" ON public.clients
FOR INSERT TO public
WITH CHECK (true);

CREATE POLICY "Public update clients" ON public.clients
FOR UPDATE TO public
USING (true)
WITH CHECK (true);

-- PROJECTS
CREATE POLICY "Public insert projects" ON public.projects
FOR INSERT TO public
WITH CHECK (true);

CREATE POLICY "Public update projects" ON public.projects
FOR UPDATE TO public
USING (true)
WITH CHECK (true);

-- MILESTONES
CREATE POLICY "Public insert milestones" ON public.milestones
FOR INSERT TO public
WITH CHECK (true);

CREATE POLICY "Public update milestones" ON public.milestones
FOR UPDATE TO public
USING (true)
WITH CHECK (true);

-- TEAM MEMBERS (Resources page edits)
CREATE POLICY "Public update team_members" ON public.team_members
FOR UPDATE TO public
USING (true)
WITH CHECK (true);

-- PROJECT ASSIGNMENTS (assign/unassign)
CREATE POLICY "Public insert assignments" ON public.project_assignments
FOR INSERT TO public
WITH CHECK (true);

CREATE POLICY "Public update assignments" ON public.project_assignments
FOR UPDATE TO public
USING (true)
WITH CHECK (true);

CREATE POLICY "Public delete assignments" ON public.project_assignments
FOR DELETE TO public
USING (true);
