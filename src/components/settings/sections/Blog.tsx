import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  FileText, 
  Plus, 
  Search, 
  Loader2,
  Filter
} from 'lucide-react';
import { useProjectData, ProjectBlogPost } from '@/hooks/useProjectData';
import { toast } from 'sonner';
import { BlogCard } from '@/components/blog/BlogCard';
import { BlogEditor } from '@/components/blog/BlogEditor';
import { BlogPromptBar } from '@/components/blog/BlogPromptBar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export function Blog() {
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get('projectId');
  const { data: posts, isLoading, create, update, remove, refetch } = useProjectData(projectId, 'blog');
  
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [editingPost, setEditingPost] = useState<ProjectBlogPost | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [deletePostId, setDeletePostId] = useState<string | null>(null);

  // Filtrage des articles
  const filteredPosts = useMemo(() => {
    if (!posts) return [];
    
    return posts.filter((post: ProjectBlogPost) => {
      if (statusFilter !== 'all' && post.status !== statusFilter) {
        return false;
      }
      
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          post.title.toLowerCase().includes(query) ||
          (post.content && post.content.toLowerCase().includes(query)) ||
          post.slug.toLowerCase().includes(query)
        );
      }
      
      return true;
    });
  }, [posts, searchQuery, statusFilter]);

  const handleSavePost = async (data: any) => {
    if (data.id) {
      await update(data.id, data);
    } else {
      await create(data);
    }
    await refetch();
    setEditingPost(null);
    setIsCreating(false);
  };

  const handleDeletePost = async () => {
    if (!deletePostId) return;
    try {
      await remove(deletePostId);
      toast.success('Article supprimé');
      setDeletePostId(null);
    } catch {
      toast.error('Erreur lors de la suppression');
    }
  };

  const handleAIPrompt = (prompt: string) => {
    // UI seulement pour l'instant - sera implémenté plus tard
    toast.info('Génération IA bientôt disponible !', {
      description: `Prompt: "${prompt.slice(0, 50)}${prompt.length > 50 ? '...' : ''}"`,
    });
  };

  if (!projectId) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-muted-foreground">
        <FileText className="h-16 w-16 mb-4 opacity-30" />
        <h3 className="text-xl font-semibold text-foreground mb-2">Blog</h3>
        <p>Sélectionnez un projet pour gérer les articles</p>
      </div>
    );
  }

  // Editeur en plein écran
  if (isCreating || editingPost) {
    return (
      <BlogEditor
        projectId={projectId}
        post={editingPost || undefined}
        onSave={handleSavePost}
        onClose={() => {
          setIsCreating(false);
          setEditingPost(null);
        }}
      />
    );
  }

  return (
    <div className="relative flex flex-col min-h-[calc(100vh-200px)]">
      {/* Header */}
      <div className="flex items-center justify-between py-4 border-b mb-6">
        <div className="flex items-center gap-3">
          <FileText className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold text-foreground">Blog</h2>
          {posts && posts.length > 0 && (
            <span className="text-sm text-muted-foreground">
              ({filteredPosts.length} article{filteredPosts.length > 1 ? 's' : ''})
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-[200px] h-9 rounded-lg"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[130px] h-9 rounded-lg">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous</SelectItem>
              <SelectItem value="draft">Brouillons</SelectItem>
              <SelectItem value="published">Publiés</SelectItem>
            </SelectContent>
          </Select>
          <Button 
            onClick={() => setIsCreating(true)}
            className="h-9 rounded-full border-[#03A5C0] bg-[#03A5C0]/10 text-[#03A5C0] hover:bg-[#03A5C0]/20 px-4"
            variant="outline"
          >
            <Plus className="h-4 w-4 mr-2" />
            Nouvel article
          </Button>
        </div>
      </div>

      {/* Contenu avec flex-1 pour prendre l'espace disponible */}
      <div className="flex-1 overflow-auto pb-48">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !filteredPosts.length ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <div className="h-16 w-16 rounded-full border-2 border-muted-foreground/30 flex items-center justify-center mb-4">
              <FileText className="h-8 w-8 opacity-50" />
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">Aucun article</h3>
            <p className="mb-4">
              {searchQuery || statusFilter !== 'all' 
                ? "Aucun résultat trouvé" 
                : "Commencez à rédiger votre premier article"}
            </p>
            <Button 
              onClick={() => setIsCreating(true)}
              variant="outline"
              className="rounded-lg"
            >
              <Plus className="h-4 w-4 mr-2" />
              Nouvel article
            </Button>
          </div>
        ) : (
          <>
            {/* Grille de cards avec effet de fade en bas */}
            <div className="relative">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredPosts.map((post: ProjectBlogPost, index: number) => {
                  // Calculer l'opacité en fonction de la position (fade vers le bas)
                  const totalPosts = filteredPosts.length;
                  const rowIndex = Math.floor(index / 3);
                  const totalRows = Math.ceil(totalPosts / 3);
                  const fadeStart = Math.max(0, totalRows - 2); // Commence à fader 2 lignes avant la fin
                  
                  let opacity = 1;
                  if (rowIndex >= fadeStart && totalRows > 2) {
                    const fadeProgress = (rowIndex - fadeStart + 1) / (totalRows - fadeStart);
                    opacity = Math.max(0.3, 1 - fadeProgress * 0.7);
                  }

                  return (
                    <BlogCard
                      key={post.id}
                      post={post}
                      onEdit={() => setEditingPost(post)}
                      onDelete={() => setDeletePostId(post.id)}
                      onView={() => setEditingPost(post)}
                      style={{ opacity }}
                    />
                  );
                })}
              </div>

              {/* Gradient overlay pour effet de fade */}
              {filteredPosts.length > 3 && (
                <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent pointer-events-none" />
              )}
            </div>
          </>
        )}
      </div>

      {/* Barre de prompt IA centrée en bas de la zone blog */}
      <div className="mt-auto pt-4">
        <BlogPromptBar onSubmit={handleAIPrompt} />
      </div>

      {/* Dialog de confirmation de suppression */}
      <AlertDialog open={!!deletePostId} onOpenChange={() => setDeletePostId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer l'article ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. L'article sera définitivement supprimé.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-lg">Annuler</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeletePost}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-lg"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
