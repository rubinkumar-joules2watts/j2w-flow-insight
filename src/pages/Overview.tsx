import AppLayout from "@/components/layout/AppLayout";
import Topbar from "@/components/layout/Topbar";
import { useClients, useProjects, useMilestones, useTeamMembers, useAssignments } from "@/hooks/useData";
import { useNavigate } from "react-router-dom";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Activity, CheckCircle, AlertTriangle, AlertOctagon, FileText, Users } from "lucide-react";
import j2wLogo from "@/assets/j2w-logo.png";

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

const Overview = () => {
  const { data: clients } = useClients();
  const { data: projects } = useProjects();
  const { data: milestones } = useMilestones();
  const { data: members } = useTeamMembers();
  const { data: assignments } = useAssignments();
  const navigate = useNavigate();

  const activeProjects = projects?.filter((p) => p.status !== "Completed") || [];
  const totalMilestones = milestones?.length || 0;
  const avgCompletion = milestones?.length
    ? Math.round(milestones.reduce((s, m) => s + (m.completion_pct || 0), 0) / milestones.length)
    : 0;
  const blockerCount = milestones?.filter((m) => m.blocker).length || 0;
  const doneCount = milestones?.filter((m) => m.completion_pct === 100).length || 0;
  const amberCount = milestones?.filter((m) => m.milestone_flag === "amber").length || 0;
  const redCount = milestones?.filter((m) => m.milestone_flag === "red").length || 0;
  const invoicesRaised = milestones?.filter((m) => m.invoice_status === "Raised").length || 0;
  const teamDeployed = members?.filter((m) => m.is_active).length || 0;

  // Milestone completion by client
  const clientCompletionData = clients?.map((c) => {
    const projIds = projects?.filter((p) => p.client_id === c.id).map((p) => p.id) || [];
    const clientMs = milestones?.filter((m) => projIds.includes(m.project_id || "")) || [];
    const done = clientMs.filter((m) => m.completion_pct === 100).length;
    const total = clientMs.length;
    return { name: c.name, pct: total ? Math.round((done / total) * 100) : 0, done, total };
  }) || [];

  // Active blockers
  const activeBlockers = milestones
    ?.filter((m) => m.blocker)
    .sort((a, b) => {
      const order: Record<string, number> = { red: 0, amber: 1, grey: 2, green: 3 };
      return (order[a.milestone_flag || "grey"] || 2) - (order[b.milestone_flag || "grey"] || 2);
    })
    .map((m) => {
      const proj = projects?.find((p) => p.id === m.project_id);
      return { ...m, projectName: proj?.name || "" };
    }) || [];

  const invoicesPending = milestones?.filter((m) => m.invoice_status === "Pending").length || 0;
  const upcomingDeadlines = milestones
    ?.filter((m) => m.planned_end && m.completion_pct !== 100)
    .sort((a, b) => (a.planned_end || "").localeCompare(b.planned_end || ""))
    .slice(0, 3) || [];

  const getProjectResources = (projectId: string) => {
    const memberIds = assignments?.filter((a) => a.project_id === projectId).map((a) => a.team_member_id) || [];
    return members?.filter((m) => memberIds.includes(m.id)).map((m) => m.name).join(", ") || "—";
  };

  const getProjectMilestoneProgress = (projectId: string) => {
    const pMs = milestones?.filter((m) => m.project_id === projectId) || [];
    const done = pMs.filter((m) => m.completion_pct === 100).length;
    return { done, total: pMs.length };
  };

  return (
    <AppLayout>
      <Topbar title="Overview" />

      {/* Hero Strip */}
      <div className="relative h-28 overflow-hidden border-b border-border">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-[0.18]"
          style={{ backgroundImage: "url(/images/fractal-bg.jpg)" }}
        />
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(90deg, rgba(13,13,13,1) 0%, rgba(13,13,13,0.2) 100%)" }}
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
        {/* KPI Row */}
        <div className="grid grid-cols-5 gap-3">
          {[
            { icon: CheckCircle, label: "Milestones Done", value: doneCount, color: "text-success" },
            { icon: AlertTriangle, label: "In Progress (Amber)", value: amberCount, color: "text-warning" },
            { icon: AlertOctagon, label: "Critical / Red", value: redCount, color: "text-destructive" },
            { icon: FileText, label: "Invoices Raised", value: invoicesRaised, color: "text-primary" },
            { icon: Users, label: "Team Deployed", value: teamDeployed, color: "text-accent" },
          ].map((kpi) => (
            <div key={kpi.label} className="flex items-center gap-3 rounded-lg border border-border bg-card p-4">
              <kpi.icon size={20} className={kpi.color} />
              <div>
                <p className="text-2xl font-bold text-foreground">{kpi.value}</p>
                <p className="text-xs text-muted-foreground font-medium">{kpi.label}</p>
              </div>
            </div>
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
                  {["Client", "Project", "Type", "Manager", "Resources", "Progress", "Status", "Invoice"].map((h) => (
                    <th key={h} className="px-4 py-2.5 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {projects?.map((p) => {
                  const client = clients?.find((c) => c.id === p.client_id);
                  const prog = getProjectMilestoneProgress(p.id);
                  const pctWidth = prog.total ? (prog.done / prog.total) * 100 : 0;
                  const pMs = milestones?.filter((m) => m.project_id === p.id) || [];
                  const hasRaisedInvoice = pMs.some((m) => m.invoice_status === "Raised");
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
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: "hsl(160,5%,55%)" }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: "hsl(160,5%,55%)" }} width={60} />
                <Tooltip
                  contentStyle={{ background: "hsl(160,8%,12%)", border: "1px solid hsl(160,6%,20%)", borderRadius: 8, fontSize: 11, color: "#fff" }}
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
            <h4 className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">Upcoming Deadlines</h4>
            <div className="space-y-1.5">
              {upcomingDeadlines.map((m) => {
                const proj = projects?.find((p) => p.id === m.project_id);
                return (
                  <div key={m.id} className="flex items-center justify-between text-xs">
                    <span className="text-foreground truncate max-w-[140px]">{proj?.name} · {m.milestone_code}</span>
                    <span className="text-muted-foreground">{m.planned_end}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default Overview;
