import { useState, useCallback, useEffect, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";
import Topbar from "@/components/layout/Topbar";
import FilterSelect from "@/components/common/FilterSelect";
import { useClients, useProjects, useMilestones, useTeamMembers, useAssignments, useAuditLog, useProjectUpdates, useProjectDocuments } from "@/hooks/useData";
import { api, apiUrl } from "@/lib/api";
import { writeAuditLog } from "@/lib/audit";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, X, Check, AlertTriangle, History, Trash2, Send, Calendar, MessageSquare, ChevronDown, ChevronRight, FileUp, FileText, Download, Loader2, Paperclip, Link as LinkIcon } from "lucide-react";
import { toast } from "sonner";

const formatDateReadable = (value: string | null | undefined) => {
  if (!value) return "-";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return value;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(y, mo - 1, d);
  if (Number.isNaN(dt.getTime())) return value;
  return dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

const clampProgress = (value: unknown) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, Math.round(n)));
};

const deriveInitials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || "TM";

const Projects = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: clients } = useClients();
  const { data: projects } = useProjects();
  const { data: milestones } = useMilestones();
  const { data: members } = useTeamMembers();
  const { data: assignments } = useAssignments();
  const { data: auditLog } = useAuditLog();
  const { data: allUpdates = [] } = useProjectUpdates();
  const { data: projDocs = [] } = useProjectDocuments();

  const selectedId = searchParams.get("id") || projects?.[0]?.id || "";
  const project = projects?.find((p) => p.id === selectedId);
  const client = clients?.find((c) => c.id === project?.client_id);
  const projMilestones = milestones?.filter((m) => m.project_id === selectedId) || [];
  const projAssignments = assignments?.filter((a) => a.project_id === selectedId) || [];
  const projUpdates = allUpdates?.filter((u) => u.project_id === selectedId) || [];
  const assignedMembers = members?.filter((m) => projAssignments.some((a) => a.team_member_id === m.id)) || [];
  const unassignedMembers = members?.filter((m) => !projAssignments.some((a) => a.team_member_id === m.id)) || [];

  // Get audit entries relevant to this project
  const milestoneIds = projMilestones.map((m) => m.id);
  const assignmentIds = projAssignments.map((a) => a.id);
  const projectAudit = auditLog?.filter((entry) => {
    if (entry.table_name === "projects" && entry.record_id === selectedId) return true;
    if (entry.table_name === "milestones" && milestoneIds.includes(entry.record_id || "")) return true;
    if (entry.table_name === "project_assignments" && assignmentIds.includes(entry.record_id || "")) return true;
    // Also catch assignment inserts/deletes where the record may no longer exist
    if (entry.table_name === "project_assignments") {
      const nv = entry.new_values as Record<string, unknown> | null;
      const ov = entry.old_values as Record<string, unknown> | null;
      if (nv && nv.project_id === selectedId) return true;
      if (ov && ov.project_id === selectedId) return true;
    }
    if (entry.table_name === "milestones") {
      const nv = entry.new_values as Record<string, unknown> | null;
      const ov = entry.old_values as Record<string, unknown> | null;
      if (nv && nv.project_id === selectedId) return true;
      if (ov && ov.project_id === selectedId) return true;
    }
    return false;
  }) || [];

  const [showAddProject, setShowAddProject] = useState(false);
  const [showAddMilestone, setShowAddMilestone] = useState(false);
  const [showAssignMember, setShowAssignMember] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [confirmDeleteMilestone, setConfirmDeleteMilestone] = useState<string | null>(null);
  const [confirmDeleteProject, setConfirmDeleteProject] = useState<string | null>(null);
  const [savedField, setSavedField] = useState<string | null>(null);
  const [projectClientFilter, setProjectClientFilter] = useState("all");
  const [projectStatusFilter, setProjectStatusFilter] = useState("all");
  const [projectSearch, setProjectSearch] = useState("");
  const [milestoneStatusFilter, setMilestoneStatusFilter] = useState("all");
  const [milestoneSearch, setMilestoneSearch] = useState("");
  const [showAddHierarchyMember, setShowAddHierarchyMember] = useState(false);
  const [newUpdate, setNewUpdate] = useState("");
  const [updateDate, setUpdateDate] = useState(new Date().toISOString().split("T")[0]);
  const [updateCategory, setUpdateCategory] = useState<"Internal" | "Sales" | "Cadence">("Internal");
  const [uploadCategory, setUploadCategory] = useState<"Internal" | "Sales" | "Cadence">("Internal");
  const [pendingUpdateFile, setPendingUpdateFile] = useState<File | null>(null);
  const [timelineFilter, setTimelineFilter] = useState("all");
  const [documentFilter, setDocumentFilter] = useState("all");
  const [isAddingUpdate, setIsAddingUpdate] = useState(false);
  const [isTimelineCollapsed, setIsTimelineCollapsed] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadingUpdateId, setUploadingUpdateId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const tileFileInputRef = useRef<HTMLInputElement>(null);
  const [newHierarchyMember, setNewHierarchyMember] = useState({
    name: "",
    role: "Developer",
    reportsTo: "",
    memberType: "Internal",
  });
  const saveTimerRef = useRef<number>();

  const filteredProjects = (projects || []).filter((p) => {
    const byClient = projectClientFilter === "all" || p.client_id === projectClientFilter;
    const byStatus = projectStatusFilter === "all" || (p.status || "") === projectStatusFilter;
    const bySearch = !projectSearch.trim() || p.name.toLowerCase().includes(projectSearch.toLowerCase().trim());
    return byClient && byStatus && bySearch;
  });

  const filteredProjMilestones = projMilestones.filter((m) => {
    const byStatus = milestoneStatusFilter === "all" || (m.status || "") === milestoneStatusFilter;
    const bySearch = !milestoneSearch.trim() || `${m.milestone_code || ""} ${m.description || ""}`.toLowerCase().includes(milestoneSearch.toLowerCase().trim());
    return byStatus && bySearch;
  });

  const filteredProjDocs = projDocs.filter((d) => d.project_id === selectedId)
    .filter((d) => documentFilter === "all" || d.category === documentFilter);

  // Realtime subscription
  useEffect(() => {
    const channel = api.channel("projects-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "projects" }, () => qc.invalidateQueries({ queryKey: ["projects"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "milestones" }, () => qc.invalidateQueries({ queryKey: ["milestones"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "project_assignments" }, () => qc.invalidateQueries({ queryKey: ["project_assignments"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "project_updates" }, () => qc.invalidateQueries({ queryKey: ["project_updates"] }))
      .subscribe();
    return () => { api.removeChannel(channel); };
  }, [qc]);

  const showSaved = (fieldId: string) => {
    setSavedField(fieldId);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => setSavedField(null), 2000);
  };

  const updateMilestone = useCallback(async (id: string, field: string, value: unknown, oldVal: unknown) => {
    const current = milestones?.find((m) => m.id === id);
    if (!current) return;

    const next: Record<string, unknown> = { [field]: value };

    if (field === "completion_pct") {
      const pct = clampProgress(value);
      next.completion_pct = pct;
      if (pct === 100) {
        next.status = "Completed";
        next.blocker = false;
      } else if ((current.status || "") === "Completed") {
        next.status = "On Track";
      }
    }

    if (field === "status") {
      const status = String(value || "");
      next.status = status;
      if (status === "Completed") {
        next.completion_pct = 100;
        next.blocker = false;
      } else if (clampProgress(current.completion_pct) === 100) {
        next.completion_pct = 99;
      }
    }

    if (field === "blocker") {
      const blocker = Boolean(value);
      next.blocker = blocker;
      if (blocker && (current.status || "") === "On Track") {
        next.status = "Delayed";
      }
      if (blocker && (current.status || "") === "Completed") {
        next.status = "Delayed";
        next.completion_pct = 99;
      }
    }

    const { error } = await api.from("milestones").update(next as any).eq("id", id);
    if (error) { toast.error("Failed to update"); return; }

    const changedFields = Object.keys(next);
    const oldValues = changedFields.reduce((acc, key) => {
      acc[key] = (current as Record<string, unknown>)[key] ?? null;
      return acc;
    }, {} as Record<string, unknown>);

    await writeAuditLog("milestones", id, "UPDATE", oldValues, next, changedFields);
    qc.invalidateQueries({ queryKey: ["milestones"] });
    toast.success(`✓ Updated ${changedFields.join(", ")} · ${new Date().toLocaleTimeString()}`);
    showSaved(`${id}-${field}`);
  }, [qc, milestones]);

  const updateProject = useCallback(async (field: string, value: string, oldVal: string | null) => {
    if (!project) return;
    const { error } = await api.from("projects").update({ [field]: value } as any).eq("id", project.id);
    if (error) { toast.error("Failed to update"); return; }
    await writeAuditLog("projects", project.id, "UPDATE", { [field]: oldVal }, { [field]: value }, [field]);
    qc.invalidateQueries({ queryKey: ["projects"] });
    toast.success(`✓ Updated ${field} · ${new Date().toLocaleTimeString()}`);
    showSaved(`proj-${field}`);
  }, [qc, project]);

  // Add project form
  const [newProject, setNewProject] = useState({ clientName: "", name: "", code: "", serviceType: "Outcome", revenueModel: "Milestone", deliveryManager: "", clientSpoc: "", handledBy: "", memberIds: [] as string[] });

  const handleAddProject = async () => {
    let clientId: string;
    const existing = clients?.find((c) => c.name.toLowerCase() === newProject.clientName.toLowerCase());
    if (existing) { clientId = existing.id; }
    else {
      const { data, error } = await api.from("clients").insert({ name: newProject.clientName }).select().single();
      if (error) { toast.error("Failed to create client"); return; }
      clientId = data.id;
      qc.invalidateQueries({ queryKey: ["clients"] });
    }
    const { data: proj, error } = await api.from("projects").insert({
      client_id: clientId, name: newProject.name, code: newProject.code || null,
      service_type: newProject.serviceType, revenue_model: newProject.revenueModel,
      delivery_manager: newProject.deliveryManager || null, client_spoc: newProject.clientSpoc || null,
      handled_by: newProject.handledBy || null,
    }).select().single();
    if (error) { toast.error("Failed to create project"); return; }
    await writeAuditLog("projects", proj.id, "INSERT", null, proj);
    for (const mId of newProject.memberIds) {
      const { data: a } = await api.from("project_assignments").insert({ project_id: proj.id, team_member_id: mId }).select().single();
      if (a) await writeAuditLog("project_assignments", a.id, "INSERT", null, a);
    }
    qc.invalidateQueries({ queryKey: ["projects"] });
    qc.invalidateQueries({ queryKey: ["project_assignments"] });
    qc.invalidateQueries({ queryKey: ["clients"] });
    toast.success(`✓ Project created · ${new Date().toLocaleTimeString()}`);
    setShowAddProject(false);
    navigate(`/projects?id=${proj.id}`);
  };

  const [newMs, setNewMs] = useState({ code: "", description: "", plannedStart: "", plannedEnd: "", deliverables: "" });
  const handleAddMilestone = async () => {
    const { data, error } = await api.from("milestones").insert({
      project_id: selectedId, milestone_code: newMs.code, description: newMs.description,
      planned_start: newMs.plannedStart || null, planned_end: newMs.plannedEnd || null,
      deliverables: newMs.deliverables || null,
    }).select().single();
    if (error) { toast.error("Failed to add milestone"); return; }
    await writeAuditLog("milestones", data.id, "INSERT", null, data);
    qc.invalidateQueries({ queryKey: ["milestones"] });
    toast.success(`✓ Milestone added · ${new Date().toLocaleTimeString()}`);
    setShowAddMilestone(false);
    setNewMs({ code: "", description: "", plannedStart: "", plannedEnd: "", deliverables: "" });
  };

  const handleAssignMember = async (memberId: string) => {
    const { data, error } = await api.from("project_assignments").insert({ project_id: selectedId, team_member_id: memberId }).select().single();
    if (error) { toast.error("Failed to assign"); return; }
    await writeAuditLog("project_assignments", data.id, "INSERT", null, data);
    qc.invalidateQueries({ queryKey: ["project_assignments"] });
    toast.success(`✓ Member assigned · ${new Date().toLocaleTimeString()}`);
    setShowAssignMember(false);
  };

  const handleRemoveMember = async (memberId: string) => {
    const assignment = assignments?.find((a) => a.project_id === selectedId && a.team_member_id === memberId);
    if (!assignment) return;
    const { error } = await api.from("project_assignments").delete().eq("id", assignment.id);
    if (error) { toast.error("Failed to remove"); return; }
    await writeAuditLog("project_assignments", assignment.id, "DELETE", assignment, null);
    qc.invalidateQueries({ queryKey: ["project_assignments"] });
    toast.success(`✓ Member removed · ${new Date().toLocaleTimeString()}`);
    setConfirmRemove(null);
  };

  const resolveReportsToId = (reportsTo: string | null) => {
    if (!reportsTo) return null;
    const byId = assignedMembers.find((m) => m.id === reportsTo);
    if (byId) return byId.id;
    const byName = assignedMembers.find((m) => m.name.toLowerCase() === reportsTo.toLowerCase());
    return byName?.id || null;
  };

  const updateMemberField = useCallback(async (memberId: string, field: "role" | "reports_to", value: string | null, oldVal: unknown) => {
    const { error } = await api.from("team_members").update({ [field]: value } as any).eq("id", memberId);
    if (error) { toast.error("Failed to update member"); return; }
    await writeAuditLog("team_members", memberId, "UPDATE", { [field]: oldVal }, { [field]: value }, [field]);
    qc.invalidateQueries({ queryKey: ["team_members"] });
    qc.invalidateQueries({ queryKey: ["audit_log"] });
    toast.success(`✓ Updated ${field.replace("_", " ")} · ${new Date().toLocaleTimeString()}`);
    showSaved(`${memberId}-${field}`);
  }, [qc]);

  const handleAddHierarchyMember = async () => {
    if (!project) return;
    if (!newHierarchyMember.name.trim()) {
      toast.error("Member name is required");
      return;
    }

    const payload = {
      name: newHierarchyMember.name.trim(),
      initials: deriveInitials(newHierarchyMember.name),
      role: newHierarchyMember.role.trim() || "Developer",
      reports_to: newHierarchyMember.reportsTo || null,
      member_type: newHierarchyMember.memberType || "Internal",
      engagement_pct: 100,
      color_hex: "#0EA5A6",
      is_active: true,
    };

    const { data: member, error: memberError } = await api.from("team_members").insert(payload as any).select().single();
    if (memberError || !member) {
      toast.error("Failed to add person");
      return;
    }

    const { data: assignment, error: assignmentError } = await api
      .from("project_assignments")
      .insert({ project_id: project.id, team_member_id: member.id } as any)
      .select()
      .single();

    if (assignmentError) {
      toast.error("Added person but failed to assign to project");
      return;
    }

    await writeAuditLog("team_members", member.id, "INSERT", null, member);
    await writeAuditLog("project_assignments", assignment.id, "INSERT", null, assignment);

    qc.invalidateQueries({ queryKey: ["team_members"] });
    qc.invalidateQueries({ queryKey: ["project_assignments"] });
    qc.invalidateQueries({ queryKey: ["audit_log"] });

    setShowAddHierarchyMember(false);
    setNewHierarchyMember({ name: "", role: "Developer", reportsTo: "", memberType: "Internal" });
    toast.success(`✓ Added ${payload.name} to hierarchy · ${new Date().toLocaleTimeString()}`);
  };

  const handleAddUpdate = async () => {
    if (!newUpdate.trim() || !project) return;
    setIsAddingUpdate(true);
    const { data: updateData, error } = await api.from("project_updates").insert({
      project_id: project.id,
      content: newUpdate.trim(),
      activity_date: updateDate,
      category: updateCategory,
    }).select().single();

    if (error) {
      toast.error("Failed to add update");
    } else {
      if (pendingUpdateFile && updateData) {
        await executeUpload(pendingUpdateFile, project.id, updateData.id, updateCategory);
      }
      setNewUpdate("");
      setUpdateDate(new Date().toISOString().split("T")[0]);
      setPendingUpdateFile(null);
      qc.invalidateQueries({ queryKey: ["project_updates"] });
      toast.success("Timeline updated");
    }
    setIsAddingUpdate(false);
  };

  const executeUpload = async (file: File, projId: string, updateId?: string, category?: string) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("project_id", projId);
    if (updateId) formData.append("update_id", updateId);
    if (category) formData.append("category", category);

    const response = await fetch(apiUrl("/api/upload"), { method: "POST", body: formData });
    if (!response.ok) throw new Error("Upload failed");
    qc.invalidateQueries({ queryKey: ["project_documents"] });
    qc.invalidateQueries({ queryKey: ["project_updates"] });
  };

  const handleUploadFile = async (e: React.ChangeEvent<HTMLInputElement>, updateId?: string) => {
    const file = e.target.files?.[0];
    if (!file || !project) return;

    if (updateId) setUploadingUpdateId(updateId);
    else setIsUploading(true);

    try {
      await executeUpload(file, project.id, updateId, "Internal");
      toast.success(updateId ? "Attachment added" : "File uploaded");
    } catch (err) {
      toast.error("Upload failed");
    } finally {
      setIsUploading(false);
      setUploadingUpdateId(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (tileFileInputRef.current) tileFileInputRef.current.value = "";
    }
  };

  const handleDeleteDocument = async (docId: string) => {
    const { error } = await api.from("project_documents").delete().eq("id", docId);
    if (error) toast.error("Failed to delete");
    else {
      qc.invalidateQueries({ queryKey: ["project_documents"] });
      toast.success("Document deleted");
    }
  };

  const hierarchyChildrenByManager = assignedMembers.reduce((acc, member) => {
    const managerId = resolveReportsToId(member.reports_to);
    const key = managerId || "__root__";
    if (!acc[key]) acc[key] = [];
    acc[key].push(member);
    return acc;
  }, {} as Record<string, typeof assignedMembers>);

  const renderHierarchyNode = (
    memberId: string,
    path: Set<string> = new Set(),
    isFirst = true,
    isLast = true,
    hasParent = false,
    level = 0
  ) => {
    const member = assignedMembers.find((m) => m.id === memberId);
    if (!member) return null;
    if (path.has(memberId)) return null;

    const nextPath = new Set(path);
    nextPath.add(memberId);
    const children = hierarchyChildrenByManager[memberId] || [];

    return (
      <div key={member.id} className="flex flex-col items-center relative">
        {/* Top connector for non-root nodes */}
        {hasParent && (
          <div className="flex flex-col items-center w-full">
            {/* The bridge segment from the sibling group */}
            <div className="relative w-full h-4">
              {/* Horizontal line */}
              {!(isFirst && isLast) && (
                <div className={`absolute top-0 h-px bg-border/60 ${isFirst ? "left-1/2 right-0" :
                  isLast ? "left-0 right-1/2" :
                    "left-0 right-0"
                  }`} />
              )}
              {/* Vertical line into the card */}
              <div className="absolute left-1/2 top-0 -translate-x-1/2 h-full w-px bg-border/60" />
            </div>
          </div>
        )}

        {/* Node Card */}
        <div
          className={`group flex flex-col items-center gap-2 rounded-xl border p-3 transition-all duration-300 shadow-sm relative z-10 ${level === 0
            ? "bg-primary/5 border-primary/20 shadow-primary/5 min-w-[200px]"
            : "bg-card border-border/60 hover:border-primary/40 hover:shadow-md hover:-translate-y-0.5 min-w-[180px]"
            }`}
        >
          <div
            className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold shadow-inner"
            style={{
              backgroundColor: member.color_hex || "#666",
              color: "#fff",
              boxShadow: `0 0 0 2px ${member.color_hex}44`
            }}
          >
            {member.initials || deriveInitials(member.name)}
          </div>
          <div className="text-center min-w-0">
            <p className={`text-xs font-bold truncate ${level === 0 ? "text-primary" : "text-foreground"}`}>
              {member.name}
            </p>
            <p className="text-[10px] text-muted-foreground font-medium mt-0.5">
              {member.role || "No role"}
            </p>
            {member.member_type === "External" && (
              <span className="mt-1 inline-block text-[8px] bg-accent/10 text-accent px-1 rounded-sm border border-accent/20 font-bold uppercase tracking-tighter">EXT</span>
            )}
          </div>
          {children.length > 0 && (
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[8px] text-primary-foreground border-2 border-card font-extrabold shadow-sm">
              {children.length}
            </div>
          )}
        </div>

        {/* Children Row */}
        {children.length > 0 && (
          <div className="flex flex-col items-center">
            {/* Vertical line down to children group */}
            <div className="h-4 w-px bg-border/60" />

            <div className="flex items-start gap-8">
              {children.map((child, idx) =>
                renderHierarchyNode(
                  child.id,
                  nextPath,
                  idx === 0,
                  idx === children.length - 1,
                  true,
                  level + 1
                )
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  const handleDeleteMilestone = async (milestoneId: string) => {
    const ms = milestones?.find((m) => m.id === milestoneId);
    if (!ms) return;
    const { error } = await api.from("milestones").delete().eq("id", milestoneId);
    if (error) {
      toast.error("Failed to delete milestone");
      return;
    }
    await writeAuditLog("milestones", milestoneId, "DELETE", ms, null);
    qc.invalidateQueries({ queryKey: ["milestones"] });
    qc.invalidateQueries({ queryKey: ["audit_log"] });
    toast.success(`✓ Milestone deleted · ${new Date().toLocaleTimeString()}`);
    setConfirmDeleteMilestone(null);
  };

  const handleDeleteProject = async (projectId: string) => {
    const proj = projects?.find((p) => p.id === projectId);
    if (!proj) return;

    const relatedMilestones = milestones?.filter((m) => m.project_id === projectId) || [];
    const relatedAssignments = assignments?.filter((a) => a.project_id === projectId) || [];

    for (const ms of relatedMilestones) {
      const { error } = await api.from("milestones").delete().eq("id", ms.id);
      if (error) {
        toast.error("Failed to delete related milestones");
        return;
      }
      await writeAuditLog("milestones", ms.id, "DELETE", ms, null);
    }

    for (const a of relatedAssignments) {
      const { error } = await api.from("project_assignments").delete().eq("id", a.id);
      if (error) {
        toast.error("Failed to delete related assignments");
        return;
      }
      await writeAuditLog("project_assignments", a.id, "DELETE", a, null);
    }

    const { error } = await api.from("projects").delete().eq("id", projectId);
    if (error) {
      toast.error("Failed to delete project");
      return;
    }
    await writeAuditLog("projects", projectId, "DELETE", proj, null);

    const remaining = (projects || []).filter((p) => p.id !== projectId);
    qc.invalidateQueries({ queryKey: ["projects"] });
    qc.invalidateQueries({ queryKey: ["milestones"] });
    qc.invalidateQueries({ queryKey: ["project_assignments"] });
    qc.invalidateQueries({ queryKey: ["audit_log"] });

    if (remaining[0]?.id) {
      navigate(`/projects?id=${remaining[0].id}`);
    } else {
      navigate(`/projects`);
    }

    toast.success(`✓ Project deleted · ${new Date().toLocaleTimeString()}`);
    setConfirmDeleteProject(null);
  };

  const doneMilestones = projMilestones.filter((m) => m.completion_pct === 100).length;

  return (
    <AppLayout>
      <Topbar title="Projects" />
      <div className="p-6 space-y-5 animate-fade-in">
        {/* Filters */}
        <div className="grid grid-cols-3 gap-4 rounded-lg border border-slate-700 bg-gradient-to-b from-slate-900/50 to-slate-800/30 p-4">
          <FilterSelect
            value={projectClientFilter}
            onChange={setProjectClientFilter}
            label="Client"
            placeholder="All Clients"
            options={[
              { label: "All Clients", value: "all" },
              ...((clients || []).map((c) => ({ label: c.name, value: c.id })))
            ]}
          />
          <FilterSelect
            value={projectStatusFilter}
            onChange={setProjectStatusFilter}
            label="Status"
            placeholder="All Project Status"
            options={[
              { label: "All Project Status", value: "all" },
              { label: "On Track", value: "On Track" },
              { label: "At Risk", value: "At Risk" },
              { label: "Blocked", value: "Blocked" },
              { label: "Completed", value: "Completed" }
            ]}
          />
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wide">
              Search
            </label>
            <input
              value={projectSearch}
              onChange={(e) => setProjectSearch(e.target.value)}
              placeholder="Search Project Name"
              className="w-full rounded-lg border border-slate-700 bg-gradient-to-b from-slate-800 to-slate-900 px-4 py-2.5 text-sm text-white font-medium placeholder-slate-500 transition-all duration-200 hover:border-blue-500/50 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
          </div>
        </div>

        {/* Project Selector */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          {filteredProjects.map((p) => {
            const cl = clients?.find((c) => c.id === p.client_id);
            return (
              <button
                key={p.id}
                onClick={() => navigate(`/projects?id=${p.id}`)}
                className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${p.id === selectedId
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                  }`}
              >
                {cl?.name} · {p.name}
              </button>
            );
          })}
          <button onClick={() => setShowAddProject(true)} className="shrink-0 flex items-center gap-1 rounded-full border border-primary bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 transition-colors">
            <Plus size={14} /> Add Project
          </button>
        </div>

        {project && (
          <>
            {/* Project Header */}
            <div className="flex items-start justify-between rounded-lg border border-border bg-card p-5">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-foreground flex items-center gap-1.5">
                    <span className="text-muted-foreground/60 font-semibold">{client?.name}</span>
                    <span className="text-muted-foreground/40 font-light">·</span>
                    <InlineEdit
                      value={project.name}
                      onSave={(v) => updateProject("name", v, project.name)}
                      savedKey={savedField === "proj-name"}
                      className="hover:text-primary transition-colors cursor-text"
                    />
                  </h2>
                  {confirmDeleteProject === project.id ? (
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-destructive">Delete project?</span>
                      <button onClick={() => handleDeleteProject(project.id)} className="text-destructive hover:text-destructive/80"><Check size={14} /></button>
                      <button onClick={() => setConfirmDeleteProject(null)} className="text-muted-foreground hover:text-foreground"><X size={14} /></button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmDeleteProject(project.id)} className="rounded-md p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" title="Delete Project">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <EditableSelect value={project.service_type || ""} options={["Outcome", "Governance", "AI Solution", "Automation", "Others"]} onSave={(v) => updateProject("service_type", v, project.service_type)} />
                  <EditableSelect value={project.revenue_model || ""} options={["Milestone", "Monthly", "Fixed"]} onSave={(v) => updateProject("revenue_model", v, project.revenue_model)} />
                  <EditableSelect value={project.status || "On Track"} options={["On Track", "At Risk", "Blocked", "Completed"]} onSave={(v) => updateProject("status", v, project.status)} />
                </div>
                <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">Manager: <InlineEdit value={project.delivery_manager || ""} onSave={(v) => updateProject("delivery_manager", v, project.delivery_manager)} savedKey={savedField === "proj-delivery_manager"} /></span>
                  <span className="flex items-center gap-1">SPOC: <InlineEdit value={project.client_spoc || ""} onSave={(v) => updateProject("client_spoc", v, project.client_spoc)} savedKey={savedField === "proj-client_spoc"} /></span>
                  <span className="flex items-center gap-1">Handled by: <InlineEdit value={project.handled_by || ""} onSave={(v) => updateProject("handled_by", v, project.handled_by)} savedKey={savedField === "proj-handled_by"} /></span>
                </div>
              </div>
              <div className="flex gap-6 text-right">
                {[
                  { label: "Total", value: projMilestones.length },
                  { label: "Done", value: doneMilestones },
                  { label: "Remaining", value: projMilestones.length - doneMilestones },
                  { label: "Resources", value: assignedMembers.length },
                ].map((s) => (
                  <div key={s.label}>
                    <p className="text-xl font-bold text-foreground">{s.value}</p>
                    <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Timeline Typebar */}
            <div className="rounded-xl border border-border/50 bg-card p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <MessageSquare size={20} />
                </div>
                <div className="flex-1 flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={updateDate}
                      onChange={(e) => setUpdateDate(e.target.value)}
                      className="rounded-lg border border-border bg-secondary/30 px-3 py-1.5 text-xs outline-none transition-all focus:border-primary/50 focus:bg-background h-[32px] w-[140px]"
                      disabled={isAddingUpdate}
                    />
                    <div className="flex items-center gap-1 bg-secondary/30 p-1 rounded-lg border border-border">
                      {(["Internal", "Sales", "Cadence"] as const).map((cat) => (
                        <button
                          key={cat}
                          onClick={() => setUpdateCategory(cat)}
                          className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${updateCategory === cat
                            ? cat === "Internal" ? "bg-blue-500 text-white shadow-sm" :
                              cat === "Sales" ? "bg-emerald-500 text-white shadow-sm" :
                                "bg-orange-500 text-white shadow-sm"
                            : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                            }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="relative flex-1">
                    <input
                      value={newUpdate}
                      onChange={(e) => setNewUpdate(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleAddUpdate()}
                      placeholder="Type project update or activity detail here... (e.g. SOW Signed)"
                      className="w-full rounded-lg border border-border bg-secondary/30 px-4 py-2.5 pr-12 text-sm outline-none transition-all focus:border-primary/50 focus:bg-background focus:ring-2 focus:ring-primary/10 h-[42px]"
                      disabled={isAddingUpdate}
                    />
                    <div className="absolute right-2 top-1.5 flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          const el = document.createElement('input');
                          el.type = 'file';
                          el.onchange = (e) => {
                            const f = (e.target as HTMLInputElement).files?.[0];
                            if (f) setPendingUpdateFile(f);
                          };
                          el.click();
                        }}
                        className={`flex h-7 w-7 items-center justify-center rounded-md border transition-all ${pendingUpdateFile ? "border-primary bg-primary/10 text-primary shadow-sm" : "border-border text-muted-foreground hover:bg-secondary hover:text-foreground"}`}
                        title={pendingUpdateFile ? `Ready to upload: ${pendingUpdateFile.name}` : "Attach document"}
                      >
                        <Paperclip size={14} className={pendingUpdateFile ? "animate-pulse" : ""} />
                      </button>
                      <button
                        onClick={handleAddUpdate}
                        disabled={isAddingUpdate || (!newUpdate.trim() && !pendingUpdateFile)}
                        className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-sm transition-all hover:bg-primary/90 disabled:opacity-50"
                      >
                        <Send size={14} />
                      </button>
                    </div>
                  </div>
                  {pendingUpdateFile && (
                    <div className="flex items-center gap-2 px-1">
                      <div className="flex items-center gap-1.5 rounded-full bg-primary/5 border border-primary/20 px-2 py-0.5 animate-in slide-in-from-top-1 duration-200">
                        <FileText size={10} className="text-primary" />
                        <span className="text-[10px] font-bold text-primary truncate max-w-[200px]">{pendingUpdateFile.name}</span>
                        <button onClick={() => setPendingUpdateFile(null)} className="text-muted-foreground hover:text-destructive transition-colors ml-1">
                          <X size={10} />
                        </button>
                      </div>
                      <span className="text-[10px] text-muted-foreground animate-pulse">will be uploaded with update</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Timeline Feed */}
            <div className="relative">
              <div className="flex items-center justify-between mb-2 px-1">
                <div className="flex items-center gap-2">
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Filters</h4>
                  <div className="flex items-center gap-1.5 ml-2">
                    {["all", "Internal", "Sales", "Cadence"].map((f) => (
                      <button
                        key={f}
                        onClick={() => setTimelineFilter(f)}
                        className={`px-2.5 py-0.5 rounded-full text-[9px] font-extrabold transition-all border ${timelineFilter === f
                          ? f === "Internal" ? "bg-blue-500 border-blue-500 text-white" :
                            f === "Sales" ? "bg-emerald-500 border-emerald-500 text-white" :
                              f === "Cadence" ? "bg-orange-500 border-orange-500 text-white" :
                                "bg-foreground border-foreground text-background"
                          : "bg-secondary/50 border-border/50 text-muted-foreground hover:border-primary/30"
                          }`}
                      >
                        {f.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {projUpdates.length > 0 && (
                <div className="relative">
                  <div className="flex items-start gap-2 overflow-x-auto pb-4 no-scrollbar">
                    <button
                      onClick={() => setIsTimelineCollapsed(!isTimelineCollapsed)}
                      className="flex shrink-0 items-center justify-center rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs font-bold text-muted-foreground uppercase tracking-widest vertical-text hover:bg-secondary/50 transition-all group"
                    >
                      <div className="flex items-center gap-1.5 transform -rotate-90 mb-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {isTimelineCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                      </div>
                      Timeline
                    </button>

                    {isTimelineCollapsed ? (
                      <div className="flex flex-1 items-center gap-3 py-1 cursor-pointer" onClick={() => setIsTimelineCollapsed(false)}>
                        <div className="flex items-center gap-2 rounded-full border border-border/60 bg-card px-4 py-1.5 text-[11px] font-bold text-muted-foreground shadow-sm hover:border-primary/40 transition-all">
                          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                          {projUpdates.filter(u => timelineFilter === "all" || u.category === timelineFilter).length} update{projUpdates.length !== 1 ? 's' : ''} in timeline
                          <ChevronRight size={10} className="ml-1" />
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-3 min-h-[80px]">
                        {projUpdates
                          .filter(u => timelineFilter === "all" || u.category === timelineFilter)
                          .slice().reverse().map((u, idx) => (
                            <div
                              key={u.id}
                              className={`group relative flex min-w-[220px] max-w-[260px] flex-col rounded-xl border bg-card p-3 shadow-sm transition-all animate-in fade-in slide-in-from-left-2 duration-300 ${u.category === "Sales" ? "border-emerald-200/60 hover:border-emerald-400 hover:shadow-emerald-500/5 translate-y-0" :
                                u.category === "Cadence" ? "border-orange-200/60 hover:border-orange-400 hover:shadow-orange-500/5 translate-y-0" :
                                  "border-blue-200/60 hover:border-blue-400 hover:shadow-blue-500/5 translate-y-0"
                                }`}
                            >
                              <div className="mb-2 flex items-center justify-between">
                                <div className={`flex items-center gap-1.5 text-[10px] font-bold ${u.category === "Sales" ? "text-emerald-600" :
                                  u.category === "Cadence" ? "text-orange-600" :
                                    "text-blue-600"
                                  }`}>
                                  <Calendar size={10} />
                                  {new Date(u.activity_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                                  <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[8px] uppercase tracking-wider ${u.category === "Sales" ? "bg-emerald-100 text-emerald-700" :
                                    u.category === "Cadence" ? "bg-orange-100 text-orange-700" :
                                      "bg-blue-100 text-blue-700"
                                    }`}>
                                    {u.category || "Internal"}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => {
                                      setUploadingUpdateId(u.id);
                                      tileFileInputRef.current?.click();
                                    }}
                                    className="text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
                                    disabled={uploadingUpdateId === u.id}
                                    title="Attach document"
                                  >
                                    {uploadingUpdateId === u.id ? <Loader2 size={10} className="animate-spin" /> : <Paperclip size={10} />}
                                  </button>
                                  <span className="text-[9px] text-muted-foreground bg-secondary/50 px-1.5 py-0.5 rounded-full">
                                    Manual
                                  </span>
                                </div>
                              </div>
                              <p className="text-xs text-foreground line-clamp-3 leading-relaxed mb-2">
                                {u.content}
                              </p>

                              {u.file_path && (
                                <a
                                  href={apiUrl(`/api/files/${u.file_path}?download=${encodeURIComponent(u.file_name || "file")}`)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="mt-auto flex items-center gap-1.5 text-[9px] text-primary hover:underline font-bold bg-primary/5 p-1 rounded border border-primary/10"
                                  title={u.file_name}
                                >
                                  <LinkIcon size={8} />
                                  <span className="truncate max-w-[150px]">{u.file_name}</span>
                                </a>
                              )}

                              {idx !== 0 && (
                                <div className="absolute -left-3 top-1/2 h-[1px] w-3 bg-border group-hover:bg-primary/20" />
                              )}
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Hidden Input for Tile Upload */}
            <input
              type="file"
              ref={tileFileInputRef}
              onChange={(e) => handleUploadFile(e, uploadingUpdateId || undefined)}
              className="hidden"
            />

            {/* Milestone Tracker */}
            <div className="rounded-lg border border-border bg-card">
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <h3 className="text-sm font-bold text-foreground">Milestone Tracker</h3>
                <div className="flex items-center gap-2">
                  <select
                    value={milestoneStatusFilter}
                    onChange={(e) => setMilestoneStatusFilter(e.target.value)}
                    className="rounded-md border border-border bg-secondary px-2 py-1 text-xs text-foreground outline-none"
                  >
                    <option value="all">All Status</option>
                    {["Completed", "On Track", "Delayed", "On Hold", "Pending", "Upcoming"].map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  <input
                    value={milestoneSearch}
                    onChange={(e) => setMilestoneSearch(e.target.value)}
                    placeholder="Search Milestone"
                    className="rounded-md border border-border bg-secondary px-2 py-1 text-xs text-foreground outline-none"
                  />
                  <button onClick={() => setShowAddMilestone(true)} className="flex items-center gap-1 rounded-md bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/20 transition-colors">
                    <Plus size={14} /> Add Milestone
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border text-left text-muted-foreground">
                      {["ID", "Description", "Planned", "Actual/ETA", "Progress", "Status", "Blocker", "Invoice", "Remarks", "Delete"].map((h) => (
                        <th
                          key={h}
                          className={`px-3 py-2 font-medium ${h === "Remarks" ? "min-w-[280px]" : "whitespace-nowrap"}`}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProjMilestones.length === 0 && (
                      <tr><td colSpan={10} className="px-3 py-8 text-center text-muted-foreground">No milestones yet</td></tr>
                    )}
                    {filteredProjMilestones.map((m) => (
                      <tr key={m.id} className="border-b border-border last:border-0">
                        <td className="px-3 py-2 font-medium text-foreground">
                          <InlineEdit value={m.milestone_code || ""} onSave={(v) => updateMilestone(m.id, "milestone_code", v, m.milestone_code)} savedKey={savedField === `${m.id}-milestone_code`} />
                        </td>
                        <td className="px-3 py-2 text-foreground min-w-[200px] max-w-[400px] whitespace-normal break-words">
                          <InlineEdit
                            value={m.description || ""}
                            onSave={(v) => updateMilestone(m.id, "description", v, m.description)}
                            savedKey={savedField === `${m.id}-description`}
                            multiline
                          />
                        </td>
                        <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                          <div className="flex items-center gap-1">
                            <InlineDateEdit value={m.planned_start} onSave={(v) => updateMilestone(m.id, "planned_start", v || null, m.planned_start)} savedKey={savedField === `${m.id}-planned_start`} />
                            <span>→</span>
                            <InlineDateEdit value={m.planned_end} onSave={(v) => updateMilestone(m.id, "planned_end", v || null, m.planned_end)} savedKey={savedField === `${m.id}-planned_end`} />
                          </div>
                        </td>
                        <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                          <div className="flex items-center gap-1">
                            <InlineDateEdit value={m.actual_start} onSave={(v) => updateMilestone(m.id, "actual_start", v || null, m.actual_start)} savedKey={savedField === `${m.id}-actual_start`} />
                            <span>→</span>
                            <InlineDateEdit value={m.actual_end_eta} onSave={(v) => updateMilestone(m.id, "actual_end_eta", v || null, m.actual_end_eta)} savedKey={savedField === `${m.id}-actual_end_eta`} />
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-16 rounded-full bg-secondary">
                              <div className={`h-full rounded-full ${m.milestone_flag === "red" ? "bg-destructive" : m.milestone_flag === "amber" ? "bg-warning" : "bg-success"}`} style={{ width: `${clampProgress(m.completion_pct)}%` }} />
                            </div>
                            <InlinePercentEdit
                              value={m.completion_pct ?? 0}
                              onSave={(val) => updateMilestone(m.id, "completion_pct", val, m.completion_pct)}
                              savedKey={savedField === `${m.id}-completion_pct`}
                            />
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <div className="relative">
                            <select
                              value={m.status || "Pending"}
                              onChange={(e) => updateMilestone(m.id, "status", e.target.value, m.status)}
                              className="appearance-none rounded-md border border-border bg-secondary px-2 py-1 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary"
                            >
                              {["Completed", "On Track", "Delayed", "On Hold", "Pending", "Upcoming"].map((s) => (
                                <option key={s} value={s}>{s}</option>
                              ))}
                            </select>
                            {savedField === `${m.id}-status` && <span className="absolute -top-4 left-0 text-[10px] text-success">Saved ✓</span>}
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <button
                            onClick={() => updateMilestone(m.id, "blocker", !m.blocker, m.blocker)}
                            className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors ${m.blocker ? "bg-destructive/15 text-destructive" : "bg-secondary text-muted-foreground"}`}
                          >
                            <AlertTriangle size={12} /> {m.blocker ? "Yes" : "No"}
                          </button>
                        </td>
                        <td className="px-3 py-2">
                          <select
                            value={m.invoice_status || "Pending"}
                            onChange={(e) => updateMilestone(m.id, "invoice_status", e.target.value, m.invoice_status)}
                            className="appearance-none rounded-md border border-border bg-secondary px-2 py-1 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary"
                          >
                            <option value="Raised">Raised</option>
                            <option value="Pending">Pending</option>
                          </select>
                        </td>
                        <td className="px-3 py-2 align-top min-w-[280px] max-w-[420px] whitespace-normal break-words">
                          <InlineEdit
                            value={m.remarks || ""}
                            onSave={(val) => updateMilestone(m.id, "remarks", val, m.remarks)}
                            savedKey={savedField === `${m.id}-remarks`}
                            multiline
                          />
                        </td>
                        <td className="px-3 py-2">
                          {confirmDeleteMilestone === m.id ? (
                            <div className="flex items-center gap-1">
                              <button onClick={() => handleDeleteMilestone(m.id)} className="text-destructive hover:text-destructive/80"><Check size={14} /></button>
                              <button onClick={() => setConfirmDeleteMilestone(null)} className="text-muted-foreground hover:text-foreground"><X size={14} /></button>
                            </div>
                          ) : (
                            <button onClick={() => setConfirmDeleteMilestone(m.id)} className="text-muted-foreground hover:text-destructive transition-colors" title="Delete Milestone">
                              <Trash2 size={14} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Resources Deployed */}
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-foreground">Resources Deployed</h3>
                <div className="flex items-center gap-2">
                  <button onClick={() => setShowAddHierarchyMember(true)} className="flex items-center gap-1 rounded-md bg-accent/15 px-2.5 py-1 text-xs font-medium text-accent hover:bg-accent/25 transition-colors">
                    <Plus size={14} /> Add Person
                  </button>
                  <div className="relative">
                    <button onClick={() => setShowAssignMember(!showAssignMember)} className="flex items-center gap-1 rounded-md bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/20 transition-colors">
                      <Plus size={14} /> Add Team Member
                    </button>
                    {showAssignMember && (
                      <div className="absolute right-0 top-full mt-1 z-50 w-56 rounded-lg border border-border bg-popover p-1 shadow-lg">
                        {unassignedMembers.length === 0 && <p className="px-3 py-2 text-xs text-muted-foreground">All members assigned</p>}
                        {unassignedMembers.map((m) => (
                          <button key={m.id} onClick={() => handleAssignMember(m.id)} className="w-full text-left rounded-md px-3 py-1.5 text-xs text-foreground hover:bg-secondary transition-colors">
                            {m.name} · {m.role}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              {assignedMembers.length === 0 && <p className="text-xs text-muted-foreground">No resources assigned</p>}
              <div className="flex flex-wrap gap-2">
                {assignedMembers.map((m) => (
                  <div key={m.id} className="flex items-center gap-2 rounded-lg bg-secondary px-3 py-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold" style={{ backgroundColor: m.color_hex || "#666", color: "#fff" }}>
                      {m.initials}
                    </div>
                    <div>
                      <p className="text-xs font-medium text-foreground">{m.name}</p>
                      <p className="text-[10px] text-muted-foreground">{m.role}</p>
                    </div>
                    {confirmRemove === m.id ? (
                      <div className="flex items-center gap-1 ml-2">
                        <span className="text-[10px] text-destructive">Remove?</span>
                        <button onClick={() => handleRemoveMember(m.id)} className="text-destructive hover:text-destructive/80"><Check size={14} /></button>
                        <button onClick={() => setConfirmRemove(null)} className="text-muted-foreground hover:text-foreground"><X size={14} /></button>
                      </div>
                    ) : (
                      <button onClick={() => setConfirmRemove(m.id)} className="ml-1 text-muted-foreground hover:text-destructive transition-colors"><X size={14} /></button>
                    )}
                  </div>
                ))}
              </div>

              {assignedMembers.length > 0 && (
                <div className="mt-6 grid grid-cols-[1.2fr_0.8fr] gap-6">
                  <div className="rounded-xl border border-border/50 bg-secondary/10 p-5 shadow-sm">
                    <div className="mb-4 flex items-center justify-between">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80">Hierarchy Tree</h4>
                      <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold">Visual Flow</span>
                    </div>
                    <div className="overflow-x-auto pb-6 no-scrollbar min-h-[400px]">
                      <div className="flex flex-col items-center justify-start min-w-max p-4">
                        {(hierarchyChildrenByManager.__root__ || []).map((root, idx, arr) =>
                          renderHierarchyNode(root.id, new Set(), idx === 0, idx === arr.length - 1, false, 0)
                        )}
                        {(hierarchyChildrenByManager.__root__ || []).length === 0 && (
                          <div className="flex flex-col items-center justify-center py-12 text-center w-full">
                            <div className="rounded-full bg-secondary p-3 mb-2">
                              <AlertTriangle size={20} className="text-muted-foreground" />
                            </div>
                            <p className="text-xs text-muted-foreground max-w-[180px]">No root members found. Set at least one person with no manager in Hierarchy Settings.</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-border/50 bg-card p-5 shadow-sm">
                    <div className="mb-4 flex items-center justify-between">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80">Management Setup</h4>
                      <span className="text-[10px] bg-secondary text-muted-foreground px-2 py-0.5 rounded-full font-bold">Config</span>
                    </div>
                    <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                      {assignedMembers.map((m) => {
                        const reportsToId = resolveReportsToId(m.reports_to) || "";
                        return (
                          <div key={m.id} className="grid grid-cols-[1fr_1fr_1fr] items-center gap-2 rounded-md border border-border bg-card px-2 py-1.5">
                            <div className="min-w-0">
                              <p className="text-xs font-medium text-foreground truncate">{m.name}</p>
                            </div>
                            <InlineEdit
                              value={m.role || ""}
                              onSave={(v) => updateMemberField(m.id, "role", v, m.role)}
                              savedKey={savedField === `${m.id}-role`}
                            />
                            <div className="relative">
                              <select
                                value={reportsToId}
                                onChange={(e) => updateMemberField(m.id, "reports_to", e.target.value || null, m.reports_to)}
                                className="w-full appearance-none rounded-md border border-border bg-secondary px-2 py-1 text-xs text-foreground outline-none"
                              >
                                <option value="">Top Level</option>
                                {assignedMembers.filter((x) => x.id !== m.id).map((x) => (
                                  <option key={x.id} value={x.id}>{x.name}</option>
                                ))}
                              </select>
                              {savedField === `${m.id}-reports_to` && <span className="absolute -top-4 left-0 text-[10px] text-success">Saved ✓</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Edit History */}
            <div className="rounded-lg border border-border bg-card">
              <div className="border-b border-border px-4 py-3 flex items-center gap-2">
                <History size={14} className="text-muted-foreground" />
                <h3 className="text-sm font-bold text-foreground">Edit History</h3>
                <span className="text-[10px] text-muted-foreground ml-auto">{projectAudit.length} entries</span>
              </div>
              <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                {projectAudit.length === 0 && (
                  <p className="px-4 py-6 text-xs text-muted-foreground text-center">No changes recorded yet</p>
                )}
                {[...projectAudit].reverse().map((entry) => {
                  const time = entry.created_at ? new Date(entry.created_at) : null;
                  const changedFields = entry.changed_fields as string[] | null;
                  const oldVals = entry.old_values as Record<string, unknown> | null;
                  const newVals = entry.new_values as Record<string, unknown> | null;

                  let description = "";
                  const actionColor = entry.action === "INSERT" ? "text-success" : entry.action === "DELETE" ? "text-destructive" : "text-warning";
                  const actionLabel = entry.action === "INSERT" ? "Created" : entry.action === "DELETE" ? "Deleted" : "Updated";

                  if (entry.table_name === "milestones") {
                    const msCode = (newVals?.milestone_code || oldVals?.milestone_code || "") as string;
                    if (entry.action === "UPDATE" && changedFields?.length) {
                      description = `Milestone ${msCode}: ${changedFields.map((f) => {
                        const newV = newVals?.[f] ?? "—";
                        return `${f.replace(/_/g, " ")} → ${newV}`;
                      }).join(", ")}`;
                    } else {
                      description = `Milestone ${msCode}`;
                    }
                  } else if (entry.table_name === "project_assignments") {
                    const memberId = (newVals?.team_member_id || oldVals?.team_member_id) as string;
                    const member = members?.find((m) => m.id === memberId);
                    description = `Resource: ${member?.name || "Unknown"}`;
                  } else if (entry.table_name === "projects") {
                    if (entry.action === "UPDATE" && changedFields?.length) {
                      description = changedFields.map((f) => {
                        const newV = newVals?.[f] ?? "—";
                        return `${f.replace(/_/g, " ")} → ${newV}`;
                      }).join(", ");
                    } else {
                      description = "Project details";
                    }
                  }

                  return (
                    <div key={entry.id} className="flex items-start gap-3 border-b border-border last:border-0 px-4 py-2.5">
                      <div className="mt-0.5">
                        <span className={`text-[10px] font-bold uppercase ${actionColor}`}>{actionLabel}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-foreground">{description}</p>
                        <p className="text-[10px] text-muted-foreground">{entry.table_name.replace(/_/g, " ")}</p>
                      </div>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                        {time ? time.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) + " " + time.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "—"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Project Documents */}
            <div className="rounded-lg border border-border bg-card">
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <div className="flex items-center gap-4">
                  <h3 className="text-sm font-bold text-foreground">Project Documents</h3>
                  <div className="flex items-center gap-1 bg-secondary/30 p-1 rounded-lg border border-border">
                    {["all", "Internal", "Sales", "Cadence"].map((f) => (
                      <button
                        key={f}
                        onClick={() => setDocumentFilter(f)}
                        className={`px-2 py-0.5 rounded text-[8px] font-bold transition-all ${documentFilter === f
                          ? "bg-foreground text-background"
                          : "text-muted-foreground hover:bg-secondary"
                          }`}
                      >
                        {f.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 bg-secondary/30 p-1 rounded-lg border border-border mr-2">
                    {(["Internal", "Sales", "Cadence"] as const).map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setUploadCategory(cat)}
                        className={`px-2 py-0.5 text-[8px] font-extrabold rounded transition-all ${uploadCategory === cat
                          ? cat === "Internal" ? "bg-blue-500 text-white" :
                            cat === "Sales" ? "bg-emerald-500 text-white" :
                              "bg-orange-500 text-white"
                          : "text-muted-foreground hover:bg-secondary/50"
                          }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="flex items-center gap-1 rounded-md bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/20 transition-colors disabled:opacity-50"
                  >
                    {isUploading ? <Loader2 size={12} className="animate-spin" /> : <FileUp size={14} />}
                    Upload File
                  </button>
                  <input type="file" ref={fileInputRef} onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f && project) {
                      setIsUploading(true);
                      executeUpload(f, project.id, undefined, uploadCategory)
                        .then(() => toast.success("File uploaded"))
                        .catch(() => toast.error("Upload failed"))
                        .finally(() => {
                          setIsUploading(false);
                          if (fileInputRef.current) fileInputRef.current.value = "";
                        });
                    }
                  }} className="hidden" />
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="border-b border-border text-left text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2 font-medium">Name</th>
                      <th className="px-4 py-2 font-medium text-center">Category</th>
                      <th className="px-4 py-2 font-medium">Type</th>
                      <th className="px-4 py-2 font-medium">Size</th>
                      <th className="px-4 py-2 font-medium">Date</th>
                      <th className="px-4 py-2 font-medium text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {filteredProjDocs.length === 0 && (
                      <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No documents found matching filter</td></tr>
                    )}
                    {filteredProjDocs.map((doc) => (
                      <tr key={doc.id} className="hover:bg-secondary/20 transition-colors">
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-2">
                            <FileText size={14} className="text-primary" />
                            <span className="font-medium text-foreground">{doc.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-2 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[8px] font-extrabold uppercase ${doc.category === "Sales" ? "bg-emerald-100 text-emerald-700" :
                            doc.category === "Cadence" ? "bg-orange-100 text-orange-700" :
                              "bg-blue-100 text-blue-700"
                            }`}>
                            {doc.category || "Internal"}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-muted-foreground">.{doc.type}</td>
                        <td className="px-4 py-2 text-muted-foreground">{(doc.size / 1024 / 1024).toFixed(2)} MB</td>
                        <td className="px-4 py-2 text-muted-foreground">{new Date(doc.created_at).toLocaleDateString()}</td>
                        <td className="px-4 py-2 text-right">
                          <a href={apiUrl(`/api/files/${doc.path}?download=${encodeURIComponent(doc.name)}`)} download={doc.name} className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-secondary hover:text-foreground">
                            <Download size={12} />
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* Add Project Modal */}
        {showAddProject && (
          <ModalOverlay onClose={() => setShowAddProject(false)} title="Add Project">
            <div className="space-y-3">
              <Input label="Client Name" value={newProject.clientName} onChange={(v) => setNewProject({ ...newProject, clientName: v })} />
              <Input label="Project Name" value={newProject.name} onChange={(v) => setNewProject({ ...newProject, name: v })} />
              <Input label="Code" value={newProject.code} onChange={(v) => setNewProject({ ...newProject, code: v })} />
              <Select label="Service Type" value={newProject.serviceType} onChange={(v) => setNewProject({ ...newProject, serviceType: v })} options={["Outcome", "Governance", "AI Solution", "Automation", "Others"]} />
              <Select label="Revenue Model" value={newProject.revenueModel} onChange={(v) => setNewProject({ ...newProject, revenueModel: v })} options={["Milestone", "Monthly", "Fixed"]} />
              <Input label="Delivery Manager" value={newProject.deliveryManager} onChange={(v) => setNewProject({ ...newProject, deliveryManager: v })} />
              <Input label="Client SPOC" value={newProject.clientSpoc} onChange={(v) => setNewProject({ ...newProject, clientSpoc: v })} />
              <Input label="Handled By" value={newProject.handledBy} onChange={(v) => setNewProject({ ...newProject, handledBy: v })} />
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Assign Members</label>
                <div className="max-h-32 overflow-y-auto space-y-1 rounded-md border border-border p-2">
                  {members?.map((m) => (
                    <label key={m.id} className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newProject.memberIds.includes(m.id)}
                        onChange={(e) => setNewProject({
                          ...newProject,
                          memberIds: e.target.checked ? [...newProject.memberIds, m.id] : newProject.memberIds.filter((id) => id !== m.id),
                        })}
                        className="rounded border-border"
                      />
                      {m.name}
                    </label>
                  ))}
                </div>
              </div>
              <button onClick={handleAddProject} className="w-full rounded-lg bg-primary py-2 text-sm font-bold text-primary-foreground hover:opacity-90 transition-opacity">Create Project</button>
            </div>
          </ModalOverlay>
        )}

        {/* Add Milestone Modal */}
        {showAddMilestone && (
          <ModalOverlay onClose={() => setShowAddMilestone(false)} title="Add Milestone">
            <div className="space-y-3">
              <Input label="Milestone Code" value={newMs.code} onChange={(v) => setNewMs({ ...newMs, code: v })} placeholder="M1" />
              <Input label="Description" value={newMs.description} onChange={(v) => setNewMs({ ...newMs, description: v })} />
              <Input label="Planned Start" value={newMs.plannedStart} onChange={(v) => setNewMs({ ...newMs, plannedStart: v })} type="date" />
              <Input label="Planned End" value={newMs.plannedEnd} onChange={(v) => setNewMs({ ...newMs, plannedEnd: v })} type="date" />
              <Input label="Deliverables" value={newMs.deliverables} onChange={(v) => setNewMs({ ...newMs, deliverables: v })} />
              <button onClick={handleAddMilestone} className="w-full rounded-lg bg-primary py-2 text-sm font-bold text-primary-foreground hover:opacity-90 transition-opacity">Add Milestone</button>
            </div>
          </ModalOverlay>
        )}

        {showAddHierarchyMember && (
          <ModalOverlay onClose={() => setShowAddHierarchyMember(false)} title="Add Person to Hierarchy">
            <div className="space-y-3">
              <Input
                label="Name"
                value={newHierarchyMember.name}
                onChange={(v) => setNewHierarchyMember({ ...newHierarchyMember, name: v })}
                placeholder="Member name"
              />
              <Input
                label="Role"
                value={newHierarchyMember.role}
                onChange={(v) => setNewHierarchyMember({ ...newHierarchyMember, role: v })}
                placeholder="Role"
              />
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Reports To</label>
                <select
                  value={newHierarchyMember.reportsTo}
                  onChange={(e) => setNewHierarchyMember({ ...newHierarchyMember, reportsTo: e.target.value })}
                  className="w-full appearance-none rounded-md border border-border bg-secondary px-3 py-1.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">Top Level</option>
                  {assignedMembers.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>
              <Select
                label="Member Type"
                value={newHierarchyMember.memberType}
                onChange={(v) => setNewHierarchyMember({ ...newHierarchyMember, memberType: v })}
                options={["Internal", "Vendor", "Contractor"]}
              />
              <button onClick={handleAddHierarchyMember} className="w-full rounded-lg bg-primary py-2 text-sm font-bold text-primary-foreground hover:opacity-90 transition-opacity">
                Add Person
              </button>
            </div>
          </ModalOverlay>
        )}
      </div>
    </AppLayout >
  );
};

// Shared components
const Input = ({ label, value, onChange, type = "text", placeholder }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) => (
  <div>
    <label className="mb-1 block text-xs font-medium text-muted-foreground">{label}</label>
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-md border border-border bg-secondary px-3 py-1.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary"
    />
  </div>
);

const Select = ({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) => (
  <div>
    <label className="mb-1 block text-xs font-medium text-muted-foreground">{label}</label>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full appearance-none rounded-md border border-border bg-secondary px-3 py-1.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary"
    >
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  </div>
);

const ModalOverlay = ({ onClose, title, children }: { onClose: () => void; title: string; children: React.ReactNode }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80" onClick={onClose}>
    <div className="w-full max-w-md rounded-lg border border-border bg-card p-5 shadow-lg" onClick={(e) => e.stopPropagation()}>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-bold text-foreground">{title}</h3>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={16} /></button>
      </div>
      {children}
    </div>
  </div>
);

const InlineEdit = ({ value, onSave, savedKey, multiline = false, className = "" }: { value: string; onSave: (v: string) => void; savedKey: boolean; multiline?: boolean; className?: string }) => {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(value);
  const timerRef = useRef<number>();

  useEffect(() => {
    setText(value);
  }, [value]);

  const handleBlur = () => {
    setEditing(false);
    if (text !== value) {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => onSave(text), 800);
    }
  };

  if (editing && multiline) {
    return (
      <textarea
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={handleBlur}
        rows={3}
        className="w-full min-w-[240px] rounded-md border border-primary/50 bg-secondary px-2 py-1 text-xs text-foreground outline-none resize-y"
      />
    );
  }

  if (editing) {
    return (
      <input
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={handleBlur}
        className="w-full min-w-[120px] rounded-md border border-primary/50 bg-secondary px-2 py-1 text-xs text-foreground outline-none"
      />
    );
  }

  return (
    <div className="relative">
      <span
        onClick={() => setEditing(true)}
        className={`cursor-pointer text-muted-foreground hover:text-foreground block ${multiline ? "whitespace-normal break-words" : "max-w-[160px] truncate"} ${className}`}
      >
        {value || "—"}
      </span>
      {savedKey && <span className="absolute -top-4 left-0 text-[10px] text-success">Saved ✓</span>}
    </div>
  );
};

const InlineDateEdit = ({ value, onSave, savedKey }: { value: string | null; onSave: (v: string) => void; savedKey: boolean }) => {
  const [editing, setEditing] = useState(false);
  const [date, setDate] = useState(value || "");

  useEffect(() => {
    setDate(value || "");
  }, [value]);

  const handleBlur = () => {
    setEditing(false);
    if ((value || "") !== date) onSave(date);
  };

  if (editing) {
    return (
      <input
        autoFocus
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        onBlur={handleBlur}
        className="w-[118px] rounded-md border border-primary/50 bg-secondary px-2 py-1 text-xs text-foreground outline-none"
      />
    );
  }

  return (
    <div className="relative w-[118px]">
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="w-full text-left text-xs text-muted-foreground hover:text-foreground"
      >
        {formatDateReadable(value)}
      </button>
      {savedKey && <span className="absolute -top-4 left-0 text-[10px] text-success">Saved ✓</span>}
    </div>
  );
};

const InlinePercentEdit = ({ value, onSave, savedKey }: { value: number | null; onSave: (v: number) => void; savedKey: boolean }) => {
  const [draft, setDraft] = useState(String(clampProgress(value)));

  useEffect(() => {
    setDraft(String(clampProgress(value)));
  }, [value]);

  const commit = () => {
    const next = clampProgress(draft);
    const prev = clampProgress(value);
    setDraft(String(next));
    if (next !== prev) onSave(next);
  };

  return (
    <div className="relative flex items-center gap-1">
      <input
        type="number"
        min={0}
        max={100}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur();
        }}
        className="w-10 rounded bg-transparent text-xs text-muted-foreground outline-none text-right"
      />
      <span className="text-muted-foreground text-xs">%</span>
      {savedKey && <span className="absolute -top-4 left-0 text-[10px] text-success">Saved ✓</span>}
    </div>
  );
};

const EditableSelect = ({ value, options, onSave }: { value: string; options: string[]; onSave: (v: string) => void }) => (
  <select
    value={value}
    onChange={(e) => onSave(e.target.value)}
    className="appearance-none rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-secondary-foreground outline-none cursor-pointer hover:bg-muted transition-colors"
  >
    {options.map((o) => <option key={o} value={o}>{o}</option>)}
  </select>
);

export default Projects;

