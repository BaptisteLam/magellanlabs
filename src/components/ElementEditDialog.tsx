import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import { Code2, Tag, FileText } from 'lucide-react';
// Type ElementInfo défini localement
export interface ElementInfo {
  tagName: string;
  id: string;
  classList: string[];
  textContent: string;
  path: string;
}

interface ElementEditDialogProps {
  isOpen: boolean;
  onClose: () => void;
  elementInfo: ElementInfo | null;
  onModify: (prompt: string) => void;
}

export function ElementEditDialog({ isOpen, onClose, elementInfo, onModify }: ElementEditDialogProps) {
  const [prompt, setPrompt] = useState('');

  const handleSubmit = () => {
    if (!prompt.trim()) return;
    onModify(prompt);
    setPrompt('');
  };

  if (!elementInfo) return null;

  const contextualPrompt = `Modifier l'élément suivant :

Type: <${elementInfo.tagName.toLowerCase()}>
${elementInfo.id ? `ID: #${elementInfo.id}` : ''}
${elementInfo.classList.length > 0 ? `Classes: ${elementInfo.classList.join(', ')}` : ''}
Texte actuel: "${elementInfo.textContent.substring(0, 100)}${elementInfo.textContent.length > 100 ? '...' : ''}"

Instruction de modification: ${prompt}

Ne modifie que cet élément spécifique identifié par son chemin CSS: ${elementInfo.path}`;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="w-5 h-5 text-primary" />
            Modifier l'élément
          </DialogTitle>
          <DialogDescription>
            Décrivez les modifications à apporter à cet élément
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Infos sur l'élément */}
          <div className="border border-border rounded-lg p-4 bg-muted/50">
            <div className="flex items-start gap-3 mb-3">
              <Code2 className="w-4 h-4 text-muted-foreground mt-1" />
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="font-mono">
                    {elementInfo.tagName.toLowerCase()}
                  </Badge>
                  {elementInfo.id && (
                    <Badge variant="secondary" className="font-mono">
                      #{elementInfo.id}
                    </Badge>
                  )}
                  {elementInfo.classList.map((cls, i) => (
                    <Badge key={i} variant="secondary" className="font-mono text-xs">
                      .{cls}
                    </Badge>
                  ))}
                </div>
                
                {elementInfo.textContent && (
                  <div className="mt-2">
                    <div className="flex items-center gap-2 mb-1">
                      <FileText className="w-3 h-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Contenu actuel:</span>
                    </div>
                    <p className="text-sm line-clamp-3 bg-background rounded px-2 py-1 border border-border/50">
                      {elementInfo.textContent}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="text-xs text-muted-foreground font-mono bg-background rounded px-2 py-1 border border-border/50 overflow-x-auto">
              {elementInfo.path}
            </div>
          </div>

          {/* Champ de prompt */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Comment voulez-vous modifier cet élément ?
            </label>
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Ex: Change le texte en 'Nouveau titre', augmente la taille, change la couleur en bleu..."
              className="min-h-[100px] resize-none"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.ctrlKey) {
                  handleSubmit();
                }
              }}
            />
            <p className="text-xs text-muted-foreground">
              Ctrl + Entrée pour soumettre
            </p>
          </div>

          {/* Exemples de prompts */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Exemples de modifications :</p>
            <div className="flex flex-wrap gap-2">
              {[
                "Change la couleur en bleu",
                "Augmente la taille de police",
                "Centre ce texte",
                "Ajoute une ombre",
                "Rends-le plus visible"
              ].map((example, i) => (
                <button
                  key={i}
                  onClick={() => setPrompt(example)}
                  className="text-xs px-2 py-1 rounded-full border border-border hover:bg-accent transition-colors"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={!prompt.trim()}
            style={{
              borderColor: 'rgb(3,165,192)',
              backgroundColor: prompt.trim() ? 'rgb(3,165,192)' : 'rgba(3,165,192,0.5)',
              color: 'white'
            }}
          >
            Appliquer les modifications
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
