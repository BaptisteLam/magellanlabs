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
    <div className="group relative">
      {/* Card Container */}
      <div 
        className="rounded-2xl overflow-visible transition-all duration-300 hover:shadow-xl"
        style={{
          backgroundColor: isDark ? 'hsl(var(--card))' : '#ffffff',
          boxShadow: '0 4px 20px -4px rgba(0, 0, 0, 0.1)'
        }}
      >
        {/* Image Container - Ratio 1:1, overflow visible pour effet hors cadre */}
        <div className="relative aspect-square rounded-t-2xl overflow-hidden">
          <div className="absolute inset-0 transition-transform duration-500 ease-out group-hover:scale-110 group-hover:-translate-y-2 origin-center">
            <img 
              src={imageUrl} 
              alt={title}
              className="w-full h-full object-cover object-top rounded-t-2xl shadow-lg transition-shadow duration-500 group-hover:shadow-2xl"
            />
          </div>
          {/* Overlay on hover */}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-all duration-300 rounded-t-2xl pointer-events-none" />
        </div>

        {/* Content */}
        <div className="p-4">
          <h3 
            className="font-semibold text-base mb-1"
            style={{ color: isDark ? 'hsl(var(--foreground))' : '#1e293b' }}
          >
            {title}
          </h3>
          
          {/* Description */}
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
                className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all border hover:brightness-110"
                style={{
                  borderColor: '#03A5C0',
                  backgroundColor: 'rgba(3, 165, 192, 0.1)',
                  color: '#03A5C0'
                }}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Voir</span>
              </button>
              <button
                onClick={onUse}
                className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all border hover:brightness-110"
                style={{
                  borderColor: '#03A5C0',
                  backgroundColor: 'rgba(3, 165, 192, 0.1)',
                  color: '#03A5C0'
                }}
              >
                <Play className="w-3.5 h-3.5" />
                <span>Utiliser</span>
              </button>
            </div>

            {/* Messages saved */}
            <div 
              className="flex items-center gap-1.5 text-xs"
              style={{ color: isDark ? 'hsl(var(--muted-foreground))' : '#64748b' }}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>{messagesSaved} économisé{messagesSaved > 1 ? 's' : ''}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TemplateCard;
