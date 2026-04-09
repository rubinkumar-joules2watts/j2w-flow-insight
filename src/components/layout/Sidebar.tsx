import { useState } from "react";
import { LayoutDashboard, FolderKanban, Users, ChevronLeft, ChevronRight, Zap } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import j2wLogo from "@/assets/j2w-logo.png";

const navItems = [
  { icon: LayoutDashboard, label: "Overview", path: "/", description: "Dashboard & KPIs" },
  { icon: FolderKanban, label: "Projects", path: "/projects", description: "Project Management" },
  { icon: Users, label: "Resources", path: "/resources", description: "Team & Allocation" },
];

const Sidebar = () => {
  const [isExpanded, setIsExpanded] = useState(true);
  const location = useLocation();
  const navigate = useNavigate();


  return (
    <aside className={`h-screen bg-gradient-to-b from-white to-gray-50 border-r border-gray-200 flex flex-col transition-all duration-300 ${isExpanded ? "w-72" : "w-24"} shadow-sm`}>
      {/* Header - Logo and Expand/Collapse Button */}
      <div className="h-20 border-b border-gray-200 flex items-center justify-between px-6 bg-white">
        {isExpanded ? (
          <div className="flex items-center gap-4 flex-1">
            <div className="flex items-center justify-center h-14 w-14 rounded-lg bg-blue-50 shadow-sm flex-shrink-0 p-1">
              <img src={j2wLogo} alt="Joules Watts" className="h-full w-auto object-contain" />
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-bold text-gray-900">Delivery</span>
              <span className="text-xs text-gray-500 font-medium tracking-wide">TRACKER</span>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-12 w-12 rounded-lg bg-blue-50 shadow-sm flex-shrink-0 p-1 mx-auto">
            <img src={j2wLogo} alt="Joules Watts" className="h-full w-auto object-contain" />
          </div>
        )}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="p-2.5 rounded-lg hover:bg-gray-100 transition-all duration-200 text-gray-500 hover:text-blue-600 flex-shrink-0"
          title={isExpanded ? "Collapse sidebar" : "Expand sidebar"}
        >
          {isExpanded ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
        </button>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 overflow-y-auto py-6 px-3 space-y-2">
        {/* Navigation label */}
        {isExpanded && (
          <div className="px-3 py-2 text-xs font-bold text-gray-500 uppercase tracking-widest">
            Navigation
          </div>
        )}

        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <div key={item.path} title={!isExpanded ? item.label : undefined}>
              <button
                onClick={() => navigate(item.path)}
                className={`w-full flex items-center gap-3 rounded-lg px-4 py-3 transition-all duration-200 group ${
                  isActive
                    ? "bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg"
                    : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                }`}
              >
                <item.icon size={20} strokeWidth={1.5} className="flex-shrink-0" />
                {isExpanded && (
                  <div className="flex flex-col items-start flex-1">
                    <span className="text-sm font-semibold">{item.label}</span>
                    <span className={`text-xs ${isActive ? "text-blue-100" : "text-gray-400"}`}>
                      {item.description}
                    </span>
                  </div>
                )}
              </button>
            </div>
          );
        })}
      </nav>

      {/* Quick Actions / Pro Features */}
      {isExpanded && (
        <div className="px-4 py-4 border-t border-gray-200 bg-gray-50">
          <div className="rounded-lg bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 p-4 mb-4">
            <div className="flex items-start gap-3">
              <Zap size={18} className="text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <div className="text-sm font-semibold text-gray-900">Quick Insights</div>
                <div className="text-xs text-gray-600 mt-1">Real-time project status</div>
              </div>
            </div>
          </div>
        </div>
      )}

    </aside>
  );
};

export default Sidebar;
