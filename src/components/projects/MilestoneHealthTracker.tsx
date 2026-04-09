import { useState } from "react";
import { MilestoneHealthData, WeekData } from "@/hooks/useData";
import { Loader2 } from "lucide-react";

interface MilestoneHealthTrackerProps {
  data?: MilestoneHealthData;
  loading?: boolean;
  error?: Error | null;
}

const getStatusColor = (color: string): string => {
  const colorMap: Record<string, string> = {
    blue: "bg-blue-500",
    green: "bg-green-500",
    amber: "bg-amber-500",
    orange: "bg-orange-500",
    red: "bg-red-500",
    gray: "bg-gray-300",
  };
  return colorMap[color] || "bg-gray-300";
};

const WeekBlockCell = ({ week, type, allWeeks }: { week: WeekData; type: "practice" | "signoff" | "invoice"; allWeeks: Record<string, { label: string }> }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const weekLabel = allWeeks[String(week.week_number)]?.label || `W${week.week_number}`;
  const colorClass = getStatusColor(week.color);

  if (type === "practice") {
    return (
      <div
        className="relative flex items-center justify-center"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <div className={`w-4 h-4 rounded-sm ${colorClass} cursor-pointer hover:opacity-80 transition-opacity`} />
        {showTooltip && (
          <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10 border border-gray-700">
            {weekLabel}: {week.status}
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
        <div className={`w-3 h-3 rounded-full ${colorClass} cursor-pointer hover:opacity-80 transition-opacity`} />
        {showTooltip && (
          <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10 border border-gray-700">
            {weekLabel}: {week.status}
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
      <div className={`w-3 h-3 ${colorClass} cursor-pointer hover:opacity-80 transition-opacity`} style={{ transform: "rotate(45deg)" }} />
      {showTooltip && (
        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10 border border-gray-700">
          {weekLabel}: {week.status}
        </div>
      )}
    </div>
  );
};

export const MilestoneHealthTracker = ({ data, loading, error }: MilestoneHealthTrackerProps) => {
  if (loading) {
    return (
      <div className="flex items-center justify-center p-8 rounded-lg border border-gray-300 bg-gradient-to-b from-gray-50 to-gray-100">
        <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-300 rounded-lg text-sm text-red-600">
        Failed to load milestone health: {error.message}
      </div>
    );
  }

  if (!data) {
    return null;
  }

  // Collect all unique milestones across all phases
  const allMilestones = Array.from(
    new Set([
      ...data.practice.map((p) => p.milestone_code),
      ...data.signoff.map((s) => s.milestone_code),
      ...data.invoice.map((i) => i.milestone_code),
    ])
  ).filter(Boolean);

  // Create a mapping of milestone codes to phase data
  const milestoneMap: Record<string, { practice?: typeof data.practice[0]; signoff?: typeof data.signoff[0]; invoice?: typeof data.invoice[0] }> = {};
  allMilestones.forEach((code) => {
    milestoneMap[code] = {
      practice: data.practice.find((p) => p.milestone_code === code),
      signoff: data.signoff.find((s) => s.milestone_code === code),
      invoice: data.invoice.find((i) => i.milestone_code === code),
    };
  });

  const phases: Array<{ type: "practice" | "signoff" | "invoice"; label: string }> = [
    { type: "practice", label: "Practice" },
    { type: "signoff", label: "Client Signoff" },
    { type: "invoice", label: "Invoice" },
  ];

  // Group weeks by month based on actual start date (not label)
  const monthGroups: Record<string, { startIdx: number; endIdx: number; label: string }> = {};
  let currentMonthKey = "";

  Object.entries(data.all_weeks).forEach(([idx, week]) => {
    // Parse the actual start date to determine the month
    const startDate = new Date(week.start);
    const monthKey = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, "0")}`; // e.g., "2025-01"
    const monthLabel = startDate.toLocaleString("en-US", { month: "short" }); // e.g., "Jan"
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

  return (
    <div className="rounded-lg border border-gray-300 bg-gradient-to-b from-gray-50 to-gray-100 overflow-hidden">
      {/* Header */}
      <div className="border-b border-gray-300 px-6 py-4">
        <h3 className="text-lg font-bold text-gray-800">{data.project_name} - Milestone Health</h3>
        <p className="text-xs text-gray-500 mt-1">
          {data.weeks_range.start_week} — {data.weeks_range.end_week} ({data.weeks_range.total_weeks} weeks)
        </p>
      </div>

      {/* Matrix Table */}
      <div className="overflow-x-auto">
        <div className="min-w-max">
          {/* Month Headers */}
          <div className="flex border-b border-gray-300">
            {/* Empty cell for phase labels column */}
            <div className="w-40 flex-shrink-0 border-r border-gray-300" />

            {/* Month headers */}
            {Object.entries(monthGroups).map(([monthKey, { startIdx, endIdx, label }]) => {
              const weekCount = endIdx - startIdx + 1;
              return (
                <div
                  key={monthKey}
                  className="flex-shrink-0 border-r border-gray-300 py-2 px-1 text-center"
                  style={{ width: `${weekCount * 32}px` }}
                >
                  <span className="text-xs font-semibold text-gray-600">{label}</span>
                </div>
              );
            })}
          </div>

          {/* Week Number Headers */}
          <div className="flex border-b border-gray-300">
            {/* Empty cell for phase labels column */}
            <div className="w-40 flex-shrink-0 border-r border-gray-300" />

            {/* Week numbers */}
            {Object.entries(monthGroups).map(([monthKey, { startIdx, endIdx }]) => {
              const weeks = Array.from({ length: endIdx - startIdx + 1 }).map((_, i) => startIdx + i);
              return (
                <div key={`${monthKey}-weeks`} className="flex border-r border-gray-300">
                  {weeks.map((weekIdx, i) => (
                    <div
                      key={weekIdx}
                      className={`flex-shrink-0 flex items-center justify-center text-center py-1 ${i < weeks.length - 1 ? "border-r border-gray-200" : ""}`}
                      style={{ width: "32px" }}
                    >
                      <span className="text-[10px] text-gray-500 font-medium">W{i + 1}</span>
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
              className={`flex ${phaseIdx < phases.length - 1 ? "border-b border-gray-300" : ""}`}
            >
              {/* Phase Label Column */}
              <div className="w-40 flex-shrink-0 border-r border-gray-300 flex items-center px-4 py-4 bg-white/50">
                <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">{phase.label}</span>
              </div>

              {/* Milestone Data Cells */}
              {Object.entries(monthGroups).map(([monthKey, { startIdx, endIdx }]) => {
                const weeks = Array.from({ length: endIdx - startIdx + 1 }).map((_, i) => startIdx + i);
                return (
                  <div key={`${phase.type}-${monthKey}`} className="flex border-r border-gray-300">
                    {weeks.map((weekIdx, i) => {
                      let weekData: WeekData | undefined;
                      const milestoneCodes: string[] = [];

                      allMilestones.forEach((milestone) => {
                        const phaseData = milestoneMap[milestone]?.[phase.type];
                        const week = phaseData?.weeks?.find((w) => w.week_number === weekIdx);
                        if (week) {
                          weekData = week;
                          milestoneCodes.push(milestone);
                        }
                      });

                      return (
                        <div
                          key={weekIdx}
                          className={`flex-shrink-0 flex items-center justify-center py-4 px-1 ${i < weeks.length - 1 ? "border-r border-gray-200" : ""}`}
                          style={{ width: "32px" }}
                        >
                          {weekData && <WeekBlockCell week={weekData} type={phase.type} allWeeks={data.all_weeks} />}
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
      <div className="border-t border-gray-300 px-6 py-4 bg-white/30">
        <p className="text-xs font-bold text-gray-700 mb-2 uppercase tracking-wide">Status</p>
        <div className="flex flex-wrap gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-blue-500" />
            <span className="text-gray-600">Completed</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-amber-500" />
            <span className="text-gray-600">Pending</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-orange-500" />
            <span className="text-gray-600">In Progress</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-red-500" />
            <span className="text-gray-600">At Risk</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-gray-300" />
            <span className="text-gray-600">No Data</span>
          </div>
        </div>
      </div>
    </div>
  );
};
