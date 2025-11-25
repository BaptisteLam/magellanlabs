import { useState, useRef, useEffect } from 'react';
import { ArrowUp, X, Palette, Type, Edit3, Trash2 } from 'lucide-react';
import { Button } from './ui/button';
import { ElementBreadcrumb } from './ElementBreadcrumb';

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

interface VisualEditToolbarProps {
  isOpen: boolean;
  onClose: () => void;
  elementInfo: ElementInfo | null;
  onModify: (prompt: string) => void;
  onDirectEdit?: (action: 'color' | 'font' | 'edit' | 'delete', value?: string) => void;
}

const PRESET_COLORS = [
  '#03A5C0', // Magellan blue
  '#000000',
  '#FFFFFF',
  '#EF4444',
  '#10B981',
  '#3B82F6',
  '#F59E0B',
  '#8B5CF6',
];

export function VisualEditToolbar({ 
  isOpen, 
  onClose, 
  elementInfo, 
  onModify,
  onDirectEdit 
}: VisualEditToolbarProps) {
  const [prompt, setPrompt] = useState('');
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showPromptInput, setShowPromptInput] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && showPromptInput) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, showPromptInput]);

  if (!isOpen || !elementInfo) return null;

  const handleSubmit = () => {
    if (prompt.trim()) {
      onModify(prompt);
      setPrompt('');
    }
  };

  const handleQuickAction = (action: 'color' | 'font' | 'edit' | 'delete', value?: string) => {
    if (onDirectEdit) {
      onDirectEdit(action, value);
    } else {
      // Fallback: générer un prompt
      const prompts = {
        color: `Changer la couleur de ce ${elementInfo.tagName.toLowerCase()} en ${value || '#03A5C0'}`,
        font: `Modifier la police de ce ${elementInfo.tagName.toLowerCase()}`,
        edit: `Permettre l'édition directe de ce ${elementInfo.tagName.toLowerCase()}`,
        delete: `Supprimer ce ${elementInfo.tagName.toLowerCase()}`
      };
      onModify(prompts[action]);
    }
    setShowColorPicker(false);
  };

  // Calculer la position optimale de la toolbar
  const calculatePosition = () => {
    if (!elementInfo.boundingRect) {
      return {
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)',
        position: 'fixed' as const
      };
    }

    const { left, bottom, width, top } = elementInfo.boundingRect;
    const toolbarWidth = showPromptInput ? 500 : 300;
    const margin = 16;

    // Centrer la toolbar sous l'élément
    const elementCenterX = left + (width / 2);
    let toolbarLeft = elementCenterX - (toolbarWidth / 2);
    
    // S'assurer que la toolbar reste dans la fenêtre
    toolbarLeft = Math.max(20, Math.min(toolbarLeft, window.innerWidth - toolbarWidth - 20));

    // Si pas assez d'espace en bas, afficher au-dessus
    let toolbarTop = bottom + margin;
    if (toolbarTop + 100 > window.innerHeight) {
      toolbarTop = top - 100 - margin;
    }

    return {
      position: 'fixed' as const,
      left: toolbarLeft,
      top: Math.max(20, toolbarTop),
      width: toolbarWidth,
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

      {/* Toolbar principale */}
      <div
        className="z-[9999] bg-background/95 backdrop-blur-md border border-border rounded-2xl shadow-2xl overflow-hidden"
        style={position}
      >
        {/* Breadcrumb */}
        <div className="px-4 py-2 border-b border-border bg-muted/30">
          <ElementBreadcrumb path={elementInfo.path} />
        </div>

        {/* Actions rapides */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <Button
            variant="ghost"
            size="sm"
            className="gap-2 h-8"
            onClick={() => setShowColorPicker(!showColorPicker)}
          >
            <Palette className="w-4 h-4" />
            <span className="text-xs">Couleur</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="gap-2 h-8"
            onClick={() => handleQuickAction('font')}
          >
            <Type className="w-4 h-4" />
            <span className="text-xs">Police</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="gap-2 h-8"
            onClick={() => handleQuickAction('edit')}
          >
            <Edit3 className="w-4 h-4" />
            <span className="text-xs">Éditer</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="gap-2 h-8 text-destructive hover:text-destructive"
            onClick={() => handleQuickAction('delete')}
          >
            <Trash2 className="w-4 h-4" />
            <span className="text-xs">Supprimer</span>
          </Button>
          
          <div className="flex-1" />
          
          <button
            onClick={() => setShowPromptInput(!showPromptInput)}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {showPromptInput ? 'Masquer' : 'Re-prompt'}
          </button>
        </div>

        {/* Sélecteur de couleur */}
        {showColorPicker && (
          <div className="px-4 py-3 border-b border-border bg-muted/20">
            <div className="flex gap-2 flex-wrap">
              {PRESET_COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => handleQuickAction('color', color)}
                  className="w-8 h-8 rounded-lg border-2 border-border hover:scale-110 transition-transform"
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
              <input
                type="color"
                onChange={(e) => handleQuickAction('color', e.target.value)}
                className="w-8 h-8 rounded-lg border-2 border-border cursor-pointer"
                title="Couleur personnalisée"
              />
            </div>
          </div>
        )}

        {/* Input de re-prompt */}
        {showPromptInput && (
          <div className="flex items-center px-4 py-3 gap-3">
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
              placeholder="Décrire les modifications à apporter..."
              className="flex-1 bg-transparent border-none outline-none text-sm text-foreground placeholder:text-muted-foreground"
            />
            <Button
              onClick={handleSubmit}
              disabled={!prompt.trim()}
              size="sm"
              className="w-9 h-9 rounded-full p-0 border-0"
              style={{ 
                backgroundColor: '#03A5C0',
                color: 'white'
              }}
            >
              <ArrowUp className="w-4 h-4" />
            </Button>
          </div>
        )}

        {/* Info élément */}
        <div className="px-4 py-2 text-xs text-muted-foreground bg-muted/10 border-t border-border">
          <div className="flex items-center justify-between">
            <span>
              {elementInfo.tagName.toLowerCase()}
              {elementInfo.id && `#${elementInfo.id}`}
              {elementInfo.classList.length > 0 && ` .${elementInfo.classList[0]}`}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-6 w-6 p-0 hover:bg-muted"
            >
              <X className="w-3 h-3" />
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
