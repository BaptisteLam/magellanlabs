import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { FileCode, Globe, Trash2, Edit, Eye, Plus, Search } from 'lucide-react';
import { useSettingsStore } from '@/stores/settingsStore';

interface Project {
  id: string;
  title: string;
  thumbnail_url?: string;
  status: 'draft' | 'published';
  created_at: string;
  type: 'website' | 'builder' | 'app';
  build_session_id?: string;
}

export function MyProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const navigate = useNavigate();
  const { closeSettings } = useSettingsStore();

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [websitesRes, sessionsRes] = await Promise.all([
        supabase.from('websites').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('build_sessions').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      ]);

      const websites = (websitesRes.data || []).map((w) => ({
        id: w.id,
        title: w.title,
        thumbnail_url: w.thumbnail_url,
        status: w.status as 'draft' | 'published',
        created_at: w.created_at,
        type: 'website' as const,
        build_session_id: w.build_session_id,
      }));

      const sessions = (sessionsRes.data || [])
        .filter((s) => !websites.find((w) => w.build_session_id === s.id))
        .map((s) => ({
          id: s.id,
          title: s.title || 'Sans titre',
          status: 'draft' as const,
          created_at: s.created_at,
          type: 'builder' as const,
        }));

      setProjects([...websites, ...sessions]);
    } catch (error) {
      console.error('Error loading projects:', error);
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Impossible de charger les projets',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProject = async (project: Project) => {
    if (!confirm(`Supprimer "${project.title}" ?`)) return;

    try {
      const table = project.type === 'website' ? 'websites' : 'build_sessions';
      const { error } = await supabase.from(table).delete().eq('id', project.id);

      if (error) throw error;

      setProjects((prev) => prev.filter((p) => p.id !== project.id));
      toast({ title: 'Projet supprimé' });
    } catch (error) {
      console.error('Delete error:', error);
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Impossible de supprimer le projet',
      });
    }
  };

  const handleSaveTitle = async (project: Project) => {
    try {
      const table = project.type === 'website' ? 'websites' : 'build_sessions';
      const { error } = await supabase.from(table).update({ title: editTitle }).eq('id', project.id);

      if (error) throw error;

      setProjects((prev) => prev.map((p) => (p.id === project.id ? { ...p, title: editTitle } : p)));
      setEditingId(null);
      toast({ title: 'Titre modifié' });
    } catch (error) {
      console.error('Update error:', error);
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Impossible de modifier le titre',
      });
    }
  };

  const handleEditProject = (project: Project) => {
    closeSettings();
    const editId = project.type === 'website' && project.build_session_id ? project.build_session_id : project.id;
    navigate(`/builder/${editId}`);
  };

  const filteredProjects = projects.filter((p) =>
    p.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-foreground">Mes Projets</h2>
        <Button
          onClick={() => {
            closeSettings();
            navigate('/ai-builder');
          }}
          className="bg-[#03A5C0]/20 text-[#03A5C0] border border-[#03A5C0]/50 hover:bg-[#03A5C0]/30 rounded-[8px]"
        >
          <Plus className="h-4 w-4 mr-2" />
          Nouveau projet
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Rechercher un projet..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Chargement...</div>
      ) : filteredProjects.length === 0 ? (
        <div className="text-center py-12 space-y-4">
          <FileCode className="h-16 w-16 mx-auto text-muted-foreground" />
          <p className="text-muted-foreground">
            {searchQuery ? 'Aucun projet trouvé' : 'Aucun projet pour le moment'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProjects.map((project) => (
            <Card key={project.id} className="overflow-hidden hover:border-[#03A5C0]/50 transition-colors rounded-[8px]">
              {project.thumbnail_url && (
                <div className="aspect-video bg-muted">
                  <img
                    src={project.thumbnail_url}
                    alt={project.title}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <CardContent className="p-4 space-y-3">
                {editingId === project.id ? (
                  <div className="flex gap-2">
                    <Input
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveTitle(project);
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      autoFocus
                    />
                    <Button size="sm" onClick={() => handleSaveTitle(project)}>
                      ✓
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                      ✕
                    </Button>
                  </div>
                ) : (
                  <h3 className="font-semibold text-foreground truncate">{project.title}</h3>
                )}

                <div className="flex items-center gap-2">
                  <Badge variant={project.status === 'published' ? 'default' : 'secondary'}>
                    {project.status === 'published' ? (
                      <>
                        <Globe className="h-3 w-3 mr-1" />
                        Publié
                      </>
                    ) : (
                      'Brouillon'
                    )}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {new Date(project.created_at).toLocaleDateString()}
                  </span>
                </div>

                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => handleEditProject(project)} className="flex-1">
                    <Edit className="h-4 w-4 mr-1" />
                    Éditer
                  </Button>
                  {project.status === 'published' && (
                    <Button size="sm" variant="outline" asChild>
                      <a href={`https://${project.id}.lovable.app`} target="_blank" rel="noopener noreferrer">
                        <Eye className="h-4 w-4" />
                      </a>
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDeleteProject(project)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
