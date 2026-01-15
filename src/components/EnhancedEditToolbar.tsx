import { useState, useRef, useEffect } from 'react';
import { ArrowUp, Trash2, ChevronRight, Palette, Type, Copy, Sparkles, X } from 'lucide-react';
import { Button } from './ui/button';

interface ElementInfo {
  tagName: string;
  textContent: string;
  classList: string[];
  path: string;
  innerHTML: string;
  id?: string;
  elementType?: string;
  isInteractive?: boolean;
  parentTree?: Array<{
    tagName: string;
    id?: string;
    classList: string[];
    isSemanticParent?: boolean;
  }>;
  semanticParent?: {
    tagName: string;
    id?: string;
    classList: string[];
  } | null;
  computedStyles?: {
    fontSize: string;
    fontWeight: string;
    color: string;
    backgroundColor: string;
    display: string;
    position: string;
    padding: { top: number; right: number; bottom: number; left: number };
    margin: { top: number; right: number; bottom: number; left: number };
  };
  boundingRect?: {
    left: number;
    top: number;
    width: number;
    height: number;
    bottom: number;
    right: number;
  };
}

interface EnhancedEditToolbarProps {
  isOpen: boolean;
  onClose: () => void;
  elementInfo: ElementInfo | null;
  onModify: (prompt: string) => void;
  onSelectParent?: (parentIndex: number) => void;
}

const PRESET_COLORS = [
  '#03A5C0', // Magellan accent
  '#000000',
  '#FFFFFF',
  '#EF4444',
  '#10B981',
  '#3B82F6',
  '#F59E0B',
  '#8B5CF6',
];

const QUICK_ACTIONS = [
  { id: 'bigger', label: 'Plus grand', prompt: 'Rendre cet élément plus grand (padding et font-size augmentés)' },
  { id: 'smaller', label: 'Plus petit', prompt: 'Rendre cet élément plus petit (padding et font-size réduits)' },
  { id: 'bold', label: 'Gras', prompt: 'Mettre le texte en gras' },
  { id: 'center', label: 'Centrer', prompt: 'Centrer le contenu de cet élément' },
  { id: 'shadow', label: 'Ombre', prompt: 'Ajouter une ombre portée à cet élément' },
  { id: 'rounded', label: 'Arrondir', prompt: 'Arrondir les coins de cet élément' },
];

export function EnhancedEditToolbar({ 
  isOpen, 
  onClose, 
  elementInfo, 
  onModify,
  onSelectParent 
}: EnhancedEditToolbarProps) {
  const [prompt, setPrompt] = useState('');
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
      setShowColorPicker(false);
      setShowQuickActions(false);
    }
  }, [isOpen]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !elementInfo) return null;

  const handleSubmit = () => {
    if (prompt.trim()) {
      onModify(prompt);
      setPrompt('');
    }
  };

  const handleColorChange = (color: string) => {
    onModify(`Changer la couleur de fond de cet élément en ${color}`);
    setShowColorPicker(false);
  };

  const handleQuickAction = (actionPrompt: string) => {
    onModify(actionPrompt);
    setShowQuickActions(false);
  };

  const handleDelete = () => {
    onModify(`Supprimer cet élément <${elementInfo.tagName}>`);
  };

  const handleDuplicate = () => {
    onModify(`Dupliquer cet élément <${elementInfo.tagName}>`);
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
    const toolbarWidth = 420;
    const toolbarHeight = showColorPicker || showQuickActions ? 200 : 140;
    const margin = 16;

    // Centrer la toolbar sous l'élément
    const elementCenterX = left + (width / 2);
    let toolbarLeft = elementCenterX - (toolbarWidth / 2);
    
    // S'assurer que la toolbar reste dans la fenêtre
    toolbarLeft = Math.max(20, Math.min(toolbarLeft, window.innerWidth - toolbarWidth - 20));

    // Si pas assez d'espace en bas, afficher au-dessus
    let toolbarTop = bottom + margin;
    if (toolbarTop + toolbarHeight > window.innerHeight) {
      toolbarTop = top - toolbarHeight - margin;
    }

    return {
      position: 'fixed' as const,
      left: toolbarLeft,
      top: Math.max(20, toolbarTop),
      width: toolbarWidth,
    };
  };

  const position = calculatePosition();

  // Breadcrumb du chemin de l'élément
  const renderBreadcrumb = () => {
    if (!elementInfo.parentTree || elementInfo.parentTree.length === 0) {
      return (
        <span className="font-mono text-xs" style={{ color: '#03A5C0' }}>
          {elementInfo.elementType || `<${elementInfo.tagName}>`}
        </span>
      );
    }

    // Afficher les 3 derniers parents + l'élément actuel
    const visibleParents = elementInfo.parentTree.slice(0, 3).reverse();
    
    return (
      <div className="flex items-center gap-1 overflow-x-auto">
        {visibleParents.map((parent, index) => (
          <button
            key={index}
            onClick={() => onSelectParent?.(visibleParents.length - 1 - index)}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-mono hover:bg-muted transition-colors"
            style={{ color: parent.isSemanticParent ? '#03A5C0' : 'inherit' }}
          >
            {parent.tagName}
            {parent.id && <span className="opacity-60">#{parent.id}</span>}
            <ChevronRight className="w-3 h-3 text-muted-foreground" />
          </button>
        ))}
        <span 
          className="px-1.5 py-0.5 rounded text-xs font-mono font-medium"
          style={{ backgroundColor: 'rgba(3, 165, 192, 0.1)', color: '#03A5C0' }}
        >
          {elementInfo.elementType || elementInfo.tagName}
        </span>
      </div>
    );
  };

  return (
    <>
      {/* Backdrop semi-transparent */}
      <div 
        className="fixed inset-0 bg-black/20 backdrop-blur-[2px] z-[9998]"
        onClick={onClose}
      />

      {/* Outline de l'élément sélectionné */}
      {elementInfo.boundingRect && (
        <div
          className="fixed pointer-events-none z-[9997]"
          style={{
            left: elementInfo.boundingRect.left - 2,
            top: elementInfo.boundingRect.top - 2,
            width: elementInfo.boundingRect.width + 4,
            height: elementInfo.boundingRect.height + 4,
            border: '2px solid #03A5C0',
            borderRadius: '6px',
            boxShadow: '0 0 0 4px rgba(3, 165, 192, 0.2), 0 4px 20px rgba(0, 0, 0, 0.15)',
          }}
        />
      )}

      {/* Toolbar principale */}
      <div
        className="z-[9999] bg-background/95 backdrop-blur-md border border-border rounded-2xl shadow-2xl overflow-hidden"
        style={position}
      >
        {/* Breadcrumb */}
        <div className="px-4 py-2.5 border-b border-border bg-muted/30 flex items-center justify-between">
          {renderBreadcrumb()}
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-6 w-6 p-0 hover:bg-muted rounded-full"
          >
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>

        {/* Actions rapides */}
        <div className="flex items-center gap-1.5 px-3 py-2.5 border-b border-border">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 h-7 px-2 text-xs"
            onClick={() => {
              setShowColorPicker(!showColorPicker);
              setShowQuickActions(false);
            }}
          >
            <Palette className="w-3.5 h-3.5" />
            Couleur
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 h-7 px-2 text-xs"
            onClick={() => {
              setShowQuickActions(!showQuickActions);
              setShowColorPicker(false);
            }}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Actions
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 h-7 px-2 text-xs"
            onClick={handleDuplicate}
          >
            <Copy className="w-3.5 h-3.5" />
            Dupliquer
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 h-7 px-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={handleDelete}
          >
            <Trash2 className="w-3.5 h-3.5" />
            Supprimer
          </Button>
        </div>

        {/* Sélecteur de couleur */}
        {showColorPicker && (
          <div className="px-4 py-3 border-b border-border bg-muted/20 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-center gap-2 flex-wrap">
              {PRESET_COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => handleColorChange(color)}
                  className="w-7 h-7 rounded-lg border-2 border-border hover:scale-110 hover:border-foreground/50 transition-all"
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
              <input
                type="color"
                onChange={(e) => handleColorChange(e.target.value)}
                className="w-7 h-7 rounded-lg border-2 border-border cursor-pointer"
                title="Couleur personnalisée"
              />
            </div>
          </div>
        )}

        {/* Actions rapides prédéfinies */}
        {showQuickActions && (
          <div className="px-4 py-3 border-b border-border bg-muted/20 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-center gap-2 flex-wrap">
              {QUICK_ACTIONS.map((action) => (
                <button
                  key={action.id}
                  onClick={() => handleQuickAction(action.prompt)}
                  className="px-3 py-1.5 text-xs rounded-full border transition-all hover:scale-105"
                  style={{ 
                    borderColor: '#03A5C0',
                    backgroundColor: 'rgba(3, 165, 192, 0.1)',
                    color: '#03A5C0'
                  }}
                >
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input de prompt IA */}
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
            }}
            placeholder="Décrire les modifications..."
            className="flex-1 bg-muted/50 rounded-full px-4 py-2 border-none outline-none text-sm text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-[#03A5C0]/30"
          />
          <button
            onClick={handleSubmit}
            disabled={!prompt.trim()}
            className="w-9 h-9 rounded-full p-0 transition-all hover:scale-105 disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center"
            style={{ 
              backgroundColor: prompt.trim() ? '#03A5C0' : 'rgba(3, 165, 192, 0.3)',
              color: 'white'
            }}
          >
            <ArrowUp className="w-4 h-4" />
          </button>
        </div>

        {/* Info élément avec styles */}
        {elementInfo.computedStyles && (
          <div className="px-4 py-2 text-[10px] text-muted-foreground bg-muted/10 border-t border-border flex items-center gap-3 overflow-x-auto">
            <span className="font-mono whitespace-nowrap">
              {elementInfo.computedStyles.fontSize}
            </span>
            <span 
              className="w-3 h-3 rounded border border-border flex-shrink-0" 
              style={{ backgroundColor: elementInfo.computedStyles.backgroundColor }}
              title={`bg: ${elementInfo.computedStyles.backgroundColor}`}
            />
            <span 
              className="w-3 h-3 rounded border border-border flex-shrink-0" 
              style={{ backgroundColor: elementInfo.computedStyles.color }}
              title={`color: ${elementInfo.computedStyles.color}`}
            />
            <span className="font-mono whitespace-nowrap opacity-60">
              {elementInfo.computedStyles.display} • {elementInfo.computedStyles.position}
            </span>
            {elementInfo.textContent && (
              <span className="truncate max-w-[150px] opacity-60">
                "{elementInfo.textContent.substring(0, 30)}..."
              </span>
            )}
          </div>
        )}
      </div>
    </>
  );
}
