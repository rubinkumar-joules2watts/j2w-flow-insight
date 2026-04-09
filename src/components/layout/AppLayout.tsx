import { ReactNode } from "react";
import Sidebar from "./Sidebar";

const AppLayout = ({ children }: { children: ReactNode }) => (
  <div className="flex h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 overflow-hidden">
    <Sidebar />
    <main className="flex-1 flex flex-col overflow-y-auto overflow-x-hidden">
      {children}
    </main>
  </div>
);

export default AppLayout;
