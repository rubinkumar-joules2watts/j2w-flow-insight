import { useState, useEffect } from "react";
import AppLayout from "@/components/layout/AppLayout";
import Topbar from "@/components/layout/Topbar";
import FilterSelect from "@/components/common/FilterSelect";
import { FormInput, FormSelect, FormRange, FormCheckboxGroup, FormModal, FormActions, FormSection } from "@/components/common/FormComponents";
import { useProjects, useTeamMembers, useAssignments, useClients, TeamMember } from "@/hooks/useData";
import { api } from "@/lib/api";
import { writeAuditLog } from "@/lib/audit";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, X, Trash2, Check } from "lucide-react";
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

  // Group members by name to consolidate personas
  const groupedMembers = (members || []).reduce((acc, m) => {
    const name = (m.name || "").trim();
    if (!name) return acc;
    if (!acc[name]) acc[name] = [];
    acc[name].push(m);
    return acc;
  }, {} as Record<string, TeamMember[]>);

  const uniqueNames = Object.keys(groupedMembers).sort();

  const filteredNames = uniqueNames.filter((name) => {
    const group = groupedMembers[name];
    const bySearch = !memberSearch.trim() || name.toLowerCase().includes(memberSearch.toLowerCase().trim());
    if (!bySearch) return false;

    const byRole = memberRoleFilter === "all" || group.some((m) => (m.role || "") === memberRoleFilter);
    if (!byRole) return false;

    const byProject = projectFilter === "all" || group.some((m) => (assignments || []).some((a) => a.team_member_id === m.id && a.project_id === projectFilter));
    if (!byProject) return false;

    return true;
  });

  const filteredProjects = projectFilter === "all" ? (projects || []) : (projects || []).filter((p) => p.id === projectFilter);

  useEffect(() => {
    const channel = api.channel("resources-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "team_members" }, () => qc.invalidateQueries({ queryKey: ["team_members"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "project_assignments" }, () => qc.invalidateQueries({ queryKey: ["project_assignments"] }))
      .subscribe();
    return () => { api.removeChannel(channel); };
  }, [qc]);

  const getProjectsForGroup = (group: TeamMember[]) => {
    const results: { projectName: string; role: string }[] = [];
    const memberIds = group.map(m => m.id);

    assignments?.filter((a) => memberIds.includes(a.team_member_id || "")).forEach((a) => {
      const p = projects?.find((pr) => pr.id === a.project_id);
      if (p) {
        results.push({
          projectName: p.name,
          role: a.role_on_project || group.find(m => m.id === a.team_member_id)?.role || "Resource"
        });
      }
    });
    return results;
  };

  const engagementColor = (pct: number) => {
    if (pct > 80) return "bg-success";
    if (pct >= 50) return "bg-warning";
    return "bg-destructive";
  };

  const [newMember, setNewMember] = useState({ name: "", role: "", reportsTo: "", memberType: "Full-time", resourceType: "Internal", vendor: "", engagementPct: 50, projectIds: [] as string[] });

  const handleAddMember = async () => {
    const initials = newMember.name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
    const colors = ["#3CBFB0", "#60A5FA", "#C084FC", "#F59E0B", "#22C55E", "#FB923C", "#E8253A", "#F472B6"];
    const color = colors[Math.floor(Math.random() * colors.length)];
    const { data, error } = await api.from("team_members").insert({
      name: newMember.name, role: newMember.role, reports_to: newMember.reportsTo || null,
      member_type: newMember.memberType, resource_type: newMember.resourceType || "Internal",
      vendor: newMember.resourceType === "Consultant - External" ? newMember.vendor : null,
      engagement_pct: newMember.engagementPct,
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
    setNewMember({ name: "", role: "", reportsTo: "", memberType: "Full-time", resourceType: "Internal", vendor: "", engagementPct: 50, projectIds: [] });
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

  const handleDeleteGroup = async (name: string) => {
    const group = groupedMembers[name];
    if (!group) return;

    for (const member of group) {
      const memberAssignments = assignments?.filter((a) => a.team_member_id === member.id) || [];
      for (const a of memberAssignments) {
        const { error } = await api.from("project_assignments").delete().eq("id", a.id);
        if (error) {
          toast.error(`Failed to delete assignments for ${member.name}`);
          return;
        }
        await writeAuditLog("project_assignments", a.id, "DELETE", a, null);
      }

      const { error } = await api.from("team_members").delete().eq("id", member.id);
      if (error) {
        toast.error(`Failed to delete member record for ${member.name}`);
        return;
      }
      await writeAuditLog("team_members", member.id, "DELETE", member as any, null);
    }

    qc.invalidateQueries({ queryKey: ["team_members"] });
    qc.invalidateQueries({ queryKey: ["project_assignments"] });
    toast.success(`✓ Consolidated profile for ${name} deleted · ${new Date().toLocaleTimeString()}`);
    setConfirmDeleteMember(null);
    if (editMember && members?.find(m => m.id === editMember)?.name === name) {
      setEditMember(null);
    }
  };

  // Effort data - based on grouped names
  const effortData = filteredNames.map((name) => {
    const group = groupedMembers[name];
    const memberIds = group.map(m => m.id);
    const totalHours = assignments?.filter((a) => memberIds.includes(a.team_member_id || "")).reduce((s, a) => s + (a.allocated_hours_per_week || 8), 0) || 0;
    return { name: name, hours: totalHours, color: group[0].color_hex || "#666" };
  }).filter((d) => d.hours > 0) || [];

  // Gantt months
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  return (
    <AppLayout>
      <Topbar title="Resource Allocation" />
      <div className="p-6 space-y-5 animate-fade-in">
        <div className="grid grid-cols-3 gap-4 rounded-lg border border-gray-300 bg-gradient-to-b from-gray-50 to-gray-100 p-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
              Search
            </label>
            <input
              value={memberSearch}
              onChange={(e) => setMemberSearch(e.target.value)}
              placeholder="Search Member Name"
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 font-medium placeholder-gray-400 transition-all duration-200 hover:border-blue-500/50 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
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

        {/* Team Overview - Dashboard Style */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-gray-900">Team Overview</h3>
          <button onClick={() => setShowAddMember(true)} className="flex items-center gap-1 rounded-lg bg-blue-500/20 border border-blue-500/40 px-3 py-2 text-xs font-bold text-blue-400 hover:bg-blue-500/30 hover:border-blue-400 transition-all">
            <Plus size={14} /> Add Member
          </button>
        </div>
        <div className="grid grid-cols-4 gap-3">
          {filteredNames.map((name) => {
            const group = groupedMembers[name];
            const primaryMember = group[0];
            const memberProjects = getProjectsForGroup(group);
            return (
              <div key={name} onClick={() => setEditMember(primaryMember.id)} className="group cursor-pointer rounded-2xl border border-gray-300 bg-white shadow-sm hover:border-blue-500/50 hover:shadow-xl transition-all duration-300 flex flex-col overflow-hidden">
                {/* Card Header: Initials + Name */}
                <div className="flex items-center gap-3 p-4 bg-gray-100/50 border-b border-gray-200">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white shadow-md border-2 border-white" style={{
                    backgroundColor: primaryMember.resource_type === 'Consultant - External' ? '#6366F1' : primaryMember.resource_type === 'Consultant - Internal' ? '#F59E0B' : '#22C55E'
                  }}>
                    {primaryMember.initials}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-gray-900 truncate leading-tight">{name}</p>
                    <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 mt-1 text-[7px] font-bold uppercase border tracking-widest ${primaryMember.resource_type === 'Consultant - External' ? "bg-indigo-400/10 text-indigo-500 border-indigo-400/20" :
                      primaryMember.resource_type === 'Consultant - Internal' ? "bg-amber-400/10 text-amber-500 border-amber-400/20" :
                        "bg-emerald-400/10 text-emerald-500 border-emerald-400/20"
                      }`}>
                      {primaryMember.resource_type || "Internal"}
                    </span>
                  </div>
                </div>

                {/* Allocation Progress */}
                <div className="px-4 py-3 bg-gray-50/50 border-b border-gray-100">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Allocation</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${(primaryMember.engagement_pct || 0) > 80 ? "bg-emerald-100 text-emerald-600" :
                        (primaryMember.engagement_pct || 0) >= 50 ? "bg-amber-100 text-amber-600" :
                          "bg-red-100 text-red-600"
                      }`}>
                      {primaryMember.engagement_pct || 0}%
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-gray-200 rounded-full overflow-hidden shadow-inner">
                    <div
                      className={`h-full transition-all duration-500 ease-out rounded-full ${engagementColor(primaryMember.engagement_pct || 0)}`}
                      style={{ width: `${Math.min(100, primaryMember.engagement_pct || 0)}%` }}
                    />
                  </div>
                </div>

                {/* Stacked Roles Section */}
                <div className="flex flex-col flex-1 divide-y divide-gray-200">
                  {memberProjects.length === 0 ? (
                    <div className="p-4 py-8 text-center bg-gray-50/30">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Unassigned</p>
                      <p className="text-[11px] text-gray-500 font-medium italic">{primaryMember.role}</p>
                    </div>
                  ) : (
                    memberProjects.map((p, pIdx) => (
                      <div key={`${name}-${p.projectName}-${pIdx}`} className={`flex items-center justify-between px-4 py-3 hover:bg-blue-50/50 transition-colors ${pIdx % 2 === 0 ? "bg-gray-50/50" : "bg-white"}`}>
                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] font-extrabold text-blue-600 uppercase tracking-tight truncate">{p.role}</p>
                        </div>
                        <div className="ml-2">
                          <span className="text-[11px] font-bold text-gray-700 bg-gray-200/50 px-2 py-0.5 rounded-md border border-gray-300/30 whitespace-nowrap shadow-sm group-hover:bg-white transition-all">
                            {p.projectName}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Card Footer: Actions */}
                <div className="mt-auto px-4 py-2 bg-gray-50/30 border-t border-gray-100 flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => setConfirmDeleteMember(name)} className="rounded-md p-1.5 text-gray-400 hover:bg-red-500/10 hover:text-red-500 transition-all" title="Delete Consolidated Profile">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Allocation Matrix */}
        <div className="rounded-lg border border-gray-200 bg-white shadow-lg overflow-hidden">
          <div className="border-b border-gray-200 px-6 py-4 bg-gradient-to-r from-blue-50 to-blue-100/50">
            <h3 className="text-lg font-bold text-gray-900">Work Allocation Matrix</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-300 bg-white text-left">
                  <th className="px-6 py-4 font-bold text-gray-900 sticky left-0 bg-white z-10 min-w-[200px]">Member</th>
                  {projects?.map((p) => (
                    <th key={p.id} className="px-4 py-4 text-center font-bold text-gray-900 whitespace-nowrap tracking-wide uppercase text-xs border-l border-gray-200">
                      <span className="block truncate">{p.name}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredNames.map((name, idx) => {
                  const group = groupedMembers[name];
                  const primaryMember = group[0];
                  const isEvenRow = idx % 2 === 0;
                  return (
                    <tr key={name} className={`border-b border-gray-200 ${isEvenRow ? "bg-gray-50" : "bg-white"} hover:bg-blue-50 last:border-0 transition-all duration-200`}>
                      <td className="px-6 py-4 text-gray-900 font-bold sticky left-0 z-10 min-w-[200px] bg-gradient-to-r from-gray-100 to-transparent">{name}</td>
                      {filteredProjects.map((p) => {
                        const isAssigned = group.some((m) => assignments?.some((a) => a.team_member_id === m.id && a.project_id === p.id));
                        const isConfirming = group.some((m) => confirmToggle?.memberId === m.id && confirmToggle?.projectId === p.id);
                        return (
                          <td key={p.id} className="px-4 py-4 text-center">
                            {isConfirming ? (
                              <div className="flex items-center justify-center gap-1">
                                <button onClick={() => handleToggleAssignment(primaryMember.id, p.id)} className="text-emerald-600 hover:text-emerald-700"><Check size={16} /></button>
                                <button onClick={() => setConfirmToggle(null)} className="text-gray-500 hover:text-gray-700"><X size={16} /></button>
                              </div>
                            ) : (
                              <button
                                onClick={() => isAssigned ? setConfirmToggle({ memberId: primaryMember.id, projectId: p.id }) : handleToggleAssignment(primaryMember.id, p.id)}
                                className={`h-6 w-6 rounded-full mx-auto flex items-center justify-center transition-all duration-200 ${isAssigned ? "bg-blue-500 hover:bg-blue-600 shadow-lg shadow-blue-500/50" : "bg-gray-300 hover:bg-gray-400"}`}
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

        {/* Effort Chart - Dashboard Style */}
        <div className="rounded-lg border border-gray-200 bg-gradient-to-b from-white to-gray-50 p-6">
          <h3 className="mb-4 text-sm font-bold text-gray-900">Effort Tracking (Est. Hours/Week)</h3>
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
        {/* Gantt Timeline - Commented out for now
        <div className="rounded-lg border border-gray-200 bg-white shadow-lg overflow-hidden">
          <div className="border-b border-gray-200 px-6 py-4 bg-gradient-to-r from-blue-50 to-blue-100/50">
            <h3 className="text-lg font-bold text-gray-900">Work Allocation Timeline (2026)</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-300 bg-white text-left">
                  <th className="px-6 py-4 font-bold text-gray-900 sticky left-0 bg-white z-10 min-w-[200px]">Member</th>
                  {months.map((m) => <th key={m} className="px-4 py-4 text-center font-bold text-gray-900 min-w-[80px] tracking-wide uppercase text-xs border-l border-gray-200">{m}</th>)}
                </tr>
              </thead>
              <tbody>
                {filteredMembers.map((m, idx) => {
                  const memberAssigns = assignments?.filter((a) => a.team_member_id === m.id) || [];
                  const isEvenRow = idx % 2 === 0;
                  return (
                    <tr key={m.id} className={`border-b border-gray-200 ${isEvenRow ? "bg-gray-50" : "bg-white"} hover:bg-blue-50 last:border-0 transition-all duration-200`}>
                      <td className="px-6 py-4 text-gray-900 font-bold sticky left-0 z-10 min-w-[200px] bg-gradient-to-r from-gray-100 to-transparent">{m.name}</td>
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
        */}

        {/* Add Member Modal */}
        <FormModal title="Add Team Member" isOpen={showAddMember} onClose={() => setShowAddMember(false)}>
          <FormSection>
            <FormInput
              label="Full Name"
              value={newMember.name}
              onChange={(v) => setNewMember({ ...newMember, name: v })}
              placeholder="John Doe"
              required
            />
            <FormInput
              label="Role"
              value={newMember.role}
              onChange={(v) => setNewMember({ ...newMember, role: v })}
              placeholder="Senior Developer"
              required
            />
            <FormInput
              label="Reports To"
              value={newMember.reportsTo}
              onChange={(v) => setNewMember({ ...newMember, reportsTo: v })}
              placeholder="Manager name or ID"
            />
          </FormSection>
          <FormSection title="Assignment">
            <FormSelect
              label="Member Type"
              value={newMember.memberType}
              onChange={(v) => setNewMember({ ...newMember, memberType: v })}
              options={["Full-time", "Consultant", "Intern", "Trainee"]}
              required
            />
            <FormSelect
              label="Resource Type"
              value={newMember.resourceType}
              onChange={(v) => setNewMember({ ...newMember, resourceType: v })}
              options={["Internal", "Consultant - Internal", "Consultant - External"]}
              required
            />
            {newMember.resourceType === "Consultant - External" && (
              <FormInput
                label="Vendor Name"
                value={newMember.vendor}
                onChange={(v) => setNewMember({ ...newMember, vendor: v })}
                placeholder="Enter vendor name"
                required
              />
            )}
          </FormSection>
          <FormSection title="Projects">
            <FormCheckboxGroup
              label="Assign to Projects"
              items={projects?.map((p) => ({ id: p.id, name: p.name })) || []}
              selectedIds={newMember.projectIds}
              onChange={(ids) => setNewMember({ ...newMember, projectIds: ids })}
            />
          </FormSection>
          <FormActions
            onSubmit={handleAddMember}
            onCancel={() => setShowAddMember(false)}
            submitLabel="Add Member"
          />
        </FormModal>

        {editMember && members && (
          <EditMemberDrawer
            members={members.filter(m => m.name === (members.find(x => x.id === editMember)?.name || ""))}
            projects={projects || []}
            assignments={assignments || []}
            onClose={() => setEditMember(null)}
            qc={qc}
          />
        )}

        {/* Delete Member Confirmation Modal */}
        {confirmDeleteMember && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setConfirmDeleteMember(null)}>
            <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Delete Consolidated Profile</h3>
              <p className="text-sm text-gray-600 mb-6">Are you sure you want to delete the profile for <span className="font-bold text-red-600">{confirmDeleteMember}</span>? This will remove all associated project records and designations for this person across all documents.</p>
              <div className="flex gap-3">
                <button onClick={() => setConfirmDeleteMember(null)} className="flex-1 rounded-xl border border-gray-300 bg-gray-50 px-4 py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-100 transition-all">Cancel</button>
                <button onClick={() => handleDeleteGroup(confirmDeleteMember)} className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-red-700 shadow-lg shadow-red-600/30 transition-all">Delete Everything</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout >
  );
};

const EditMemberDrawer = ({ members, projects, assignments, onClose, qc }: { members: any[]; projects: any[]; assignments: any[]; onClose: () => void; qc: any }) => {
  const primaryMember = members[0];
  const [form, setForm] = useState({
    name: primaryMember.name,
    role: primaryMember.role,
    reportsTo: primaryMember.reports_to || "",
    memberType: primaryMember.member_type || "Full-time",
    resourceType: primaryMember.resource_type || "Internal",
    vendor: primaryMember.vendor || "",
    engagementPct: primaryMember.engagement_pct || 50
  });
  const [isLoading, setIsLoading] = useState(false);
  const [localAssignments, setLocalAssignments] = useState<{ id: string; projectName: string; role: string; memberId: string }[]>([]);

  useEffect(() => {
    const memberIds = members.map(m => m.id);
    const allAssignments = (assignments || [])
      .filter((a) => memberIds.includes(a.team_member_id || ""))
      .map((a) => {
        const p = projects?.find((pr) => pr.id === a.project_id);
        const m = members.find(x => x.id === a.team_member_id);
        return {
          id: a.id,
          memberId: a.team_member_id!,
          projectName: p?.name || "Unknown Project",
          role: a.role_on_project || m?.role || ""
        };
      })
      .filter(a => a.projectName !== "Unknown Project");
    setLocalAssignments(allAssignments);
  }, [members, assignments, projects]);

  const handleSave = async () => {
    setIsLoading(true);

    const newValues = {
      name: form.name,
      role: form.role,
      reports_to: form.reportsTo || null,
      member_type: form.memberType,
      resource_type: form.resourceType || "Internal",
      vendor: form.resourceType === "Consultant - External" ? form.vendor : null,
      engagement_pct: form.engagementPct
    };

    // Update all member records in the group
    for (const member of members) {
      const oldValues = { name: member.name, role: member.role, reports_to: member.reports_to, member_type: member.member_type, resource_type: member.resource_type, vendor: member.vendor, engagement_pct: member.engagement_pct };
      const { error: memberError } = await api.from("team_members").update(newValues).eq("id", member.id);
      if (!memberError) {
        await writeAuditLog("team_members", member.id, "UPDATE", oldValues, newValues);
      }
    }

    // Update specific roles for project assignments
    for (const la of localAssignments) {
      const originalAssignment = assignments?.find(a => a.id === la.id);
      if (originalAssignment && originalAssignment.role_on_project !== la.role) {
        const { error: assignmentError } = await api.from("project_assignments")
          .update({ role_on_project: la.role })
          .eq("id", la.id);

        if (!assignmentError) {
          await writeAuditLog("project_assignments", la.id, "UPDATE",
            { role_on_project: originalAssignment.role_on_project },
            { role_on_project: la.role }
          );
        }
      }
    }

    qc.invalidateQueries({ queryKey: ["team_members"] });
    qc.invalidateQueries({ queryKey: ["project_assignments"] });
    toast.success(`✓ Updated · ${new Date().toLocaleTimeString()}`);
    setIsLoading(false);
    onClose();
  };

  return (
    <FormModal title="Edit Member" isOpen={true} onClose={onClose}>
      <FormSection>
        <FormInput
          label="Name"
          value={form.name}
          onChange={(v) => setForm({ ...form, name: v })}
          disabled={isLoading}
          required
        />
        <FormInput
          label="Role"
          value={form.role}
          onChange={(v) => setForm({ ...form, role: v })}
          disabled={isLoading}
          required
        />
        <FormInput
          label="Reports To"
          value={form.reportsTo}
          onChange={(v) => setForm({ ...form, reportsTo: v })}
          disabled={isLoading}
        />
      </FormSection>

      {localAssignments.length > 0 && (
        <FormSection title="Project Designations">
          <div className="space-y-4 pt-2">
            {localAssignments.map((la, idx) => (
              <div key={la.id} className="p-3 rounded-lg border border-gray-200 bg-gray-50/50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Project</span>
                  <span className="text-[11px] font-bold text-gray-800 bg-white px-2 py-0.5 rounded border border-gray-200 shadow-sm">{la.projectName}</span>
                </div>
                <FormInput
                  label="Specific Role / Designation"
                  value={la.role}
                  onChange={(v) => {
                    const newLA = [...localAssignments];
                    newLA[idx].role = v;
                    setLocalAssignments(newLA);
                  }}
                  disabled={isLoading}
                  placeholder="e.g. Lead Developer, QA Tester"
                />
              </div>
            ))}
          </div>
        </FormSection>
      )}

      <FormSection title="Assignment">
        <FormSelect
          label="Member Type"
          value={form.memberType}
          onChange={(v) => setForm({ ...form, memberType: v })}
          options={["Full-time", "Consultant", "Intern", "Trainee"]}
          disabled={isLoading}
          required
        />
        <FormSelect
          label="Resource Type"
          value={form.resourceType}
          onChange={(v) => setForm({ ...form, resourceType: v })}
          options={["Internal", "Consultant - Internal", "Consultant - External"]}
          disabled={isLoading}
          required
        />
        {form.resourceType === "Consultant - External" && (
          <FormInput
            label="Vendor Name"
            value={form.vendor}
            onChange={(v) => setForm({ ...form, vendor: v })}
            disabled={isLoading}
            placeholder="Enter vendor name"
            required
          />
        )}
      </FormSection>
      <FormActions
        onSubmit={handleSave}
        onCancel={onClose}
        submitLabel="Save Changes"
        isLoading={isLoading}
      />
    </FormModal>
  );
};

export default Resources;
