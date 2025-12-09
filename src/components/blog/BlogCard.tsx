import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { FileText, Calendar, Eye, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface BlogCardProps {
  post: {
    id: string;
    title: string;
    content?: string;
    slug: string;
    status: string;
    featured_image?: string;
    published_at?: string;
    created_at: string;
  };
  onEdit: () => void;
  onDelete: () => void;
  onView: () => void;
  style?: React.CSSProperties;
}

export function BlogCard({ post, onEdit, onDelete, onView, style }: BlogCardProps) {
  const description = post.content 
    ? post.content.replace(/<[^>]*>/g, '').slice(0, 120) + (post.content.length > 120 ? '...' : '')
    : 'Aucune description';

  return (
    <div 
      className="group relative bg-card border rounded-xl overflow-hidden hover:shadow-lg transition-all duration-300 cursor-pointer"
      style={style}
      onClick={onView}
    >
      {/* Image de couverture */}
      <div className="relative h-40 bg-muted overflow-hidden">
        {post.featured_image ? (
          <img 
            src={post.featured_image} 
            alt={post.title} 
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <FileText className="h-12 w-12 text-muted-foreground/30" />
          </div>
        )}
        
        {/* Status badge */}
        <Badge 
          className={`absolute top-3 left-3 ${
            post.status === 'published' 
              ? 'bg-green-500/90 text-white' 
              : 'bg-yellow-500/90 text-white'
          }`}
        >
          {post.status === 'published' ? 'Publié' : 'Brouillon'}
        </Badge>

        {/* Actions overlay */}
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
          <Button
            variant="secondary"
            size="icon"
            onClick={(e) => { e.stopPropagation(); onView(); }}
            className="rounded-full"
          >
            <Eye className="h-4 w-4" />
          </Button>
          <Button
            variant="secondary"
            size="icon"
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            className="rounded-full"
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="destructive"
            size="icon"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="rounded-full"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-semibold text-foreground mb-2 line-clamp-2 group-hover:text-[#03A5C0] transition-colors">
          {post.title}
        </h3>
        <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
          {description}
        </p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Calendar className="h-3 w-3" />
          <span>
            {post.published_at 
              ? format(new Date(post.published_at), "d MMM yyyy", { locale: fr })
              : format(new Date(post.created_at), "d MMM yyyy", { locale: fr })
            }
          </span>
        </div>
      </div>
    </div>
  );
}
