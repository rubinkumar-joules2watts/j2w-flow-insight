import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { MilestoneHealthData, MilestoneHealthPhase, WeekData } from "@/hooks/useData";
import { Loader2 } from "lucide-react";

interface MilestoneHealthTrackerProps {
  data?: MilestoneHealthData;
  loading?: boolean;
  error?: Error | null;
  onDataRefresh?: (projectId: string) => Promise<void>;
}

interface ModalState {
  isOpen: boolean;
  type: "practice" | "signoff" | "invoice";
  milestone: MilestoneHealthPhase;
  milestoneId: string;
  weekNumber?: number;
  weekLabel?: string;
  currentStatus?: string | null;
  isEmpty: boolean;
}

const getStatusColor = (color: string): string => {
  const colorMap: Record<string, string> = {
    green: "#22c55e",
    blue: "#3b82f6",
    orange: "#f97316",
    red: "#ef4444",
    gray: "#d1d5db",
  };
  return colorMap[color] || "#d1d5db";
};

const getStatusColorClass = (color: string): string => {
  const colorMap: Record<string, string> = {
    green: "bg-green-500",
    blue: "bg-blue-500",
    orange: "bg-orange-500",
    red: "bg-red-500",
    gray: "bg-gray-300",
  };
  return colorMap[color] || "bg-gray-300";
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
  onClick: () => void;
}

const EmptyCell = ({ weekNumber, allWeeks, milestoneCode, onClick }: EmptyCellProps) => {
  const [showBadge, setShowBadge] = useState(false);
  const weekLabel = allWeeks[String(weekNumber)]?.label || `Week ${weekNumber}`;

  return (
    <div
      className="relative flex items-center justify-center"
      onMouseEnter={() => setShowBadge(true)}
      onMouseLeave={() => setShowBadge(false)}
    >
      <button
        onClick={onClick}
        className="w-10 h-10 rounded border-2 border-dashed border-gray-300 hover:border-gray-500 hover:bg-gray-100 transition-all opacity-60 hover:opacity-100 cursor-pointer flex items-center justify-center"
        aria-label={`${milestoneCode || 'Milestone'} ${weekLabel}, Empty. Press to add status.`}
        title={`Add status for ${milestoneCode} - ${weekLabel}`}
      >
        {milestoneCode && <span className="text-[10px] font-bold text-gray-400">{milestoneCode}</span>}
      </button>
      {showBadge && (
        <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-gray-400 font-bold text-2xl pointer-events-none">
          +
        </span>
      )}
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
        className="relative flex items-center justify-center"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <button
          onClick={onClick}
          className={`w-10 h-10 rounded transition-transform hover:scale-110 cursor-pointer ${bgColor} flex items-center justify-center`}
          aria-label={ariaLabel}
          title={tooltipText}
        >
          <span className="text-xs font-bold text-white">{milestone}</span>
        </button>
        {showTooltip && (
          <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10 border border-gray-700 pointer-events-none">
            <div>{milestone}</div>
            <div>{weekLabel}</div>
            <div>{week.status}</div>
          </div>
        )}
      </div>
    );
  }

  if (type === "signoff") {
    return (
      <div
        className="relative flex items-center justify-center"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <button
          onClick={onClick}
          className={`w-12 h-12 rounded-full transition-transform hover:scale-125 cursor-pointer ${bgColor} flex items-center justify-center relative`}
          aria-label={ariaLabel}
          title={tooltipText}
        >
          <span className="absolute text-[11px] font-bold text-white">{milestone}</span>
        </button>
        {showTooltip && (
          <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10 border border-gray-700 pointer-events-none">
            <div className="font-semibold">{milestone}</div>
            <div>Signoff: {week.status}</div>
            <div>{weekLabel}</div>
          </div>
        )}
      </div>
    );
  }

  // invoice - diamond
  return (
    <div
      className="relative flex items-center justify-center"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <button
        onClick={onClick}
        className={`w-12 h-12 transition-transform hover:scale-125 cursor-pointer ${bgColor} flex items-center justify-center relative`}
        style={{ transform: "rotate(45deg)" }}
        aria-label={ariaLabel}
        title={tooltipText}
      >
        <span className="absolute text-[11px] font-bold text-white" style={{ transform: "rotate(-45deg)" }}>{milestone}</span>
      </button>
      {showTooltip && (
        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10 border border-gray-700 pointer-events-none">
          <div className="font-semibold">{milestone}</div>
          <div>Invoice: {week.status}</div>
          <div>{weekLabel}</div>
        </div>
      )}
    </div>
  );
};

export const MilestoneHealthTracker = ({ data, loading, error, onDataRefresh }: MilestoneHealthTrackerProps) => {
  const qc = useQueryClient();
  const [modalState, setModalState] = useState<ModalState | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8 rounded-lg border border-gray-200 bg-white">
        <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
        <span className="ml-2 text-sm text-gray-600">Loading milestone health...</span>
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
    isEmpty = false
  ) => {
    setModalState({
      isOpen: true,
      type,
      milestone,
      milestoneId: milestone.id || "",
      weekNumber,
      weekLabel,
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
      const baseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
      const response = await fetch(`${baseUrl}/api/milestones/${modalState.milestoneId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      console.log("Milestone id is ", modalState.milestoneId);

      if (!response.ok) {
        throw new Error("Failed to update milestone");
      }

      // Close modal
      handleModalClose();

      // Refresh milestone health data immediately
      if (data?.project_id) {
        try {
          const baseUrl = import.meta.env.VITE_API_BASE_URL || "https://j2w-tracker-backend.onrender.com";
          const healthRes = await fetch(`${baseUrl}api/projects/${data.project_id}/milestone-health`);
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
      alert(`Error updating milestone: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Group weeks by month based on actual start date
  const monthGroups: Record<string, { startIdx: number; endIdx: number; label: string }> = {};
  let currentMonthKey = "";

  Object.entries(data.all_weeks).forEach(([idx, week]) => {
    const startDate = new Date(week.start);
    const year = startDate.getFullYear();
    const month = String(startDate.getMonth() + 1).padStart(2, "0");
    const monthKey = `${year}-${month}`;
    const monthLabel = `${startDate.toLocaleString("en-US", { month: "short" })} ${year}`;
    const weekIdx = parseInt(idx);

    if (monthKey !== currentMonthKey) {
      currentMonthKey = monthKey;
      if (!monthGroups[monthKey]) {
        monthGroups[monthKey] = { startIdx: weekIdx, endIdx: weekIdx, label: monthLabel };
      }
    } else if (monthGroups[monthKey]) {
      monthGroups[monthKey].endIdx = weekIdx;
    }
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
            {Object.entries(monthGroups).map(([monthKey, { startIdx, endIdx, label }]) => {
              const weekCount = endIdx - startIdx + 1;
              return (
                <div
                  key={monthKey}
                  className="flex-shrink-0 border-r border-gray-200 py-2 px-2 text-center font-semibold text-xs text-gray-700"
                  style={{ width: `${weekCount * 80}px` }}
                >
                  {label}
                </div>
              );
            })}
          </div>

          {/* Week Number Headers */}
          <div className="flex border-b border-gray-200 bg-gray-50">
            <div className="w-48 flex-shrink-0 border-r border-gray-200" />
            {Object.entries(monthGroups).map(([monthKey, { startIdx, endIdx }]) => {
              const weeks = Array.from({ length: endIdx - startIdx + 1 }).map((_, i) => startIdx + i);
              return (
                <div key={`${monthKey}-weeks`} className="flex border-r border-gray-200">
                  {weeks.map((_, i) => (
                    <div
                      key={`${monthKey}-week-${i}`}
                      className={`flex-shrink-0 flex items-center justify-center text-center py-1 text-xs text-gray-500 font-medium ${i < weeks.length - 1 ? "border-r border-gray-200" : ""}`}
                      style={{ width: "80px" }}
                    >
                      {i + 1}
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
              <div className="w-48 flex-shrink-0 border-r border-gray-200 flex items-center px-4 py-3 bg-gray-50 border-b border-gray-200">
                <span className="text-xs font-bold text-gray-700 uppercase">{phase.label}</span>
              </div>

              {/* Milestone Data Cells */}
              {Object.entries(monthGroups).map(([monthKey, { startIdx, endIdx }]) => {
                const weeks = Array.from({ length: endIdx - startIdx + 1 }).map((_, i) => startIdx + i);
                return (
                  <div key={`${phase.type}-${monthKey}`} className="flex border-r border-gray-200">
                    {weeks.map((weekIdx, i) => {
                      const phaseData = data[phase.type];
                      const weekLabel = data.all_weeks[String(weekIdx)]?.label || `Week ${weekIdx}`;
                      let cellContent = null;

                      if (phase.type === "practice") {
                        // Sort all milestones by code for consistent alignment (M1, M2, M3, etc.)
                        const sortedMilestones = [...phaseData].sort((a, b) => {
                          const codeA = a.milestone_code || "";
                          const codeB = b.milestone_code || "";
                          return codeA.localeCompare(codeB, undefined, { numeric: true });
                        });

                        cellContent = (
                          <div className="flex flex-col gap-4">
                            {/* Render all milestones in sorted order - filled if has data, empty if not */}
                            {sortedMilestones.map((milestone) => {
                              const week = milestone.weeks.find((w) => w.week_number === weekIdx);
                              if (week) {
                                return (
                                  <WeekBlockCell
                                    key={`${milestone.milestone_code}-${weekIdx}`}
                                    week={week}
                                    type="practice"
                                    allWeeks={data.all_weeks}
                                    milestone={milestone.milestone_code || ""}
                                    onClick={() => handleModalOpen("practice", milestone, weekIdx, weekLabel, false)}
                                  />
                                );
                              } else {
                                return (
                                  <EmptyCell
                                    key={`${milestone.milestone_code}-empty-${weekIdx}`}
                                    weekNumber={weekIdx}
                                    allWeeks={data.all_weeks}
                                    milestoneCode={milestone.milestone_code || ""}
                                    onClick={() => handleModalOpen("practice", milestone, weekIdx, weekLabel, true)}
                                  />
                                );
                              }
                            })}
                          </div>
                        );
                      } else {
                        // Sort all milestones by code for consistent alignment (M1, M2, M3, etc.)
                        const sortedMilestones = [...phaseData].sort((a, b) => {
                          const codeA = a.milestone_code || "";
                          const codeB = b.milestone_code || "";
                          return codeA.localeCompare(codeB, undefined, { numeric: true });
                        });

                        // For signoff and invoice, only render milestones that have data for this week
                        const milestonesForWeek = sortedMilestones.filter((m) => m.weeks.some((w) => w.week_number === weekIdx));
                        if (milestonesForWeek.length > 0) {
                          cellContent = (
                            <div className="flex flex-col gap-6">
                              {milestonesForWeek.map((milestone) => {
                                const week = milestone.weeks.find((w) => w.week_number === weekIdx);
                                if (!week) return null;
                                return (
                                  <WeekBlockCell
                                    key={`${milestone.milestone_code}-${weekIdx}`}
                                    week={week}
                                    type={phase.type}
                                    allWeeks={data.all_weeks}
                                    milestone={milestone.milestone_code || ""}
                                    onClick={() => handleModalOpen(phase.type, milestone, weekIdx, weekLabel, false)}
                                  />
                                );
                              })}
                            </div>
                          );
                        }
                      }

                      return (
                        <div
                          key={weekIdx}
                          className={`flex-shrink-0 flex flex-col items-center justify-around py-3 px-3 ${i < weeks.length - 1 ? "border-r border-gray-200" : ""}`}
                          style={{ width: "80px", minHeight: "100px" }}
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
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: "#d1d5db" }} />
            <span className="text-gray-600">No Data</span>
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
