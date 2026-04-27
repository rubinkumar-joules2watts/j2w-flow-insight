import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Loader2, FileText, Download, Edit2, Check, Wand2 } from "lucide-react";

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
}

interface ProjectReport {
  project_id: string;
  project_name: string;
  executive_summary: string;
  milestones: MilestoneReport[];
}

export const ProjectReportGenerator = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [startDate, setStartDate] = useState<string>(
    new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split("T")[0]
  );
  const [endDate, setEndDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [reports, setReports] = useState<ProjectReport[] | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const baseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
      const response = await fetch(`${baseUrl}/api/projects`);
      const data = await response.json();
      if (Array.isArray(data)) {
        setProjects(data);
      } else {
        console.error("API did not return a project array", data);
        setProjects([]);
      }
    } catch (error) {
      console.error("Failed to fetch projects", error);
    }
  };

  const handleGenerate = async () => {
    if (selectedProjectIds.length === 0) {
      toast.error("Please select at least one project");
      return;
    }

    setIsGenerating(true);
    setReports(null);

    try {
      const baseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
      const response = await fetch(`${baseUrl}/api/reports/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_ids: selectedProjectIds,
          start_date: startDate,
          end_date: endDate,
        }),
      });

      if (!response.ok) throw new Error("Generation failed");

      const data = await response.json();
      setReports(data);
      toast.success("Insights synthesized successfully ✨");
    } catch (error) {
      toast.error("Failed to generate report");
      console.error(error);
    } finally {
      setIsGenerating(false);
    }
  };

  const exportToDoc = (report: ProjectReport) => {
    const content = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head><meta charset='utf-8'><title>${report.project_name} Status Report</title>
      <style>
        body { font-family: 'Segoe UI', sans-serif; line-height: 1.6; color: #333; }
        h1 { color: #059669; border-bottom: 2px solid #059669; padding-bottom: 10px; }
        h2 { color: #1e293b; margin-top: 30px; }
        .summary { background: #f0fdf4; border-left: 5px solid #059669; padding: 15px; font-style: italic; margin-bottom: 30px; }
        .milestone { margin-bottom: 20px; border-bottom: 1px solid #e2e8f0; padding-bottom: 15px; }
        .m-header { font-weight: bold; font-size: 1.1em; color: #0f172a; }
        .m-status { font-size: 0.8em; color: #64748b; text-transform: uppercase; }
        .m-content { margin-top: 5px; color: #475569; }
      </style>
      </head>
      <body>
        <h1>Project Status Report: ${report.project_name}</h1>
        <p>Report Date: ${new Date().toLocaleDateString()}</p>
        <p>Horizon: ${startDate} to ${endDate}</p>
        
        <div class="summary">
          <strong>Executive Summary:</strong><br/>
          ${report.executive_summary}
        </div>
        
        <h2>Milestone Status</h2>
        ${report.milestones.map(m => `
          <div class="milestone">
            <div class="m-header">${m.name}: ${m.description}</div>
            <div class="m-status">Status: ${m.status}</div>
            <div class="m-content">${m.timeline_summary}</div>
          </div>
        `).join('')}
      </body>
      </html>
    `;

    const blob = new Blob(['\ufeff', content], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${report.project_name}_Status_Report.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2 border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-300">
          <Wand2 className="h-4 w-4" />
          Status Report Generator
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] bg-slate-950 border-slate-800 text-slate-100 overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
            Project Status Insight Studio
          </DialogTitle>
        </DialogHeader>

        {!reports ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 py-6">
            <div className="space-y-4">
              <Label className="text-sm font-medium text-slate-400">Step 1: Select Projects</Label>
              <ScrollArea className="h-[300px] rounded-md border border-slate-800 p-4 bg-slate-900/50">
                {projects.map((p) => (
                  <div key={p.id} className="flex items-center space-x-3 mb-3 p-2 rounded hover:bg-slate-800 transition-colors">
                    <Checkbox
                      id={p.id}
                      checked={selectedProjectIds.includes(p.id)}
                      onCheckedChange={(checked) => {
                        if (checked) setSelectedProjectIds([...selectedProjectIds, p.id]);
                        else setSelectedProjectIds(selectedProjectIds.filter((id) => id !== p.id));
                      }}
                      className="border-emerald-500 data-[state=checked]:bg-emerald-500"
                    />
                    <label htmlFor={p.id} className="text-sm font-medium cursor-pointer flex-1">
                      {p.name}
                    </label>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-400">
                      {p.status}
                    </span>
                  </div>
                ))}
              </ScrollArea>
            </div>

            <div className="space-y-6">
              <div className="space-y-4">
                <Label className="text-sm font-medium text-slate-400">Step 2: Define Time Horizon</Label>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="start-date" className="text-xs text-slate-500 uppercase tracking-wider font-bold">Start Date</Label>
                    <Input
                      id="start-date"
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="bg-slate-900 border-slate-800 focus:ring-emerald-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="end-date" className="text-xs text-slate-500 uppercase tracking-wider font-bold">End Date</Label>
                    <Input
                      id="end-date"
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="bg-slate-900 border-slate-800 focus:ring-emerald-500"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-8">
                <Button
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold h-12 gap-2 shadow-lg shadow-emerald-500/20"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Synthesizing Insights...
                    </>
                  ) : (
                    <>
                      <Wand2 className="h-5 w-5" />
                      Generate Report
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <ScrollArea className="flex-1 px-1">
            <div className="space-y-12 py-6">
              {reports.map((report) => (
                <div key={report.project_id} className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="flex items-end justify-between border-b border-slate-800 pb-2">
                    <div>
                      <h3 className="text-xl font-bold text-emerald-400">{report.project_name}</h3>
                      <p className="text-sm text-slate-500">Status Insights • {startDate} to {endDate}</p>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-8 gap-1.5 text-slate-400 hover:text-white"
                      onClick={() => exportToDoc(report)}
                    >
                      <Download className="h-3.5 w-3.5" />
                      Export DOC
                    </Button>
                  </div>

                  <div className="bg-emerald-500/5 border border-emerald-500/20 p-4 rounded-lg relative group">
                    <Label className="text-[10px] uppercase font-bold text-emerald-500 absolute -top-2 left-4 bg-slate-950 px-2 tracking-widest">Executive Summary</Label>
                    <textarea
                      className="w-full bg-transparent text-slate-300 italic leading-relaxed border-none focus:ring-0 resize-none min-h-[40px]"
                      value={report.executive_summary}
                      onChange={(e) => {
                        const newReports = [...reports];
                        newReports[reports.indexOf(report)].executive_summary = e.target.value;
                        setReports(newReports);
                      }}
                    />
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 bg-emerald-500/10 rounded">
                      <Edit2 className="h-3 w-3 text-emerald-400" />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    {report.milestones.map((m, mIdx) => (
                      <div key={m.id} className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl flex flex-col md:flex-row gap-6 relative group">
                        <div className="md:w-1/3 border-r border-slate-800/50 pr-4">
                          <div className="flex items-center gap-2 mb-2">
                             <div className="w-6 h-6 rounded bg-emerald-500/20 flex items-center justify-center text-[10px] font-bold text-emerald-400 border border-emerald-500/30">
                              {m.name}
                             </div>
                             <span className="font-bold text-slate-200 truncate">{m.description}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold tracking-tighter uppercase ${
                              m.status === "On Track" ? "bg-emerald-500/10 text-emerald-500" :
                              m.status === "At Risk" ? "bg-amber-500/10 text-amber-500" :
                              "bg-slate-800 text-slate-500"
                            }`}>
                              {m.status}
                            </span>
                          </div>
                        </div>
                        <div className="flex-1">
                          <Label className="text-[9px] uppercase font-bold text-slate-500 mb-1 block tracking-wider">📝 Timeline Story</Label>
                          <textarea
                            className="w-full bg-transparent text-sm text-slate-300 leading-snug border-none focus:ring-0 resize-none min-h-[60px]"
                            value={m.timeline_summary}
                            onChange={(e) => {
                              const newReports = [...reports];
                              const pIdx = reports.indexOf(report);
                              newReports[pIdx].milestones[mIdx].timeline_summary = e.target.value;
                              setReports(newReports);
                            }}
                          />
                        </div>
                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 bg-slate-800 rounded">
                           <Edit2 className="h-3 w-3 text-slate-400" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              <div className="flex justify-center pt-8">
                 <Button onClick={() => setReports(null)} variant="outline" className="border-slate-800 text-slate-400 hover:bg-slate-900">
                   Back to Project Selection
                 </Button>
              </div>
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
};
