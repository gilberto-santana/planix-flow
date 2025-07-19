
// src/App.tsx

import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import { ChartsProvider } from "@/contexts/ChartsContext";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import StatsIndex from "./pages/dashboard/stats/Index";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ChartsProvider>
      <TooltipProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/dashboard/stats" element={<StatsIndex />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          <Toaster />
        </BrowserRouter>
      </TooltipProvider>
    </ChartsProvider>
  </QueryClientProvider>
);

export default App;
