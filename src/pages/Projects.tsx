import { useState, useCallback, useEffect, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";
import Topbar from "@/components/layout/Topbar";
import { useClients, useProjects, useMilestones, useTeamMembers, useAssignments } from "@/hooks/useData";
import { supabase } from "@/integrations/supabase/client";
import { writeAuditLog } from "@/lib/audit";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, X, Check, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

const Projects = ({ themeToggle }: { themeToggle?: { dark: boolean; toggle: () => void } }) => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: clients } = useClients();
  const { data: projects } = useProjects();
  const { data: milestones } = useMilestones();
  const { data: members } = useTeamMembers();
  const { data: assignments } = useAssignments();

  const selectedId = searchParams.get("id") || projects?.[0]?.id || "";
  const project = projects?.find((p) => p.id === selectedId);
  const client = clients?.find((c) => c.id === project?.client_id);
  const projMilestones = milestones?.filter((m) => m.project_id === selectedId) || [];
  const projAssignments = assignments?.filter((a) => a.project_id === selectedId) || [];
  const assignedMembers = members?.filter((m) => projAssignments.some((a) => a.team_member_id === m.id)) || [];
  const unassignedMembers = members?.filter((m) => !projAssignments.some((a) => a.team_member_id === m.id)) || [];

  const [showAddProject, setShowAddProject] = useState(false);
  const [showAddMilestone, setShowAddMilestone] = useState(false);
  const [showAssignMember, setShowAssignMember] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [savedField, setSavedField] = useState<string | null>(null);
  const saveTimerRef = useRef<number>();

  // Realtime subscription
  useEffect(() => {
    const channel = supabase.channel("projects-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "projects" }, () => qc.invalidateQueries({ queryKey: ["projects"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "milestones" }, () => qc.invalidateQueries({ queryKey: ["milestones"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "project_assignments" }, () => qc.invalidateQueries({ queryKey: ["project_assignments"] }))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [qc]);

  const showSaved = (fieldId: string) => {
    setSavedField(fieldId);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => setSavedField(null), 2000);
  };

  const updateMilestone = useCallback(async (id: string, field: string, value: unknown, oldVal: unknown) => {
    const { error } = await supabase.from("milestones").update({ [field]: value } as any).eq("id", id);
    if (error) { toast.error("Failed to update"); return; }
    await writeAuditLog("milestones", id, "UPDATE", { [field]: oldVal }, { [field]: value }, [field]);
    qc.invalidateQueries({ queryKey: ["milestones"] });
    toast.success(`✓ Updated ${field} · ${new Date().toLocaleTimeString()}`);
    showSaved(`${id}-${field}`);
  }, [qc]);

  // Add project form
  const [newProject, setNewProject] = useState({ clientName: "", name: "", code: "", serviceType: "Outcome", revenueModel: "Milestone", deliveryManager: "", clientSpoc: "", handledBy: "", memberIds: [] as string[] });

  const handleAddProject = async () => {
    let clientId: string;
    const existing = clients?.find((c) => c.name.toLowerCase() === newProject.clientName.toLowerCase());
    if (existing) { clientId = existing.id; }
    else {
      const { data, error } = await supabase.from("clients").insert({ name: newProject.clientName }).select().single();
      if (error) { toast.error("Failed to create client"); return; }
      clientId = data.id;
      qc.invalidateQueries({ queryKey: ["clients"] });
    }
    const { data: proj, error } = await supabase.from("projects").insert({
      client_id: clientId, name: newProject.name, code: newProject.code || null,
      service_type: newProject.serviceType, revenue_model: newProject.revenueModel,
      delivery_manager: newProject.deliveryManager || null, client_spoc: newProject.clientSpoc || null,
      handled_by: newProject.handledBy || null,
    }).select().single();
    if (error) { toast.error("Failed to create project"); return; }
    await writeAuditLog("projects", proj.id, "INSERT", null, proj);
    for (const mId of newProject.memberIds) {
      const { data: a } = await supabase.from("project_assignments").insert({ project_id: proj.id, team_member_id: mId }).select().single();
      if (a) await writeAuditLog("project_assignments", a.id, "INSERT", null, a);
    }
    qc.invalidateQueries({ queryKey: ["projects", "project_assignments"] });
    toast.success(`✓ Project created · ${new Date().toLocaleTimeString()}`);
    setShowAddProject(false);
    navigate(`/projects?id=${proj.id}`);
  };

  const [newMs, setNewMs] = useState({ code: "", description: "", plannedStart: "", plannedEnd: "", deliverables: "" });
  const handleAddMilestone = async () => {
    const { data, error } = await supabase.from("milestones").insert({
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
    const { data, error } = await supabase.from("project_assignments").insert({ project_id: selectedId, team_member_id: memberId }).select().single();
    if (error) { toast.error("Failed to assign"); return; }
    await writeAuditLog("project_assignments", data.id, "INSERT", null, data);
    qc.invalidateQueries({ queryKey: ["project_assignments"] });
    toast.success(`✓ Member assigned · ${new Date().toLocaleTimeString()}`);
    setShowAssignMember(false);
  };

  const handleRemoveMember = async (memberId: string) => {
    const assignment = assignments?.find((a) => a.project_id === selectedId && a.team_member_id === memberId);
    if (!assignment) return;
    const { error } = await supabase.from("project_assignments").delete().eq("id", assignment.id);
    if (error) { toast.error("Failed to remove"); return; }
    await writeAuditLog("project_assignments", assignment.id, "DELETE", assignment, null);
    qc.invalidateQueries({ queryKey: ["project_assignments"] });
    toast.success(`✓ Member removed · ${new Date().toLocaleTimeString()}`);
    setConfirmRemove(null);
  };

  const doneMilestones = projMilestones.filter((m) => m.completion_pct === 100).length;

  return (
    <AppLayout>
      <Topbar title="Projects" themeToggle={themeToggle} />
      <div className="p-6 space-y-5 animate-fade-in">
        {/* Project Selector */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          {projects?.map((p) => {
            const cl = clients?.find((c) => c.id === p.client_id);
            return (
              <button
                key={p.id}
                onClick={() => navigate(`/projects?id=${p.id}`)}
                className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  p.id === selectedId
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
              <div>
                <h2 className="text-lg font-bold text-foreground">{client?.name} · {project.name}</h2>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {[project.service_type, project.revenue_model, project.handled_by].filter(Boolean).map((c) => (
                    <span key={c} className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-secondary-foreground">{c}</span>
                  ))}
                </div>
                <div className="mt-2 text-xs text-muted-foreground space-x-4">
                  {project.delivery_manager && <span>Manager: {project.delivery_manager}</span>}
                  {project.client_spoc && <span>SPOC: {project.client_spoc}</span>}
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
                    <p className="text-[10px] text-muted-foreground font-medium">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Milestone Tracker */}
            <div className="rounded-lg border border-border bg-card">
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <h3 className="text-sm font-bold text-foreground">Milestone Tracker</h3>
                <button onClick={() => setShowAddMilestone(true)} className="flex items-center gap-1 rounded-md bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/20 transition-colors">
                  <Plus size={14} /> Add Milestone
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border text-left text-muted-foreground">
                      {["ID", "Description", "Planned", "Actual/ETA", "Progress", "Status", "Blocker", "Invoice", "Remarks"].map((h) => (
                        <th key={h} className="px-3 py-2 font-medium whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {projMilestones.length === 0 && (
                      <tr><td colSpan={9} className="px-3 py-8 text-center text-muted-foreground">No milestones yet</td></tr>
                    )}
                    {projMilestones.map((m) => (
                      <tr key={m.id} className="border-b border-border last:border-0">
                        <td className="px-3 py-2 font-medium text-foreground">{m.milestone_code}</td>
                        <td className="px-3 py-2 text-foreground max-w-[200px] truncate">{m.description}</td>
                        <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{m.planned_start || "—"} → {m.planned_end || "TBD"}</td>
                        <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{m.actual_start || "—"} → {m.actual_end_eta || "—"}</td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-16 rounded-full bg-secondary">
                              <div className={`h-full rounded-full ${m.milestone_flag === "red" ? "bg-destructive" : m.milestone_flag === "amber" ? "bg-warning" : "bg-success"}`} style={{ width: `${m.completion_pct}%` }} />
                            </div>
                            <span className="text-muted-foreground">{m.completion_pct}%</span>
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
                        <td className="px-3 py-2">
                          <InlineEdit
                            value={m.remarks || ""}
                            onSave={(val) => updateMilestone(m.id, "remarks", val, m.remarks)}
                            savedKey={savedField === `${m.id}-remarks`}
                          />
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
      </div>
    </AppLayout>
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

const InlineEdit = ({ value, onSave, savedKey }: { value: string; onSave: (v: string) => void; savedKey: boolean }) => {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(value);
  const timerRef = useRef<number>();

  const handleBlur = () => {
    setEditing(false);
    if (text !== value) {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => onSave(text), 800);
    }
  };

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
      <span onClick={() => setEditing(true)} className="cursor-pointer text-muted-foreground hover:text-foreground max-w-[160px] block truncate">{value || "—"}</span>
      {savedKey && <span className="absolute -top-4 left-0 text-[10px] text-success">Saved ✓</span>}
    </div>
  );
};

export default Projects;
