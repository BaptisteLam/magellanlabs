import { Zap, FileCode, Paintbrush } from 'lucide-react';

interface HotReloadIndicatorProps {
  isUpdating: boolean;
  updateType: 'css' | 'html' | 'full' | null;
}

export function HotReloadIndicator({ isUpdating, updateType }: HotReloadIndicatorProps) {
  const getIcon = () => {
    switch (updateType) {
      case 'css':
        return <Paintbrush className="w-3 h-3" />;
      case 'html':
        return <FileCode className="w-3 h-3" />;
      default:
        return <Zap className="w-3 h-3" />;
    }
  };

  const getLabel = () => {
    switch (updateType) {
      case 'css':
        return 'Style updated';
      case 'html':
        return 'HTML updated';
      case 'full':
        return 'Preview reloaded';
      default:
        return 'Updated';
    }
  };

  if (!isUpdating) return null;

  return (
    <div
      className="fixed top-4 right-4 z-50 flex items-center gap-2 px-3 py-1.5 rounded-full shadow-lg backdrop-blur-sm animate-fade-in"
      style={{
        backgroundColor: 'rgba(3, 165, 192, 0.1)',
        border: '1px solid rgba(3, 165, 192, 0.3)',
      }}
    >
      <div className="animate-spin" style={{ color: '#03A5C0' }}>
        {getIcon()}
      </div>
      <span className="text-xs font-medium" style={{ color: '#03A5C0' }}>
        {getLabel()}
      </span>
    </div>
  );
}
