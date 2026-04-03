import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Client = { id: string; name: string };
export type Project = {
  id: string; client_id: string | null; name: string; code: string | null;
  service_type: string | null; revenue_model: string | null; project_type: string | null;
  delivery_manager: string | null; client_spoc: string | null; handled_by: string | null;
  status: string | null; created_at: string | null; updated_at: string | null;
};
export type Milestone = {
  id: string; project_id: string | null; milestone_code: string | null;
  description: string | null; planned_start: string | null; planned_end: string | null;
  actual_start: string | null; actual_end_eta: string | null;
  completion_pct: number | null; status: string | null; milestone_flag: string | null;
  deliverables: string | null; days_variance: number | null;
  blocker: boolean | null; blocker_owner: string | null; remarks: string | null;
  invoice_status: string | null; created_at: string | null; updated_at: string | null;
};
export type TeamMember = {
  id: string; name: string; initials: string | null; role: string;
  reports_to: string | null; member_type: string | null;
  engagement_pct: number | null; color_hex: string | null;
  is_active: boolean | null;
};
export type ProjectAssignment = {
  id: string; project_id: string | null; team_member_id: string | null;
  role_on_project: string | null; allocated_hours_per_week: number | null;
  start_date: string | null; end_date: string | null;
};
export type ProjectUpdate = {
  id: string; project_id: string; content: string; activity_date: string; created_at: string;
};

export const useClients = () =>
  useQuery({ queryKey: ["clients"], queryFn: async () => {
    const { data, error } = await supabase.from("clients").select("*");
    if (error) throw error;
    return data as Client[];
  }});

export const useProjects = () =>
  useQuery({ queryKey: ["projects"], queryFn: async () => {
    const { data, error } = await supabase.from("projects").select("*");
    if (error) throw error;
    return data as Project[];
  }});

export const useMilestones = () =>
  useQuery({ queryKey: ["milestones"], queryFn: async () => {
    const { data, error } = await supabase.from("milestones").select("*");
    if (error) throw error;
    return data as Milestone[];
  }});

export const useTeamMembers = () =>
  useQuery({ queryKey: ["team_members"], queryFn: async () => {
    const { data, error } = await supabase.from("team_members").select("*");
    if (error) throw error;
    return data as TeamMember[];
  }});

export const useAssignments = () =>
  useQuery({ queryKey: ["project_assignments"], queryFn: async () => {
    const { data, error } = await supabase.from("project_assignments").select("*");
    if (error) throw error;
    return data as ProjectAssignment[];
  }});

export type AuditEntry = {
  id: string; table_name: string; record_id: string | null; action: string;
  changed_by: string | null; changed_fields: unknown; old_values: unknown;
  new_values: unknown; created_at: string | null;
};

export const useAuditLog = () =>
  useQuery({ queryKey: ["audit_log"], queryFn: async () => {
    const { data, error } = await supabase.from("audit_log").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return data as AuditEntry[];
  }});

export const useProjectUpdates = () =>
  useQuery({ queryKey: ["project_updates"], queryFn: async () => {
    const { data, error } = await supabase.from("project_updates").select("*").order("activity_date", { ascending: true });
    if (error) throw error;
    return data as ProjectUpdate[];
  }});
