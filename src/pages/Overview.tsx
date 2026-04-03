import { useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import Topbar from "@/components/layout/Topbar";
import { useClients, useProjects, useMilestones, useTeamMembers, useAssignments } from "@/hooks/useData";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Activity, CheckCircle, AlertTriangle, AlertOctagon, FileText, Users, X } from "lucide-react";
import j2wLogo from "@/assets/j2w-logo.png";

type OverviewTileKey = "done" | "amber" | "red" | "invoices" | "invoicesPending" | "team";

const flagColor = (f: string | null) => {
  if (f === "green") return "bg-success";
  if (f === "amber") return "bg-warning";
  if (f === "red") return "bg-destructive";
  return "bg-muted";
};

const statusBadge = (s: string | null) => {
  const base = "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium";
  if (s === "Completed") return `${base} bg-success/15 text-success`;
  if (s === "In Progress") return `${base} bg-primary/15 text-primary`;
  if (s === "On Track") return `${base} bg-success/15 text-success`;
  if (s === "Delayed") return `${base} bg-warning/15 text-warning`;
  if (s === "Blocked") return `${base} bg-destructive/15 text-destructive`;
  if (s === "Planning") return `${base} bg-muted text-muted-foreground`;
  return `${base} bg-muted text-muted-foreground`;
};

const Overview = ({ themeToggle }: { themeToggle?: { dark: boolean; toggle: () => void } }) => {
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

  // Realtime: auto-refresh all metrics when any table changes
  useEffect(() => {
    const channel = supabase.channel("overview-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "projects" }, () => qc.invalidateQueries({ queryKey: ["projects"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "milestones" }, () => qc.invalidateQueries({ queryKey: ["milestones"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "team_members" }, () => qc.invalidateQueries({ queryKey: ["team_members"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "project_assignments" }, () => qc.invalidateQueries({ queryKey: ["project_assignments"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "clients" }, () => qc.invalidateQueries({ queryKey: ["clients"] }))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
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
  const amberCount = filteredMilestones.filter((m) => m.milestone_flag === "amber").length || 0;
  const redCount = filteredMilestones.filter((m) => m.milestone_flag === "red").length || 0;
  const invoicesRaised = filteredMilestones.filter((m) => m.invoice_status === "Raised").length || 0;
  const teamDeployed = members?.filter((m) => m.is_active).length || 0;

  const milestonesDone = filteredMilestones.filter((m) => m.completion_pct === 100) || [];
  const milestonesAmber = filteredMilestones.filter((m) => m.milestone_flag === "amber") || [];
  const milestonesRed = filteredMilestones.filter((m) => m.milestone_flag === "red") || [];
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

  const invoicesPending = filteredMilestones.filter((m) => m.invoice_status === "Pending").length || 0;
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
      <Topbar title="Overview" themeToggle={themeToggle} />

      {/* Hero Strip */}
      <div className="relative h-28 overflow-hidden border-b border-border">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-[0.18]"
          style={{ backgroundImage: "url(/images/fractal-bg.jpg)" }}
        />
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(90deg, hsl(var(--background)) 0%, hsl(var(--background) / 0.2) 100%)" }}
        />
        <div className="relative z-10 flex h-full items-center px-6 gap-5">
          <img src={j2wLogo} alt="J2W" className="h-10 w-10 object-contain" />
          <div className="h-10 w-px bg-border" />
          <div>
            <h2 className="text-lg font-bold text-foreground">Delivery Tracker</h2>
            <p className="text-xs text-muted-foreground font-medium">Tech Team · Joules to Watts</p>
          </div>
          <div className="ml-auto flex gap-6">
            {[
              { label: "Active Projects", value: activeProjects.length },
              { label: "Milestones", value: totalMilestones },
              { label: "Avg Completion", value: `${avgCompletion}%` },
              { label: "Active Blockers", value: blockerCount },
            ].map((s) => (
              <div key={s.label} className="text-right">
                <p className="text-xl font-bold text-foreground">{s.value}</p>
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="p-6 space-y-5 animate-fade-in">
        {/* Filters */}
        <div className="grid grid-cols-3 gap-3 rounded-lg border border-border bg-card p-3">
          <select
            value={clientFilter}
            onChange={(e) => setClientFilter(e.target.value)}
            className="rounded-md border border-border bg-secondary px-3 py-2 text-xs text-foreground outline-none"
          >
            <option value="all">All Clients</option>
            {(clients || []).map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-md border border-border bg-secondary px-3 py-2 text-xs text-foreground outline-none"
          >
            <option value="all">All Status</option>
            {["Planning", "On Track", "In Progress", "Delayed", "Blocked", "Completed"].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <input
            value={projectSearch}
            onChange={(e) => setProjectSearch(e.target.value)}
            placeholder="Search Project"
            className="rounded-md border border-border bg-secondary px-3 py-2 text-xs text-foreground outline-none"
          />
        </div>

        {/* KPI Row */}
        <div className="grid grid-cols-6 gap-3">
          {[
            { key: "done" as OverviewTileKey, icon: CheckCircle, label: "Milestones Done", value: doneCount, color: "text-success" },
            { key: "amber" as OverviewTileKey, icon: AlertTriangle, label: "In Progress (Amber)", value: amberCount, color: "text-warning" },
            { key: "red" as OverviewTileKey, icon: AlertOctagon, label: "Critical / Red", value: redCount, color: "text-destructive" },
            { key: "invoices" as OverviewTileKey, icon: FileText, label: "Invoices Raised", value: invoicesRaised, color: "text-primary" },
            { key: "invoicesPending" as OverviewTileKey, icon: FileText, label: "Invoices Pending", value: invoicesPending, color: "text-warning" },
            { key: "team" as OverviewTileKey, icon: Users, label: "Team Deployed", value: teamDeployed, color: "text-accent" },
          ].map((kpi) => (
            <button
              key={kpi.label}
              onClick={() => setActiveTile(kpi.key)}
              className="flex items-center gap-3 rounded-lg border border-border bg-card p-4 text-left transition-colors hover:bg-secondary/40"
            >
              <kpi.icon size={20} className={kpi.color} />
              <div>
                <p className="text-2xl font-bold text-foreground">{kpi.value}</p>
                <p className="text-xs text-muted-foreground font-medium">{kpi.label}</p>
              </div>
            </button>
          ))}
        </div>

        {/* Project Status Table */}
        <div className="rounded-lg border border-border bg-card">
          <div className="border-b border-border px-4 py-3">
            <h3 className="text-sm font-bold text-foreground">Project Status</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  {["Client", "Project", "Type", "Manager", "Resources", "Progress", "Status", "Revenue", "Invoice"].map((h) => (
                    <th key={h} className="px-4 py-2.5 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredProjects.map((p) => {
                  const client = clients?.find((c) => c.id === p.client_id);
                  const prog = getProjectMilestoneProgress(p.id);
                  const pctWidth = prog.total ? (prog.done / prog.total) * 100 : 0;
                  const pMs = milestones?.filter((m) => m.project_id === p.id) || [];
                  const hasRaisedInvoice = pMs.some((m) => m.invoice_status === "Raised");
                  const raisedInvoices = pMs.filter((m) => m.invoice_status === "Raised").length;
                  const pendingInvoices = pMs.filter((m) => m.invoice_status === "Pending").length;
                  return (
                    <tr
                      key={p.id}
                      onClick={() => navigate(`/projects?id=${p.id}`)}
                      className="border-b border-border last:border-0 cursor-pointer transition-colors hover:bg-secondary/50"
                    >
                      <td className="px-4 py-2.5 text-muted-foreground">{client?.name}</td>
                      <td className="px-4 py-2.5 font-medium text-foreground">{p.name}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{p.service_type}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{p.delivery_manager}</td>
                      <td className="px-4 py-2.5 text-muted-foreground max-w-[200px] truncate">{getProjectResources(p.id)}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-20 rounded-full bg-secondary">
                            <div className="h-full rounded-full bg-primary" style={{ width: `${pctWidth}%` }} />
                          </div>
                          <span className="text-muted-foreground">{prog.done}/{prog.total}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5"><span className={statusBadge(p.status)}>{p.status}</span></td>
                      <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">
                        <span className="font-medium text-foreground">{raisedInvoices}</span>
                        <span className="text-muted-foreground">/{pMs.length || 0} raised</span>
                        {pendingInvoices > 0 && (
                          <span className="ml-1 text-warning">({pendingInvoices} pending)</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-block h-2 w-2 rounded-full ${hasRaisedInvoice ? "bg-success" : "bg-muted-foreground"}`} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Bottom Row */}
        <div className="grid grid-cols-3 gap-3">
          {/* Milestone Completion by Client */}
          <div className="rounded-lg border border-border bg-card p-4">
            <h3 className="mb-3 text-sm font-bold text-foreground">Milestone Completion by Client</h3>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={clientCompletionData} layout="vertical" margin={{ left: 0, right: 12 }}>
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} width={60} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11, color: "hsl(var(--foreground))" }}
                  formatter={(v: number) => [`${v}%`, "Completion"]}
                />
                <Bar dataKey="pct" radius={[0, 4, 4, 0]}>
                  {clientCompletionData.map((_, i) => (
                    <Cell key={i} fill="hsl(72,100%,64%)" />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Active Blockers */}
          <div className="rounded-lg border border-border bg-card p-4">
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
          </div>

          {/* Invoice Summary */}
          <div className="rounded-lg border border-border bg-card p-4">
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
          </div>
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
                    {(activeTile === "invoicesPending" ? invoicePendingRows :
                      activeTile === "done" ? milestonesDone :
                      activeTile === "amber" ? milestonesAmber :
                      activeTile === "red" ? milestonesRed : invoiceRaisedRows).map((m) => (
                      <tr key={m.id} className="border-b border-border last:border-0">
                        <td className="px-2 py-2 text-muted-foreground">{getClientName(m.project_id)}</td>
                        <td className="px-2 py-2 text-foreground">{getProjectName(m.project_id)}</td>
                        <td className="px-2 py-2 text-foreground">{m.milestone_code || "-"} · {m.description || "-"}</td>
                        <td className="px-2 py-2 text-muted-foreground">{m.status || "-"}</td>
                        <td className="px-2 py-2 text-muted-foreground">{m.completion_pct ?? 0}%</td>
                        <td className="px-2 py-2 text-muted-foreground">{m.invoice_status || "-"}</td>
                      </tr>
                    ))}
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
