import { useState, useRef } from 'react';
import { ArrowUp, Paperclip, X, Image, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useThemeStore } from '@/stores/themeStore';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface BlogPromptBarProps {
  onSubmit?: (prompt: string, files?: File[]) => void;
  disabled?: boolean;
}

export function BlogPromptBar({ onSubmit, disabled }: BlogPromptBarProps) {
  const [prompt, setPrompt] = useState('');
  const { isDark } = useThemeStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachedFiles, setAttachedFiles] = useState<Array<{ name: string; file: File; type: string }>>([]);

  const handleSubmit = () => {
    if (prompt.trim() && onSubmit) {
      onSubmit(prompt, attachedFiles.map(f => f.file));
      setPrompt('');
      setAttachedFiles([]);
    }
  };

  const handleFileClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const newFiles = Array.from(files).map(file => ({
        name: file.name,
        file,
        type: file.type
      }));
      setAttachedFiles(prev => [...prev, ...newFiles]);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeFile = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) {
      return <Image className="w-3 h-3" />;
    }
    if (fileType === 'application/pdf' || fileType.includes('document') || fileType.includes('text')) {
      return <FileText className="w-3 h-3" />;
    }
    return <Paperclip className="w-3 h-3" />;
  };

  const iconButtonStyle = {
    borderColor: isDark ? 'hsl(var(--border))' : 'rgba(203, 213, 225, 0.5)',
    backgroundColor: 'transparent',
    color: isDark ? 'hsl(var(--foreground))' : '#64748b',
    borderWidth: '1px',
    borderStyle: 'solid' as const
  };

  return (
    <div className="absolute bottom-6 left-0 right-0 px-4 z-40">
      <div className="max-w-2xl mx-auto">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.pdf,.doc,.docx,.txt"
        multiple
        onChange={handleFileChange}
        className="hidden"
      />
      
      <div 
        className="w-full rounded-xl p-3 border transition-colors"
        style={{
          backgroundColor: isDark ? 'hsl(var(--card))' : '#ffffff',
          borderColor: isDark ? 'hsl(var(--border))' : 'rgba(203, 213, 225, 0.8)',
          boxShadow: '0 4px 12px -2px rgba(0, 0, 0, 0.08), 0 2px 6px -1px rgba(0, 0, 0, 0.04)'
        }}
      >
        {/* Fichiers attachés */}
        {attachedFiles.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {attachedFiles.map((file, index) => (
              <div 
                key={index}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm"
                style={{
                  backgroundColor: isDark ? 'hsl(var(--card))' : '#f8fafc',
                  borderColor: isDark ? 'hsl(var(--border))' : 'rgba(203, 213, 225, 0.5)',
                  color: isDark ? 'hsl(var(--foreground))' : '#334155'
                }}
              >
                {getFileIcon(file.type)}
                <span className="max-w-[200px] truncate">{file.name}</span>
                <button
                  onClick={() => removeFile(index)}
                  className="ml-1 hover:text-red-500 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="relative">
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Décrivez le sujet de votre article et laissez l'IA le rédiger..."
            className="w-full min-h-[80px] resize-none border-0 p-3 text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
            style={{ 
              fontSize: '14px',
              color: isDark ? 'hsl(var(--foreground))' : '#334155',
              backgroundColor: 'transparent'
            }}
            disabled={disabled}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
          />
        </div>

        <div className="flex items-center justify-between mt-2 gap-2">
          <TooltipProvider>
            <div className="flex items-center gap-1">
              {/* Bouton pièce jointe */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    type="button"
                    onClick={handleFileClick}
                    className="w-8 h-8 rounded-lg transition-all hover:bg-primary/10 hover:border-primary p-0 border"
                    style={iconButtonStyle}
                  >
                    <Paperclip className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p className="text-xs">Joindre un fichier</p>
                </TooltipContent>
              </Tooltip>
            </div>

            {/* Bouton d'envoi */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={handleSubmit}
                  type="button"
                  disabled={!prompt.trim() || disabled}
                  className="transition-all hover:scale-105 border-0 disabled:opacity-50"
                  style={{ 
                    backgroundColor: '#03A5C0',
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    padding: 0
                  }}
                >
                  <ArrowUp className="w-4 h-4 text-white" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p className="text-xs">Générer l'article</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      <p className="text-xs text-muted-foreground mt-2 text-center">
        Appuyez sur Entrée pour générer • Shift+Entrée pour nouvelle ligne
      </p>
      </div>
    </div>
  );
}
