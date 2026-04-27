import { useState, useEffect } from "react";
import AppLayout from "@/components/layout/AppLayout";
import Topbar from "@/components/layout/Topbar";
import FilterSelect from "@/components/common/FilterSelect";
import { FormInput, FormSelect, FormRange, FormCheckboxGroup, FormModal, FormActions, FormSection } from "@/components/common/FormComponents";
import { useProjects, useTeamMembers, useAssignments, useClients, TeamMember } from "@/hooks/useData";
import { api } from "@/lib/api";
import { writeAuditLog } from "@/lib/audit";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, X, Trash2, Check, Loader2, Sparkles, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

const Resources = () => {
  const qc = useQueryClient();
  const { data: members, isLoading: membersLoading } = useTeamMembers();
  const { data: projects, isLoading: projectsLoading } = useProjects();
  const { data: assignments, isLoading: assignmentsLoading } = useAssignments();
  const { data: clients } = useClients();

  const isInitialLoading = membersLoading || projectsLoading || assignmentsLoading;

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
    const results: { projectName: string; role: string; engagementPct?: number }[] = [];
    const memberIds = group.map(m => m.id);

    assignments?.filter((a) => memberIds.includes(a.team_member_id || "")).forEach((a) => {
      const p = projects?.find((pr) => pr.id === a.project_id);
      if (p) {
        const member = group.find(m => m.id === a.team_member_id);
        const engagement = member?.engagements?.find(e => e.project_id === p.id);
        const engagementPct = engagement ? parseInt(engagement.engagement_level) : undefined;
        
        results.push({
          projectName: p.name,
          role: a.role_on_project || member?.role || "Resource",
          engagementPct: isNaN(engagementPct as any) ? undefined : engagementPct
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

  const [newMember, setNewMember] = useState({ name: "", role: "", reportsTo: "", memberType: "Full-time", resourceType: "Internal", vendor: "", engagementPct: 50, projectIds: [] as string[], skills: [] as string[] });
  const [suggestedSkills, setSuggestedSkills] = useState<any>(null);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchSuggestedSkills = async (title: string) => {
    if (!title.trim()) return;
    setLoadingSuggestions(true);
    try {
      const baseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
      const res = await fetch(`${baseUrl}api/designations/skills`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ designation: title })
      });
      if (res.ok) {
        const data = await res.json();
        setSuggestedSkills(data);
      }
    } catch (err) {
      console.error("Failed to fetch skills", err);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const handleAddMember = async () => {
    const initials = newMember.name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
    const colors = ["#3CBFB0", "#60A5FA", "#C084FC", "#F59E0B", "#22C55E", "#FB923C", "#E8253A", "#F472B6"];
    const color = colors[Math.floor(Math.random() * colors.length)];
    setIsSubmitting(true);
    const { data, error } = await api.from("team_members").insert({
      name: newMember.name, role: newMember.role, reports_to: newMember.reportsTo || null,
      member_type: newMember.memberType, resource_type: newMember.resourceType || "Internal",
      vendor: newMember.resourceType === "External" ? newMember.vendor : null,
      engagement_pct: newMember.engagementPct,
      initials, color_hex: color,
      skills: newMember.skills,
    }).select().single();
    if (error) { toast.error("Failed to add member"); setIsSubmitting(false); return; }
    await writeAuditLog("team_members", data.id, "INSERT", null, data);
    for (const pId of newMember.projectIds) {
      const { data: a } = await api.from("project_assignments").insert({ project_id: pId, team_member_id: data.id }).select().single();
      if (a) await writeAuditLog("project_assignments", a.id, "INSERT", null, a);
    }
    qc.invalidateQueries({ queryKey: ["team_members"] });
    qc.invalidateQueries({ queryKey: ["project_assignments"] });
    toast.success(`✓ Member added · ${new Date().toLocaleTimeString()}`);
    setNewMember({ name: "", role: "", reportsTo: "", memberType: "Full-time", resourceType: "Internal", vendor: "", engagementPct: 50, projectIds: [], skills: [] });
    setSuggestedSkills(null);
    setShowAddMember(false);
    setIsSubmitting(false);
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

  if (isInitialLoading) {
    return (
      <AppLayout>
        <Topbar title="Resource Allocation" />
        <div className="flex h-[80vh] items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
            <p className="text-sm font-bold text-gray-500 uppercase tracking-widest">Loading Records...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

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
                    backgroundColor: primaryMember.resource_type === 'External' ? '#6366F1' : primaryMember.resource_type === 'Consultant' ? '#F59E0B' : '#22C55E'
                  }}>
                    {primaryMember.initials}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-gray-900 truncate leading-tight">{name}</p>
                    <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 mt-1 text-[7px] font-bold uppercase border tracking-widest ${primaryMember.resource_type === 'External' ? "bg-indigo-400/10 text-indigo-500 border-indigo-400/20" :
                      primaryMember.resource_type === 'Consultant' ? "bg-amber-400/10 text-amber-500 border-amber-400/20" :
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
                        <div className="ml-2 flex items-center gap-1.5">
                          {p.engagementPct !== undefined && p.engagementPct > 0 && (
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${p.engagementPct > 80 ? 'bg-emerald-100 text-emerald-600' : p.engagementPct >= 50 ? 'bg-amber-100 text-amber-600' : 'bg-red-100 text-red-600'}`}>
                              {p.engagementPct}%
                            </span>
                          )}
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
        {/* 
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
        */}

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

        <FormModal title="Add Team Member" isOpen={showAddMember} onClose={() => setShowAddMember(false)} maxWidth="max-w-2xl">
          <div className="grid grid-cols-2 gap-6">
            <FormSection title="Identity">
              <FormInput
                label="Full Name"
                value={newMember.name}
                onChange={(v) => setNewMember({ ...newMember, name: v })}
                placeholder="John Doe"
                required
              />
              <FormInput
                label="Role / Designation"
                value={newMember.role}
                onChange={(v) => setNewMember({ ...newMember, role: v })}
                onBlur={() => fetchSuggestedSkills(newMember.role)}
                placeholder="e.g. Senior Developer"
                required
              />
              <FormInput
                label="Reports To"
                value={newMember.reportsTo}
                onChange={(v) => setNewMember({ ...newMember, reportsTo: v })}
                placeholder="Manager Name or ID"
              />
            </FormSection>

            <FormSection title="Skills & Profile">
              <SkillsSelector
                selectedSkills={newMember.skills}
                suggestedSkills={suggestedSkills}
                isLoading={loadingSuggestions}
                currentRole={newMember.role}
                onGenerate={() => fetchSuggestedSkills(newMember.role)}
                onAddSkill={(s) => setNewMember(prev => ({ ...prev, skills: [...prev.skills, s] }))}
                onRemoveSkill={(s) => setNewMember(prev => ({ ...prev, skills: prev.skills.filter(sk => sk !== s) }))}
              />
            </FormSection>
          </div>

          <div className="grid grid-cols-2 gap-6 border-t border-gray-100 pt-6 mt-2">
            <FormSection title="Type & Vendor">
              <div className="grid grid-cols-2 gap-3">
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
                  options={["Internal", "Consultant", "External"]}
                  required
                />
              </div>
              {newMember.resourceType === "External" && (
                <div className="mt-3 animate-in fade-in slide-in-from-top-2">
                  <FormInput
                    label="Vendor Name"
                    value={newMember.vendor}
                    onChange={(v) => setNewMember({ ...newMember, vendor: v })}
                    placeholder="Enter vendor name"
                    required
                  />
                </div>
              )}
            </FormSection>

            <FormSection title="Project Alignment">
              <FormCheckboxGroup
                label="Select Projects"
                items={projects?.map((p) => ({ id: p.id, name: p.name })) || []}
                selectedIds={newMember.projectIds}
                onChange={(ids) => setNewMember({ ...newMember, projectIds: ids })}
                maxHeight="max-h-[120px]"
              />
            </FormSection>
          </div>

          <div className="border-t border-gray-100 pt-6 mt-4">
            <FormActions
              onSubmit={handleAddMember}
              onCancel={() => setShowAddMember(false)}
              submitLabel="Add Member"
              isLoading={isSubmitting}
            />
          </div>
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

const SkillsSelector = ({ selectedSkills, suggestedSkills, isLoading, currentRole, onGenerate, onAddSkill, onRemoveSkill }: {
  selectedSkills: string[];
  suggestedSkills: any;
  isLoading: boolean;
  currentRole?: string;
  onGenerate?: () => void;
  onAddSkill: (s: string) => void;
  onRemoveSkill: (s: string) => void
}) => {
  const [customSkill, setCustomSkill] = useState("");

  const handleAddCustom = () => {
    if (customSkill.trim() && !selectedSkills.includes(customSkill.trim())) {
      onAddSkill(customSkill.trim());
      setCustomSkill("");
    }
  };

  return (
    <div className="space-y-3">
      <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide">
        Skills
      </label>
      <div className="flex flex-wrap gap-1.5 p-2.5 rounded-xl border border-gray-300 bg-white shadow-inner min-h-[46px] transition-all hover:border-blue-300 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/10">
        {selectedSkills.map(s => (
          <span key={s} className="flex items-center gap-1 rounded-full bg-blue-600 text-white text-[10px] font-bold px-2.5 py-1 shadow-md animate-in zoom-in-50">
            {s}
            <button onClick={() => onRemoveSkill(s)} className="hover:text-red-200 transition-colors ml-0.5">
              <X size={10} />
            </button>
          </span>
        ))}
        <input
          value={customSkill}
          onChange={(e) => setCustomSkill(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              handleAddCustom();
            }
          }}
          placeholder={selectedSkills.length === 0 ? "Type a skill and press Enter..." : "Add more..."}
          className="flex-1 bg-transparent border-none outline-none text-xs text-gray-900 placeholder-gray-400 min-w-[120px]"
        />
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 px-1 py-1 bg-blue-50/50 rounded-lg animate-pulse">
          <Loader2 size={12} className="animate-spin text-blue-500" />
          <span className="text-[10px] font-bold text-blue-500 uppercase tracking-widest">Generating suggestions...</span>
        </div>
      )}

      {!isLoading && !suggestedSkills && currentRole && currentRole.length > 3 && onGenerate && (
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onGenerate(); }}
          className="group w-full flex items-center justify-between gap-2 p-3 rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 transition-all duration-300 shadow-sm"
        >
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-500 text-white shadow-blue-200 shadow-lg group-hover:scale-110 transition-transform">
              <Sparkles size={14} />
            </div>
            <p className="text-xs font-bold text-blue-900">Want to generate suggested skills for <span className="text-blue-600 underline decoration-blue-300 underline-offset-2 italic">{currentRole}</span>?</p>
          </div>
          <div className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-2.5 py-1.5 text-[10px] font-bold text-white shadow-md shadow-blue-600/20 group-hover:bg-blue-700">
            Generate <Wand2 size={11} />
          </div>
        </button>
      )}

      {suggestedSkills && (
        <div className="space-y-4 p-5 rounded-2xl border border-blue-100 bg-white shadow-xl shadow-blue-500/5 animate-in fade-in slide-in-from-top-2 duration-500 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-blue-500" />
          <div className="flex items-center justify-between border-b border-blue-100 pb-3 mb-3">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-100 text-blue-600 shadow-inner">
                <Sparkles size={12} />
              </div>
              <div>
                <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest block leading-none">AI Suggestions</span>
                <span className="text-[8px] font-medium text-gray-400 uppercase tracking-tighter">Based on {suggestedSkills.designation}</span>
              </div>
            </div>
            {onGenerate && (
              <button
                onClick={(e) => { e.preventDefault(); onGenerate(); }}
                className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-blue-50 text-[10px] font-bold text-blue-500 transition-colors"
              >
                <Wand2 size={10} /> Refresh
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 gap-5 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
            {[
              { key: "technical_skills", label: "Technical Mastery", color: "text-blue-600", bg: "bg-blue-500/10", icon: "T" },
              { key: "tools_and_technologies", label: "Tools & Ecosystem", color: "text-indigo-600", bg: "bg-indigo-500/10", icon: "E" },
              { key: "soft_skills", label: "Core Soft Skills", color: "text-emerald-600", bg: "bg-emerald-500/10", icon: "S" },
              { key: "domain_knowledge", label: "Domain Expertise", color: "text-amber-600", bg: "bg-amber-500/10", icon: "D" },
              { key: "certifications", label: "Key Certifications", color: "text-purple-600", bg: "bg-purple-500/10", icon: "C" }
            ].map(cat => {
              const skills = suggestedSkills[cat.key] || [];
              if (skills.length === 0) return null;
              const available = skills.filter((s: string) => !selectedSkills.includes(s));
              if (available.length === 0) return null;

              return (
                <div key={cat.key} className="space-y-2.5">
                  <div className="flex items-center gap-2">
                    <div className={`flex h-4 w-4 items-center justify-center rounded text-[8px] font-bold ${cat.color} ${cat.bg}`}>
                      {cat.icon}
                    </div>
                    <p className={`text-[10px] font-extrabold uppercase tracking-tight ${cat.color}`}>{cat.label}</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5 pl-0.5">
                    {available.map((s: string) => (
                      <button
                        key={s}
                        onClick={(e) => { e.preventDefault(); onAddSkill(s); }}
                        className="group relative flex items-center gap-1.5 text-[10px] font-bold px-3 py-1.5 rounded-lg bg-gray-50 border border-gray-200 text-gray-600 hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50 transition-all duration-200 shadow-sm"
                      >
                        <Plus size={10} className="text-gray-300 group-hover:text-blue-500 transition-colors" />
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
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
    engagementPct: primaryMember.engagement_pct || 50,
    skills: primaryMember.skills || [] as string[]
  });
  const [isLoading, setIsLoading] = useState(false);
  const [suggestedSkills, setSuggestedSkills] = useState<any>(null);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  const fetchSuggestedSkills = async (title: string) => {
    if (!title.trim()) return;
    setLoadingSuggestions(true);
    try {
      const baseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
      const res = await fetch(`${baseUrl}api/designations/skills`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ designation: title })
      });
      if (res.ok) {
        const data = await res.json();
        setSuggestedSkills(data);
      }
    } catch (err) {
      console.error("Fetch failed", err);
    } finally {
      setLoadingSuggestions(false);
    }
  };
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
      vendor: form.resourceType === "External" ? form.vendor : null,
      engagement_pct: form.engagementPct,
      skills: form.skills
    };

    // Update all member records in the group
    for (const member of members) {
      const oldValues = { name: member.name, role: member.role, reports_to: member.reports_to, member_type: member.member_type, resource_type: member.resource_type, vendor: member.vendor, engagement_pct: member.engagement_pct, skills: member.skills };
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
    <FormModal title="Edit Member" isOpen={true} onClose={onClose} maxWidth="max-w-3xl">
      <div className="grid grid-cols-2 gap-8">
        <div className="space-y-6">
          <FormSection title="Basic Information">
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
              onBlur={() => fetchSuggestedSkills(form.role)}
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

          <FormSection title="Contractual Details">
            <div className="grid grid-cols-2 gap-4">
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
                options={["Internal", "Consultant", "External"]}
                disabled={isLoading}
                required
              />
            </div>
            {form.resourceType === "External" && (
              <div className="mt-3">
                <FormInput
                  label="Vendor Name"
                  value={form.vendor}
                  onChange={(v) => setForm({ ...form, vendor: v })}
                  disabled={isLoading}
                  placeholder="Enter vendor name"
                  required
                />
              </div>
            )}
          </FormSection>
        </div>

        <div className="space-y-6">
          <FormSection title="Skills Registry">
            <SkillsSelector
              selectedSkills={form.skills}
              suggestedSkills={suggestedSkills}
              isLoading={loadingSuggestions}
              currentRole={form.role}
              onGenerate={() => fetchSuggestedSkills(form.role)}
              onAddSkill={(s) => setForm(prev => ({ ...prev, skills: [...prev.skills, s] }))}
              onRemoveSkill={(s) => setForm(prev => ({ ...prev, skills: prev.skills.filter(sk => sk !== s) }))}
            />
          </FormSection>

          {localAssignments.length > 0 && (
            <FormSection title="Active Project Assignments">
              <div className="space-y-3 pt-1">
                {localAssignments.map((la, idx) => (
                  <div key={la.id} className="p-4 rounded-xl border border-gray-100 bg-gray-50/80 shadow-sm">
                    <div className="flex items-center justify-between mb-3 border-b border-gray-200 pb-2">
                      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Designation on Project</p>
                      <span className="text-[11px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-100">{la.projectName}</span>
                    </div>
                    <FormInput
                      label=""
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
        </div>
      </div>

      <div className="mt-8 border-t border-gray-100 pt-6">
        <FormActions
          onSubmit={handleSave}
          onCancel={onClose}
          submitLabel="Update Resource Profile"
          isLoading={isLoading}
        />
      </div>
    </FormModal>
  );
};

export default Resources;
