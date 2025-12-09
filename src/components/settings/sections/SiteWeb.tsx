import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Globe, ExternalLink, Pencil, Check, ChevronDown, ChevronRight, Save, Link2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface Project {
  id: string;
  title: string | null;
  public_url: string | null;
  project_files: unknown;
  cloudflare_deployment_url: string | null;
}

interface PageSEO {
  path: string;
  description: string;
}

export function SiteWeb() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get('projectId');
  
  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [customDomain, setCustomDomain] = useState('');
  const [pageSEO, setPageSEO] = useState<PageSEO[]>([]);
  const [openPages, setOpenPages] = useState<string[]>([]);
  const [isSavingSEO, setIsSavingSEO] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');

  useEffect(() => {
    fetchLatestProject();
  }, [projectId]);

  const fetchLatestProject = async () => {
    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      let query = supabase
        .from('build_sessions')
        .select('id, title, public_url, project_files, cloudflare_deployment_url')
        .eq('user_id', session.user.id);

      if (projectId) {
        query = query.eq('id', projectId);
      } else {
        query = query.order('updated_at', { ascending: false }).limit(1);
      }

      const { data, error } = await query.single();

      if (error && error.code !== 'PGRST116') throw error;
      
      if (data) {
        setProject(data);
        
        // Extract HTML pages for SEO
        const files = data.project_files as Record<string, string> | null;
        if (files) {
          const htmlPages = Object.keys(files)
            .filter(path => path.endsWith('.html'))
            .map(path => ({
              path,
              description: '' // TODO: Load from database if stored
            }));
          setPageSEO(htmlPages);
        }
      }
    } catch (error) {
      console.error('Error fetching project:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditProject = () => {
    if (project) {
      navigate(`/builder/${project.id}`);
    }
  };

  const handleStartEditTitle = () => {
    setEditedTitle(project?.title || '');
    setIsEditingTitle(true);
  };

  const handleSaveTitle = async () => {
    if (!project || !editedTitle.trim()) return;
    try {
      const { error } = await supabase
        .from('build_sessions')
        .update({ title: editedTitle.trim() })
        .eq('id', project.id);
      
      if (error) throw error;
      
      setProject(prev => prev ? { ...prev, title: editedTitle.trim() } : null);
      setIsEditingTitle(false);
      toast.success('Nom du projet mis à jour');
    } catch (error) {
      toast.error('Erreur lors de la mise à jour');
    }
  };

  const isOnline = project?.public_url || project?.cloudflare_deployment_url;

  const getSubdomain = () => {
    if (project?.public_url) {
      const match = project.public_url.match(/^https?:\/\/([^.]+)\.builtbymagellan\.com/);
      return match ? match[1] : project.title?.toLowerCase().replace(/\s+/g, '-') || 'projet';
    }
    return project?.title?.toLowerCase().replace(/\s+/g, '-') || 'projet';
  };

  const togglePage = (path: string) => {
    setOpenPages(prev => 
      prev.includes(path) 
        ? prev.filter(p => p !== path)
        : [...prev, path]
    );
  };

  const updatePageSEO = (path: string, description: string) => {
    if (description.length > 250) return;
    setPageSEO(prev => 
      prev.map(page => 
        page.path === path ? { ...page, description } : page
      )
    );
  };

  const handleSaveSEO = async () => {
    setIsSavingSEO(true);
    try {
      // TODO: Save SEO descriptions to database
      toast.success('Descriptions SEO enregistrées');
    } catch (error) {
      toast.error('Erreur lors de l\'enregistrement');
    } finally {
      setIsSavingSEO(false);
    }
  };

  const getPreviewHtml = () => {
    if (!project?.project_files) return null;
    const files = project.project_files as Record<string, string>;
    return files['index.html'] || Object.values(files).find(content => 
      typeof content === 'string' && content.includes('<!DOCTYPE html>')
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-muted/50 rounded animate-pulse w-48" />
        <div className="h-64 bg-muted/50 rounded-lg animate-pulse" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Site Web</h2>
          <p className="text-muted-foreground">Aucun projet sélectionné</p>
        </div>
        <Card className="rounded-[8px]">
          <CardContent className="py-12 text-center">
            <Globe className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground mb-4">Créez votre premier projet pour commencer</p>
            <Button 
              onClick={() => navigate('/builder')}
              className="rounded-full px-6 py-0 border transition-all"
              style={{ 
                borderColor: 'rgb(3,165,192)', 
                backgroundColor: 'rgba(3,165,192,0.1)', 
                color: 'rgb(3,165,192)' 
              }}
            >
              Nouveau projet
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Site Web</h2>
        <p className="text-muted-foreground">Gérez votre site et ses paramètres</p>
      </div>

      {/* Widget Preview du site */}
      <Card className="rounded-[8px] overflow-hidden">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Globe className="h-5 w-5" />
              {isEditingTitle ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={editedTitle}
                    onChange={(e) => setEditedTitle(e.target.value)}
                    className="h-8 w-48 text-base font-semibold"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveTitle();
                      if (e.key === 'Escape') setIsEditingTitle(false);
                    }}
                  />
                  <button
                    onClick={handleSaveTitle}
                    className="p-1 hover:bg-muted rounded transition-colors"
                  >
                    <Check className="h-4 w-4 text-green-500" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span>{project.title || 'Sans titre'}</span>
                  <button
                    onClick={handleStartEditTitle}
                    className="p-1 hover:bg-muted rounded transition-colors"
                  >
                    <Pencil className="h-4 w-4 text-muted-foreground hover:text-[#03A5C0]" />
                  </button>
                </div>
              )}
            </CardTitle>
            <div className="flex items-center gap-3">
              {/* Status indicator */}
              <div className="flex items-center gap-2">
                <div className={cn(
                  "w-2 h-2 rounded-full",
                  isOnline ? "bg-green-500" : "bg-orange-500"
                )} />
                <span className={cn(
                  "text-xs font-medium",
                  isOnline ? "text-green-600" : "text-orange-500"
                )}>
                  {isOnline ? 'En ligne' : 'Déconnecté'}
                </span>
              </div>
              
              {/* Edit button */}
              <Button
                onClick={handleEditProject}
                className="rounded-full px-4 py-0 border transition-all text-sm gap-2"
                style={{ 
                  borderColor: 'rgb(3,165,192)', 
                  backgroundColor: 'rgba(3,165,192,0.1)', 
                  color: 'rgb(3,165,192)' 
                }}
              >
                <Pencil className="h-4 w-4" />
                Modifier
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {/* Preview iframe */}
          <div className="relative w-full h-[400px] bg-muted/30 border-t border-border/50">
            {getPreviewHtml() ? (
              <iframe
                srcDoc={getPreviewHtml()!}
                className="w-full h-full border-0"
                title="Preview du site"
                sandbox="allow-scripts"
              />
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <p>Aucun aperçu disponible</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Widget Nom de domaine */}
      <Card className="rounded-[8px]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Link2 className="h-5 w-5" />
            Nom de domaine
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Domaine Magellan */}
          <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-border/50">
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-2 h-2 rounded-full",
                isOnline ? "bg-green-500" : "bg-orange-500"
              )} />
              <div>
                <p className="text-sm font-medium">
                  <span className="text-foreground">{getSubdomain()}</span>
                  <span className="text-muted-foreground">.builtbymagellan.com</span>
                </p>
                <p className="text-xs text-muted-foreground">Domaine Magellan</p>
              </div>
            </div>
            {isOnline && (
              <a 
                href={project.public_url || project.cloudflare_deployment_url || '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#03A5C0] hover:text-[#03A5C0]/80 transition-colors"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            )}
          </div>

          {/* Domaine personnalisé */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Domaine personnalisé</label>
            <div className="flex gap-2">
              <Input
                placeholder="monsite.com"
                value={customDomain}
                onChange={(e) => setCustomDomain(e.target.value)}
                className="flex-1 rounded-lg"
              />
              <Button
                onClick={() => toast.info('Configuration de domaine personnalisé à venir')}
                className="rounded-full px-4 py-0 border transition-all"
                style={{ 
                  borderColor: 'rgb(3,165,192)', 
                  backgroundColor: 'rgba(3,165,192,0.1)', 
                  color: 'rgb(3,165,192)' 
                }}
              >
                Connecter
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Ajoutez votre propre nom de domaine pour personnaliser l'URL de votre site
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Widget SEO */}
      <Card className="rounded-[8px]">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Globe className="h-5 w-5" />
              SEO - Descriptions des pages
            </CardTitle>
            <Button
              onClick={handleSaveSEO}
              disabled={isSavingSEO}
              className="rounded-full px-4 py-0 border transition-all text-sm gap-2"
              style={{ 
                borderColor: 'rgb(3,165,192)', 
                backgroundColor: 'rgba(3,165,192,0.1)', 
                color: 'rgb(3,165,192)' 
              }}
            >
              <Save className="h-4 w-4" />
              {isSavingSEO ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {pageSEO.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Aucune page HTML trouvée dans le projet
            </p>
          ) : (
            pageSEO.map((page) => (
              <Collapsible 
                key={page.path}
                open={openPages.includes(page.path)}
                onOpenChange={() => togglePage(page.path)}
              >
                <CollapsibleTrigger className="w-full">
                  <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-border/50 hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-2">
                      {openPages.includes(page.path) ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span className="text-sm font-medium">{page.path}</span>
                    </div>
                    {page.description && (
                      <Check className="h-4 w-4 text-green-500" />
                    )}
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="p-3 border border-t-0 border-border/50 rounded-b-lg bg-background">
                    <Textarea
                      placeholder="Description de la page pour les moteurs de recherche (max 250 caractères)"
                      value={page.description}
                      onChange={(e) => updatePageSEO(page.path, e.target.value)}
                      maxLength={250}
                      rows={3}
                      className="resize-none"
                    />
                    <div className="flex justify-end mt-1">
                      <span className={cn(
                        "text-xs",
                        page.description.length >= 250 ? "text-red-500" : "text-muted-foreground"
                      )}>
                        {page.description.length}/250
                      </span>
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
