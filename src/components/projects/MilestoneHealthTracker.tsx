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
    gray: "bg-gray-500",
  };
  return colorMap[color] || "bg-gray-500";
};

const WeekBlock = ({ week, type }: { week: WeekData; type: "practice" | "signoff" | "invoice" }) => {
  const baseColor = getStatusColor(week.color);

  if (type === "practice") {
    return (
      <div className="flex items-center justify-center" title={`${week.week_label}: ${week.status}`}>
        <div className={`w-5 h-5 rounded-sm ${baseColor}`} />
      </div>
    );
  }

  if (type === "signoff") {
    return (
      <div className="flex items-center justify-center" title={`${week.week_label}: ${week.status}`}>
        <div className={`w-4 h-4 rounded-full ${baseColor}`} />
      </div>
    );
  }

  // invoice - diamond shape
  return (
    <div className="flex items-center justify-center" title={`${week.week_label}: ${week.status}`}>
      <div className={`w-3.5 h-3.5 ${baseColor}`} style={{ transform: "rotate(45deg)" }} />
    </div>
  );
};

const CurlyBrace = ({ children }: { children: React.ReactNode }) => {
  return (
    <svg
      className="w-5 h-12 text-gray-500 flex-shrink-0"
      viewBox="0 0 20 48"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M 14 6 Q 10 10 10 24 Q 10 38 14 42" />
    </svg>
  );
};

const MilestoneRow = ({
  phases,
  type,
  allWeeks,
}: {
  phases: MilestoneHealthData["practice"] | MilestoneHealthData["signoff"] | MilestoneHealthData["invoice"];
  type: "practice" | "signoff" | "invoice";
  allWeeks: Record<string, { label: string; start: string }>;
}) => {
  const totalWeeks = Object.keys(allWeeks).length;

  return (
    <div className="space-y-3">
      {phases.length === 0 ? null : (
        phases.map((phase) => (
          <div key={phase.milestone_code} className="flex items-start gap-2">
            <div className="flex items-center gap-1 flex-shrink-0">
              <CurlyBrace>{phase.milestone_code}</CurlyBrace>
              <div className="text-xs font-bold text-gray-300 w-12 truncate">{phase.milestone_code}</div>
            </div>

            {/* Week blocks container */}
            <div className="flex gap-0.5 overflow-x-auto pb-1 flex-1">
              {Array.from({ length: totalWeeks }).map((_, weekIndex) => {
                const weekData = phase.weeks?.find((w) => w.week_number === weekIndex);
                return (
                  <div key={weekIndex} className="flex-shrink-0 flex items-center justify-center h-6">
                    {weekData ? (
                      <WeekBlock week={weekData} type={type} />
                    ) : (
                      <div className={`w-5 h-5 bg-gray-700 ${type === "signoff" ? "rounded-full" : type === "invoice" ? "rounded-sm" : "rounded-sm"}`} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
};

export const MilestoneHealthTracker = ({ data, loading, error }: MilestoneHealthTrackerProps) => {
  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-900/20 border border-red-500/50 rounded-md text-sm text-red-400">
        Failed to load milestone health: {error.message}
      </div>
    );
  }

  if (!data) {
    return null;
  }

  // Group weeks by month
  const monthGroups: Record<string, { start: number; end: number; label: string }> = {};
  let currentMonth = "";
  let monthStart = 0;

  Object.entries(data.all_weeks).forEach(([idx, week]) => {
    const monthLabel = week.label.split(" ")[0]; // e.g., "Jan", "Feb"
    if (monthLabel !== currentMonth) {
      if (currentMonth) {
        monthGroups[currentMonth].end = parseInt(idx) - 1;
      }
      currentMonth = monthLabel;
      monthStart = parseInt(idx);
      monthGroups[monthLabel] = { start: monthStart, end: parseInt(idx), label: monthLabel };
    }
  });
  if (currentMonth) {
    monthGroups[currentMonth].end = Object.keys(data.all_weeks).length - 1;
  }

  const totalWeeks = Object.keys(data.all_weeks).length;

  return (
    <div className="bg-gray-900/40 border border-gray-800 rounded-lg p-6 space-y-8">
      <div>
        <h3 className="text-lg font-semibold text-gray-100 mb-1">{data.project_name} - Milestone Health</h3>
        <p className="text-xs text-gray-400">
          {data.weeks_range.start_week} — {data.weeks_range.end_week} ({data.weeks_range.total_weeks} weeks)
        </p>
      </div>

      {/* Month/Week Headers */}
      <div className="flex gap-2 text-xs text-gray-400 overflow-x-auto pb-2">
        <div className="w-20 flex-shrink-0" />
        <div className="flex gap-0.5">
          {Object.entries(monthGroups).map(([month, { start, end }]) => {
            const weekCount = end - start + 1;
            return (
              <div key={month} className="flex gap-0.5" style={{ width: `${weekCount * 21}px` }}>
                <span className="text-xs font-semibold text-gray-500 w-full text-center">{month}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Week number headers */}
      <div className="flex gap-2 text-xs text-gray-500 overflow-x-auto pb-3 mb-2">
        <div className="w-20 flex-shrink-0" />
        <div className="flex gap-0.5">
          {Array.from({ length: totalWeeks }).map((_, idx) => {
            const week = data.all_weeks[String(idx)];
            const weekNum = (idx % 4) + 1; // Week number within the month (1-4)
            return (
              <div key={idx} className="flex-shrink-0 w-5 text-center text-gray-600 text-[10px]">
                {weekNum === 1 ? "1" : ""}
              </div>
            );
          })}
        </div>
      </div>

      {/* Practice Health */}
      {data.practice.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">Practice Health</div>
          <MilestoneRow phases={data.practice} type="practice" allWeeks={data.all_weeks} />
        </div>
      )}

      {/* Signoff Health */}
      {data.signoff.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">Signoff Health</div>
          <MilestoneRow phases={data.signoff} type="signoff" allWeeks={data.all_weeks} />
        </div>
      )}

      {/* Invoice Health */}
      {data.invoice.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">Invoice Health</div>
          <MilestoneRow phases={data.invoice} type="invoice" allWeeks={data.all_weeks} />
        </div>
      )}

      {/* Legend */}
      <div className="pt-4 border-t border-gray-800">
        <div className="flex flex-wrap gap-6 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-blue-500 rounded-sm" />
            <span className="text-gray-400">Completed</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-amber-500 rounded-sm" />
            <span className="text-gray-400">Pending</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-orange-500 rounded-sm" />
            <span className="text-gray-400">In Progress</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-red-500 rounded-sm" />
            <span className="text-gray-400">At Risk</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-gray-500 rounded-sm" />
            <span className="text-gray-400">No Data</span>
          </div>
        </div>
      </div>
    </div>
  );
};
