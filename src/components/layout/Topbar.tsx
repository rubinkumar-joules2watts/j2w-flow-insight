import { Sun, Moon } from "lucide-react";

const Topbar = ({ title, themeToggle }: { title: string; themeToggle?: { dark: boolean; toggle: () => void } }) => (
  <header
    className="sticky top-0 z-40 flex h-13 items-center justify-between border-b border-border px-6 bg-background/85"
    style={{ backdropFilter: "blur(8px)" }}
  >
    <h1 className="text-sm font-medium text-foreground">{title}</h1>
    {themeToggle && (
      <button
        onClick={themeToggle.toggle}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
        title={themeToggle.dark ? "Switch to light mode" : "Switch to dark mode"}
      >
        {themeToggle.dark ? <Sun size={16} /> : <Moon size={16} />}
      </button>
    )}
  </header>
);

export default Topbar;
