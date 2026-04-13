import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { MilestoneHealthData, MilestoneHealthPhase, WeekData, Milestone } from "@/hooks/useData";
import { Loader2, Pencil, Plus as PlusIcon } from "lucide-react";

interface MilestoneHealthTrackerProps {
  data?: MilestoneHealthData;
  loading?: boolean;
  error?: Error | null;
  onDataRefresh?: (projectId: string) => Promise<void>;
  projectMilestones?: Milestone[];
}

interface ModalState {
  isOpen: boolean;
  type: "practice" | "signoff" | "invoice";
  milestone: MilestoneHealthPhase;
  milestoneId: string;
  weekNumber?: number;
  weekLabel?: string;
  weekDate?: string;
  currentStatus?: string | null;
  isEmpty: boolean;
}

const getColorForStatus = (type: "practice" | "signoff" | "invoice", status: string): string => {
  const colors: Record<string, Record<string, string>> = {
    practice: {
      "On Track": "green",
      "At Risk": "orange",
      "Blocked": "red",
      "Completed": "blue"
    },
    signoff: {
      "Done": "blue",
      "Partial": "indigo",
      "Pending": "gray"
    },
    invoice: {
      "Done": "blue",
      "Partial": "indigo",
      "Pending": "gray"
    }
  };

  return colors[type]?.[status] || "gray";
};

const getStatusColor = (color: string): string => {
  const colorMap: Record<string, string> = {
    green: "#22c55e",
    blue: "#3b82f6",
    orange: "#f97316",
    red: "#ef4444",
    indigo: "#6366f1",
    gray: "#d1d5db",
  };
  return colorMap[color] || "#d1d5db";
};

const getStatusColorClass = (colorOrStatus: string): string => {
  const norm = (colorOrStatus || "").toLowerCase();

  // Status-based overrides
  if (norm.includes("completed")) return "bg-blue-500 shadow-blue-500/20";
  if (norm.includes("on track")) return "bg-green-500 shadow-green-500/20";
  if (norm.includes("at risk")) return "bg-orange-500 shadow-orange-500/20";
  if (norm.includes("blocked")) return "bg-red-500 shadow-red-500/20";
  if (norm.includes("done")) return "bg-blue-500 shadow-blue-500/20";
  if (norm.includes("partial")) return "bg-indigo-500 shadow-indigo-500/20";
  if (norm.includes("pending")) return "bg-gray-300";

  // Fallback to color mapping
  const colorMap: Record<string, string> = {
    green: "bg-green-500 shadow-green-500/20",
    blue: "bg-blue-500 shadow-blue-500/20",
    orange: "bg-orange-500 shadow-orange-500/20",
    red: "bg-red-500 shadow-red-500/20",
    indigo: "bg-indigo-500 shadow-indigo-500/20",
    gray: "bg-gray-300",
  };
  return colorMap[norm] || "bg-gray-300";
};

interface StatusEditorModalProps {
  isOpen: boolean;
  milestone: MilestoneHealthPhase;
  type: "practice" | "signoff" | "invoice";
  weekLabel?: string;
  isEmpty?: boolean;
  onClose: () => void;
  onSave: (updates: Record<string, unknown>) => Promise<void>;
}

const StatusEditorModal = ({ isOpen, milestone, type, weekLabel, isEmpty = false, onClose, onSave }: StatusEditorModalProps) => {
  const [selectedStatus, setSelectedStatus] = useState(
    isEmpty
      ? type === "practice"
        ? "On Track"
        : "Pending"
      : type === "practice"
        ? milestone.status
        : type === "signoff"
          ? milestone.signoff_status || "Pending"
          : milestone.invoice_status || "Pending"
  );
  const [selectedDate, setSelectedDate] = useState(
    type === "signoff" && milestone.date ? milestone.date.split("T")[0] : type === "invoice" && milestone.date ? milestone.date.split("T")[0] : new Date().toISOString().split("T")[0]
  );
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updates: Record<string, unknown> = {};

      if (type === "practice") {
        updates.status = selectedStatus;
      } else if (type === "signoff") {
        updates.client_signoff_status = selectedStatus;
        if (selectedStatus === "Done") {
          updates.signedoff_date = selectedDate;
        }
      } else if (type === "invoice") {
        updates.invoice_status = selectedStatus;
        if (selectedStatus === "Done") {
          updates.invoice_raised_date = selectedDate;
        }
      }

      await onSave(updates);
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  const modalTitle = isEmpty ? `Add Status - ${milestone.milestone_code}` : `Update ${milestone.milestone_code}`;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-lg w-96 p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-lg font-semibold text-gray-800">{modalTitle}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-xl">
            ✕
          </button>
        </div>
        {weekLabel && (
          <p className="text-xs text-gray-500 mb-4">{weekLabel}</p>
        )}

        <div className="space-y-4">
          {/* Status Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {type === "practice" && (
                <>
                  <option value="On Track">On Track</option>
                  <option value="At Risk">At Risk</option>
                  <option value="Blocked">Blocked</option>
                  <option value="Completed">Completed</option>
                </>
              )}
              {(type === "signoff" || type === "invoice") && (
                <>
                  <option value="Pending">Pending</option>
                  <option value="Partial">Partial</option>
                  <option value="Done">Done</option>
                </>
              )}
            </select>
          </div>

          {/* Date Selector (for signoff/invoice when Done) */}
          {(type === "signoff" || type === "invoice") && selectedStatus === "Done" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {type === "signoff" ? "Signoff Date" : "Invoice Date"}
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                max={new Date().toISOString().split("T")[0]}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {/* Info Text */}
          <div className="bg-blue-50 border border-blue-200 rounded p-3 text-xs text-blue-700">
            {isEmpty ? (
              <>
                {type === "practice" && "Add a status for this milestone in this week."}
                {type === "signoff" && "Record when the client signed off."}
                {type === "invoice" && "Record when the invoice was raised."}
              </>
            ) : (
              <>
                {type === "practice" && "Update the milestone status for this week."}
                {type === "signoff" && "Mark as Done when client has signed off."}
                {type === "invoice" && "Mark as Done when invoice has been raised."}
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 justify-end mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
            disabled={isSaving}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-500 rounded-md hover:bg-blue-600 disabled:opacity-50"
            disabled={isSaving}
          >
            {isSaving ? "Saving..." : isEmpty ? "Add" : "Update"}
          </button>
        </div>
      </div>
    </div>
  );
};

interface WeekBlockCellProps {
  week: WeekData;
  type: "practice" | "signoff" | "invoice";
  allWeeks: Record<string, { label: string }>;
  milestone: string;
  onClick: () => void;
}

interface EmptyCellProps {
  weekNumber: number;
  allWeeks: Record<string, { label: string }>;
  milestoneCode?: string;
  onClick?: () => void;
  hideCode?: boolean;
}

const EmptyCell = ({ weekNumber, allWeeks, milestoneCode, onClick, hideCode }: EmptyCellProps) => {
  const [isHovered, setIsHovered] = useState(false);
  const weekLabel = allWeeks[String(weekNumber)]?.label || `Week ${weekNumber}`;

  return (
    <div
      className="relative flex items-center justify-center p-0"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <button
        onClick={onClick}
        className={`w-10 h-10 rounded border-2 border-dashed transition-all cursor-pointer flex items-center justify-center group ${isHovered && onClick ? "border-blue-400 bg-blue-50/50 scale-105" : "border-gray-300 opacity-60"
          }`}
        aria-label={`${milestoneCode || 'Milestone'} ${weekLabel}, Empty. Press to add status.`}
        title={onClick ? `Add status for ${milestoneCode} - ${weekLabel}` : undefined}
        disabled={!onClick}
      >
        {isHovered && onClick ? (
          <PlusIcon size={14} className="text-blue-500 animate-pulse" />
        ) : (
          milestoneCode && !hideCode && <span className="text-[10px] font-bold text-gray-400">{milestoneCode}</span>
        )}
      </button>
    </div>
  );
};

const WeekBlockCell = ({ week, type, allWeeks, milestone, onClick }: WeekBlockCellProps) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const weekLabel = allWeeks[String(week.week_number)]?.label || `Week ${week.week_number}`;
  const bgColor = getStatusColorClass(week.color);
  const tooltipText = `${milestone} - ${weekLabel}\n${week.status}`;
  const ariaLabel = `${milestone} ${weekLabel}, ${week.status}. Press to edit.`;

  if (type === "practice") {
    return (
      <div
        className="relative flex items-center justify-center p-0"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <button
          onClick={onClick}
          className={`group w-10 h-10 rounded transition-all hover:scale-105 hover:ring-2 hover:ring-offset-2 hover:ring-blue-400 cursor-pointer ${bgColor} flex items-center justify-center relative overflow-hidden`}
          aria-label={ariaLabel}
          title={tooltipText}
        >
          <span className={`text-[10px] font-bold text-white transition-opacity ${showTooltip && onClick ? 'opacity-20' : 'opacity-100'}`}>{milestone}</span>
          {showTooltip && onClick && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/10">
              <Pencil size={12} className="text-white" />
            </div>
          )}
        </button>
        {showTooltip && (
          <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 bg-gray-900/95 backdrop-blur-sm text-white text-[10px] px-2 py-1.5 rounded-lg shadow-xl z-20 border border-white/10 pointer-events-none animate-in fade-in zoom-in-95">
            <div className="font-bold border-b border-white/10 mb-1 pb-1">{milestone}</div>
            <div className="text-gray-300 uppercase tracking-tighter text-[8px]">{weekLabel}</div>
            <div className="font-medium">{week.status}</div>
          </div>
        )}
      </div>
    );
  }

  if (type === "signoff" || type === "invoice") {
    const isSignoff = type === "signoff";
    return (
      <div
        className="relative flex items-center justify-center p-0"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <button
          onClick={onClick}
          className={`group w-10 h-10 transition-all hover:scale-105 cursor-pointer flex items-center justify-center relative ${isSignoff ? bgColor + " rounded-full shadow-lg" : ""}`}
          aria-label={ariaLabel}
          title={tooltipText}
          disabled={!onClick}
        >
          {/* For Invoice, use a rotated child div for the diamond shape/color */}
          {!isSignoff && (
            <div
              className={`w-7 h-7 ${bgColor} shadow-lg transform rotate-45`}
            />
          )}

          <span
            className={`absolute ${isSignoff ? "text-xs" : "text-[10px] font-bold"} text-white transition-opacity ${showTooltip && onClick ? 'opacity-20' : 'opacity-100'}`}
          >
            {milestone}
          </span>
          {showTooltip && onClick && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/10">
              <Pencil size={12} className="text-white" />
            </div>
          )}
        </button>
        {showTooltip && (
          <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 bg-gray-900/95 backdrop-blur-sm text-white text-[10px] px-2 py-1.5 rounded-lg shadow-xl z-20 border border-white/10 pointer-events-none animate-in fade-in zoom-in-95">
            <div className="font-bold border-b border-white/10 mb-1 pb-1">{milestone}</div>
            <div className="text-gray-300 uppercase tracking-tighter text-[8px]">{isSignoff ? "Signoff" : "Invoice"}: {weekLabel}</div>
            <div className="font-medium">{week.status}</div>
          </div>
        )}
      </div>
    );
  }

  return null;
};

export const MilestoneHealthTracker = ({ data, loading, error, onDataRefresh, projectMilestones }: MilestoneHealthTrackerProps) => {
  const qc = useQueryClient();
  const [modalState, setModalState] = useState<ModalState | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4 rounded-lg border border-gray-200 bg-white">
        <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
        <span className="ml-2 text-xs text-gray-600">Loading milestone health...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-300 rounded-lg text-sm text-red-700">
        <strong>Error:</strong> Failed to load milestone health. {error?.message}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-4 bg-amber-50 border border-amber-300 rounded-lg text-sm text-amber-700">
        No milestone health data available.
      </div>
    );
  }

  const handleModalOpen = (
    type: "practice" | "signoff" | "invoice",
    milestone: MilestoneHealthPhase,
    weekNumber?: number,
    weekLabel?: string,
    weekDate?: string,
    isEmpty = false
  ) => {
    setModalState({
      isOpen: true,
      type,
      milestone,
      milestoneId: milestone.id || "",
      weekNumber,
      weekLabel,
      weekDate,
      isEmpty,
    });
  };

  const handleModalClose = () => {
    setModalState(null);
  };

  const handleSave = async (updates: Record<string, unknown>) => {
    if (!modalState) return;
    setIsSaving(true);
    try {
      const baseUrl = import.meta.env.VITE_API_BASE_URL || "https://j2w-tracker-backend.onrender.com";
      let response;

      // Determine new status from updates object
      let newStatus = updates.status || updates.client_signoff_status || updates.invoice_status;

      if (modalState.weekNumber !== undefined) {
        // API 3: Update specific week (creates if missing!)
        const weekPayload = {
          week_status: newStatus,
          week_label: modalState.weekLabel || "",
          color: getColorForStatus(modalState.type, String(newStatus)),
          date: modalState.weekDate || (updates.signedoff_date || updates.invoice_raised_date || new Date().toISOString().split("T")[0])
        };

        response = await fetch(`${baseUrl}/api/milestones/${modalState.milestoneId}/health/${modalState.type}/week/${modalState.weekNumber}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(weekPayload),
        });
      } else {
        // API 2: Update milestone-level status (regenerates all weeks)
        response = await fetch(`${baseUrl}/api/milestones/${modalState.milestoneId}/health/${modalState.type}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: newStatus,
            date: updates.signedoff_date || updates.invoice_raised_date || null
          }),
        });
      }

      if (!response.ok) {
        throw new Error("Failed to update milestone health");
      }

      // Close modal
      handleModalClose();

      // Refresh milestone health data immediately from API 1
      if (data?.project_id) {
        try {
          const healthRes = await fetch(`${baseUrl}/api/projects/${data.project_id}/milestone-health`);
          if (healthRes.ok) {
            const healthData = await healthRes.json();
            // Update the cache with fresh data
            qc.setQueryData(["milestone_health", data.project_id], healthData);
          }
        } catch (refreshErr) {
          console.error("Failed to refresh milestone health:", refreshErr);
        }
      }
    } catch (err) {
      console.error("Update failed:", err);
      alert(`Error updating: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setIsSaving(false);
    }
  };

  // --- NEW TIMELINE LOGIC (Refined) ---

  // 1. Determine Absolute Start/End
  let timelineStart = new Date();

  // Start logic: prioritize actual health activity week dates
  const practicePhases = data.practice || [];
  const signoffPhases = data.signoff || [];
  const invoicePhases = data.invoice || [];
  const allTargetMilestones = projectMilestones || [];

  let anchorDate: Date | null = null;

  // 1. Gather all week dates from all phases
  const healthWeekDates = [
    ...practicePhases.flatMap(p => p.weeks?.map(w => w.date) || []),
    ...signoffPhases.flatMap(s => s.weeks?.map(w => w.date) || []),
    ...invoicePhases.flatMap(i => i.weeks?.map(w => w.date) || [])
  ].filter((d): d is string => !!d).map(d => new Date(d));

  if (healthWeekDates.length > 0) {
    anchorDate = new Date(Math.min(...healthWeekDates.map(d => d.getTime())));
  }

  // 2. Fallback to M1 if no health data yet
  if (!anchorDate) {
    const m1 = allTargetMilestones.find(m => m.milestone_code?.toUpperCase() === "M1");
    if (m1 && (m1.planned_start || m1.actual_start)) {
      anchorDate = new Date(m1.planned_start || m1.actual_start || "");
    }
  }

  // 3. Absolute fallback: earliest date in project list
  if (!anchorDate && allTargetMilestones.length > 0) {
    const milestoneDates = allTargetMilestones.flatMap(m => [
      m.planned_start ? new Date(m.planned_start) : null,
      m.actual_start ? new Date(m.actual_start) : null,
    ]).filter((d): d is Date => d !== null);
    if (milestoneDates.length > 0) {
      anchorDate = new Date(Math.min(...milestoneDates.map(d => d.getTime())));
    }
  }

  if (anchorDate) {
    timelineStart = new Date(anchorDate);
  }

  // Align to Sunday of that week for consistent alignment
  timelineStart.setDate(timelineStart.getDate() - timelineStart.getDay());

  // End logic: Max of (Project End, CURRENT_DATE + 4 months) Capped at Dec 2026 for now
  let maxProjectDate = new Date();
  if (allTargetMilestones.length > 0) {
    const endDates = allTargetMilestones.flatMap(m => [
      m.planned_end ? new Date(m.planned_end) : null,
      m.actual_end_eta ? new Date(m.actual_end_eta) : null,
    ]).filter((d): d is Date => d !== null);
    if (endDates.length > 0) {
      maxProjectDate = new Date(Math.max(...endDates.map(d => d.getTime())));
    }
  }

  const fourMonthsFromNow = new Date();
  fourMonthsFromNow.setMonth(fourMonthsFromNow.getMonth() + 4);

  let timelineEnd = new Date(Math.max(maxProjectDate.getTime(), fourMonthsFromNow.getTime()));

  // Still cap at Dec 2026 if it's too far
  const dec2026 = new Date(2026, 11, 31);
  if (timelineEnd > dec2026) {
    timelineEnd = new Date(dec2026.getTime());
  }

  // 2. Generate Contiguous Weeks
  const processedAllWeeks: Record<string, { start: string; label: string }> = {};
  const dateToWeekIdxMap: Record<string, number> = {};

  let current = new Date(timelineStart);
  let wIdx = 0;
  while (current <= timelineEnd) {
    const startStr = current.toISOString().split("T")[0];
    const nextWeek = new Date(current);
    nextWeek.setDate(nextWeek.getDate() + 6);

    processedAllWeeks[String(wIdx)] = {
      start: startStr,
      label: `${current.toLocaleString('default', { month: 'short' })} ${current.getDate()}-${nextWeek.getDate()}, ${current.getFullYear()}`
    };

    // Fill every day in the week into the dateToWeekIdxMap for easier lookup
    const walker = new Date(current);
    for (let d = 0; d < 7; d++) {
      dateToWeekIdxMap[walker.toISOString().split("T")[0]] = wIdx;
      walker.setDate(walker.getDate() + 1);
    }

    current.setDate(current.getDate() + 7);
    wIdx++;
  }

  // 3. Group by Month (Chronological)
  const monthGroups: Record<string, { startIdx: number; endIdx: number; label: string }> = {};
  const monthOrder: string[] = []; // To keep month keys in order

  // Iterate in numerical order of weeks
  const sortedWeekIndices = Object.keys(processedAllWeeks).map(Number).sort((a, b) => a - b);
  sortedWeekIndices.forEach((weekIdx) => {
    const week = processedAllWeeks[String(weekIdx)];
    const startDate = new Date(week.start);
    const year = startDate.getFullYear();
    const month = String(startDate.getMonth() + 1).padStart(2, "0");
    const monthKey = `${year}-${month}`;
    const monthLabel = `${startDate.toLocaleString("en-US", { month: "short" })} ${year}`;

    if (!monthGroups[monthKey]) {
      monthGroups[monthKey] = { startIdx: weekIdx, endIdx: weekIdx, label: monthLabel };
      monthOrder.push(monthKey);
    } else {
      monthGroups[monthKey].endIdx = weekIdx;
    }
  });

  // Helper to find the week index for a backend WeekData item using its date
  const getMappedWeekIdx = (dateStr: string | undefined): number | undefined => {
    if (!dateStr) return undefined;
    const cleanDate = dateStr.split("T")[0];
    return dateToWeekIdxMap[cleanDate];
  };

  const phases: Array<{ type: "practice" | "signoff" | "invoice"; label: string }> = [
    { type: "practice", label: "PRACTICE" },
    { type: "signoff", label: "CLIENT SIGNOFF" },
    { type: "invoice", label: "INVOICE HEALTH" },
  ];

  return (
    <div className="rounded-lg border border-gray-200 bg-white overflow-hidden shadow-sm">
      {/* Header */}
      <div className="border-b border-gray-200 px-6 py-4 bg-gradient-to-r from-gray-50 to-white">
        <h2 className="text-xl font-bold text-gray-900">{data.project_name} - Milestone Health</h2>
        <p className="text-xs text-gray-500 mt-1">
          Last Updated: {new Date().toLocaleDateString()} | {data.weeks_range.start_week} — {data.weeks_range.end_week} ({data.weeks_range.total_weeks} weeks)
        </p>
      </div>

      {/* Matrix Table */}
      <div className="overflow-x-auto">
        <div className="min-w-max">
          {/* Month Headers */}
          <div className="flex border-b border-gray-200 bg-gray-50">
            <div className="w-48 flex-shrink-0 border-r border-gray-200" />
            {monthOrder.map((monthKey) => {
              const { startIdx, endIdx, label } = monthGroups[monthKey];
              const weekCount = endIdx - startIdx + 1;
              return (
                <div
                  key={monthKey}
                  className="flex-shrink-0 border-r border-gray-200 py-2 px-2 text-center font-semibold text-xs text-gray-700"
                  style={{ width: `${weekCount * 40}px` }}
                >
                  {label}
                </div>
              );
            })}
          </div>

          {/* Week Number Headers */}
          <div className="flex border-b border-gray-200 bg-gray-50">
            <div className="w-48 flex-shrink-0 border-r border-gray-200" />
            {monthOrder.map((monthKey) => {
              const { startIdx, endIdx } = monthGroups[monthKey];
              const weeks = Array.from({ length: endIdx - startIdx + 1 }).map((_, i) => startIdx + i);
              return (
                <div key={`${monthKey}-weeks`} className="flex border-r border-gray-200">
                  {weeks.map((wNum, i) => (
                    <div
                      key={`${monthKey}-week-${wNum}`}
                      className={`flex-shrink-0 flex items-center justify-center text-center py-1 text-[9px] text-gray-500 font-medium ${i < weeks.length - 1 ? "border-r border-gray-200" : ""}`}
                      style={{ width: "40px" }}
                    >
                      W{i + 1}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>

          {/* Data Rows */}
          {phases.map((phase, phaseIdx) => (
            <div
              key={phase.type}
              className={`flex ${phaseIdx < phases.length - 1 ? "border-b border-gray-200" : ""}`}
            >
              {/* Phase Label Column */}
              <div className="w-48 flex-shrink-0 border-r border-gray-200 flex items-center px-4 py-2 bg-gray-50 border-b border-gray-200">
                <span className="text-[10px] font-bold text-gray-700 uppercase tracking-tight">{phase.label}</span>
              </div>

              {/* Milestone Data Cells */}
              {monthOrder.map((monthKey) => {
                const { startIdx, endIdx } = monthGroups[monthKey];
                const weeksInMonth = Array.from({ length: endIdx - startIdx + 1 }).map((_, i) => startIdx + i);
                return (
                  <div key={`${phase.type}-${monthKey}`} className="flex border-r border-gray-200">
                    {weeksInMonth.map((weekIdx, i) => {
                      const weekMeta = processedAllWeeks[String(weekIdx)];
                      const weekLabel = weekMeta?.label || `Week ${weekIdx}`;

                      // USE projectMilestones as the master list for rows
                      const milestonesToRender = projectMilestones || [];

                      // Sort all milestones by code for consistent alignment
                      const sortedMilestones = [...milestonesToRender].sort((a, b) => {
                        const codeA = a.milestone_code || "";
                        const codeB = b.milestone_code || "";
                        return codeA.localeCompare(codeB, undefined, { numeric: true });
                      });

                      const cellContent = (
                        <div className="flex flex-col gap-0">
                          {sortedMilestones.map((m) => {
                            // Find corresponding health data if any
                            const phaseDataRows = data[phase.type] || [];
                            const healthMilestone = phaseDataRows.find(hm => hm.id === m.id || hm.milestone_code === m.milestone_code);

                            // Mock a health item if not found so modal works
                            const milestoneToEdit: MilestoneHealthPhase = healthMilestone || {
                              id: m.id || "",
                              milestone_code: m.milestone_code || "",
                              description: m.description || "",
                              milestone_type: phase.type,
                              weeks: [],
                              status: "Pending"
                            };

                            // DATE-BASED Mapping for the week bubble
                            // 1. Check if we have a weeks array (Practice)
                            let week = healthMilestone?.weeks?.find((w) => {
                              const mappedIdx = getMappedWeekIdx(w.date);
                              return mappedIdx === weekIdx;
                            });

                            // 2. Fallback to single date (Signoff/Invoice)
                            if (!week && healthMilestone?.date) {
                              const mappedIdx = getMappedWeekIdx(healthMilestone.date);
                              if (mappedIdx === weekIdx) {
                                // Blue for Done/Completed, Indigo for Partial, Gray for Pending
                                const isDone = healthMilestone.status === 'Done' || healthMilestone.status === 'Completed';
                                const isPartial = healthMilestone.status === 'Partial';
                                const color = isDone ? 'blue' : isPartial ? 'indigo' : 'gray';
                                week = {
                                  week_number: weekIdx,
                                  status: healthMilestone.status || 'Pending',
                                  color: color,
                                  week_label: weekLabel,
                                  date: healthMilestone.date
                                };
                              }
                            }

                            if (week) {
                              return (
                                <WeekBlockCell
                                  key={`${m.milestone_code}-${weekIdx}`}
                                  week={week}
                                  type={phase.type}
                                  allWeeks={processedAllWeeks}
                                  milestone={m.milestone_code || ""}
                                  onClick={phase.type === "practice" ? () => handleModalOpen(phase.type, milestoneToEdit, weekIdx, week.week_label, week.date, false) : undefined}
                                />
                              );
                            } else {
                              return (
                                <EmptyCell
                                  key={`${m.milestone_code}-empty-${weekIdx}`}
                                  weekNumber={weekIdx}
                                  allWeeks={processedAllWeeks}
                                  milestoneCode={m.milestone_code || ""}
                                  hideCode={phase.type !== "practice"}
                                  onClick={phase.type === "practice" ? () => handleModalOpen(phase.type, milestoneToEdit, weekIdx, weekLabel, weekMeta?.start || new Date().toISOString().split("T")[0], true) : undefined}
                                />
                              );
                            }
                          })}
                        </div>
                      );

                      return (
                        <div
                          key={`${phase.type}-${weekIdx}`}
                          className={`flex-shrink-0 flex flex-col items-center justify-around p-0 ${i < weeksInMonth.length - 1 ? "border-r border-gray-200" : ""}`}
                          style={{ width: "40px", minHeight: "40px" }}
                        >
                          {cellContent}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Footer - Legend */}
      <div className="border-t border-gray-200 px-6 py-4 bg-gray-50">
        <p className="text-xs font-bold text-gray-700 mb-3 uppercase">Status Legend</p>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: "#22c55e" }} />
            <span className="text-gray-600">On Track</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: "#3b82f6" }} />
            <span className="text-gray-600">Completed</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: "#f97316" }} />
            <span className="text-gray-600">At Risk</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: "#ef4444" }} />
            <span className="text-gray-600">Blocked</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: "#6366f1" }} />
            <span className="text-gray-600">Partial</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: "#d1d5db" }} />
            <span className="text-gray-600">Pending</span>
          </div>
        </div>
      </div>

      {/* Status Editor Modal */}
      {modalState && (
        <StatusEditorModal
          isOpen={modalState.isOpen}
          milestone={modalState.milestone}
          type={modalState.type}
          weekLabel={modalState.weekLabel}
          isEmpty={modalState.isEmpty}
          onClose={handleModalClose}
          onSave={handleSave}
        />
      )}
    </div>
  );
};
