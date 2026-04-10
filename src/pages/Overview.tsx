import { useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import Topbar from "@/components/layout/Topbar";
import FilterSelect from "@/components/common/FilterSelect";
import { useClients, useProjects, useMilestones, useTeamMembers, useAssignments } from "@/hooks/useData";
import { api, apiUrl } from "@/lib/api";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Zap, AlertTriangle, AlertOctagon, AlertCircle, X } from "lucide-react";

interface DashboardCounters {
  active_projects: number;
  on_track_projects: number;
  at_risk_projects: number;
  blocked_projects: number;
  completed_projects: number;
}

const statusBadge = (s: string | null) => {
  const base = "inline-flex items-center rounded-full px-3 py-1 text-xs font-bold";
  if (s === "On Track") return `${base} bg-emerald-100 text-emerald-700 border border-emerald-300`;
  if (s === "At Risk") return `${base} bg-amber-100 text-amber-700 border border-amber-300`;
  if (s === "Blocked") return `${base} bg-red-100 text-red-700 border border-red-300`;
  if (s === "Completed") return `${base} bg-blue-100 text-blue-700 border border-blue-300`;
  return `${base} bg-gray-200 text-gray-700 border border-gray-300`;
};

const Overview = () => {
  const { data: clients } = useClients();
  const { data: projects } = useProjects();
  const { data: milestones } = useMilestones();
  const { data: members } = useTeamMembers();
  const { data: assignments } = useAssignments();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [clientFilter, setClientFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [projectSearch, setProjectSearch] = useState("");
  const [counters, setCounters] = useState<DashboardCounters>({
    active_projects: 0,
    on_track_projects: 0,
    at_risk_projects: 0,
    blocked_projects: 0,
    completed_projects: 0,
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

  // Milestone completion by client
  const clientCompletionData = clients?.map((c) => {
    const projIds = filteredProjects.filter((p) => p.client_id === c.id).map((p) => p.id) || [];
    const clientMs = filteredMilestones.filter((m) => projIds.includes(m.project_id || "")) || [];
    const done = clientMs.filter((m) => m.completion_pct === 100).length;
    const total = clientMs.length;
    return { name: c.name, pct: total ? Math.round((done / total) * 100) : 0, done, total };
  }) || [];

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

      <div className="p-6 space-y-5 animate-fade-in">
        {/* Filters */}
        <div className="grid grid-cols-3 gap-4 rounded-lg border border-gray-200 bg-gradient-to-b from-white to-gray-50 p-4">
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
            <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
              Search
            </label>
            <input
              value={projectSearch}
              onChange={(e) => setProjectSearch(e.target.value)}
              placeholder="Search Project Name"
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 font-medium placeholder-gray-400 transition-all duration-200 hover:border-blue-500/50 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
          </div>
        </div>

        {/* KPI Row - Dashboard Counters */}
        <div className="grid grid-cols-5 gap-4">
          {[
            {
              icon: Zap,
              label: "Active Projects",
              value: counters.active_projects,
              color: "text-emerald-700",
              bgColor: "bg-emerald-50 border-emerald-200"
            },
            {
              icon: AlertTriangle,
              label: "On Track Projects",
              value: counters.on_track_projects,
              color: "text-amber-700",
              bgColor: "bg-amber-50 border-amber-200"
            },
            {
              icon: AlertOctagon,
              label: "At Risk Projects",
              value: counters.at_risk_projects,
              color: "text-red-700",
              bgColor: "bg-red-50 border-red-200"
            },
            {
              icon: AlertCircle,
              label: "Blocked Projects",
              value: counters.blocked_projects,
              color: "text-indigo-700",
              bgColor: "bg-indigo-50 border-indigo-200"
            },
            {
              icon: Zap,
              label: "Completed Projects",
              value: counters.completed_projects,
              color: "text-white",
              bgColor: "bg-emerald-600 border-emerald-700"
            },
          ].map((kpi) => (
            <div
              key={kpi.label}
              className={`flex flex-col items-center justify-center rounded-2xl border-2 ${kpi.bgColor} p-4 text-center shadow-lg transition-all hover:shadow-xl h-[160px] relative overflow-hidden group`}
            >
              <p className={`text-sm font-black uppercase tracking-[0.2em] mb-2 ${kpi.label === "Completed Projects" ? "text-emerald-50" : "text-gray-700"}`}>
                {kpi.label.replace(" Projects", "")}
              </p>
              <div className="flex items-center gap-3">
                <p className={`text-6xl font-black tracking-tight ${kpi.label === "Completed Projects" ? "text-white" : "text-gray-950"}`}>
                  {kpi.value}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Project Status Table */}
        <div className="rounded-lg border border-gray-200 bg-gradient-to-b from-white to-gray-50 shadow-lg overflow-hidden">
          <div className="border-b border-gray-200 px-6 py-4 bg-gradient-to-r from-blue-50 to-blue-100/50">
            <h3 className="text-lg font-bold text-gray-900">Project Status</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gradient-to-r from-gray-50 to-gray-100 text-left">
                  {["Client", "Project", "Type", "Manager", "Resources", "Status", "Invoice"].map((h) => (
                    <th key={h} className="px-6 py-4 font-bold text-gray-900 tracking-wide uppercase text-xs">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredProjects.map((p, idx) => {
                  const client = clients?.find((c) => c.id === p.client_id);
                  const prog = getProjectMilestoneProgress(p.id);
                  const pMs = milestones?.filter((m) => m.project_id === p.id) || [];
                  const raisedInvoices = pMs.filter((m) => m.invoice_status === "Raised").length;
                  const pendingInvoices = pMs.filter((m) => m.invoice_status === "Pending").length;
                  const isEvenRow = idx % 2 === 0;
                  return (
                    <tr
                      key={p.id}
                      onClick={() => navigate(`/projects?id=${p.id}`)}
                      className={`border-b border-gray-200 cursor-pointer transition-all duration-200 ${isEvenRow ? "bg-gray-50" : "bg-white"
                        } hover:bg-blue-50 last:border-0`}
                    >
                      <td className="px-6 py-4 text-gray-600 font-medium">{client?.name}</td>
                      <td className="px-6 py-4 font-bold text-gray-900">{p.name}</td>
                      <td className="px-6 py-4 text-gray-600">{p.service_type}</td>
                      <td className="px-6 py-4 text-gray-600">{p.delivery_manager}</td>
                      <td className="px-6 py-4 text-gray-600 min-w-[300px] break-words">{getProjectResources(p.id)}</td>
                      <td className="px-6 py-4"><span className={statusBadge(p.status)}>{p.status}</span></td>
                      <td className="px-6 py-4 text-gray-600 whitespace-nowrap">
                        <span className="font-bold text-gray-900">{raisedInvoices}</span>
                        <span className="text-gray-600">/{pMs.length || 0} raised</span>
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
          <div className="rounded-lg border border-gray-200 bg-gradient-to-br from-white to-gray-50 p-6 shadow-lg">
            <div className="mb-6">
              <h3 className="text-lg font-bold text-gray-900">Milestone Completion by Client</h3>
              <p className="text-xs text-gray-500 mt-1">Performance across all clients</p>
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
        </div>
      </div>
    </AppLayout>
  );
};

export default Overview;
