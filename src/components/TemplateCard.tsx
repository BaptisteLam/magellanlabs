import { Eye, Play, MessageSquare } from 'lucide-react';
import { useThemeStore } from '@/stores/themeStore';

interface TemplateCardProps {
  title: string;
  description: string;
  imageUrl: string;
  messagesSaved: number;
  onView: () => void;
  onUse: () => void;
}

const TemplateCard = ({ title, description, imageUrl, messagesSaved, onView, onUse }: TemplateCardProps) => {
  const { isDark } = useThemeStore();

  return (
    <div 
      className="rounded-xl border overflow-hidden transition-all hover:scale-[1.02] hover:shadow-lg"
      style={{
        backgroundColor: isDark ? 'hsl(var(--card))' : '#ffffff',
        borderColor: isDark ? 'hsl(var(--border))' : 'rgba(203, 213, 225, 0.8)',
        boxShadow: '0 4px 12px -2px rgba(0, 0, 0, 0.08), 0 2px 6px -1px rgba(0, 0, 0, 0.04)'
      }}
    >
      {/* Image */}
      <div className="relative h-36 overflow-hidden bg-muted">
        <img 
          src={imageUrl} 
          alt={title}
          className="w-full h-full object-cover"
        />
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 
          className="font-semibold text-sm mb-1 truncate"
          style={{ color: isDark ? 'hsl(var(--foreground))' : '#334155' }}
        >
          {title}
        </h3>
        <p 
          className="text-xs mb-3 line-clamp-2"
          style={{ color: isDark ? 'hsl(var(--muted-foreground))' : '#64748b' }}
        >
          {description}
        </p>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={onView}
              className="flex items-center gap-1 px-2 py-1 rounded-full text-xs transition-all border"
              style={{
                borderColor: '#03A5C0',
                backgroundColor: 'rgba(3, 165, 192, 0.1)',
                color: '#03A5C0'
              }}
            >
              <Eye className="w-3 h-3" />
              <span>Voir</span>
            </button>
            <button
              onClick={onUse}
              className="flex items-center gap-1 px-2 py-1 rounded-full text-xs transition-all border"
              style={{
                borderColor: '#03A5C0',
                backgroundColor: 'rgba(3, 165, 192, 0.1)',
                color: '#03A5C0'
              }}
            >
              <Play className="w-3 h-3" />
              <span>Utiliser</span>
            </button>
          </div>

          {/* Messages saved */}
          <div 
            className="flex items-center gap-1 text-xs"
            style={{ color: isDark ? 'hsl(var(--muted-foreground))' : '#64748b' }}
          >
            <MessageSquare className="w-3 h-3" />
            <span>{messagesSaved}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TemplateCard;
