import { useState, useEffect } from "react";
import AppLayout from "@/components/layout/AppLayout";
import Topbar from "@/components/layout/Topbar";
import FilterSelect from "@/components/common/FilterSelect";
import { useProjects, useTeamMembers, useAssignments, useClients } from "@/hooks/useData";
import { api } from "@/lib/api";
import { writeAuditLog } from "@/lib/audit";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, X, Check, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

const Resources = () => {
  const qc = useQueryClient();
  const { data: members } = useTeamMembers();
  const { data: projects } = useProjects();
  const { data: assignments } = useAssignments();
  const { data: clients } = useClients();
  const [showAddMember, setShowAddMember] = useState(false);
  const [editMember, setEditMember] = useState<string | null>(null);
  const [confirmToggle, setConfirmToggle] = useState<{ memberId: string; projectId: string } | null>(null);
  const [confirmDeleteMember, setConfirmDeleteMember] = useState<string | null>(null);
  const [memberSearch, setMemberSearch] = useState("");
  const [memberRoleFilter, setMemberRoleFilter] = useState("all");
  const [projectFilter, setProjectFilter] = useState("all");

  const filteredMembers = (members || []).filter((m) => {
    const bySearch = !memberSearch.trim() || m.name.toLowerCase().includes(memberSearch.toLowerCase().trim());
    const byRole = memberRoleFilter === "all" || (m.role || "") === memberRoleFilter;
    const byProject = projectFilter === "all" || (assignments || []).some((a) => a.team_member_id === m.id && a.project_id === projectFilter);
    return bySearch && byRole && byProject;
  });

  const filteredProjects = projectFilter === "all" ? (projects || []) : (projects || []).filter((p) => p.id === projectFilter);

  useEffect(() => {
    const channel = api.channel("resources-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "team_members" }, () => qc.invalidateQueries({ queryKey: ["team_members"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "project_assignments" }, () => qc.invalidateQueries({ queryKey: ["project_assignments"] }))
      .subscribe();
    return () => { api.removeChannel(channel); };
  }, [qc]);

  const getProjectsForMember = (memberId: string) =>
    assignments?.filter((a) => a.team_member_id === memberId).map((a) => {
      const p = projects?.find((pr) => pr.id === a.project_id);
      return p?.name || "";
    }).filter(Boolean) || [];

  const engagementColor = (pct: number) => {
    if (pct > 80) return "bg-success";
    if (pct >= 50) return "bg-warning";
    return "bg-destructive";
  };

  const [newMember, setNewMember] = useState({ name: "", role: "", reportsTo: "", memberType: "Full-time", engagementPct: 50, projectIds: [] as string[] });

  const handleAddMember = async () => {
    const initials = newMember.name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
    const colors = ["#3CBFB0", "#60A5FA", "#C084FC", "#F59E0B", "#22C55E", "#FB923C", "#E8253A", "#F472B6"];
    const color = colors[Math.floor(Math.random() * colors.length)];
    const { data, error } = await api.from("team_members").insert({
      name: newMember.name, role: newMember.role, reports_to: newMember.reportsTo || null,
      member_type: newMember.memberType, engagement_pct: newMember.engagementPct,
      initials, color_hex: color,
    }).select().single();
    if (error) { toast.error("Failed to add member"); return; }
    await writeAuditLog("team_members", data.id, "INSERT", null, data);
    for (const pId of newMember.projectIds) {
      const { data: a } = await api.from("project_assignments").insert({ project_id: pId, team_member_id: data.id }).select().single();
      if (a) await writeAuditLog("project_assignments", a.id, "INSERT", null, a);
    }
    qc.invalidateQueries({ queryKey: ["team_members"] });
    qc.invalidateQueries({ queryKey: ["project_assignments"] });
    toast.success(`✓ Member added · ${new Date().toLocaleTimeString()}`);
    setShowAddMember(false);
    setNewMember({ name: "", role: "", reportsTo: "", memberType: "Full-time", engagementPct: 50, projectIds: [] });
  };

  const handleToggleAssignment = async (memberId: string, projectId: string) => {
    const existing = assignments?.find((a) => a.team_member_id === memberId && a.project_id === projectId);
    if (existing) {
      const { error } = await api.from("project_assignments").delete().eq("id", existing.id);
      if (error) { toast.error("Failed"); return; }
      await writeAuditLog("project_assignments", existing.id, "DELETE", existing, null);
      toast.success(`✓ Unassigned · ${new Date().toLocaleTimeString()}`);
    } else {
      const { data, error } = await api.from("project_assignments").insert({ project_id: projectId, team_member_id: memberId }).select().single();
      if (error) { toast.error("Failed"); return; }
      await writeAuditLog("project_assignments", data.id, "INSERT", null, data);
      toast.success(`✓ Assigned · ${new Date().toLocaleTimeString()}`);
    }
    qc.invalidateQueries({ queryKey: ["project_assignments"] });
    setConfirmToggle(null);
  };

  const handleDeleteMember = async (memberId: string) => {
    const member = members?.find((m) => m.id === memberId);
    if (!member) return;

    const memberAssignments = assignments?.filter((a) => a.team_member_id === memberId) || [];
    for (const a of memberAssignments) {
      const { error } = await api.from("project_assignments").delete().eq("id", a.id);
      if (error) {
        toast.error("Failed to delete assignments for member");
        return;
      }
      await writeAuditLog("project_assignments", a.id, "DELETE", a, null);
    }

    const { error } = await api.from("team_members").delete().eq("id", memberId);
    if (error) {
      toast.error("Failed to delete member");
      return;
    }
    await writeAuditLog("team_members", memberId, "DELETE", member as any, null);

    qc.invalidateQueries({ queryKey: ["team_members"] });
    qc.invalidateQueries({ queryKey: ["project_assignments"] });
    toast.success(`✓ Member deleted · ${new Date().toLocaleTimeString()}`);
    setConfirmDeleteMember(null);
    if (editMember === memberId) {
      setEditMember(null);
    }
  };

  // Effort data
  const effortData = filteredMembers.map((m) => {
    const totalHours = assignments?.filter((a) => a.team_member_id === m.id).reduce((s, a) => s + (a.allocated_hours_per_week || 8), 0) || 0;
    return { name: m.name, hours: totalHours, color: m.color_hex || "#666" };
  }).filter((d) => d.hours > 0) || [];

  // Gantt months
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  return (
    <AppLayout>
      <Topbar title="Resource Allocation" />
      <div className="p-6 space-y-5 animate-fade-in">
        <div className="grid grid-cols-3 gap-4 rounded-lg border border-slate-700 bg-gradient-to-b from-slate-900/50 to-slate-800/30 p-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wide">
              Search
            </label>
            <input
              value={memberSearch}
              onChange={(e) => setMemberSearch(e.target.value)}
              placeholder="Search Member Name"
              className="w-full rounded-lg border border-slate-700 bg-gradient-to-b from-slate-800 to-slate-900 px-4 py-2.5 text-sm text-white font-medium placeholder-slate-500 transition-all duration-200 hover:border-blue-500/50 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
          </div>
          <FilterSelect
            value={memberRoleFilter}
            onChange={setMemberRoleFilter}
            label="Role"
            placeholder="All Roles"
            options={[
              { label: "All Roles", value: "all" },
              ...Array.from(new Set((members || []).map((m) => m.role).filter(Boolean))).map((role) => ({
                label: role || "Unassigned",
                value: role || "unassigned"
              }))
            ]}
          />
          <FilterSelect
            value={projectFilter}
            onChange={setProjectFilter}
            label="Project"
            placeholder="All Projects"
            options={[
              { label: "All Projects", value: "all" },
              ...((projects || []).map((p) => ({ label: p.name, value: p.id })))
            ]}
          />
        </div>

        {/* Team Overview */}
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-bold text-foreground">Team Overview</h3>
          <button onClick={() => setShowAddMember(true)} className="flex items-center gap-1 rounded-md bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/20 transition-colors">
            <Plus size={14} /> Add Team Member
          </button>
        </div>
        <div className="grid grid-cols-4 gap-3">
          {filteredMembers.map((m) => {
            const memberProjects = getProjectsForMember(m.id);
            return (
              <div key={m.id} onClick={() => setEditMember(m.id)} className="cursor-pointer rounded-lg border border-border bg-card p-4 hover:border-primary/30 transition-colors">
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold" style={{ backgroundColor: m.color_hex || "#666", color: "#fff" }}>
                    {m.initials}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-foreground">{m.name}</p>
                    <p className="text-[10px] text-muted-foreground">{m.role}</p>
                  </div>
                </div>
                <div className="mb-2">
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                    <span>Engagement</span>
                    <span className="font-bold text-foreground">{m.engagement_pct}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-secondary">
                    <div className={`h-full rounded-full ${engagementColor(m.engagement_pct || 0)}`} style={{ width: `${m.engagement_pct}%` }} />
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {memberProjects.map((p) => (
                    <span key={p} className="rounded-full bg-secondary px-1.5 py-0.5 text-[9px] text-muted-foreground">{p}</span>
                  ))}
                </div>
                <div className="mt-2 flex justify-end" onClick={(e) => e.stopPropagation()}>
                  {confirmDeleteMember === m.id ? (
                    <div className="flex items-center gap-1 text-[10px]">
                      <span className="text-destructive">Delete?</span>
                      <button onClick={() => handleDeleteMember(m.id)} className="text-destructive hover:text-destructive/80"><Check size={14} /></button>
                      <button onClick={() => setConfirmDeleteMember(null)} className="text-muted-foreground hover:text-foreground"><X size={14} /></button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmDeleteMember(m.id)} className="rounded-md p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" title="Delete Member">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Allocation Matrix */}
        <div className="rounded-lg border border-slate-700 bg-gradient-to-b from-slate-900 to-slate-800/50 shadow-lg overflow-hidden">
          <div className="border-b border-slate-700 px-6 py-4 bg-gradient-to-r from-blue-600/10 to-blue-500/5">
            <h3 className="text-lg font-bold text-white">Work Allocation Matrix</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 bg-gradient-to-r from-slate-800 to-slate-900 text-left">
                  <th className="px-6 py-4 font-bold text-white sticky left-0 bg-gradient-to-r from-slate-800 to-slate-900 z-10 min-w-[200px]">Member</th>
                  {projects?.map((p) => (
                    <th key={p.id} className="px-4 py-4 text-center font-bold text-white whitespace-nowrap tracking-wide uppercase text-xs">
                      <span className="block truncate">{p.name}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredMembers.map((m, idx) => {
                  const isEvenRow = idx % 2 === 0;
                  return (
                    <tr key={m.id} className={`border-b border-slate-700/50 ${isEvenRow ? "bg-slate-800/20" : "bg-transparent"} hover:bg-blue-600/15 last:border-0 transition-all duration-200`}>
                      <td className="px-6 py-4 text-white font-bold sticky left-0 z-10 min-w-[200px] bg-gradient-to-r from-slate-900 to-transparent">{m.name}</td>
                      {filteredProjects.map((p) => {
                        const isAssigned = assignments?.some((a) => a.team_member_id === m.id && a.project_id === p.id);
                        const isConfirming = confirmToggle?.memberId === m.id && confirmToggle?.projectId === p.id;
                        return (
                          <td key={p.id} className="px-4 py-4 text-center">
                            {isConfirming ? (
                              <div className="flex items-center justify-center gap-1">
                                <button onClick={() => handleToggleAssignment(m.id, p.id)} className="text-emerald-400 hover:text-emerald-300"><Check size={16} /></button>
                                <button onClick={() => setConfirmToggle(null)} className="text-slate-500 hover:text-slate-300"><X size={16} /></button>
                              </div>
                            ) : (
                              <button
                                onClick={() => isAssigned ? setConfirmToggle({ memberId: m.id, projectId: p.id }) : handleToggleAssignment(m.id, p.id)}
                                className={`h-6 w-6 rounded-full mx-auto flex items-center justify-center transition-all duration-200 ${isAssigned ? "bg-blue-500 hover:bg-blue-600 shadow-lg shadow-blue-500/50" : "bg-slate-700 hover:bg-slate-600"}`}
                              >
                                {isAssigned && <Check size={14} className="text-white font-bold" />}
                              </button>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Effort Chart */}
        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="mb-3 text-sm font-bold text-foreground">Effort Tracking (Est. Hours/Week)</h3>
          <ResponsiveContainer width="100%" height={Math.max(200, effortData.length * 32)}>
            <BarChart data={effortData} layout="vertical" margin={{ left: 8, right: 16 }}>
              <XAxis type="number" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} width={120} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11, color: "hsl(var(--foreground))" }} />
              <Bar dataKey="hours" radius={[0, 4, 4, 0]}>
                {effortData.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Gantt Timeline */}
        <div className="rounded-lg border border-slate-700 bg-gradient-to-b from-slate-900 to-slate-800/50 shadow-lg overflow-hidden">
          <div className="border-b border-slate-700 px-6 py-4 bg-gradient-to-r from-blue-600/10 to-blue-500/5">
            <h3 className="text-lg font-bold text-white">Work Allocation Timeline (2026)</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 bg-gradient-to-r from-slate-800 to-slate-900 text-left">
                  <th className="px-6 py-4 font-bold text-white sticky left-0 bg-gradient-to-r from-slate-800 to-slate-900 z-10 min-w-[200px]">Member</th>
                  {months.map((m) => <th key={m} className="px-4 py-4 text-center font-bold text-white min-w-[80px] tracking-wide uppercase text-xs">{m}</th>)}
                </tr>
              </thead>
              <tbody>
                {filteredMembers.map((m, idx) => {
                  const memberAssigns = assignments?.filter((a) => a.team_member_id === m.id) || [];
                  const isEvenRow = idx % 2 === 0;
                  return (
                    <tr key={m.id} className={`border-b border-slate-700/50 ${isEvenRow ? "bg-slate-800/20" : "bg-transparent"} hover:bg-blue-600/15 last:border-0 transition-all duration-200`}>
                      <td className="px-6 py-4 text-white font-bold sticky left-0 z-10 min-w-[200px] bg-gradient-to-r from-slate-900 to-transparent">{m.name}</td>
                      {months.map((_, mi) => {
                        const activeProject = memberAssigns.find((a) => {
                          if (!a.start_date && !a.end_date) return true; // always active if no dates
                          const start = a.start_date ? new Date(a.start_date).getMonth() : 0;
                          const end = a.end_date ? new Date(a.end_date).getMonth() : 11;
                          return mi >= start && mi <= end;
                        });
                        if (!activeProject) return <td key={mi} className="px-4 py-4" />;
                        const proj = filteredProjects.find((p) => p.id === activeProject.project_id) || projects?.find((p) => p.id === activeProject.project_id);
                        return (
                          <td key={mi} className="px-4 py-4">
                            <div className="rounded-lg px-3 py-2 text-xs font-bold text-center" style={{ backgroundColor: m.color_hex ? `${m.color_hex}40` : "#66666640", color: m.color_hex || "#888", border: `1px solid ${m.color_hex || "#888"}40` }}>
                              {proj?.name?.slice(0, 8)}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Add Member Modal */}
        {showAddMember && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80" onClick={() => setShowAddMember(false)}>
            <div className="w-full max-w-md rounded-lg border border-border bg-card p-5 shadow-lg" onClick={(e) => e.stopPropagation()}>
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-bold text-foreground">Add Team Member</h3>
                <button onClick={() => setShowAddMember(false)} className="text-muted-foreground hover:text-foreground"><X size={16} /></button>
              </div>
              <div className="space-y-3">
                <FormInput label="Full Name" value={newMember.name} onChange={(v) => setNewMember({ ...newMember, name: v })} />
                <FormInput label="Role" value={newMember.role} onChange={(v) => setNewMember({ ...newMember, role: v })} />
                <FormInput label="Reports To" value={newMember.reportsTo} onChange={(v) => setNewMember({ ...newMember, reportsTo: v })} />
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Member Type</label>
                  <select value={newMember.memberType} onChange={(e) => setNewMember({ ...newMember, memberType: e.target.value })} className="w-full appearance-none rounded-md border border-border bg-secondary px-3 py-1.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary">
                    {["Full-time", "Consultant", "Intern", "Trainee"].map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Engagement % ({newMember.engagementPct}%)</label>
                  <input type="range" min={0} max={100} value={newMember.engagementPct} onChange={(e) => setNewMember({ ...newMember, engagementPct: Number(e.target.value) })} className="w-full accent-primary" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Assign to Projects</label>
                  <div className="max-h-32 overflow-y-auto space-y-1 rounded-md border border-border p-2">
                    {projects?.map((p) => (
                      <label key={p.id} className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
                        <input type="checkbox" checked={newMember.projectIds.includes(p.id)} onChange={(e) => setNewMember({
                          ...newMember,
                          projectIds: e.target.checked ? [...newMember.projectIds, p.id] : newMember.projectIds.filter((id) => id !== p.id),
                        })} className="rounded border-border" />
                        {p.name}
                      </label>
                    ))}
                  </div>
                </div>
                <button onClick={handleAddMember} className="w-full rounded-lg bg-primary py-2 text-sm font-bold text-primary-foreground hover:opacity-90 transition-opacity">Add Member</button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Member Drawer */}
        {editMember && (() => {
          const m = members?.find((mem) => mem.id === editMember);
          if (!m) return null;
          return (
            <EditMemberDrawer member={m} onClose={() => setEditMember(null)} qc={qc} />
          );
        })()}
      </div>
    </AppLayout>
  );
};

const FormInput = ({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) => (
  <div>
    <label className="mb-1 block text-xs font-medium text-muted-foreground">{label}</label>
    <input value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-md border border-border bg-secondary px-3 py-1.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary" />
  </div>
);

const EditMemberDrawer = ({ member, onClose, qc }: { member: any; onClose: () => void; qc: any }) => {
  const [form, setForm] = useState({ name: member.name, role: member.role, reportsTo: member.reports_to || "", memberType: member.member_type || "Full-time", engagementPct: member.engagement_pct || 50 });

  const handleSave = async () => {
    const oldValues = { name: member.name, role: member.role, reports_to: member.reports_to, member_type: member.member_type, engagement_pct: member.engagement_pct };
    const newValues = { name: form.name, role: form.role, reports_to: form.reportsTo || null, member_type: form.memberType, engagement_pct: form.engagementPct };
    const { error } = await api.from("team_members").update(newValues).eq("id", member.id);
    if (error) { toast.error("Failed to update"); return; }
    await writeAuditLog("team_members", member.id, "UPDATE", oldValues, newValues);
    qc.invalidateQueries({ queryKey: ["team_members"] });
    toast.success(`✓ Updated · ${new Date().toLocaleTimeString()}`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80" onClick={onClose}>
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-5 shadow-lg" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-bold text-foreground">Edit Member</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={16} /></button>
        </div>
        <div className="space-y-3">
          <FormInput label="Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
          <FormInput label="Role" value={form.role} onChange={(v) => setForm({ ...form, role: v })} />
          <FormInput label="Reports To" value={form.reportsTo} onChange={(v) => setForm({ ...form, reportsTo: v })} />
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Member Type</label>
            <select value={form.memberType} onChange={(e) => setForm({ ...form, memberType: e.target.value })} className="w-full appearance-none rounded-md border border-border bg-secondary px-3 py-1.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary">
              {["Full-time", "Consultant", "Intern", "Trainee"].map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Engagement % ({form.engagementPct}%)</label>
            <input type="range" min={0} max={100} value={form.engagementPct} onChange={(e) => setForm({ ...form, engagementPct: Number(e.target.value) })} className="w-full accent-primary" />
          </div>
          <button onClick={handleSave} className="w-full rounded-lg bg-primary py-2 text-sm font-bold text-primary-foreground hover:opacity-90 transition-opacity">Save Changes</button>
        </div>
      </div>
    </div>
  );
};

export default Resources;
