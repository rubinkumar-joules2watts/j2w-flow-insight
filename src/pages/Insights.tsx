import React, { useMemo, useState, useEffect } from "react";
import AppLayout from "@/components/layout/AppLayout";
import Topbar from "@/components/layout/Topbar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Loader2, Download, Edit2, Wand2, Search, FileText, X, Check } from "lucide-react";

interface Project {
  id: string;
  name: string;
  status: string;
}

interface MilestoneReport {
  id: string;
  name: string;
  description: string;
  status: string;
  timeline_summary: string;
  window_start?: string;
  window_end?: string;
  log_count?: number;
}

interface ProjectReport {
  project_id: string;
  project_name: string;
  status: string;
  executive_summary: string;
  window_start: string;
  window_end: string;
  milestones: MilestoneReport[];
}

type ProjectProgressStatus = "queued" | "reading" | "synthesizing" | "done" | "error";

type ProjectProgress = {
  projectName: string;
  status: ProjectProgressStatus;
  detail: string;
};

type BatchMode = "single" | "per_project";
type ExportFormat = "docx" | "pdf";

const getCurrentMonthRange = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    startDate: start.toISOString().split("T")[0],
    endDate: end.toISOString().split("T")[0],
  };
};

type ParsedSummarySection = {
  heading?: string;
  bullets: string[];
};

const parseSummarySections = (raw: string): ParsedSummarySection[] => {
  const lines = (raw || "")
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const sections: ParsedSummarySection[] = [];
  let current: ParsedSummarySection = { bullets: [] };

  const pushCurrent = () => {
    if (current.heading || current.bullets.length > 0) {
      sections.push(current);
    }
  };

  for (const line of lines) {
    if (line.startsWith("##")) {
      pushCurrent();
      current = {
        heading: line.replace(/^##+\s*/, "").trim(),
        bullets: [],
      };
      continue;
    }

    const bulletMatch = line.match(/^[-*•]\s+(.*)$/);
    if (bulletMatch) {
      current.bullets.push(bulletMatch[1].trim());
      continue;
    }

    // Keep non-bullet lines as points so model output is never dropped.
    current.bullets.push(line);
  }

  pushCurrent();
  return sections;
};

const renderSummaryText = (text: string) => {
  const sections = parseSummarySections(text);

  if (sections.length === 0) {
    return <p className="text-base font-medium text-slate-700 leading-8">No summary generated.</p>;
  }

  return (
    <div className="space-y-7">
      {sections.map((section, sIdx) => (
        <section key={`summary-section-${sIdx}`} className="space-y-3.5">
          {section.heading && (
            <h5 className="text-sm font-black text-slate-900 tracking-wide">{section.heading}</h5>
          )}
          <ul className="space-y-2.5 pl-5 list-disc marker:text-slate-400">
            {section.bullets.map((bullet, bIdx) => (
              <li key={`summary-section-${sIdx}-bullet-${bIdx}`} className="text-[15px] font-medium text-slate-700 leading-7">
                {bullet}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
};

const Insights = () => {
  const monthRange = getCurrentMonthRange();

  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [projectSearch, setProjectSearch] = useState("");
  const [startDate, setStartDate] = useState<string>(monthRange.startDate);
  const [endDate, setEndDate] = useState<string>(monthRange.endDate);

  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState<Record<string, ProjectProgress>>({});

  const [reports, setReports] = useState<ProjectReport[] | null>(null);

  const [batchMode, setBatchMode] = useState<BatchMode>("single");
  const [exportFormat, setExportFormat] = useState<ExportFormat>("docx");
  const [isExporting, setIsExporting] = useState(false);
  const [exportFiles, setExportFiles] = useState<Array<{ file_name: string; download_url: string }>>([]);
  const [isEditMode, setIsEditMode] = useState(false);

  useEffect(() => {
    void fetchProjects();
  }, []);

  const filteredProjects = useMemo(() => {
    const q = projectSearch.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter((p) => `${p.name} ${p.status}`.toLowerCase().includes(q));
  }, [projects, projectSearch]);

  const fetchProjects = async () => {
    try {
      const baseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
      const response = await fetch(`${baseUrl}/api/projects`);
      const data = await response.json();
      setProjects(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to fetch projects", error);
      toast.error("Failed to load projects");
    }
  };

  const updateProgress = (projectId: string, next: Partial<ProjectProgress>) => {
    setProgress((prev) => ({
      ...prev,
      [projectId]: {
        projectName: prev[projectId]?.projectName || projects.find((p) => p.id === projectId)?.name || "Project",
        status: prev[projectId]?.status || "queued",
        detail: prev[projectId]?.detail || "Queued",
        ...next,
      },
    }));
  };

  const handleGenerate = async () => {
    if (selectedProjectIds.length === 0) {
      toast.error("Please select at least one project");
      return;
    }

    if (startDate > endDate) {
      toast.error("Start date cannot be after end date");
      return;
    }

    const orderedIds = [...selectedProjectIds];
    const initialProgress: Record<string, ProjectProgress> = {};
    for (const id of orderedIds) {
      initialProgress[id] = {
        projectName: projects.find((p) => p.id === id)?.name || "Project",
        status: "queued",
        detail: "Queued",
      };
    }

    setProgress(initialProgress);
    setReports(null);
    setExportFiles([]);
    setIsGenerating(true);

    const generated: ProjectReport[] = [];
    const baseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

    for (const projectId of orderedIds) {
      try {
        updateProgress(projectId, { status: "reading", detail: "Reading project history..." });

        const response = await fetch(`${baseUrl}/api/reports/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            project_ids: [projectId],
            start_date: startDate,
            end_date: endDate,
          }),
        });

        if (!response.ok) {
          throw new Error(`Generation failed (${response.status})`);
        }

        updateProgress(projectId, { status: "synthesizing", detail: "Synthesizing executive narrative..." });

        const data = (await response.json()) as ProjectReport[];
        if (Array.isArray(data) && data[0]) {
          generated.push(data[0]);
        }

        updateProgress(projectId, { status: "done", detail: "Completed" });
      } catch (error) {
        console.error(error);
        updateProgress(projectId, { status: "error", detail: "Failed to generate" });
      }
    }

    setIsGenerating(false);
    setReports(generated);
    setIsConfigOpen(false);

    if (generated.length > 0) {
      toast.success(`Generated ${generated.length} project report${generated.length > 1 ? "s" : ""}`);
    } else {
      toast.error("No reports generated. Please check project data in selected window.");
    }
  };

  const handleExport = async (formatOverride?: ExportFormat) => {
    if (!reports || reports.length === 0) {
      toast.error("No reports available to export");
      return;
    }

    const activeFormat = formatOverride || exportFormat;
    setIsExporting(true);
    setExportFiles([]);

    try {
      const baseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
      const response = await fetch(`${baseUrl}/api/export-status-report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reports,
          batch_mode: batchMode,
          format: activeFormat,
          file_name: `status_report_${startDate}_${endDate}`,
        }),
      });

      if (!response.ok) {
        throw new Error("Export failed");
      }

      const data = await response.json();
      const files = Array.isArray(data?.files) ? data.files : [];
      const normalized = files
        .filter((f: any) => typeof f?.download_url === "string")
        .map((f: any) => ({ file_name: f.file_name as string, download_url: f.download_url as string }));

      setExportFiles(normalized);

      if (normalized[0]) {
        const fileUrl = `${baseUrl}${normalized[0].download_url}`;
        const fileResp = await fetch(fileUrl);
        if (!fileResp.ok) {
          throw new Error("Failed to download exported file");
        }

        const blob = await fileResp.blob();
        const objectUrl = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = objectUrl;
        link.download = normalized[0].file_name;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(objectUrl);
      }

      toast.success("Export generated successfully");
    } catch (error) {
      console.error(error);
      toast.error("Failed to export report");
    } finally {
      setIsExporting(false);
    }
  };

  const renderProgressDot = (status: ProjectProgressStatus) => {
    if (status === "done") return "bg-emerald-500";
    if (status === "error") return "bg-red-500";
    if (status === "reading" || status === "synthesizing") return "bg-blue-500 animate-pulse";
    return "bg-slate-300";
  };

  return (
    <AppLayout>
      <div className="flex flex-col h-full bg-slate-50 overflow-hidden">
        <Topbar title="Insight Studio" />

        <div className="flex-1 flex overflow-hidden">
          {/* LEFT: CONFIGURATION PANEL */}
          <aside className="w-80 border-r border-slate-200 bg-white flex flex-col shadow-sm z-10">
            <div className="p-5 border-b border-slate-100 bg-slate-50/50">
              <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <Wand2 size={20} className="text-blue-600" />
                Generator Config
              </h2>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-1">Setup your reporting window</p>
            </div>

            <ScrollArea className="flex-1 p-5">
              <div className="space-y-6">
                {/* Date Horizon */}
                <div className="space-y-3">
                  <Label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1">Reporting Horizon</Label>
                  <div className="grid grid-cols-1 gap-2">
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-[9px] font-black text-slate-400 uppercase">From</span>
                      <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-10 pl-11 text-xs font-bold border-slate-200 focus:border-blue-400 transition-all rounded-xl" />
                    </div>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-[9px] font-black text-slate-400 uppercase">Until</span>
                      <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-10 pl-11 text-xs font-bold border-slate-200 focus:border-blue-400 transition-all rounded-xl" />
                    </div>
                  </div>
                </div>

                {/* Project Selection */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between pl-1">
                    <Label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Projects</Label>
                    <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">{selectedProjectIds.length} Selected</span>
                  </div>
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                    <Input
                      value={projectSearch}
                      onChange={(e) => setProjectSearch(e.target.value)}
                      placeholder="Search projects..."
                      className="pl-9 h-10 text-xs border-slate-200 rounded-xl"
                    />
                  </div>

                  <div className="space-y-1 mt-2">
                    {filteredProjects.map((p) => {
                      const checked = selectedProjectIds.includes(p.id);
                      return (
                        <div
                          key={p.id}
                          onClick={() => {
                            if (checked) setSelectedProjectIds((prev) => prev.filter((id) => id !== p.id));
                            else setSelectedProjectIds((prev) => [...prev, p.id]);
                          }}
                          className={`group flex items-center gap-3 p-2.5 rounded-xl border cursor-pointer transition-all ${
                            checked ? "bg-blue-50 border-blue-200 shadow-sm" : "bg-white border-transparent hover:bg-slate-50"
                          }`}
                        >
                          <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${checked ? "bg-blue-600 border-blue-600" : "border-slate-300"}`}>
                            {checked && <Check size={10} className="text-white" />}
                          </div>
                          <div className="min-w-0">
                            <p className={`font-bold text-xs truncate ${checked ? "text-blue-900" : "text-slate-700"}`}>{p.name}</p>
                            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tight">{p.status}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </ScrollArea>

            <div className="p-5 border-t border-slate-100 bg-white">
              <Button
                onClick={handleGenerate}
                disabled={isGenerating || selectedProjectIds.length === 0}
                className="w-full h-12 bg-slate-900 hover:bg-black text-white font-black text-sm gap-2 rounded-xl shadow-lg transition-all active:scale-95"
              >
                {isGenerating ? <Loader2 className="animate-spin" /> : <Wand2 size={16} />}
                Generate Reports
              </Button>
            </div>
          </aside>

          {/* RIGHT: PREVIEW AREA */}
          <main className="flex-1 overflow-hidden flex flex-col relative">
            {/* TOOLBAR */}
            {!!reports && (
              <div className="absolute top-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 bg-white/80 backdrop-blur-md border border-slate-200 p-2 rounded-2xl shadow-2xl">
                <Button
                  variant={isEditMode ? "default" : "outline"}
                  onClick={() => setIsEditMode((prev) => !prev)}
                  className={`gap-2 rounded-xl px-4 h-10 border transition-all ${
                    isEditMode ? "bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600" : "bg-white text-slate-700 border-slate-200"
                  }`}
                >
                  {isEditMode ? <Check size={16} /> : <Edit2 size={16} />}
                  <span className="font-bold text-xs">{isEditMode ? "Done" : "Edit"}</span>
                </Button>

                <div className="h-6 w-[1px] bg-slate-200" />

                <div className="flex items-center gap-1">
                  <select
                    value={batchMode}
                    onChange={(e) => setBatchMode(e.target.value as BatchMode)}
                    className="h-9 px-3 text-xs font-bold text-slate-700 bg-transparent border-none focus:ring-0 cursor-pointer"
                  >
                    <option value="single">Unified PDF</option>
                    <option value="per_project">Split Files</option>
                  </select>
                </div>

                <div className="h-6 w-[1px] bg-slate-200" />

                <Button
                  onClick={() => handleExport("pdf")}
                  disabled={isExporting}
                  className="gap-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl px-4 h-10 shadow-lg transition-all active:scale-95"
                >
                  {isExporting ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
                  <span className="font-bold text-xs">Download PDF</span>
                </Button>
                
                <Button
                  variant="ghost"
                  onClick={() => { setReports(null); setExportFiles([]); setIsEditMode(false); }}
                  className="h-10 w-10 p-0 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50"
                >
                  <X size={18} />
                </Button>
              </div>
            )}

            {!reports && !isGenerating && (
              <div className="h-full flex items-center justify-center p-10">
                <div className="max-w-md text-center opacity-40">
                  <div className="w-20 h-20 bg-slate-200 rounded-3xl mx-auto flex items-center justify-center text-slate-400 mb-6">
                    <FileText size={40} />
                  </div>
                  <h3 className="text-xl font-black text-slate-900 italic">No Active Workspace</h3>
                  <p className="text-sm font-bold text-slate-500 mt-2">
                    Select projects from the left sidebar to begin synthesizing status reports.
                  </p>
                </div>
              </div>
            )}

            {isGenerating && (
              <div className="h-full flex flex-col items-center justify-center p-10 bg-slate-50/50">
                <div className="w-full max-w-sm space-y-4">
                  <div className="text-center mb-6">
                    <Loader2 className="w-10 h-10 animate-spin text-blue-600 mx-auto mb-4" />
                    <h3 className="text-lg font-black text-slate-900">Synthesizing Reports...</h3>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">AI analyzing project trajectory</p>
                  </div>
                  <div className="space-y-2">
                    {Object.entries(progress).map(([projectId, p]) => (
                      <div key={projectId} className="flex items-center justify-between text-[11px] border border-slate-200 rounded-xl px-4 py-3 bg-white shadow-sm">
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full ${renderProgressDot(p.status)}`} />
                          <p className="font-black text-slate-700 uppercase tracking-tight">{p.projectName}</p>
                        </div>
                        <p className="text-slate-400 font-bold italic">{p.detail}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {!!reports && (
              <ScrollArea className="flex-1 bg-slate-100/50 pt-24">
                <div className="max-w-[800px] mx-auto px-10 pb-20 space-y-12">
                  {reports.map((report, rIdx) => (
                    <div key={report.project_id} className="bg-white shadow-[0_10px_40px_-15px_rgba(0,0,0,0.1)] rounded-sm overflow-hidden border border-slate-200 ring-1 ring-slate-100">
                      {/* Paper Header */}
                      <div className="h-1 bg-blue-600" />
                      <div className="p-10 border-b border-slate-100 flex justify-between items-start">
                        <div>
                          <p className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] mb-2">Project Status Insight</p>
                          <h2 className="text-4xl font-black text-slate-900 tracking-tight">{report.project_name}</h2>
                          <div className="flex gap-4 mt-4">
                            <div className="flex flex-col">
                              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Reporting window</span>
                              <span className="text-xs font-bold text-slate-700">{report.window_start} to {report.window_end}</span>
                            </div>
                            <div className="h-full w-[1px] bg-slate-200" />
                            <div className="flex flex-col">
                              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Health State</span>
                              <span className="text-xs font-black text-emerald-600 uppercase italic">On Track</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Confidential</p>
                          <p className="text-xs font-bold text-slate-800">Delivery Management</p>
                        </div>
                      </div>

                      <div className="p-10 space-y-10">
                        {/* Executive Summary Section */}
                        <section>
                          <div className="flex items-center gap-3 mb-4">
                            <div className="h-2 w-2 rounded-full bg-blue-600" />
                            <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest">Executive Narrative</h4>
                          </div>
                          <div className={`p-6 rounded-2xl border transition-all ${isEditMode ? "bg-slate-50 border-blue-200 ring-4 ring-blue-50" : "bg-white border-transparent"}`}>
                            {isEditMode ? (
                              <textarea
                                className="w-full bg-transparent text-lg font-medium text-slate-800 leading-relaxed border-none focus:ring-0 resize-none min-h-[120px]"
                                value={report.executive_summary}
                                onChange={(e) => {
                                  const next = [...reports];
                                  next[rIdx].executive_summary = e.target.value;
                                  setReports(next);
                                }}
                              />
                            ) : (
                              renderSummaryText(report.executive_summary)
                            )}
                          </div>
                        </section>

                        {/* Milestones Section */}
                        <section className="space-y-6">
                           <div className="flex items-center gap-3 mb-6">
                            <div className="h-2 w-2 rounded-full bg-slate-400" />
                            <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest">Milestone Progress stories</h4>
                          </div>
                          
                          <div className="grid grid-cols-1 gap-6">
                            {report.milestones.map((m, mIdx) => (
                              <div key={m.id || mIdx} className="group flex gap-6">
                                <div className="w-32 flex-shrink-0 pt-1">
                                  <div className="px-2 py-1 bg-slate-900 text-white inline-block text-[10px] font-black uppercase tracking-widest rounded-sm mb-2">
                                    {m.name}
                                  </div>
                                  <p className="text-[11px] font-black text-slate-800 leading-tight block">{m.description}</p>
                                  <p className="text-[10px] font-black text-emerald-600 uppercase tracking-tighter mt-1 italic">{m.status}</p>
                                </div>
                                <div className={`flex-1 p-5 rounded-2xl border transition-all ${isEditMode ? "bg-slate-50 border-blue-200 ring-4 ring-blue-50" : "bg-slate-50/50 border-slate-100 border-transparent hover:bg-white hover:shadow-md hover:border-slate-200"}`}>
                                  {isEditMode ? (
                                    <textarea
                                      className="w-full bg-transparent text-sm font-medium text-slate-700 leading-relaxed border-none focus:ring-0 resize-none min-h-[80px]"
                                      value={m.timeline_summary}
                                      onChange={(e) => {
                                        const next = [...reports];
                                        next[rIdx].milestones[mIdx].timeline_summary = e.target.value;
                                        setReports(next);
                                      }}
                                    />
                                  ) : (
                                    renderSummaryText(m.timeline_summary)
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </section>

                        <div className="pt-10 border-t border-slate-100 flex justify-between items-center text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                          <span>End of Insight Report</span>
                          <span>Page {rIdx + 1} of {reports.length}</span>
                        </div>
                      </div>
                    </div>
                  ))}

                  {exportFiles.length > 1 && (
                    <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
                      <div className="flex items-center gap-2 mb-4">
                        <Download size={18} className="text-blue-600" />
                        <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest">Generated Report Files</h4>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {exportFiles.map((file) => (
                          <a
                            key={file.file_name}
                            href={`${import.meta.env.VITE_API_BASE_URL || "http://localhost:8000"}${file.download_url}`}
                            className="flex items-center justify-between p-4 rounded-xl border border-slate-100 hover:border-blue-200 hover:bg-blue-50/30 transition-all group"
                            download={file.file_name}
                          >
                            <span className="text-xs font-bold text-slate-600 group-hover:text-blue-700 truncate max-w-[200px]">{file.file_name}</span>
                            <Download size={14} className="text-slate-300 group-hover:text-blue-500" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>
            )}
          </main>
        </div>
      </div>
    </AppLayout>
  );
};

export default Insights;
