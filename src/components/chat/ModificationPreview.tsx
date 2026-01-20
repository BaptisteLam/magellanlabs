import { cn } from "@/lib/utils";
import { Check, X, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

interface DiffLine {
  type: 'add' | 'remove' | 'unchanged' | 'context';
  content: string;
  lineNumber: number;
}

interface ModificationPreviewProps {
  previews: Array<{
    file: string;
    diff: {
      lines: DiffLine[];
      addedLines: number;
      removedLines: number;
    };
    autoApproved: boolean;
    summary: string;
  }>;
  onApprove: () => void;
  onReject: () => void;
  isLoading?: boolean;
}

export function ModificationPreview({ 
  previews, 
  onApprove, 
  onReject,
  isLoading = false 
}: ModificationPreviewProps) {
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());

  const toggleFile = (file: string) => {
    const newExpanded = new Set(expandedFiles);
    if (newExpanded.has(file)) {
      newExpanded.delete(file);
    } else {
      newExpanded.add(file);
    }
    setExpandedFiles(newExpanded);
  };

  const allAutoApproved = previews.every(p => p.autoApproved);
  const totalAdded = previews.reduce((sum, p) => sum + p.diff.addedLines, 0);
  const totalRemoved = previews.reduce((sum, p) => sum + p.diff.removedLines, 0);

  return (
    <div className="rounded-lg border border-[#03A5C0]/20 bg-[#03A5C0]/5 p-4 my-2">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium text-foreground">
          Modifications à appliquer
        </h4>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="text-green-500">+{totalAdded}</span>
          <span className="text-red-500">-{totalRemoved}</span>
        </div>
      </div>

      <div className="space-y-2 mb-4">
        {previews.map((preview) => (
          <div 
            key={preview.file} 
            className="rounded border border-border/50 bg-background/50 overflow-hidden"
          >
            {/* Header du fichier */}
            <button
              onClick={() => toggleFile(preview.file)}
              className="w-full flex items-center justify-between px-3 py-2 hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-[#03A5C0]">
                  {preview.file.split('/').pop()}
                </span>
                {preview.autoApproved && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/10 text-green-600">
                    Auto
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {preview.summary}
                </span>
                {expandedFiles.has(preview.file) ? (
                  <ChevronUp className="w-3 h-3" />
                ) : (
                  <ChevronDown className="w-3 h-3" />
                )}
              </div>
            </button>

            {/* Contenu du diff */}
            {expandedFiles.has(preview.file) && (
              <div className="border-t border-border/50 p-2 bg-muted/20">
                <pre className="text-xs font-mono overflow-x-auto max-h-48 overflow-y-auto">
                  {preview.diff.lines.map((line, i) => (
                    <div 
                      key={i}
                      className={cn(
                        "px-2 py-0.5",
                        line.type === 'add' && 'bg-green-500/10 text-green-600',
                        line.type === 'remove' && 'bg-red-500/10 text-red-600',
                        line.type === 'context' && 'text-muted-foreground',
                        line.type === 'unchanged' && 'text-foreground'
                      )}
                    >
                      <span className="inline-block w-4 text-right mr-2 opacity-50">
                        {line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' '}
                      </span>
                      <span className="inline-block w-8 text-right mr-2 opacity-30">
                        {line.lineNumber > 0 ? line.lineNumber : ''}
                      </span>
                      {line.content}
                    </div>
                  ))}
                </pre>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {allAutoApproved 
            ? "✓ Modifications triviales - approbation automatique possible"
            : `${previews.length} fichier(s) à modifier`
          }
        </span>
        <div className="flex gap-2">
          <button
            onClick={onReject}
            disabled={isLoading}
            className={cn(
              "inline-flex items-center justify-center gap-1.5",
              "px-3 py-1.5 text-sm font-medium rounded-full",
              "border border-border bg-background",
              "hover:bg-muted transition-colors",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          >
            <X className="w-3.5 h-3.5" />
            Annuler
          </button>
          <button
            onClick={onApprove}
            disabled={isLoading}
            className={cn(
              "inline-flex items-center justify-center gap-1.5",
              "px-4 py-1.5 text-sm font-medium rounded-full",
              "border transition-all",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
            style={{
              borderColor: 'rgb(3,165,192)',
              backgroundColor: 'rgba(3,165,192,0.1)',
              color: 'rgb(3,165,192)'
            }}
          >
            <Check className="w-3.5 h-3.5" />
            {isLoading ? 'Application...' : 'Appliquer'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Composant pour afficher les suggestions proactives
interface ProactiveSuggestion {
  type: string;
  message: string;
  autoApplicable: boolean;
  priority: string;
}

interface SuggestionsDisplayProps {
  suggestions: ProactiveSuggestion[];
  onApplySuggestion?: (suggestion: ProactiveSuggestion) => void;
}

export function SuggestionsDisplay({ suggestions, onApplySuggestion }: SuggestionsDisplayProps) {
  if (suggestions.length === 0) return null;

  return (
    <div className="rounded-lg border border-[#03A5C0]/10 bg-[#03A5C0]/5 p-3 my-2">
      <h5 className="text-xs font-medium text-muted-foreground mb-2">
        💡 Suggestions d'amélioration
      </h5>
      <div className="space-y-1.5">
        {suggestions.map((suggestion, i) => (
          <div 
            key={i}
            className="flex items-center justify-between text-xs"
          >
            <span className="text-foreground">{suggestion.message}</span>
            {suggestion.autoApplicable && onApplySuggestion && (
              <button
                onClick={() => onApplySuggestion(suggestion)}
                className={cn(
                  "px-2 py-0.5 rounded-full text-[10px] font-medium",
                  "border transition-all hover:bg-[#03A5C0]/20"
                )}
                style={{
                  borderColor: 'rgb(3,165,192)',
                  color: 'rgb(3,165,192)'
                }}
              >
                Appliquer
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
