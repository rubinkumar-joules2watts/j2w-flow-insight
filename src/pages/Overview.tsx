import { useEffect, useState, useMemo } from "react";
import AppLayout from "@/components/layout/AppLayout";
import Topbar from "@/components/layout/Topbar";
import FilterSelect from "@/components/common/FilterSelect";
import { useClients, useProjects, useMilestones, useTeamMembers, useAssignments } from "@/hooks/useData";
import { api, apiUrl } from "@/lib/api";
import { useNavigate } from "react-router-dom";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend,
} from "recharts";
import {
  RefreshCw, Bell, ArrowRight, ChevronLeft, ChevronRight,
  Briefcase, TrendingUp, ShieldAlert, Archive, CheckCircle2, Circle,
  Search, Zap, Target, Wallet, Landmark, Percent,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import Lottie from "lottie-react";
import activeProjectsAnim from "../../public/json/business-team-working-on-business-idea.json";
import onTrackAnim from "../../public/json/boy-watching-business-performance.json";
import atRiskAnim from "../../public/json/business-persons-bickering-with-each-other.json";
import blockedAnim from "../../public/json/office-drawer.json";
import completedAnim from "../../public/json/successful-business-agreement.json";
import { Skeleton } from "@/components/ui/skeleton";
import {
  RevenueStatCard,
  aggregateRevenueForProjectList,
  formatRupeeCompact,
  formatPercentFromNumber,
  projectRevenueFromApi,
} from "@/lib/revenueDisplay";

interface DashboardCounters {
  active_projects: number;
  on_track_projects: number;
  at_risk_projects: number;
  blocked_projects: number;
  completed_projects: number;
}

const PAGE_SIZE = 8;

const STATUS_COLORS: Record<string, string> = {
  "On Track": "#22c55e",
  "Completed": "#3b82f6",
  "At Risk": "#f59e0b",
  "Blocked": "#94a3b8",
  "Inactive": "#94a3b8",
};

const statusBadge = (s: string | null) => {
  const base = "inline-flex items-center rounded-full px-3.5 py-1.5 text-sm font-bold";
  if (s === "On Track") return `${base} bg-emerald-100 text-emerald-700 border border-emerald-300`;
  if (s === "At Risk") return `${base} bg-amber-100 text-amber-700 border border-amber-300`;
  if (s === "Blocked") return `${base} bg-red-100 text-red-700 border border-red-300`;
  if (s === "Completed") return `${base} bg-blue-100 text-blue-700 border border-blue-300`;
  return `${base} bg-gray-200 text-gray-700 border border-gray-300`;
};



const Overview = () => {
  const { data: clients, isLoading: clientsLoading } = useClients();
  const { data: projects, isLoading: projectsLoading } = useProjects();
  const { data: milestones, isLoading: milestonesLoading } = useMilestones();
  const { data: members, isLoading: membersLoading } = useTeamMembers();
  const { data: assignments, isLoading: assignmentsLoading } = useAssignments();
  const navigate = useNavigate();
  const qc = useQueryClient();
  
  const { data: countersData, isLoading: countersLoading } = useQuery({
    queryKey: ["dashboard_counters"],
    queryFn: async () => {
      const response = await fetch(apiUrl("/api/dashboard/counters"), {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) throw new Error("Failed to fetch dashboard counters");
      return (await response.json()) as DashboardCounters;
    }
  });

  const counters = countersData || {
    active_projects: 0,
    on_track_projects: 0,
    at_risk_projects: 0,
    blocked_projects: 0,
    completed_projects: 0,
  };

  const isLoading = clientsLoading || projectsLoading || milestonesLoading || membersLoading || assignmentsLoading || countersLoading;

  const [clientFilter, setClientFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [projectSearch, setProjectSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const channel = api.channel("overview-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "projects" }, () => {
        qc.invalidateQueries({ queryKey: ["projects"] });
        qc.invalidateQueries({ queryKey: ["dashboard_counters"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "milestones" }, () => qc.invalidateQueries({ queryKey: ["milestones"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "team_members" }, () => qc.invalidateQueries({ queryKey: ["team_members"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "project_assignments" }, () => qc.invalidateQueries({ queryKey: ["project_assignments"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "clients" }, () => qc.invalidateQueries({ queryKey: ["clients"] }))
      .subscribe();
    return () => { api.removeChannel(channel); };
  }, [qc]);

  // Reset pagination when filters change
  useEffect(() => { setCurrentPage(1); }, [clientFilter, statusFilter, projectSearch]);

  const filteredProjects = (projects || []).filter((p) => {
    const byClient = clientFilter === "all" || p.client_id === clientFilter;
    const byStatus = statusFilter === "all"
      ? true
      : statusFilter === "Active"
        ? (p.status === "On Track" || p.status === "At Risk")
        : (p.status || "") === statusFilter;
    const bySearch = !projectSearch.trim() || p.name.toLowerCase().includes(projectSearch.toLowerCase().trim());
    return byClient && byStatus && bySearch;
  });

  const revenueScopeLabel = useMemo(() => {
    const parts: string[] = [];
    if (clientFilter === "all") parts.push("All clients");
    else {
      const cn = clients?.find((c) => c.id === clientFilter)?.name;
      parts.push(cn || "Selected client");
    }
    if (statusFilter === "all") parts.push("All statuses");
    else if (statusFilter === "Active") parts.push("Active (On Track + At Risk)");
    else parts.push(statusFilter);
    if (projectSearch.trim()) parts.push(`Search: "${projectSearch.trim()}"`);
    return parts.join(" · ");
  }, [clientFilter, statusFilter, projectSearch, clients]);

  const revenueTotals = useMemo(
    () => aggregateRevenueForProjectList(filteredProjects, milestones || []),
    [filteredProjects, milestones]
  );

  const realizedFootnote = revenueTotals.hasAmounts
    ? "Portfolio actualized ÷ planned for projects in the current filter"
    : "Enter planned totals and milestone values on each project to populate revenue.";

  const totalProjects = (projects || []).length;

  // Projects by Status data for donut chart
  const statusCounts = {
    "On Track": (projects || []).filter((p) => p.status === "On Track").length,
    "Completed": (projects || []).filter((p) => p.status === "Completed").length,
    "At Risk": (projects || []).filter((p) => p.status === "At Risk").length,
    "Inactive": (projects || []).filter((p) => !["On Track", "At Risk", "Completed"].includes(p.status || "")).length,
  };

  const pieData = [
    { name: "On Track", value: statusCounts["On Track"], color: "#22c55e" },
    { name: "Completed", value: statusCounts["Completed"], color: "#3b82f6" },
    { name: "At Risk", value: statusCounts["At Risk"], color: "#f59e0b" },
    { name: "Inactive", value: statusCounts["Inactive"], color: "#94a3b8" },
  ].filter((d) => d.value > 0 || true); // keep all for legend

  // Milestone completion by client
  const filteredProjectIds = new Set(filteredProjects.map((p) => p.id));
  const filteredMilestones = (milestones || []).filter((m) => filteredProjectIds.has(m.project_id || ""));

  const clientCompletionData = (clients || []).map((c) => {
    const projIds = filteredProjects.filter((p) => p.client_id === c.id).map((p) => p.id);
    const clientMs = filteredMilestones.filter((m) => projIds.includes(m.project_id || ""));
    const done = clientMs.filter((m) => m.completion_pct === 100).length;
    const total = clientMs.length;
    return { name: c.name, pct: total ? Math.round((done / total) * 100) : 0, done, total };
  }).filter((d) => d.total > 0);

  // Recent activity: projects sorted by latest milestone update
  const recentActivity = (projects || [])
    .map((p) => {
      const pMs = (milestones || []).filter((m) => m.project_id === p.id);
      const signedOff = pMs.filter((m) => m.client_signoff_status === "Done").length;
      const latestMs = pMs.reduce<{ updated_at: string | null } | null>((latest, m) => {
        if (!latest || (m.updated_at && (!latest.updated_at || m.updated_at > latest.updated_at))) return m;
        return latest;
      }, null);
      return {
        id: p.id,
        name: p.name,
        status: p.status,
        signedOff,
        total: pMs.length,
        updatedAt: latestMs?.updated_at || p.updated_at,
      };
    })
    .filter((a) => a.updatedAt)
    .sort((a, b) => (b.updatedAt! > a.updatedAt! ? 1 : -1))
    .slice(0, 5);

  const getProjectResources = (projectId: string) => {
    const memberIds = assignments?.filter((a) => a.project_id === projectId).map((a) => a.team_member_id) || [];
    return members?.filter((m) => memberIds.includes(m.id)).map((m) => m.name).join(", ") || "—";
  };

  const getSignoffProgress = (projectId: string) => {
    const pMs = (milestones || []).filter((m) => m.project_id === projectId);
    const signed = pMs.filter((m) => m.client_signoff_status === "Done").length;
    return { signed, total: pMs.length };
  };

  // Pagination
  const totalPages = Math.ceil(filteredProjects.length / PAGE_SIZE);
  const paginatedProjects = filteredProjects.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const pctOfTotal = (count: number) =>
    totalProjects ? Math.round((count / totalProjects) * 100) : 0;

  const kpiCards = [
    {
      icon: Briefcase,
      lottie: activeProjectsAnim,
      label: "Active Projects",
      statusValue: "Active",
      value: counters.active_projects,
      pct: pctOfTotal(counters.active_projects),
      iconBg: "bg-blue-100",
      iconColor: "text-blue-600",
      cardBg: "bg-gradient-to-br from-blue-300/80 via-blue-100/60 to-white",
    },
    {
      icon: TrendingUp,
      lottie: onTrackAnim,
      label: "On Track",
      statusValue: "On Track",
      value: counters.on_track_projects,
      pct: pctOfTotal(counters.on_track_projects),
      iconBg: "bg-emerald-100",
      iconColor: "text-emerald-600",
      cardBg: "bg-gradient-to-br from-emerald-300/80 via-emerald-100/60 to-white",
    },
    {
      icon: ShieldAlert,
      lottie: atRiskAnim,
      label: "At Risk",
      statusValue: "At Risk",
      value: counters.at_risk_projects,
      pct: pctOfTotal(counters.at_risk_projects),
      iconBg: "bg-amber-100",
      iconColor: "text-amber-600",
      cardBg: "bg-gradient-to-br from-amber-300/80 via-amber-100/60 to-white",
    },
    {
      icon: Archive,
      lottie: blockedAnim,
      label: "Inactive",
      statusValue: "Blocked",
      value: counters.blocked_projects,
      pct: pctOfTotal(counters.blocked_projects),
      iconBg: "bg-red-100",
      iconColor: "text-red-500",
      cardBg: "bg-gradient-to-br from-red-300/80 via-red-100/60 to-white",
    },
    {
      icon: Zap,
      lottie: completedAnim,
      label: "Completed",
      statusValue: "Completed",
      value: counters.completed_projects,
      pct: pctOfTotal(counters.completed_projects),
      iconBg: "bg-blue-100",
      iconColor: "text-blue-600",
      cardBg: "bg-gradient-to-br from-blue-300/80 via-blue-100/60 to-white",
    },
  ];

  const activityStatusColor = (status: string | null) => {
    if (status === "On Track") return "text-emerald-500";
    if (status === "Completed") return "text-blue-500";
    if (status === "At Risk") return "text-amber-500";
    return "text-gray-400";
  };

  const CustomDonutLabel = ({ cx, cy }: any) => (
    <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central">
      <tspan x={cx} dy="-0.6em" fontSize="22" fontWeight="700" fill="#111827">{totalProjects}</tspan>
      <tspan x={cx} dy="1.4em" fontSize="11" fill="#6b7280">Total Projects</tspan>
    </text>
  );

  return (
    <AppLayout>
      <Topbar
        title="Overview" />

      <div className="p-6 space-y-5 animate-fade-in">
        {/* Filters */}
        <div className="grid grid-cols-3 gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <FilterSelect
            value={clientFilter}
            onChange={setClientFilter}
            label="Client"
            placeholder="All Clients"
            options={[
              { label: "All Clients", value: "all" },
              ...((clients || []).map((c) => ({ label: c.name, value: c.id }))),
            ]}
          />
          <FilterSelect
            value={statusFilter}
            onChange={setStatusFilter}
            label="Status"
            placeholder="All Status"
            options={[
              { label: "All Status", value: "all" },
              { label: "Active (On Track + At Risk)", value: "Active" },
              { label: "On Track", value: "On Track" },
              { label: "At Risk", value: "At Risk" },
              { label: "Blocked", value: "Blocked" },
              { label: "Completed", value: "Completed" },
            ]}
          />
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Search</label>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={projectSearch}
                onChange={(e) => setProjectSearch(e.target.value)}
                placeholder="Search project name, manager, client..."
                className="w-full rounded-lg border border-gray-300 bg-white pl-8 pr-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 transition-all hover:border-blue-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-5 gap-4">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-28 w-full rounded-xl" />
            ))
          ) : (
            kpiCards.map((kpi) => {
              const isActive = statusFilter === kpi.statusValue;
              return (
                <div
                  key={kpi.label}
                  onClick={() => setStatusFilter(isActive ? "all" : kpi.statusValue)}
                  className={`relative flex items-center rounded-xl border p-5 shadow-sm cursor-pointer transition-all hover:shadow-md overflow-hidden ${kpi.cardBg} ${isActive ? "ring-2 ring-blue-500 border-blue-300" : "border-gray-200 hover:border-blue-200"}`}
                >
                  <div className="flex-1 min-w-0 z-10">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide truncate">{kpi.label}</p>
                    <p className="text-4xl font-black text-gray-900 leading-tight">{kpi.value}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{kpi.pct}% of total</p>
                  </div>
                  <div className="absolute right-0 top-0 bottom-0 w-2/5 opacity-90">
                    {kpi.lottie ? (
                      <Lottie animationData={kpi.lottie} loop={true} style={{ height: '100%', width: '100%' }} />
                    ) : (
                      <div className={`flex h-full items-center justify-center ${kpi.iconBg}`}>
                        <kpi.icon size={48} className={kpi.iconColor} />
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Revenue analytics — same filter scope as project list (KPI + dropdown + search) */}
        {!isLoading && (
        <div className="rounded-xl border border-slate-200/90 bg-gradient-to-r from-slate-50/80 via-white to-indigo-50/30 p-5 shadow-sm">
          <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Revenue pipeline</h3>
              <p className="text-[11px] font-medium text-slate-500 mt-0.5">{revenueScopeLabel}</p>
            </div>
            <p className="text-[10px] font-semibold text-slate-600 rounded-md bg-slate-100/90 px-2 py-1 w-fit border border-slate-200/80 max-w-md leading-snug">
              Totals use saved data: project <span className="font-mono">total_revenue_planned_rupees</span> (when set) and milestone sums — same scope as the table below (respects Active / On Track / etc.).
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <RevenueStatCard
              title="Total revenue planned"
              subtitle={`Across ${filteredProjects.length} project${filteredProjects.length === 1 ? "" : "s"} in view`}
              amountDisplay={formatRupeeCompact(revenueTotals.planned)}
              tone="planned"
              footnote="Sum of effective planned per row (header or milestone planned)"
              icon={<Target size={18} className="text-indigo-600" aria-hidden />}
            />
            <RevenueStatCard
              title="Total revenue received"
              subtitle="Sum of milestone value actual (saved)"
              amountDisplay={formatRupeeCompact(revenueTotals.received)}
              tone="received"
              footnote="Edit milestone actuals on each project’s Milestone Tracker"
              icon={<Wallet size={18} className="text-emerald-600" aria-hidden />}
            />
            <RevenueStatCard
              title="Remaining revenue"
              subtitle="Planned minus received"
              amountDisplay={formatRupeeCompact(revenueTotals.remaining)}
              tone="remaining"
              footnote={revenueTotals.remaining === 0 ? "Fully received vs planned in view" : undefined}
              icon={<Landmark size={18} className="text-amber-700" aria-hidden />}
            />
            <RevenueStatCard
              title="Value realized %"
              subtitle="Portfolio from amounts in current filter"
              amountDisplay={
                revenueTotals.realizedPct != null
                  ? formatPercentFromNumber(revenueTotals.realizedPct)
                  : "—"
              }
              tone="realized"
              footnote={realizedFootnote}
              icon={<Percent size={18} className="text-violet-600" aria-hidden />}
            />
          </div>
        </div>
        )}



        {/* Project Status Table */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-gray-200 px-6 py-5 flex flex-col gap-2">
            <h3 className="text-base font-bold text-gray-900">Project Status</h3>
            <p className="text-sm text-slate-600 font-medium leading-relaxed max-w-4xl">
              Revenue figures are read-only here (saved project + milestone data). Open a project to edit amounts on the Milestone Tracker.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[15px] leading-snug">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-left">
                  {["CLIENT", "PROJECT", "TYPE", "MANAGER", "RESOURCES", "STATUS", "SIGNOFF", "Invoice", "TOTAL BUSINESS VALUE", "ACTUALIZED VALUE", "VALUE REALIZED %"].map((h) => (
                    <th key={h} className="px-6 py-4 text-xs font-bold text-gray-600 tracking-widest uppercase whitespace-nowrap align-bottom">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-gray-100 bg-white">
                      {Array.from({ length: 11 }).map((_, j) => (
                        <td key={j} className="px-6 py-5"><Skeleton className="h-5 w-full" /></td>
                      ))}
                    </tr>
                  ))
                ) : paginatedProjects.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-6 py-14 text-center text-base text-gray-400">
                      No projects match the current filters.
                    </td>
                  </tr>
                ) : (
                  paginatedProjects.map((p, idx) => {
                    const client = clients?.find((c) => c.id === p.client_id);
                    const signoff = getSignoffProgress(p.id);
                    const pMs = milestones?.filter((m) => m.project_id === p.id) || [];
                    const completedInvoices = pMs.filter((m) => m.invoice_status === "Done").length;
                    const rowRev = projectRevenueFromApi(p, milestones || []);
                    const realizedPctRow =
                      rowRev.planned > 0 ? (rowRev.received / rowRev.planned) * 100 : null;
                    const cell = "px-6 py-5 text-gray-700 align-middle";
                    return (
                      <tr
                        key={p.id}
                        onClick={() => navigate(`/projects?id=${p.id}`)}
                        className={`border-b border-gray-100 cursor-pointer transition-colors hover:bg-blue-50 last:border-0 ${idx % 2 === 0 ? "bg-white" : "bg-gray-50/50"}`}
                      >
                        <td className={`${cell} font-medium whitespace-nowrap`}>{client?.name || "—"}</td>
                        <td className={`${cell} font-semibold text-gray-900 whitespace-nowrap text-base`}>{p.name}</td>
                        <td className={`${cell} text-gray-600 whitespace-nowrap`}>{p.service_type || "—"}</td>
                        <td className={`${cell} text-gray-700 whitespace-nowrap`}>{p.delivery_manager || "—"}</td>
                        <td className={`${cell} text-gray-600 min-w-[220px] max-w-[320px] truncate`}>{getProjectResources(p.id)}</td>
                        <td className={`${cell} whitespace-nowrap`}>
                          <span className={statusBadge(p.status)}>{p.status || "—"}</span>
                        </td>
                        <td className={`${cell} whitespace-nowrap`}>
                          <span className="font-semibold text-gray-900">{signoff.signed}</span>
                          <span className="text-gray-400"> / {signoff.total} signed off</span>
                        </td>
                        <td className={`${cell} min-w-[150px]`}>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-gray-900">{completedInvoices}</span>
                            <span className="text-gray-400"> / {pMs.length || 0} completed</span>
                          </div>
                        </td>
                        <td className={`${cell} min-w-[140px] font-mono text-base font-semibold tabular-nums text-slate-900`}>
                          {formatRupeeCompact(rowRev.planned)}
                        </td>
                        <td className={`${cell} min-w-[140px] font-mono text-base font-semibold tabular-nums text-slate-900`}>
                          {formatRupeeCompact(rowRev.received)}
                        </td>
                        <td className={`${cell} min-w-[110px] font-mono text-base font-semibold tabular-nums text-slate-900`}>
                          {realizedPctRow != null ? formatPercentFromNumber(realizedPctRow) : "—"}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between border-t border-gray-100 px-6 py-4">
            <p className="text-sm text-gray-500">
              Showing {filteredProjects.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1} to{" "}
              {Math.min(currentPage * PAGE_SIZE, filteredProjects.length)} of {filteredProjects.length} projects
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft size={15} />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`h-7 w-7 rounded-lg text-xs font-semibold transition-colors ${page === currentPage ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-100"}`}
                >
                  {page}
                </button>
              ))}
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages || totalPages === 0}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        </div>
        {/* Charts + Activity Row */}
        <div className="grid grid-cols-[5fr_6fr_4fr] gap-4">
          {/* Projects by Status - Donut Chart */}
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm flex flex-col">
            <h3 className="text-sm font-bold text-gray-900 mb-4">Projects by Status</h3>
            <div className="flex-1 flex flex-col">
              {isLoading ? (
                <div className="space-y-4 flex-1 flex flex-col justify-center px-4">
                  <Skeleton className="h-[180px] w-[180px] rounded-full mx-auto" />
                  <div className="space-y-3 mt-4">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-5/6" />
                    <Skeleton className="h-4 w-4/6" />
                  </div>
                </div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={58}
                        outerRadius={85}
                        dataKey="value"
                        labelLine={false}
                        label={<CustomDonutLabel />}
                        strokeWidth={2}
                        stroke="#fff"
                      >
                        {pieData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="mt-3 space-y-1.5">
                    {pieData.map((d) => (
                      <div key={d.name} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: d.color }} />
                          <span className="text-gray-600">{d.name}</span>
                        </div>
                        <span className="font-semibold text-gray-900">
                          {d.value} <span className="text-gray-400 font-normal">({totalProjects ? Math.round((d.value / totalProjects) * 100) : 0}%)</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
            <button
              onClick={() => navigate("/projects")}
              className="mt-4 flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors"
            >
              View all projects <ArrowRight size={12} />
            </button>
          </div>

          {/* Milestone Completion by Client */}
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm flex flex-col">
            <h3 className="text-sm font-bold text-gray-900 mb-1">Milestone Completion by Client</h3>
            <p className="text-xs text-gray-400 mb-3">% of milestones completed</p>
            <div className="flex-1">
              {isLoading ? (
                <div className="space-y-4 px-2 py-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-4">
                      <Skeleton className="h-4 w-1/4" />
                      <Skeleton className="h-4 w-3/4" />
                    </div>
                  ))}
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={clientCompletionData} layout="vertical" margin={{ left: 80, right: 24, top: 4, bottom: 4 }}>
                    <XAxis
                      type="number"
                      domain={[0, 100]}
                      tick={{ fontSize: 10, fill: "#9ca3af" }}
                      tickFormatter={(v) => `${v}`}
                      label={{ value: "% Completion", position: "insideBottom", offset: -2, fontSize: 10, fill: "#9ca3af" }}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      tick={{ fontSize: 11, fill: "#374151", fontWeight: 500 }}
                      width={78}
                    />
                    <Tooltip
                      contentStyle={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 12, padding: "8px 12px" }}
                      formatter={(v: number, _: string, p: any) => [`${p.payload.done}/${p.payload.total} milestones (${v}%)`, "Completion"]}
                    />
                    <Bar dataKey="pct" radius={[0, 6, 6, 0]} maxBarSize={18}>
                      {clientCompletionData.map((_, i) => (
                        <Cell key={i} fill={`hsl(${217 + i * 12}, 80%, ${52 + (i % 3) * 4}%)`} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm flex flex-col">
            <h3 className="text-sm font-bold text-gray-900 mb-4">Recent Activity</h3>
            <div className="flex-1 space-y-3">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-6 w-6 rounded-full" />
                    <div className="space-y-1.5 flex-1">
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-2.5 w-1/2" />
                    </div>
                  </div>
                ))
              ) : recentActivity.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-8">No recent activity</p>
              ) : (
                recentActivity.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => navigate(`/projects?id=${item.id}`)}
                    className="flex items-start gap-2.5 cursor-pointer group"
                  >
                    {item.status === "Completed" ? (
                      <CheckCircle2 size={14} className="mt-0.5 flex-shrink-0 text-blue-500" />
                    ) : (
                      <Circle size={14} className={`mt-0.5 flex-shrink-0 ${activityStatusColor(item.status)}`} fill="currentColor" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-800 truncate group-hover:text-blue-600 transition-colors">
                        {item.name}
                      </p>
                      <p className="text-[10px] text-gray-500 mt-0.5">
                        {item.signedOff}/{item.total} signed off
                      </p>
                    </div>
                    <span className="text-[10px] text-gray-400 whitespace-nowrap flex-shrink-0 mt-0.5">
                      {item.updatedAt
                        ? formatDistanceToNow(new Date(item.updatedAt), { addSuffix: false })
                          .replace("about ", "")
                          .replace(" hours", "h")
                          .replace(" hour", "h")
                          .replace(" minutes", "m")
                          .replace(" days", "d")
                          .replace(" day", "d")
                        : "—"}
                    </span>
                  </div>
                ))
              )}
            </div>
            <button
              onClick={() => navigate("/projects")}
              className="mt-4 flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors"
            >
              View all activity <ArrowRight size={12} />
            </button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default Overview;
