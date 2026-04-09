import { ReactNode } from "react";
import Sidebar from "./Sidebar";

const AppLayout = ({ children }: { children: ReactNode }) => (
  <div className="flex h-screen bg-white overflow-hidden">
    <Sidebar />
    <main className="flex-1 flex flex-col overflow-y-auto overflow-x-hidden bg-white">
      {children}
    </main>
  </div>
);

export default AppLayout;
