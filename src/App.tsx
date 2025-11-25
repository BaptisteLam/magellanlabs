import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Home from "./pages/Home";
import About from "./pages/About";
import Contact from "./pages/Contact";
import Pricing from "./pages/Pricing";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";
import NotFound from "./pages/NotFound";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import AIBuilder from "./pages/AIBuilder";
import BuilderSession from "./pages/BuilderSession";
import BuilderAppSession from "./pages/BuilderAppSession";
import BuilderSessionMobile from "./pages/BuilderSessionMobile";
import SessionPreview from "./pages/SessionPreview";
import PublicProject from "./pages/PublicProject";
import ScrollToTop from "./components/ScrollToTop";
import { SettingsCenter } from "./components/settings/SettingsCenter";
import { useThemeStore } from "./stores/themeStore";
import { useEffect } from "react";
import { useSubdomain } from "./hooks/useSubdomain";

const queryClient = new QueryClient();

function App() {
  const { isDark } = useThemeStore();
  const subdomain = useSubdomain();

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  // Si on détecte un subdomain, afficher directement le projet publié
  if (subdomain) {
    return (
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <PublicProject />
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    );
  }

  // Sinon, afficher les routes normales du SaaS
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <SettingsCenter />
          <ScrollToTop />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/builder" element={<AIBuilder />} />
            <Route path="/builder/:sessionId" element={<BuilderSession />} />
            <Route path="/builder/app/:sessionId" element={<BuilderAppSession />} />
            <Route path="/builder/mobile/:sessionId" element={<BuilderSessionMobile />} />
            <Route path="/preview/:sessionId" element={<SessionPreview />} />
            <Route path="/p/:subdomain" element={<PublicProject />} />
            <Route path="/about" element={<About />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/tarifs" element={<Pricing />} />
            <Route path="/politique-de-confidentialite" element={<PrivacyPolicy />} />
            <Route path="/cgv" element={<TermsOfService />} />
            <Route path="/home" element={<Navigate to="/" replace />} />
            <Route path="/careers" element={<Navigate to="/contact" replace />} />
            <Route path="/nous-rejoindre" element={<Navigate to="/contact" replace />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
