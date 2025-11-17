import { useState, useRef, useEffect } from 'react';
import { Send, X } from 'lucide-react';

interface ElementInfo {
  tagName: string;
  textContent: string;
  classList: string[];
  path: string;
  innerHTML: string;
  id?: string;
  boundingRect?: {
    left: number;
    top: number;
    width: number;
    height: number;
    bottom: number;
    right: number;
  };
}

interface FloatingEditBarProps {
  isOpen: boolean;
  onClose: () => void;
  elementInfo: ElementInfo | null;
  onModify: (prompt: string) => void;
}

export function FloatingEditBar({ isOpen, onClose, elementInfo, onModify }: FloatingEditBarProps) {
  const [prompt, setPrompt] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  if (!isOpen || !elementInfo) return null;

  const handleSubmit = () => {
    if (prompt.trim()) {
      onModify(prompt);
      setPrompt('');
    }
  };

  // Calculer la position de la barre
  const calculatePosition = () => {
    if (!elementInfo.boundingRect) {
      // Fallback : centrer
      return {
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)',
        position: 'fixed' as const
      };
    }

    const { left, bottom, top, width } = elementInfo.boundingRect;
    const barHeight = 140; // Hauteur approximative de la barre
    const margin = 12;

    // Vérifier si on peut afficher en dessous
    const canShowBelow = bottom + barHeight + margin < window.innerHeight;

    return {
      position: 'fixed' as const,
      left: Math.max(20, Math.min(left, window.innerWidth - 420)), // Min 20px, max viewport - width
      top: canShowBelow 
        ? bottom + margin 
        : top - barHeight - margin,
      minWidth: Math.min(400, width),
      maxWidth: 500,
    };
  };

  const position = calculatePosition();

  return (
    <>
      {/* Backdrop semi-transparent */}
      <div 
        className="fixed inset-0 bg-black/20 backdrop-blur-[1px] z-[9998]"
        onClick={onClose}
      />

      {/* Barre d'édition flottante */}
      <div
        className="z-[9999] bg-background border border-border rounded-lg shadow-2xl"
        style={position}
      >
        {/* Header avec info élément */}
        <div className="flex items-center justify-between p-3 border-b border-border">
          <div className="text-xs font-mono text-muted-foreground">
            <span className="font-semibold" style={{ color: '#03A5C0' }}>
              {elementInfo.tagName.toLowerCase()}
            </span>
            {elementInfo.id && (
              <span className="text-purple-600 dark:text-purple-400">#{elementInfo.id}</span>
            )}
            {elementInfo.classList.length > 0 && (
              <span className="text-green-600 dark:text-green-400">
                .{elementInfo.classList.slice(0, 2).join('.')}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-muted rounded transition-colors"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Aperçu du contenu */}
        <div className="px-3 py-2 bg-muted/30 border-b border-border">
          <p className="text-xs text-muted-foreground line-clamp-2">
            {elementInfo.textContent || <em>Pas de texte</em>}
          </p>
        </div>

        {/* Zone de prompt */}
        <div className="p-3">
          <textarea
            ref={inputRef}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && e.ctrlKey) {
                e.preventDefault();
                handleSubmit();
              }
              if (e.key === 'Escape') {
                onClose();
              }
            }}
            placeholder="Comment modifier cet élément ? (ex: change la couleur en bleu)"
            className="w-full px-3 py-2 text-sm border border-border bg-background rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-[#03A5C0] text-foreground"
            rows={2}
          />

          {/* Actions */}
          <div className="flex items-center justify-between mt-3">
            <div className="text-xs text-muted-foreground">
              <kbd className="px-1.5 py-0.5 bg-muted border border-border rounded text-[10px]">
                Ctrl+Enter
              </kbd>{' '}
              pour valider
            </div>
            <button
              onClick={handleSubmit}
              disabled={!prompt.trim()}
              className="inline-flex items-center justify-center whitespace-nowrap font-medium ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 text-sm gap-2 transition-all border rounded-full px-4 py-2"
              style={{ 
                borderColor: '#03A5C0', 
                backgroundColor: 'rgba(3,165,192,0.1)', 
                color: '#03A5C0' 
              }}
            >
              <Send className="w-4 h-4" />
              Modifier
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
