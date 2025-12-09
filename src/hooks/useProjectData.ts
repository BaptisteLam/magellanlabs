import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

// Types for each section
export interface ProjectContact {
  id: string;
  project_id: string;
  name: string;
  email: string;
  phone?: string;
  message?: string;
  status: string;
  created_at: string;
}

export interface ProjectBlogPost {
  id: string;
  project_id: string;
  title: string;
  content?: string;
  slug: string;
  status: string;
  featured_image?: string;
  published_at?: string;
  created_at: string;
  updated_at: string;
}

export interface ProjectInvoice {
  id: string;
  project_id: string;
  invoice_number: string;
  amount: number;
  currency: string;
  status: string;
  line_items: any[];
  client_info: Record<string, any>;
  due_date?: string;
  paid_at?: string;
  created_at: string;
}

export interface ProjectSEO {
  id: string;
  project_id: string;
  page_path: string;
  meta_title?: string;
  meta_description?: string;
  keywords: string[];
  updated_at: string;
}

export interface ProjectDomain {
  id: string;
  project_id: string;
  domain_name: string;
  is_primary: boolean;
  status: string;
  dns_records: any[];
  verified_at?: string;
  created_at: string;
}

export interface ProjectMarketing {
  id: string;
  project_id: string;
  social_links: Record<string, string>;
  email_settings: Record<string, any>;
  campaigns: any[];
  updated_at: string;
}

export interface ProjectFinance {
  id: string;
  project_id: string;
  payment_methods: any[];
  revenue_stats: Record<string, any>;
  expense_tracking: any[];
  updated_at: string;
}

type SectionName = 'contacts' | 'blog' | 'invoices' | 'seo' | 'domains' | 'marketing' | 'finance';

const tableNames: Record<SectionName, string> = {
  contacts: 'project_contacts',
  blog: 'project_blog_posts',
  invoices: 'project_invoices',
  seo: 'project_seo',
  domains: 'project_domains',
  marketing: 'project_marketing',
  finance: 'project_finance',
};

export function useProjectData(projectId: string | null, section: SectionName) {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const tableName = tableNames[section];
  const isSingleRecord = section === 'marketing' || section === 'finance';

  const fetchData = useCallback(async () => {
    if (!projectId) {
      setData(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      if (isSingleRecord) {
        const { data: result, error: fetchError } = await supabase
          .from(tableName)
          .select('*')
          .eq('project_id', projectId)
          .maybeSingle();
        if (fetchError) throw fetchError;
        setData(result);
      } else {
        const { data: result, error: fetchError } = await supabase
          .from(tableName)
          .select('*')
          .eq('project_id', projectId)
          .order('created_at', { ascending: false });
        if (fetchError) throw fetchError;
        setData(result || []);
      }
    } catch (err: any) {
      console.error(`Error fetching ${section}:`, err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [projectId, tableName, isSingleRecord, section]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const create = async (record: any) => {
    if (!projectId) return null;
    try {
      const { data: result, error } = await supabase
        .from(tableName)
        .insert({ ...record, project_id: projectId })
        .select()
        .single();
      if (error) throw error;
      await fetchData();
      return result;
    } catch (err: any) {
      console.error(`Error creating ${section}:`, err);
      throw err;
    }
  };

  const update = async (id: string, updates: any) => {
    try {
      const { data: result, error } = await supabase
        .from(tableName)
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      await fetchData();
      return result;
    } catch (err: any) {
      console.error(`Error updating ${section}:`, err);
      throw err;
    }
  };

  const remove = async (id: string) => {
    try {
      const { error } = await supabase
        .from(tableName)
        .delete()
        .eq('id', id);
      if (error) throw error;
      await fetchData();
    } catch (err: any) {
      console.error(`Error deleting ${section}:`, err);
      throw err;
    }
  };

  const upsert = async (record: any) => {
    if (!projectId) return null;
    try {
      const { data: result, error } = await supabase
        .from(tableName)
        .upsert({ ...record, project_id: projectId })
        .select()
        .single();
      if (error) throw error;
      await fetchData();
      return result;
    } catch (err: any) {
      console.error(`Error upserting ${section}:`, err);
      throw err;
    }
  };

  return {
    data,
    isLoading,
    error,
    refetch: fetchData,
    create,
    update,
    remove,
    upsert,
  };
}
