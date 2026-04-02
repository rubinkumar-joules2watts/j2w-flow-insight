import { ReactNode } from "react";
import Sidebar from "./Sidebar";

const AppLayout = ({ children }: { children: ReactNode }) => (
  <div className="flex min-h-screen">
    <Sidebar />
    <main className="ml-14 flex-1">{children}</main>
  </div>
);

export default AppLayout;
