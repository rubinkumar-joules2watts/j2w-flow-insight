import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { MilestoneHealthData, MilestoneHealthPhase, WeekData, Milestone, useDeleteMilestonePracticeStatus } from "@/hooks/useData";
import { Loader2, Pencil, Plus as PlusIcon, Trash2 } from "lucide-react";
import { apiUrl } from "@/lib/api";
import { parseISO, format } from 'date-fns';

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
    indigo: "#4f46e5",
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
  if (norm.includes("partial")) return "bg-indigo-600 shadow-indigo-600/20";
  if (norm.includes("pending")) return "bg-gray-300";

  // Fallback to color mapping
  const colorMap: Record<string, string> = {
    green: "bg-green-500 shadow-green-500/20",
    blue: "bg-blue-500 shadow-blue-500/20",
    orange: "bg-orange-500 shadow-orange-500/20",
    red: "bg-red-500 shadow-red-500/20",
    indigo: "bg-indigo-600 shadow-indigo-600/20",
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
  onDelete?: () => Promise<void>;
}

const StatusEditorModal = ({ isOpen, milestone, type, weekLabel, isEmpty = false, onClose, onSave, onDelete }: StatusEditorModalProps) => {
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
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleDelete = () => {
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!onDelete) return;
    setIsDeleting(true);
    try {
      await onDelete();
      onClose();
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

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
        <div className="flex gap-2 justify-between mt-6">
          <div>
            {!isEmpty && type === "practice" && onDelete && (
              <button
                onClick={handleDelete}
                className="px-4 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-md hover:bg-red-100 flex items-center gap-2 disabled:opacity-50"
                disabled={isSaving || isDeleting}
              >
                {isDeleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                Delete Status
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              disabled={isSaving || isDeleting}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-500 rounded-md hover:bg-blue-600 disabled:opacity-50"
              disabled={isSaving || isDeleting}
            >
              {isSaving ? "Saving..." : isEmpty ? "Add" : "Update"}
            </button>
          </div>
        </div>
      </div>

      {/* Custom Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowDeleteConfirm(false)}>
          <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Delete Status</h3>
            <p className="text-sm text-gray-600 mb-6">Are you sure you want to delete this milestone status for <span className="font-bold text-red-600">{milestone.milestone_code}</span>? This action cannot be undone.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 rounded-xl border border-gray-300 bg-gray-50 px-4 py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-100 transition-all disabled:opacity-50"
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-red-700 shadow-lg shadow-red-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                disabled={isDeleting}
              >
                {isDeleting ? <Loader2 size={16} className="animate-spin" /> : "Delete Status"}
              </button>
            </div>
          </div>
        </div>
      )}
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
  const { mutateAsync: deleteStatus } = useDeleteMilestonePracticeStatus();

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

        response = await fetch(apiUrl(`api/milestones/${modalState.milestoneId}/health/${modalState.type}/week/${modalState.weekNumber}`), {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(weekPayload),
        });
      } else {
        // API 2: Update milestone-level status (regenerates all weeks)
        response = await fetch(apiUrl(`api/milestones/${modalState.milestoneId}/health/${modalState.type}`), {
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
          const healthRes = await fetch(apiUrl(`api/projects/${data.project_id}/milestone-health`));
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

  const handleDelete = async () => {
    if (!modalState || modalState.weekNumber === undefined || !data?.project_id) return;
    try {
      await deleteStatus({
        milestoneId: modalState.milestoneId,
        weekNumber: modalState.weekNumber,
        projectId: data.project_id
      });
      handleModalClose();
    } catch (err) {
      console.error("Delete failed:", err);
      alert(`Error deleting: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  };  // --- DATE-FNS TIMELINE LOGIC ---
  const calendarMonths = data.calendar_months || [];
  const backendAllWeeks = data.all_weeks || {};
  const allMilestones = projectMilestones || [];

  // Build full display grid from calendar_months (can extend beyond populated backend weeks).
  const monthGroups: Record<string, { startIdx: number; endIdx: number; label: string; weeks_count: number }> = {};
  const monthOrder: string[] = [];
  const processedAllWeeks: Record<string, { start: string; label: string }> = {};

  // Parse backend all_weeks to a list sorted by date
  const sortedWeeksData = Object.entries(backendAllWeeks)
    .map(([bIdx, wData]) => ({
      originalId: parseInt(bIdx, 10),
      startStr: wData.start,
      date: parseISO(wData.start),
      label: wData.label
    }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  // Generate a continuous Mon-Sun week grid spanning all calendar_months.
  // We use UTC for stability and assign each generated week to the month
  // containing its Monday, so labels like "May 4-10" land in May (W1), and
  // "Apr 27-May 3" stays in April (last column).
  type DisplayWeek = {
    startTime: number;
    startISO: string;
    label: string;
    monthKey: string;
  };

  const displayWeeks: DisplayWeek[] = [];
  const MS_PER_DAY = 24 * 60 * 60 * 1000;

  if (calendarMonths.length > 0) {
    const firstMonth = calendarMonths[0];
    const lastMonth = calendarMonths[calendarMonths.length - 1];

    // First Monday on or after the 1st day of the first month.
    const firstDayUtc = Date.UTC(firstMonth.year, firstMonth.month - 1, 1);
    const firstDow = new Date(firstDayUtc).getUTCDay(); // 0=Sun..6=Sat
    const daysForwardToMonday = firstDow === 1 ? 0 : firstDow === 0 ? 1 : 8 - firstDow;
    let cursor = firstDayUtc + daysForwardToMonday * MS_PER_DAY;

    // Last Monday on or before the last day of the last month.
    const lastDayUtc = Date.UTC(lastMonth.year, lastMonth.month, 0);
    const lastDow = new Date(lastDayUtc).getUTCDay();
    const daysBackToMonday = lastDow === 1 ? 0 : lastDow === 0 ? 6 : lastDow - 1;
    const endTime = lastDayUtc - daysBackToMonday * MS_PER_DAY;

    while (cursor <= endTime) {
      const monStart = new Date(cursor);
      const sunEnd = new Date(cursor + 6 * MS_PER_DAY);

      const startMonth = monStart.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
      const endMonth = sunEnd.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
      const startDay = monStart.getUTCDate();
      const endDay = sunEnd.getUTCDate();
      const year = sunEnd.getUTCFullYear();
      const label = startMonth === endMonth
        ? `${startMonth} ${startDay}-${endDay}, ${year}`
        : `${startMonth} ${startDay}-${endMonth} ${endDay}, ${year}`;

      const monthKey = `${startMonth} ${monStart.getUTCFullYear()}`;
      displayWeeks.push({
        startTime: cursor,
        startISO: monStart.toISOString(),
        label,
        monthKey,
      });

      cursor += 7 * MS_PER_DAY;
    }
  }

  // Build month groups directly from generated weeks (Monday-of-week determines month).
  displayWeeks.forEach((w, idx) => {
    if (!monthGroups[w.monthKey]) {
      monthGroups[w.monthKey] = { startIdx: idx, endIdx: idx, label: w.monthKey, weeks_count: 1 };
      monthOrder.push(w.monthKey);
    } else {
      monthGroups[w.monthKey].endIdx = idx;
      monthGroups[w.monthKey].weeks_count += 1;
    }
    processedAllWeeks[String(idx)] = { start: w.startISO, label: w.label };
  });

  // Map any date to its display column index using the generated grid.
  const getDisplayIdxFromDate = (dateStr: string) => {
    if (!dateStr || displayWeeks.length === 0) return -1;
    const t = parseISO(dateStr).getTime();
    for (let i = 0; i < displayWeeks.length; i++) {
      const start = displayWeeks[i].startTime;
      const end = i < displayWeeks.length - 1
        ? displayWeeks[i + 1].startTime
        : start + 7 * MS_PER_DAY;
      if (t >= start && t < end) return i;
    }
    return -1;
  };

  // Map each backend week (all_weeks[N]) to its true display column by date.
  const backendWeekToDisplayIdx: Record<number, number> = {};
  const displayIdxToBackendWeek: Record<number, number> = {};

  sortedWeeksData.forEach((w) => {
    const displayIdx = getDisplayIdxFromDate(w.startStr);
    if (displayIdx >= 0) {
      backendWeekToDisplayIdx[w.originalId] = displayIdx;
      displayIdxToBackendWeek[displayIdx] = w.originalId;
      // Prefer backend label over our auto-generated label.
      processedAllWeeks[String(displayIdx)] = { start: w.startStr, label: w.label };
    }
  });

  const getGridIdxFromDate = getDisplayIdxFromDate;

  const getGridIdxFromBackendWeek = (backendWeekNum: number) => {
    return backendWeekToDisplayIdx[backendWeekNum] ?? -1;
  };

  // Pre-calculate Health Matrix for easy lookup
  const gridMatrix: Record<string, Record<number, any>> = {};

  ["practice", "signoff", "invoice"].forEach(type => {
    const rows = (data[type as keyof MilestoneHealthData] as MilestoneHealthPhase[]) || [];
    rows.forEach((hm: any) => {
      const key = `${hm.milestone_code}-${type}`;
      if (!gridMatrix[key]) gridMatrix[key] = {};

      // 1) Place backend-provided weeks first using the date when available
      //    (more reliable than week_number, which can have backend drift).
      if (hm.weeks) {
        hm.weeks.forEach((w: any) => {
          let gIdx = -1;
          if (w.date) {
            gIdx = getGridIdxFromDate(w.date);
          }
          if (gIdx < 0) {
            gIdx = getGridIdxFromBackendWeek(w.week_number);
          }
          if (gIdx >= 0) gridMatrix[key][gIdx] = w;
        });
      }

      // 2) For practice, fill any gaps between start_date and end_date with a
      //    default "On Track" status so a contiguous timeline renders even
      //    when backend's weeks array has holes or skipped weeks.
      if (type === "practice" && hm.start_date && hm.end_date) {
        const startIdx = getDisplayIdxFromDate(hm.start_date);
        const endIdx = getDisplayIdxFromDate(hm.end_date);
        if (startIdx >= 0 && endIdx >= 0) {
          const lo = Math.min(startIdx, endIdx);
          const hi = Math.max(startIdx, endIdx);
          for (let i = lo; i <= hi; i++) {
            if (!gridMatrix[key][i]) {
              const meta = processedAllWeeks[String(i)];
              gridMatrix[key][i] = {
                week_number: displayIdxToBackendWeek[i] ?? i,
                week_label: meta?.label || `Week ${i}`,
                status: "On Track",
                color: "green",
                date: meta?.start || ""
              };
            }
          }
        }
      }

      if (hm.date) {
        const gIdx = getGridIdxFromDate(hm.date);
        if (gIdx >= 0) {
          const isDone = hm.status === 'Done' || hm.status === 'Completed';
          const isPartial = hm.status === 'Partial';

          const fallbackLabel = format(parseISO(hm.date), "MMM d, yyyy");
          const colLabel = processedAllWeeks[String(gIdx)]?.label;

          gridMatrix[key][gIdx] = {
            week_number: displayIdxToBackendWeek[gIdx] ?? gIdx,
            status: hm.status || 'Pending',
            color: isDone ? 'blue' : isPartial ? 'indigo' : 'gray',
            date: hm.date,
            week_label: colLabel || fallbackLabel
          };
        }
      }
    });
  });

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
              const { startIdx, endIdx, label, weeks_count } = monthGroups[monthKey];
              const weekCount = endIdx - startIdx + 1;
              const colWidth = weeks_count * 40;
              return (
                <div
                  key={monthKey}
                  className="flex-shrink-0 border-r border-gray-200 py-2 px-2 text-center font-semibold text-xs text-gray-700"
                  style={{ width: `${colWidth}px`, minWidth: `${colWidth}px`, maxWidth: `${colWidth}px` }}
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
              const { startIdx, endIdx, weeks_count } = monthGroups[monthKey];
              const colWidth = weeks_count * 40;
              const weeks = Array.from({ length: endIdx - startIdx + 1 }).map((_, i) => startIdx + i);
              return (
                <div
                  key={`${monthKey}-weeks`}
                  className="flex flex-shrink-0 border-r border-gray-200"
                  style={{ width: `${colWidth}px`, minWidth: `${colWidth}px`, maxWidth: `${colWidth}px` }}
                >
                  {weeks.map((wNum, i) => (
                    <div
                      key={`${monthKey}-week-${wNum}`}
                      className={`flex-1 flex items-center justify-center text-center py-1 text-[9px] text-gray-500 font-medium ${i < weeks.length - 1 ? "border-r border-gray-200" : ""}`}
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
                const { startIdx, endIdx, weeks_count } = monthGroups[monthKey];
                const colWidth = weeks_count * 40;
                const weeksInMonth = Array.from({ length: endIdx - startIdx + 1 }).map((_, i) => startIdx + i);
                return (
                  <div
                    key={`${phase.type}-${monthKey}`}
                    className="flex flex-shrink-0 border-r border-gray-200"
                    style={{ width: `${colWidth}px`, minWidth: `${colWidth}px`, maxWidth: `${colWidth}px` }}
                  >
                    {weeksInMonth.map((weekIdx, i) => {
                      const weekMeta = processedAllWeeks[String(weekIdx)];
                      const backendWeekNumber = displayIdxToBackendWeek[weekIdx] ?? weekIdx;
                      const weekLabel = weekMeta?.label || `Week ${weekIdx}`;

                      // USE allMilestones as the master list for rows
                      const milestonesToRender = allMilestones;

                      // Sort all milestones by code for consistent alignment
                      const sortedMilestones = [...milestonesToRender].sort((a, b) => {
                        const codeA = a.milestone_code || "";
                        const codeB = b.milestone_code || "";
                        return codeA.localeCompare(codeB, undefined, { numeric: true });
                      });

                      const cellContent = (
                        <div className="flex flex-col gap-0">
                          {sortedMilestones.map((m) => {
                            // Use the pre-calculated matrix for mapping
                            const matrixKey = `${m.milestone_code}-${phase.type}`;
                            let week = gridMatrix[matrixKey]?.[weekIdx];

                            // Define the milestone context for the modal
                            const phaseDataRows = data[phase.type] || [];
                            const healthMilestone = phaseDataRows.find(hm => hm.id === m.id || hm.milestone_code === m.milestone_code);
                            const milestoneToEdit: MilestoneHealthPhase = healthMilestone || {
                              id: m.id || "",
                              milestone_code: m.milestone_code || "",
                              description: m.description || "",
                              milestone_type: phase.type,
                              weeks: [],
                              status: "Pending"
                            };

                            if (week) {
                              return (
                                <WeekBlockCell
                                  key={`${m.milestone_code}-${weekIdx}`}
                                  week={week}
                                  type={phase.type}
                                  allWeeks={processedAllWeeks}
                                  milestone={m.milestone_code || ""}
                                  onClick={phase.type === "practice" ? () => handleModalOpen(phase.type, milestoneToEdit, week.week_number ?? backendWeekNumber, week.week_label, week.date, false) : undefined}
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
                                  onClick={phase.type === "practice" ? () => handleModalOpen(phase.type, milestoneToEdit, backendWeekNumber, weekLabel, weekMeta?.start || new Date().toISOString().split("T")[0], true) : undefined}
                                />
                              );
                            }
                          })}
                        </div>
                      );

                      return (
                        <div
                          key={`${phase.type}-${weekIdx}`}
                          className={`flex-1 flex flex-col items-center justify-around p-0 overflow-hidden ${i < weeksInMonth.length - 1 ? "border-r border-gray-200" : ""}`}
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
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: "#4f46e5" }} />
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
          isOpen={!!modalState}
          type={modalState?.type || "practice"}
          milestone={modalState?.milestone || {} as MilestoneHealthPhase}
          weekLabel={modalState?.weekLabel}
          isEmpty={modalState?.isEmpty || false}
          onClose={handleModalClose}
          onSave={handleSave}
          onDelete={modalState?.type === "practice" && !modalState?.isEmpty ? handleDelete : undefined}
        />
      )}
    </div>
  );
};
