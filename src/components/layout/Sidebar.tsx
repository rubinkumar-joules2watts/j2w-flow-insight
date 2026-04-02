import { LayoutDashboard, FolderKanban, Users } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import j2wLogo from "@/assets/j2w-logo.png";

const navItems = [
  { icon: LayoutDashboard, label: "Overview", path: "/" },
  { icon: FolderKanban, label: "Projects", path: "/projects" },
  { icon: Users, label: "Resources", path: "/resources" },
];

const Sidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <aside className="fixed left-0 top-0 z-50 flex h-screen w-14 flex-col items-center border-r border-border bg-sidebar py-3 gap-1">
      <div className="mb-4 flex items-center justify-center">
        <img src={j2wLogo} alt="J2W" className="h-9 w-9 object-contain" style={{ mixBlendMode: "normal" }} />
      </div>
      {navItems.map((item) => {
        const isActive = location.pathname === item.path;
        return (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            title={item.label}
            className={`group relative flex h-10 w-10 items-center justify-center rounded-lg transition-colors ${
              isActive
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
          >
            <item.icon size={20} strokeWidth={1.8} />
            <span className="pointer-events-none absolute left-full ml-2 whitespace-nowrap rounded-md bg-popover px-2 py-1 text-xs text-popover-foreground opacity-0 shadow-md transition-opacity group-hover:opacity-100">
              {item.label}
            </span>
          </button>
        );
      })}
    </aside>
  );
};

export default Sidebar;
