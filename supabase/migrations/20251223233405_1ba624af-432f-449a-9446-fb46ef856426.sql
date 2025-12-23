-- Add missing columns to build_sessions
ALTER TABLE public.build_sessions 
ADD COLUMN IF NOT EXISTS business_sector TEXT,
ADD COLUMN IF NOT EXISTS initial_modules_config JSONB;

-- Create crm_modules table
CREATE TABLE IF NOT EXISTS public.crm_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.build_sessions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  module_type TEXT NOT NULL,
  icon TEXT,
  display_order INTEGER DEFAULT 0,
  config JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT valid_module_type CHECK (module_type IN ('inventory', 'sales', 'clients', 'analytics', 'hr', 'projects', 'finance', 'marketing', 'support', 'custom'))
);

-- Create crm_widgets table
CREATE TABLE IF NOT EXISTS public.crm_widgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID NOT NULL REFERENCES public.crm_modules(id) ON DELETE CASCADE,
  widget_type TEXT NOT NULL,
  title TEXT NOT NULL,
  config JSONB DEFAULT '{}',
  layout JSONB DEFAULT '{"x": 0, "y": 0, "w": 6, "h": 4}',
  display_order INTEGER DEFAULT 0,
  is_visible BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT valid_widget_type CHECK (widget_type IN ('data-table', 'kpi-card', 'line-chart', 'bar-chart', 'pie-chart', 'calendar', 'form', 'list', 'stats-grid', 'custom'))
);

-- Create widget_data table
CREATE TABLE IF NOT EXISTS public.widget_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  widget_id UUID NOT NULL REFERENCES public.crm_widgets(id) ON DELETE CASCADE,
  data JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.crm_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_widgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.widget_data ENABLE ROW LEVEL SECURITY;

-- RLS policies for crm_modules
CREATE POLICY "Users can view their project modules" ON public.crm_modules
FOR SELECT USING (
  project_id IN (SELECT id FROM public.build_sessions WHERE user_id = auth.uid())
);

CREATE POLICY "Users can insert modules to their projects" ON public.crm_modules
FOR INSERT WITH CHECK (
  project_id IN (SELECT id FROM public.build_sessions WHERE user_id = auth.uid())
);

CREATE POLICY "Users can update their project modules" ON public.crm_modules
FOR UPDATE USING (
  project_id IN (SELECT id FROM public.build_sessions WHERE user_id = auth.uid())
);

CREATE POLICY "Users can delete their project modules" ON public.crm_modules
FOR DELETE USING (
  project_id IN (SELECT id FROM public.build_sessions WHERE user_id = auth.uid())
);

-- RLS policies for crm_widgets
CREATE POLICY "Users can view widgets of their modules" ON public.crm_widgets
FOR SELECT USING (
  module_id IN (
    SELECT cm.id FROM public.crm_modules cm
    JOIN public.build_sessions bs ON cm.project_id = bs.id
    WHERE bs.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert widgets to their modules" ON public.crm_widgets
FOR INSERT WITH CHECK (
  module_id IN (
    SELECT cm.id FROM public.crm_modules cm
    JOIN public.build_sessions bs ON cm.project_id = bs.id
    WHERE bs.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update widgets of their modules" ON public.crm_widgets
FOR UPDATE USING (
  module_id IN (
    SELECT cm.id FROM public.crm_modules cm
    JOIN public.build_sessions bs ON cm.project_id = bs.id
    WHERE bs.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete widgets of their modules" ON public.crm_widgets
FOR DELETE USING (
  module_id IN (
    SELECT cm.id FROM public.crm_modules cm
    JOIN public.build_sessions bs ON cm.project_id = bs.id
    WHERE bs.user_id = auth.uid()
  )
);

-- RLS policies for widget_data
CREATE POLICY "Users can view data of their widgets" ON public.widget_data
FOR SELECT USING (
  widget_id IN (
    SELECT cw.id FROM public.crm_widgets cw
    JOIN public.crm_modules cm ON cw.module_id = cm.id
    JOIN public.build_sessions bs ON cm.project_id = bs.id
    WHERE bs.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert data to their widgets" ON public.widget_data
FOR INSERT WITH CHECK (
  widget_id IN (
    SELECT cw.id FROM public.crm_widgets cw
    JOIN public.crm_modules cm ON cw.module_id = cm.id
    JOIN public.build_sessions bs ON cm.project_id = bs.id
    WHERE bs.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update data of their widgets" ON public.widget_data
FOR UPDATE USING (
  widget_id IN (
    SELECT cw.id FROM public.crm_widgets cw
    JOIN public.crm_modules cm ON cw.module_id = cm.id
    JOIN public.build_sessions bs ON cm.project_id = bs.id
    WHERE bs.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete data of their widgets" ON public.widget_data
FOR DELETE USING (
  widget_id IN (
    SELECT cw.id FROM public.crm_widgets cw
    JOIN public.crm_modules cm ON cw.module_id = cm.id
    JOIN public.build_sessions bs ON cm.project_id = bs.id
    WHERE bs.user_id = auth.uid()
  )
);

-- Create triggers for updated_at
CREATE TRIGGER update_crm_modules_updated_at
  BEFORE UPDATE ON public.crm_modules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_crm_widgets_updated_at
  BEFORE UPDATE ON public.crm_widgets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_widget_data_updated_at
  BEFORE UPDATE ON public.widget_data
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_crm_modules_project_id ON public.crm_modules(project_id);
CREATE INDEX IF NOT EXISTS idx_crm_widgets_module_id ON public.crm_widgets(module_id);
CREATE INDEX IF NOT EXISTS idx_widget_data_widget_id ON public.widget_data(widget_id);