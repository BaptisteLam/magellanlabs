-- Table pour les contacts reçus par projet
CREATE TABLE public.project_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.build_sessions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  message TEXT,
  status TEXT DEFAULT 'new',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Table pour les articles de blog par projet
CREATE TABLE public.project_blog_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.build_sessions(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT,
  slug TEXT NOT NULL,
  status TEXT DEFAULT 'draft',
  featured_image TEXT,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Table pour les factures par projet
CREATE TABLE public.project_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.build_sessions(id) ON DELETE CASCADE,
  invoice_number TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'EUR',
  status TEXT DEFAULT 'pending',
  line_items JSONB DEFAULT '[]',
  client_info JSONB DEFAULT '{}',
  due_date TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Table pour les métadonnées SEO par page
CREATE TABLE public.project_seo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.build_sessions(id) ON DELETE CASCADE,
  page_path TEXT NOT NULL,
  meta_title TEXT,
  meta_description TEXT,
  keywords JSONB DEFAULT '[]',
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(project_id, page_path)
);

-- Table pour les domaines personnalisés
CREATE TABLE public.project_domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.build_sessions(id) ON DELETE CASCADE,
  domain_name TEXT NOT NULL UNIQUE,
  is_primary BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'pending',
  dns_records JSONB DEFAULT '[]',
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Table pour la configuration marketing
CREATE TABLE public.project_marketing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.build_sessions(id) ON DELETE CASCADE,
  social_links JSONB DEFAULT '{}',
  email_settings JSONB DEFAULT '{}',
  campaigns JSONB DEFAULT '[]',
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(project_id)
);

-- Table pour les données financières
CREATE TABLE public.project_finance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.build_sessions(id) ON DELETE CASCADE,
  payment_methods JSONB DEFAULT '[]',
  revenue_stats JSONB DEFAULT '{}',
  expense_tracking JSONB DEFAULT '[]',
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(project_id)
);

-- Enable RLS on all tables
ALTER TABLE public.project_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_blog_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_seo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_marketing ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_finance ENABLE ROW LEVEL SECURITY;

-- RLS Policies for project_contacts
CREATE POLICY "Users can view contacts of their projects" ON public.project_contacts
FOR SELECT USING (project_id IN (SELECT id FROM public.build_sessions WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert contacts to their projects" ON public.project_contacts
FOR INSERT WITH CHECK (project_id IN (SELECT id FROM public.build_sessions WHERE user_id = auth.uid()));

CREATE POLICY "Users can update contacts of their projects" ON public.project_contacts
FOR UPDATE USING (project_id IN (SELECT id FROM public.build_sessions WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete contacts of their projects" ON public.project_contacts
FOR DELETE USING (project_id IN (SELECT id FROM public.build_sessions WHERE user_id = auth.uid()));

-- RLS Policies for project_blog_posts
CREATE POLICY "Users can view blog posts of their projects" ON public.project_blog_posts
FOR SELECT USING (project_id IN (SELECT id FROM public.build_sessions WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert blog posts to their projects" ON public.project_blog_posts
FOR INSERT WITH CHECK (project_id IN (SELECT id FROM public.build_sessions WHERE user_id = auth.uid()));

CREATE POLICY "Users can update blog posts of their projects" ON public.project_blog_posts
FOR UPDATE USING (project_id IN (SELECT id FROM public.build_sessions WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete blog posts of their projects" ON public.project_blog_posts
FOR DELETE USING (project_id IN (SELECT id FROM public.build_sessions WHERE user_id = auth.uid()));

-- RLS Policies for project_invoices
CREATE POLICY "Users can view invoices of their projects" ON public.project_invoices
FOR SELECT USING (project_id IN (SELECT id FROM public.build_sessions WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert invoices to their projects" ON public.project_invoices
FOR INSERT WITH CHECK (project_id IN (SELECT id FROM public.build_sessions WHERE user_id = auth.uid()));

CREATE POLICY "Users can update invoices of their projects" ON public.project_invoices
FOR UPDATE USING (project_id IN (SELECT id FROM public.build_sessions WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete invoices of their projects" ON public.project_invoices
FOR DELETE USING (project_id IN (SELECT id FROM public.build_sessions WHERE user_id = auth.uid()));

-- RLS Policies for project_seo
CREATE POLICY "Users can view SEO of their projects" ON public.project_seo
FOR SELECT USING (project_id IN (SELECT id FROM public.build_sessions WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert SEO to their projects" ON public.project_seo
FOR INSERT WITH CHECK (project_id IN (SELECT id FROM public.build_sessions WHERE user_id = auth.uid()));

CREATE POLICY "Users can update SEO of their projects" ON public.project_seo
FOR UPDATE USING (project_id IN (SELECT id FROM public.build_sessions WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete SEO of their projects" ON public.project_seo
FOR DELETE USING (project_id IN (SELECT id FROM public.build_sessions WHERE user_id = auth.uid()));

-- RLS Policies for project_domains
CREATE POLICY "Users can view domains of their projects" ON public.project_domains
FOR SELECT USING (project_id IN (SELECT id FROM public.build_sessions WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert domains to their projects" ON public.project_domains
FOR INSERT WITH CHECK (project_id IN (SELECT id FROM public.build_sessions WHERE user_id = auth.uid()));

CREATE POLICY "Users can update domains of their projects" ON public.project_domains
FOR UPDATE USING (project_id IN (SELECT id FROM public.build_sessions WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete domains of their projects" ON public.project_domains
FOR DELETE USING (project_id IN (SELECT id FROM public.build_sessions WHERE user_id = auth.uid()));

-- RLS Policies for project_marketing
CREATE POLICY "Users can view marketing of their projects" ON public.project_marketing
FOR SELECT USING (project_id IN (SELECT id FROM public.build_sessions WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert marketing to their projects" ON public.project_marketing
FOR INSERT WITH CHECK (project_id IN (SELECT id FROM public.build_sessions WHERE user_id = auth.uid()));

CREATE POLICY "Users can update marketing of their projects" ON public.project_marketing
FOR UPDATE USING (project_id IN (SELECT id FROM public.build_sessions WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete marketing of their projects" ON public.project_marketing
FOR DELETE USING (project_id IN (SELECT id FROM public.build_sessions WHERE user_id = auth.uid()));

-- RLS Policies for project_finance
CREATE POLICY "Users can view finance of their projects" ON public.project_finance
FOR SELECT USING (project_id IN (SELECT id FROM public.build_sessions WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert finance to their projects" ON public.project_finance
FOR INSERT WITH CHECK (project_id IN (SELECT id FROM public.build_sessions WHERE user_id = auth.uid()));

CREATE POLICY "Users can update finance of their projects" ON public.project_finance
FOR UPDATE USING (project_id IN (SELECT id FROM public.build_sessions WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete finance of their projects" ON public.project_finance
FOR DELETE USING (project_id IN (SELECT id FROM public.build_sessions WHERE user_id = auth.uid()));

-- Triggers for updated_at
CREATE TRIGGER update_project_blog_posts_updated_at
BEFORE UPDATE ON public.project_blog_posts
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_project_seo_updated_at
BEFORE UPDATE ON public.project_seo
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_project_marketing_updated_at
BEFORE UPDATE ON public.project_marketing
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_project_finance_updated_at
BEFORE UPDATE ON public.project_finance
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();