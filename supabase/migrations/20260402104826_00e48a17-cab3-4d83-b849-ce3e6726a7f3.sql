
CREATE POLICY "Public insert team_members" ON public.team_members FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Public delete team_members" ON public.team_members FOR DELETE TO public USING (true);
CREATE POLICY "Public insert audit_log" ON public.audit_log FOR INSERT TO public WITH CHECK (true);
