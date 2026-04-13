interface TopbarProps {
  title: string;
}

const Topbar = ({ title }: TopbarProps) => {
  return (
    <header className="sticky top-0 z-40 border-b border-gray-200 bg-gradient-to-r from-white via-gray-50 to-white shadow-sm">
      {/* Main header bar */}
      <div className="flex h-16 items-center px-6">
        {/* Title */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{title}</h1>
          <p className="text-[10px] text-gray-500 font-light tracking-widest leading-none">DELIVERY MANAGEMENT</p>
        </div>
      </div>
    </header>
  );
};

export default Topbar;
