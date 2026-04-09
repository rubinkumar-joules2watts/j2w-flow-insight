import { useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import Topbar from "@/components/layout/Topbar";
import FilterSelect from "@/components/common/FilterSelect";
import { useClients, useProjects, useMilestones, useTeamMembers, useAssignments } from "@/hooks/useData";
import { api, apiUrl } from "@/lib/api";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Zap, AlertTriangle, AlertOctagon, AlertCircle, FileText, Users, X } from "lucide-react";
import j2wLogo from "@/assets/j2w-logo.png";

type OverviewTileKey = "active" | "ontrack" | "atrisk" | "blocked";

interface DashboardCounters {
  active_projects: number;
  on_track_projects: number;
  at_risk_projects: number;
  blocked_projects: number;
}

const flagColor = (f: string | null) => {
  if (f === "green") return "bg-success";
  if (f === "amber") return "bg-warning";
  if (f === "red") return "bg-destructive";
  return "bg-muted";
};

const statusBadge = (s: string | null) => {
  const base = "inline-flex items-center rounded-full px-3 py-1 text-xs font-bold";
  if (s === "On Track") return `${base} bg-emerald-400/20 text-emerald-400 border border-emerald-400/30`;
  if (s === "At Risk") return `${base} bg-amber-400/20 text-amber-400 border border-amber-400/30`;
  if (s === "Blocked") return `${base} bg-red-400/20 text-red-400 border border-red-400/30`;
  if (s === "Completed") return `${base} bg-blue-400/20 text-blue-400 border border-blue-400/30`;
  return `${base} bg-slate-500/20 text-slate-400 border border-slate-500/30`;
};

const Overview = () => {
  const { data: clients } = useClients();
  const { data: projects } = useProjects();
  const { data: milestones } = useMilestones();
  const { data: members } = useTeamMembers();
  const { data: assignments } = useAssignments();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [activeTile, setActiveTile] = useState<OverviewTileKey | null>(null);
  const [clientFilter, setClientFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [projectSearch, setProjectSearch] = useState("");
  const [counters, setCounters] = useState<DashboardCounters>({
    active_projects: 0,
    on_track_projects: 0,
    at_risk_projects: 0,
    blocked_projects: 0,
  });

  // Fetch dashboard counters
  useEffect(() => {
    const fetchCounters = async () => {
      try {
        const response = await fetch(apiUrl("/api/dashboard/counters"), {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        });
        if (response.ok) {
          const data = await response.json();
          setCounters(data);
        }
      } catch (error) {
        console.error("Failed to fetch dashboard counters:", error);
      }
    };

    fetchCounters();
  }, []);

  // Realtime: auto-refresh all metrics when any table changes
  useEffect(() => {
    const channel = api.channel("overview-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "projects" }, () => qc.invalidateQueries({ queryKey: ["projects"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "milestones" }, () => qc.invalidateQueries({ queryKey: ["milestones"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "team_members" }, () => qc.invalidateQueries({ queryKey: ["team_members"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "project_assignments" }, () => qc.invalidateQueries({ queryKey: ["project_assignments"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "clients" }, () => qc.invalidateQueries({ queryKey: ["clients"] }))
      .subscribe();
    return () => { api.removeChannel(channel); };
  }, [qc]);

  const filteredProjects = (projects || []).filter((p) => {
    const byClient = clientFilter === "all" || p.client_id === clientFilter;
    const byStatus = statusFilter === "all" || (p.status || "") === statusFilter;
    const bySearch = !projectSearch.trim() || p.name.toLowerCase().includes(projectSearch.toLowerCase().trim());
    return byClient && byStatus && bySearch;
  });

  const filteredProjectIds = new Set(filteredProjects.map((p) => p.id));
  const filteredMilestones = (milestones || []).filter((m) => filteredProjectIds.has(m.project_id || ""));

  const activeProjects = filteredProjects.filter((p) => p.status !== "Completed") || [];
  const totalMilestones = filteredMilestones.length || 0;
  const avgCompletion = filteredMilestones.length
    ? Math.round(filteredMilestones.reduce((s, m) => s + (m.completion_pct || 0), 0) / filteredMilestones.length)
    : 0;
  const blockerCount = filteredMilestones.filter((m) => m.blocker).length || 0;
  const doneCount = filteredMilestones.filter((m) => m.completion_pct === 100).length || 0;
  const amberCount = filteredMilestones.filter((m) => m.milestone_flag === "amber" && m.completion_pct !== 100).length || 0;
  const redCount = filteredMilestones.filter((m) => m.milestone_flag === "red" && m.completion_pct !== 100).length || 0;
  const invoicesRaised = filteredMilestones.filter((m) => m.invoice_status === "Raised").length || 0;
  const teamDeployed = members?.filter((m) => m.is_active).length || 0;

  const milestonesDone = filteredMilestones.filter((m) => m.completion_pct === 100) || [];
  const milestonesAmber = filteredMilestones.filter((m) => m.milestone_flag === "amber" && m.completion_pct !== 100) || [];
  const milestonesRed = filteredMilestones.filter((m) => m.milestone_flag === "red" && m.completion_pct !== 100) || [];
  const invoiceRaisedRows = filteredMilestones.filter((m) => m.invoice_status === "Raised") || [];
  const invoicePendingRows = filteredMilestones.filter((m) => m.invoice_status === "Pending") || [];
  const deployedMembers = members?.filter((m) => m.is_active) || [];

  // Milestone completion by client
  const clientCompletionData = clients?.map((c) => {
    const projIds = filteredProjects.filter((p) => p.client_id === c.id).map((p) => p.id) || [];
    const clientMs = filteredMilestones.filter((m) => projIds.includes(m.project_id || "")) || [];
    const done = clientMs.filter((m) => m.completion_pct === 100).length;
    const total = clientMs.length;
    return { name: c.name, pct: total ? Math.round((done / total) * 100) : 0, done, total };
  }) || [];

  // Active blockers
  const activeBlockers = filteredMilestones
    ?.filter((m) => m.blocker)
    .sort((a, b) => {
      const order: Record<string, number> = { red: 0, amber: 1, grey: 2, green: 3 };
      return (order[a.milestone_flag || "grey"] || 2) - (order[b.milestone_flag || "grey"] || 2);
    })
    .map((m) => {
      const proj = projects?.find((p) => p.id === m.project_id);
      return { ...m, projectName: proj?.name || "" };
    }) || [];

  const invoicesPending = filteredMilestones.filter((m) => m.invoice_status === "Pending" && m.completion_pct === 100).length || 0;
  const now = new Date();
  const thisMonth = now.getMonth();
  const thisYear = now.getFullYear();

  const upcomingInvoicesThisMonth = filteredMilestones
    ?.filter((m) => {
      if (m.completion_pct === 100) return false;
      if (m.invoice_status !== "Pending") return false;
      const targetDate = m.planned_start || m.planned_end;
      if (!targetDate) return false;
      const d = new Date(targetDate);
      if (Number.isNaN(d.getTime())) return false;
      return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
    })
    .sort((a, b) => {
      const da = new Date(a.planned_start || a.planned_end || "9999-12-31").getTime();
      const db = new Date(b.planned_start || b.planned_end || "9999-12-31").getTime();
      return da - db;
    })
    .slice(0, 6) || [];

  const getProjectResources = (projectId: string) => {
    const memberIds = assignments?.filter((a) => a.project_id === projectId).map((a) => a.team_member_id) || [];
    return members?.filter((m) => memberIds.includes(m.id)).map((m) => m.name).join(", ") || "—";
  };

  const getProjectMilestoneProgress = (projectId: string) => {
    const pMs = milestones?.filter((m) => m.project_id === projectId) || [];
    const done = pMs.filter((m) => m.completion_pct === 100).length;
    return { done, total: pMs.length };
  };

  const getProjectName = (projectId: string | null) =>
    projects?.find((p) => p.id === projectId)?.name || "Unknown project";

  const getClientName = (projectId: string | null) => {
    const p = projects?.find((proj) => proj.id === projectId);
    return clients?.find((c) => c.id === p?.client_id)?.name || "Unknown client";
  };

  const getMemberProjectCount = (memberId: string) =>
    assignments?.filter((a) => a.team_member_id === memberId).length || 0;

  return (
    <AppLayout>
      <Topbar title="Overview" />

      <div className="p-6 space-y-5 animate-fade-in">
        {/* Filters */}
        <div className="grid grid-cols-3 gap-4 rounded-lg border border-slate-700 bg-gradient-to-b from-slate-900/50 to-slate-800/30 p-4">
          <FilterSelect
            value={clientFilter}
            onChange={setClientFilter}
            label="Client"
            placeholder="All Clients"
            options={[
              { label: "All Clients", value: "all" },
              ...((clients || []).map((c) => ({ label: c.name, value: c.id })))
            ]}
          />
          <FilterSelect
            value={statusFilter}
            onChange={setStatusFilter}
            label="Status"
            placeholder="All Status"
            options={[
              { label: "All Status", value: "all" },
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

        {/* KPI Row - Dashboard Counters */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { key: "active" as OverviewTileKey, icon: Zap, label: "Active Projects", value: counters.active_projects, color: "text-emerald-400", bgColor: "bg-emerald-400/10 border-emerald-400/30" },
            { key: "ontrack" as OverviewTileKey, icon: AlertTriangle, label: "On Track Projects", value: counters.on_track_projects, color: "text-amber-400", bgColor: "bg-amber-400/10 border-amber-400/30" },
            { key: "atrisk" as OverviewTileKey, icon: AlertOctagon, label: "At Risk Projects", value: counters.at_risk_projects, color: "text-red-400", bgColor: "bg-red-400/10 border-red-400/30" },
            { key: "blocked" as OverviewTileKey, icon: AlertCircle, label: "Blocked Projects", value: counters.blocked_projects, color: "text-blue-400", bgColor: "bg-blue-400/10 border-blue-400/30" },
          ].map((kpi) => (
            <button
              key={kpi.label}
              onClick={() => setActiveTile(kpi.key)}
              className={`flex flex-col items-start gap-3 rounded-lg border ${kpi.bgColor} p-5 text-left transition-all hover:scale-105 hover:shadow-lg`}
            >
              <div className={`p-2 rounded-lg ${kpi.bgColor}`}>
                <kpi.icon size={24} className={kpi.color} />
              </div>
              <div>
                <p className="text-3xl font-bold text-white">{kpi.value}</p>
                <p className="text-xs text-muted-foreground font-medium mt-1">{kpi.label}</p>
              </div>
            </button>
          ))}
        </div>

        {/* Project Status Table */}
        <div className="rounded-lg border border-slate-700 bg-gradient-to-b from-slate-900 to-slate-800/50 shadow-lg overflow-hidden">
          <div className="border-b border-slate-700 px-6 py-4 bg-gradient-to-r from-blue-600/10 to-blue-500/5">
            <h3 className="text-lg font-bold text-white">Project Status</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 bg-gradient-to-r from-slate-800 to-slate-900 text-left">
                  {["Client", "Project", "Type", "Manager", "Resources", "Status", "Invoice"].map((h) => (
                    <th key={h} className="px-6 py-4 font-bold text-white tracking-wide uppercase text-xs">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredProjects.map((p, idx) => {
                  const client = clients?.find((c) => c.id === p.client_id);
                  const prog = getProjectMilestoneProgress(p.id);
                  const pctWidth = prog.total ? (prog.done / prog.total) * 100 : 0;
                  const pMs = milestones?.filter((m) => m.project_id === p.id) || [];
                  const hasRaisedInvoice = pMs.some((m) => m.invoice_status === "Raised");
                  const raisedInvoices = pMs.filter((m) => m.invoice_status === "Raised").length;
                  const pendingInvoices = pMs.filter((m) => m.invoice_status === "Pending").length;
                  const isEvenRow = idx % 2 === 0;
                  return (
                    <tr
                      key={p.id}
                      onClick={() => navigate(`/projects?id=${p.id}`)}
                      className={`border-b border-slate-700/50 cursor-pointer transition-all duration-200 ${
                        isEvenRow ? "bg-slate-800/20" : "bg-transparent"
                      } hover:bg-blue-600/15 last:border-0`}
                    >
                      <td className="px-6 py-4 text-slate-300 font-medium">{client?.name}</td>
                      <td className="px-6 py-4 font-bold text-white">{p.name}</td>
                      <td className="px-6 py-4 text-slate-400">{p.service_type}</td>
                      <td className="px-6 py-4 text-slate-400">{p.delivery_manager}</td>
                      <td className="px-6 py-4 text-slate-400 min-w-[300px] break-words">{getProjectResources(p.id)}</td>
                      <td className="px-6 py-4"><span className={statusBadge(p.status)}>{p.status}</span></td>
                      <td className="px-6 py-4 text-slate-300 whitespace-nowrap">
                        <span className="font-bold text-white">{raisedInvoices}</span>
                        <span className="text-slate-400">/{pMs.length || 0} raised</span>
                        {pendingInvoices > 0 && (
                          <span className="ml-2 text-amber-400 font-medium">({pendingInvoices} pending)</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Bottom Row */}
        <div className="grid grid-cols-1 gap-3">
          {/* Milestone Completion by Client */}
          <div className="rounded-lg border border-slate-700 bg-gradient-to-br from-slate-900 to-slate-800/50 p-6 shadow-lg">
            <div className="mb-6">
              <h3 className="text-lg font-bold text-white">Milestone Completion by Client</h3>
              <p className="text-xs text-slate-400 mt-1">Performance across all clients</p>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={clientCompletionData} layout="vertical" margin={{ left: 100, right: 30, top: 10, bottom: 10 }}>
                <XAxis
                  type="number"
                  domain={[0, 100]}
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))", fontWeight: 500 }}
                  width={95}
                />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                    color: "hsl(var(--foreground))",
                    padding: "8px 12px"
                  }}
                  formatter={(v: number) => [`${v}%`, "Completion"]}
                />
                <Bar dataKey="pct" radius={[0, 8, 8, 0]} fill="url(#colorGradient)">
                  {clientCompletionData.map((_, i) => (
                    <Cell key={i} fill={`hsl(${217 + (i % 5) * 10}, 91%, ${50 + (i % 3) * 5}%)`} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Active Blockers - COMMENTED OUT */}
          {/* <div className="rounded-lg border border-border bg-card p-4">
            <h3 className="mb-3 text-sm font-bold text-foreground">Active Blockers</h3>
            <div className="space-y-2 max-h-[180px] overflow-y-auto">
              {activeBlockers.length === 0 && (
                <p className="text-xs text-muted-foreground">No active blockers</p>
              )}
              {activeBlockers.map((b) => (
                <div key={b.id} className="flex items-start gap-2 rounded-md bg-secondary/50 p-2">
                  <div className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${flagColor(b.milestone_flag)}`} />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{b.projectName} · {b.milestone_code}</p>
                    <p className="text-[10px] text-muted-foreground line-clamp-2">{b.remarks || "No details"}</p>
                  </div>
                </div>
              ))}
            </div>
          </div> */}

          {/* Invoice Summary - COMMENTED OUT */}
          {/* <div className="rounded-lg border border-border bg-card p-4">
            <h3 className="mb-3 text-sm font-bold text-foreground">Invoice Summary</h3>
            <div className="flex items-center gap-3 mb-3">
              <div className="flex-1">
                <div className="flex h-3 rounded-full overflow-hidden bg-secondary">
                  <div className="bg-success" style={{ width: `${totalMilestones ? (invoicesRaised / totalMilestones) * 100 : 0}%` }} />
                  <div className="bg-warning" style={{ width: `${totalMilestones ? (invoicesPending / totalMilestones) * 100 : 0}%` }} />
                </div>
                <div className="flex justify-between mt-1 text-[10px] text-muted-foreground">
                  <span>Raised: {invoicesRaised}</span>
                  <span>Pending: {invoicesPending}</span>
                </div>
              </div>
            </div>
            <h4 className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">Upcoming Invoices This Month</h4>
            <div className="space-y-1.5">
              {upcomingInvoicesThisMonth.map((m) => {
                const proj = projects?.find((p) => p.id === m.project_id);
                return (
                  <div key={m.id} className="flex items-start justify-between gap-3 text-xs">
                    <span className="text-foreground whitespace-normal break-words leading-5">{proj?.name} · {m.milestone_code}</span>
                    <span className="text-muted-foreground">{m.planned_start || m.planned_end}</span>
                  </div>
                );
              })}
              {upcomingInvoicesThisMonth.length === 0 && (
                <p className="text-xs text-muted-foreground">No upcoming pending invoices this month.</p>
              )}
            </div>
          </div> */}
        </div>
      </div>

      {activeTile && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4"
          onClick={() => setActiveTile(null)}
        >
          <div
            className="w-full max-w-4xl rounded-lg border border-border bg-card shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h3 className="text-sm font-bold text-foreground">
                {activeTile === "done" && "Milestones Done - Details"}
                {activeTile === "amber" && "In Progress (Amber) - Details"}
                {activeTile === "red" && "Critical / Red - Details"}
                {activeTile === "invoices" && "Invoices Raised - Details"}
                {activeTile === "invoicesPending" && "Invoices Pending - Details"}
                {activeTile === "team" && "Team Deployed - Details"}
              </h3>
              <button onClick={() => setActiveTile(null)} className="text-muted-foreground hover:text-foreground">
                <X size={16} />
              </button>
            </div>

            <div className="max-h-[70vh] overflow-auto p-4">
              {activeTile !== "team" && (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border text-left text-muted-foreground">
                      <th className="px-2 py-2 font-medium">Client</th>
                      <th className="px-2 py-2 font-medium">Project</th>
                      <th className="px-2 py-2 font-medium">Milestone</th>
                      <th className="px-2 py-2 font-medium">Status</th>
                      <th className="px-2 py-2 font-medium">Progress</th>
                      <th className="px-2 py-2 font-medium">Invoice</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const rows = (activeTile === "invoicesPending" ? invoicePendingRows :
                        activeTile === "done" ? milestonesDone :
                        activeTile === "amber" ? milestonesAmber :
                        activeTile === "red" ? milestonesRed : invoiceRaisedRows);
                      
                      // Defensive deduplication by project + description + status
                      const seen = new Set();
                      const uniqueRows = rows.filter(m => {
                        const key = `${m.project_id}-${m.milestone_code}-${m.description}-${m.status}`;
                        if (seen.has(key)) return false;
                        seen.add(key);
                        return true;
                      });

                      return uniqueRows.map((m) => (
                        <tr key={m.id} className="border-b border-border last:border-0 hover:bg-secondary/30 transition-colors">
                          <td className="px-2 py-2 text-muted-foreground">{getClientName(m.project_id)}</td>
                          <td className="px-2 py-2 text-foreground font-medium">{getProjectName(m.project_id)}</td>
                          <td className="px-2 py-2 text-foreground">{m.milestone_code || "-"} · {m.description || "-"}</td>
                          <td className="px-2 py-2 text-muted-foreground">{m.status || "-"}</td>
                          <td className="px-2 py-2 text-muted-foreground">{m.completion_pct ?? 0}%</td>
                          <td className="px-2 py-2 text-muted-foreground">{m.invoice_status || "-"}</td>
                        </tr>
                      ));
                    })()}
                  </tbody>
                </table>
              )}

              {activeTile === "team" && (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border text-left text-muted-foreground">
                      <th className="px-2 py-2 font-medium">Member</th>
                      <th className="px-2 py-2 font-medium">Role</th>
                      <th className="px-2 py-2 font-medium">Engagement</th>
                      <th className="px-2 py-2 font-medium">Projects Assigned</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deployedMembers.map((m) => (
                      <tr key={m.id} className="border-b border-border last:border-0">
                        <td className="px-2 py-2 text-foreground">{m.name}</td>
                        <td className="px-2 py-2 text-muted-foreground">{m.role}</td>
                        <td className="px-2 py-2 text-muted-foreground">{m.engagement_pct ?? 0}%</td>
                        <td className="px-2 py-2 text-muted-foreground">{getMemberProjectCount(m.id)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {(activeTile === "done" && milestonesDone.length === 0) && (
                <p className="text-xs text-muted-foreground">No completed milestones.</p>
              )}
              {(activeTile === "amber" && milestonesAmber.length === 0) && (
                <p className="text-xs text-muted-foreground">No amber milestones.</p>
              )}
              {(activeTile === "red" && milestonesRed.length === 0) && (
                <p className="text-xs text-muted-foreground">No critical milestones.</p>
              )}
              {(activeTile === "invoices" && invoiceRaisedRows.length === 0) && (
                <p className="text-xs text-muted-foreground">No raised invoices.</p>
              )}
              {(activeTile === "invoicesPending" && invoicePendingRows.length === 0) && (
                <p className="text-xs text-muted-foreground">No pending invoices.</p>
              )}
              {(activeTile === "team" && deployedMembers.length === 0) && (
                <p className="text-xs text-muted-foreground">No deployed team members.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
};

export default Overview;
