import { useState } from "react";
import { LayoutDashboard, FolderKanban, Users, ChevronLeft, ChevronRight, Zap, FileText, Wand2 } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import j2wLogo from "@/assets/j2w-logo.png";

const navItems = [
  { icon: LayoutDashboard, label: "Overview", path: "/", description: "Dashboard & KPIs" },
  { icon: FolderKanban, label: "Projects", path: "/projects", description: "Project Management" },
  { icon: Users, label: "Resources", path: "/resources", description: "Team & Allocation" },
  { icon: Wand2, label: "Insights", path: "/insights", description: "AI Status Reports" },
  // { icon: FileText, label: "Proposal", path: "/proposal", description: "Planning & Resources" },
];

const Sidebar = () => {
  const [isExpanded, setIsExpanded] = useState(true);
  const location = useLocation();
  const navigate = useNavigate();


  return (
    <aside className={`h-screen bg-gradient-to-b from-white to-gray-50 border-r border-gray-200 flex flex-col transition-all duration-300 ${isExpanded ? "w-56" : "w-20"} shadow-sm`}>
      {/* Header - Logo and Expand/Collapse Button */}
      <div className={`h-16 border-b border-gray-200 flex items-center bg-white px-3 ${isExpanded ? "justify-between" : "justify-center gap-2"}`}>
        <div className={`flex items-center gap-2 ${isExpanded ? "flex-1" : ""}`}>
          <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-blue-50 shadow-sm flex-shrink-0 p-1">
            <img src={j2wLogo} alt="Joules Watts" className="h-full w-auto object-contain" />
          </div>
          {isExpanded && (
            <div className="flex flex-col">
              <span className="text-base font-bold text-gray-900 leading-tight">Delivery</span>
              <span className="text-xs text-blue-600 font-bold tracking-[0.2em] uppercase">Tracker</span>
            </div>
          )}
        </div>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={`p-1.5 rounded-lg hover:bg-gray-100 transition-all duration-200 text-gray-500 hover:text-blue-600 flex-shrink-0 ${!isExpanded ? "hidden group-hover:block" : ""}`}
          title={isExpanded ? "Collapse sidebar" : "Expand sidebar"}
        >
          {isExpanded ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
        </button>
        {/* Always visible toggle in collapsed mode if we use a different approach */}
        {!isExpanded && (
          <button
            onClick={() => setIsExpanded(true)}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-all duration-200 text-gray-500 hover:text-blue-600 flex-shrink-0"
          >
            <ChevronRight size={16} />
          </button>
        )}
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto overflow-x-visible">
        {/* Navigation label */}
        {isExpanded && (
          <div className="px-3 py-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-left">
            Navigation
          </div>
        )}

        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <div key={item.path} className="relative group/nav-item overflow-visible">
              <button
                onClick={() => navigate(item.path)}
                className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 transition-all duration-200 group ${isActive
                  ? "bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-md"
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                  } ${!isExpanded ? "justify-center" : "justify-start"}`}
              >
                <item.icon size={18} strokeWidth={1.5} className="flex-shrink-0" />
                {isExpanded && (
                  <div className="flex flex-col items-start flex-1 min-w-0 text-left">
                    <span className="text-xs font-semibold truncate w-full">{item.label}</span>
                    <span className={`text-[10px] truncate w-full text-left ${isActive ? "text-blue-100" : "text-gray-400"}`}>
                      {item.description}
                    </span>
                  </div>
                )}
              </button>

              {/* Custom Tooltip for Collapsed State */}
              {!isExpanded && (
                <div className="fixed left-20 px-2 py-1 bg-gray-900 text-white text-[10px] font-bold rounded opacity-0 pointer-events-none group-hover/nav-item:opacity-100 transition-opacity whitespace-nowrap z-[100] shadow-xl ml-1">
                  {item.label}
                  {/* Tooltip Arrow */}
                  <div className="absolute right-full top-1/2 -translate-y-1/2 border-y-[4px] border-y-transparent border-r-[4px] border-r-gray-900" />
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Quick Actions / Pro Features */}
      {isExpanded && (
        <div className="px-3 py-3 border-t border-gray-200 bg-gray-50">
          <div className="rounded-lg bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 p-3">
            <div className="flex items-start gap-2.5">
              <Zap size={14} className="text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-left">
                <div className="text-xs font-semibold text-gray-900">Quick Insights</div>
                <div className="text-[10px] text-gray-600 mt-0.5">Real-time stats</div>
              </div>
            </div>
          </div>
        </div>
      )}

    </aside>
  );
};

export default Sidebar;
