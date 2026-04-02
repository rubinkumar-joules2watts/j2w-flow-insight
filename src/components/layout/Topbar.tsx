const Topbar = ({ title }: { title: string }) => (
  <header className="sticky top-0 z-40 flex h-13 items-center border-b border-border px-6" style={{ backdropFilter: "blur(8px)", backgroundColor: "hsla(160, 10%, 6%, 0.85)" }}>
    <h1 className="text-sm font-medium text-foreground">{title}</h1>
  </header>
);

export default Topbar;
