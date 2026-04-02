import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useTheme } from "@/hooks/useTheme";
import Overview from "./pages/Overview";
import Projects from "./pages/Projects";
import Resources from "./pages/Resources";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const AppInner = () => {
  const theme = useTheme();
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Overview themeToggle={theme} />} />
        <Route path="/projects" element={<Projects themeToggle={theme} />} />
        <Route path="/resources" element={<Resources themeToggle={theme} />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner position="bottom-right" />
      <AppInner />
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
