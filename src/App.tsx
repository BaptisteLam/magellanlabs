import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Home from "./pages/Home";
import About from "./pages/About";
import Contact from "./pages/Contact";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";
import NotFound from "./pages/NotFound";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import AIBuilder from "./pages/AIBuilder";
import BuilderSession from "./pages/BuilderSession";
import SessionPreview from "./pages/SessionPreview";
import PublicProject from "./pages/PublicProject";
import ProjectDashboard from "./pages/ProjectDashboard";
import ScrollToTop from "./components/ScrollToTop";
import { ProtectedRoute } from "./components/ProtectedRoute";

import { useThemeStore } from "./stores/themeStore";
import { useEffect } from "react";
import { useSubdomain } from "./hooks/useSubdomain";
import { supabaseMisconfigured } from "./integrations/supabase/client";

const queryClient = new QueryClient();

function AppContent() {
  const subdomain = useSubdomain();

  if (supabaseMisconfigured) {
    return (
      <div style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif', maxWidth: 600, margin: '4rem auto' }}>
        <h1 style={{ color: '#dc2626' }}>Missing configuration</h1>
        <p>Supabase environment variables are not configured:</p>
        <ul>
          <li><code>VITE_SUPABASE_URL</code></li>
          <li><code>VITE_SUPABASE_PUBLISHABLE_KEY</code></li>
        </ul>
        <p>
          On <strong>Vercel</strong>: Settings &gt; Environment Variables<br />
          Locally: create a <code>.env</code> file (see <code>.env.example</code>)
        </p>
      </div>
    );
  }

  // If on a subdomain, display the published project directly
  if (subdomain) {
    return <PublicProject />;
  }
  
  // Otherwise, display the normal SaaS app
  return (
    <>
      
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/builder" element={<ProtectedRoute><AIBuilder /></ProtectedRoute>} />
        <Route path="/builder/:sessionId" element={<ProtectedRoute><BuilderSession /></ProtectedRoute>} />
        <Route path="/preview/:sessionId" element={<ProtectedRoute><SessionPreview /></ProtectedRoute>} />
        <Route path="/project/:projectId" element={<ProtectedRoute><ProjectDashboard /></ProtectedRoute>} />
        <Route path="/p/:subdomain" element={<PublicProject />} />
        <Route path="/about" element={<About />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/privacy-policy" element={<PrivacyPolicy />} />
        <Route path="/terms-of-service" element={<TermsOfService />} />
        {/* Legacy French URL redirects */}
        <Route path="/tarifs" element={<Navigate to="/" replace />} />
        <Route path="/politique-de-confidentialite" element={<Navigate to="/privacy-policy" replace />} />
        <Route path="/cgv" element={<Navigate to="/terms-of-service" replace />} />
        <Route path="/home" element={<Navigate to="/" replace />} />
        <Route path="/careers" element={<Navigate to="/contact" replace />} />
        <Route path="/nous-rejoindre" element={<Navigate to="/contact" replace />} />
        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}

function App() {
  const { isDark } = useThemeStore();

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppContent />
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;