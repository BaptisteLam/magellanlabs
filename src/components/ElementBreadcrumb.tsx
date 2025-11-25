import { ChevronRight } from 'lucide-react';

interface ElementBreadcrumbProps {
  path: string;
  onSegmentClick?: (segment: string, index: number) => void;
}

export function ElementBreadcrumb({ path, onSegmentClick }: ElementBreadcrumbProps) {
  const segments = path.split(' > ').filter(Boolean);

  return (
    <div className="flex items-center gap-1 text-xs text-muted-foreground overflow-x-auto scrollbar-hide">
      {segments.map((segment, index) => {
        const isLast = index === segments.length - 1;
        
        return (
          <div key={index} className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => onSegmentClick?.(segment, index)}
              className={`
                px-2 py-1 rounded hover:bg-muted/50 transition-colors
                ${isLast ? 'text-foreground font-medium' : 'text-muted-foreground'}
              `}
              title={segment}
            >
              {formatSegment(segment)}
            </button>
            {!isLast && <ChevronRight className="w-3 h-3 text-muted-foreground/50" />}
          </div>
        );
      })}
    </div>
  );
}

function formatSegment(segment: string): string {
  // Extraire le tag et limiter les classes
  const parts = segment.split('.');
  const tag = parts[0].replace(/#.*$/, ''); // Retirer l'ID si présent
  const id = segment.match(/#([^.]+)/)?.[1];
  const firstClass = parts[1];

  if (id) return `${tag}#${id}`;
  if (firstClass) return `${tag}.${firstClass}`;
  return tag;
}
