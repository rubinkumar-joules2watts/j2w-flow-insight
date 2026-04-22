import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { api, apiUrl } from "@/lib/api";

export type Client = { id: string; name: string };
export type Project = {
  id: string; client_id: string | null; name: string; code: string | null;
  service_type: string | null; revenue_model: string | null; project_type: string | null;
  delivery_manager: string | null; client_spoc: string | null; handled_by: string | null;
  status: string | null; created_at: string | null; updated_at: string | null;
};
export type Milestone = {
  _id?: string; id?: string; project_id: string | null; milestone_code: string | null;
  description: string | null; planned_start: string | null; planned_end: string | null;
  actual_start: string | null; actual_end_eta: string | null;
  completion_pct: number | null; status: string | null; milestone_flag: string | null;
  deliverables: string | null; days_variance: number | null;
  blocker: boolean | null; blocker_owner: string | null; remarks: string | null;
  client_signoff_status: string | null; signedoff_date: string | null;
  invoice_status: string | null; invoice_raised_date: string | null;
  created_at: string | null; updated_at: string | null;
};
export type TeamMember = {
  id: string; name: string; initials: string | null; role: string;
  reports_to: string | null; member_type: string | null;
  resource_type: string | null;
  engagement_pct: number | null; color_hex: string | null;
  is_active: boolean | null;
  skills: string[] | null;
};
export type ProjectAssignment = {
  id: string; project_id: string | null; team_member_id: string | null;
  role_on_project: string | null; allocated_hours_per_week: number | null;
  start_date: string | null; end_date: string | null;
};
export type ProjectUpdate = {
  id: string;
  project_id: string;
  content: string;
  activity_date: string;
  created_at: string;
  category?: "Internal" | "Sales" | "Cadence";
  file_path?: string;
  file_name?: string;
  [key: string]: any;
};
export type ProjectDocument = {
  id: string; project_id: string; name: string; type: string; size: number; path: string; created_at: string;
  category?: "Internal" | "Sales" | "Cadence";
  update_id?: string | null;
  [key: string]: any;
};

export type WeekData = {
  week_number: number;
  week_label: string;
  status: string;
  color: string;
  date: string;
};

export type MilestoneHealthPhase = {
  id: string;
  milestone_code: string;
  description: string;
  milestone_type: "practice" | "signoff" | "invoice";
  start_date?: string | null;
  end_date?: string | null;
  date?: string;
  weeks?: WeekData[];
  completion_pct?: number;
  status: string;
  color?: string;
  days_variance?: number;
  signoff_status?: string;
  invoice_status?: string;
};

export type CalendarMonth = {
  month: number;
  year: number;
  month_name: string;
  month_year: string;
  weeks_count: number;
};

export type MilestoneHealthData = {
  project_id: string;
  project_name: string;
  practice: MilestoneHealthPhase[];
  signoff: MilestoneHealthPhase[];
  invoice: MilestoneHealthPhase[];
  weeks_range: {
    start_week: string;
    end_week: string;
    total_weeks: number;
  };
  all_weeks: Record<string, { label: string; start: string }>;
  calendar_start: string;
  calendar_months: CalendarMonth[];
};

export type TeamMemberEngagement = {
  id: string;
  team_member_id: string;
  project_id: string;
  engagement_level: string;
};

export const useClients = () =>
  useQuery({
    queryKey: ["clients"], queryFn: async () => {
      const { data, error } = await api.from("clients").select("*");
      if (error) throw error;
      return data as Client[];
    }
  });

export const useProjects = () =>
  useQuery({
    queryKey: ["projects"], queryFn: async () => {
      const { data, error } = await api.from("projects").select("*");
      if (error) throw error;
      return data as Project[];
    }
  });

export const useMilestones = () =>
  useQuery({
    queryKey: ["milestones"], queryFn: async () => {
      const { data, error } = await api.from("milestones").select("*");
      if (error) throw error;
      return data as Milestone[];
    }
  });

export const useTeamMembers = () =>
  useQuery({
    queryKey: ["team_members"], queryFn: async () => {
      const { data, error } = await api.from("team_members").select("*");
      if (error) throw error;
      return data as TeamMember[];
    }
  });

export const useAssignments = () =>
  useQuery({
    queryKey: ["project_assignments"], queryFn: async () => {
      const { data, error } = await api.from("project_assignments").select("*");
      if (error) throw error;
      return data as ProjectAssignment[];
    }
  });

export type AuditEntry = {
  id: string; table_name: string; record_id: string | null; action: string;
  changed_by: string | null; changed_fields: unknown; old_values: unknown;
  new_values: unknown; created_at: string | null;
};

export const useAuditLog = () =>
  useQuery({
    queryKey: ["audit_log"], queryFn: async () => {
      const { data, error } = await api.from("audit_log").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as AuditEntry[];
    }
  });

export const useProjectUpdates = () =>
  useQuery({
    queryKey: ["project_updates"], queryFn: async () => {
      const { data, error } = await api.from("project_updates").select("*").order("activity_date", { ascending: true });
      if (error) throw error;
      return data as ProjectUpdate[];
    }
  });

export const useProjectDocuments = () =>
  useQuery({
    queryKey: ["project_documents"], queryFn: async () => {
      const { data, error } = await api.from("project_documents").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as ProjectDocument[];
    }
  });

export const useMilestoneHealth = (projectId: string) =>
  useQuery({
    queryKey: ["milestone_health", projectId],
    queryFn: async () => {
      const res = await fetch(apiUrl(`api/projects/${projectId}/milestone-health`));
      if (!res.ok) throw new Error("Failed to fetch milestone health");
      return (await res.json()) as MilestoneHealthData;
    },
    enabled: !!projectId,
    staleTime: 0,
    gcTime: 0,
  });
export type Engagement = {
  id: string;
  team_member_id: string;
  project_id: string;
  engagement_level: string;
};

export const useEngagement = (memberId: string, projectId: string) =>
  useQuery({
    queryKey: ["engagement", memberId, projectId],
    queryFn: async () => {
      const res = await fetch(apiUrl(`/api/team_members_engagement/member/${memberId}/project/${projectId}`));
      if (!res.ok) throw new Error("Failed to fetch engagement");
      const data = await res.json();
      return (data[0] || { engagement_level: "0" }) as Engagement;
    },
    enabled: !!memberId && !!projectId,
  });

export const useUpdateEngagement = () => {
  const qc = useQueryClient();
  return {
    mutateAsync: async (payload: { team_member_id: string; project_id: string; engagement_level: string }) => {
      const res = await fetch(apiUrl(`/api/team_members_engagement`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to update engagement");
      const data = await res.json();
      qc.invalidateQueries({ queryKey: ["engagement", payload.team_member_id, payload.project_id] });
      return data as Engagement;
    }
  };
};
export const useDeleteMilestonePracticeStatus = () => {
  const qc = useQueryClient();
  return {
    mutateAsync: async (payload: { milestoneId: string; weekNumber: number; projectId: string }) => {
      const res = await fetch(apiUrl(`api/milestones/${payload.milestoneId}/health/practice/week/${payload.weekNumber}`), {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete milestone practice status");
      const data = await res.json();
      qc.invalidateQueries({ queryKey: ["milestone_health", payload.projectId] });
      return data;
    }
  };
};
