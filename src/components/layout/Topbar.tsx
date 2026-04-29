import { ReactNode } from "react";

interface TopbarProps {
  title: string;
  // actions?: ReactNode;
}

const Topbar = ({ title, }: TopbarProps) => {
  return (
    <header className="sticky top-0 z-40 border-b border-gray-200 bg-gradient-to-r from-white via-gray-50 to-white shadow-sm">
      <div className="flex h-16 items-center justify-between px-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{title}</h1>
          <p className="text-[10px] text-gray-500 font-light tracking-widest leading-none">DELIVERY MANAGEMENT</p>
        </div>
        {/* {actions && <div className="flex items-center gap-3">{actions}</div>} */}
      </div>
    </header>
  );
};

export default Topbar;
