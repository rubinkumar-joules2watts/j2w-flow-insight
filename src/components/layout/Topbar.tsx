interface TopbarProps {
  title: string;
}

const Topbar = ({ title }: TopbarProps) => {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-700 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 shadow-2xl">
      {/* Main header bar */}
      <div className="flex h-20 items-center px-8">
        {/* Title */}
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">{title}</h1>
          <p className="text-xs text-slate-500 font-light tracking-widest">DELIVERY MANAGEMENT</p>
        </div>
      </div>
    </header>
  );
};

export default Topbar;
