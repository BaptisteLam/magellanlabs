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
  const inputRef = useRef<HTMLInputElement>(null);

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

  // Calculer la position de la barre (centrée sous l'élément)
  const calculatePosition = () => {
    if (!elementInfo.boundingRect) {
      return {
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)',
        position: 'fixed' as const
      };
    }

    const { left, bottom, width } = elementInfo.boundingRect;
    const barWidth = 400;
    const margin = 12;

    // Centrer la barre par rapport à l'élément
    const centerX = left + (width / 2);
    const barLeft = Math.max(20, Math.min(centerX - (barWidth / 2), window.innerWidth - barWidth - 20));

    return {
      position: 'fixed' as const,
      left: barLeft,
      top: bottom + margin,
      width: barWidth,
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

      {/* Barre d'édition simple */}
      <div
        className="z-[9999] bg-background border border-border rounded-full shadow-2xl flex items-center px-4 py-2 gap-2"
        style={position}
      >
        <input
          ref={inputRef}
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleSubmit();
            }
            if (e.key === 'Escape') {
              onClose();
            }
          }}
          placeholder="Comment modifier cet élément ?"
          className="flex-1 bg-transparent border-none outline-none text-sm text-foreground placeholder:text-muted-foreground"
        />
        <button
          onClick={handleSubmit}
          disabled={!prompt.trim()}
          className="flex items-center justify-center w-8 h-8 rounded-full transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ 
            backgroundColor: '#03A5C0',
            color: 'white'
          }}
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </>
  );
}
