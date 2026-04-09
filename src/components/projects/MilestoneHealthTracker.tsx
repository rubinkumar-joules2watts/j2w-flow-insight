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
    blue: "bg-blue-500 border-blue-400",
    green: "bg-green-500 border-green-400",
    amber: "bg-amber-500 border-amber-400",
    orange: "bg-orange-500 border-orange-400",
    red: "bg-red-500 border-red-400",
    gray: "bg-gray-600 border-gray-500",
  };
  return colorMap[color] || "bg-gray-600 border-gray-500";
};

const WeekBlockCell = ({ week, type, allWeeks }: { week: WeekData; type: "practice" | "signoff" | "invoice"; allWeeks: Record<string, { label: string }> }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const weekLabel = allWeeks[String(week.week_number)]?.label || `W${week.week_number}`;
  const colorClasses = getStatusColor(week.color);

  if (type === "practice") {
    return (
      <div
        className="relative flex items-center justify-center"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <div className={`w-5 h-5 rounded-sm border ${colorClasses} cursor-pointer hover:scale-110 transition-transform`} />
        {showTooltip && (
          <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-gray-900 border border-gray-700 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10">
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
        <div className={`w-4 h-4 rounded-full border ${colorClasses} cursor-pointer hover:scale-110 transition-transform`} />
        {showTooltip && (
          <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-gray-900 border border-gray-700 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10">
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
      <div className={`w-3.5 h-3.5 border ${colorClasses} cursor-pointer hover:scale-110 transition-transform`} style={{ transform: "rotate(45deg)" }} />
      {showTooltip && (
        <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-gray-900 border border-gray-700 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10">
          {weekLabel}: {week.status}
        </div>
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

  return (
    <div className="bg-gray-900/40 border border-gray-800 rounded-lg p-6 space-y-6 overflow-x-auto">
      <div>
        <h3 className="text-lg font-semibold text-gray-100 mb-1">{data.project_name} - Milestone Health</h3>
        <p className="text-xs text-gray-400">
          {data.weeks_range.start_week} — {data.weeks_range.end_week} ({data.weeks_range.total_weeks} weeks)
        </p>
      </div>

      {/* Matrix Table */}
      <div className="min-w-max">
        {/* Header Row - Milestones */}
        <div className="flex border-b border-gray-700">
          {/* Empty cell for phase labels column */}
          <div className="w-40 flex-shrink-0 border-r border-gray-700" />

          {/* Milestone headers */}
          {allMilestones.map((milestone) => (
            <div key={milestone} className="w-24 flex-shrink-0 flex items-center justify-center border-r border-gray-700 py-3">
              <span className="text-sm font-bold text-blue-400">{milestone}</span>
            </div>
          ))}
        </div>

        {/* Data Rows */}
        {phases.map((phase) => (
          <div key={phase.type} className="flex border-b border-gray-700 last:border-b-0">
            {/* Phase Label Column */}
            <div className="w-40 flex-shrink-0 border-r border-gray-700 flex items-center px-4 py-4 bg-gray-800/30">
              <span className="text-xs font-semibold text-gray-300 uppercase tracking-wide">{phase.label}</span>
            </div>

            {/* Milestone Data Cells */}
            {allMilestones.map((milestone) => {
              const phaseData = milestoneMap[milestone]?.[phase.type];
              const weeks = phaseData?.weeks || [];

              return (
                <div
                  key={`${phase.type}-${milestone}`}
                  className="w-24 flex-shrink-0 flex items-center justify-center border-r border-gray-700 py-4 px-2"
                >
                  {weeks.length > 0 ? (
                    <div className="flex flex-wrap gap-1 justify-center">
                      {weeks.slice(0, 6).map((week, idx) => (
                        <WeekBlockCell key={idx} week={week} type={phase.type} allWeeks={data.all_weeks} />
                      ))}
                      {weeks.length > 6 && (
                        <div className="text-[10px] text-gray-400 w-full text-center col-span-full">
                          +{weeks.length - 6} more
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-xs text-gray-500">—</div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="pt-4 border-t border-gray-800">
        <p className="text-xs font-semibold text-gray-400 mb-3 uppercase tracking-wide">Status Legend</p>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-blue-500 rounded-sm border border-blue-400" />
            <span className="text-gray-400">Completed</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-amber-500 rounded-sm border border-amber-400" />
            <span className="text-gray-400">Pending</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-orange-500 rounded-sm border border-orange-400" />
            <span className="text-gray-400">In Progress</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-red-500 rounded-sm border border-red-400" />
            <span className="text-gray-400">At Risk</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-gray-600 rounded-sm border border-gray-500" />
            <span className="text-gray-400">No Data</span>
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-3">Shape Legend: □ Practice • Signoff ◆ Invoice</p>
      </div>
    </div>
  );
};
