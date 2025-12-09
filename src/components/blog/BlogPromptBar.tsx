import { useState } from 'react';
import { Sparkles, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface BlogPromptBarProps {
  onSubmit?: (prompt: string) => void;
  disabled?: boolean;
}

export function BlogPromptBar({ onSubmit, disabled }: BlogPromptBarProps) {
  const [prompt, setPrompt] = useState('');

  const handleSubmit = () => {
    if (prompt.trim() && onSubmit) {
      onSubmit(prompt);
      setPrompt('');
    }
  };

  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 w-full max-w-2xl px-4 z-40">
      <div className="relative bg-card/95 backdrop-blur-xl border rounded-2xl shadow-2xl p-4">
        {/* Gradient glow effect */}
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-[#03A5C0]/20 via-transparent to-[#03A5C0]/20 blur-xl -z-10" />
        
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 h-10 w-10 rounded-full bg-[#03A5C0]/10 flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-[#03A5C0]" />
          </div>
          
          <div className="flex-1">
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Décrivez le sujet de votre article et laissez l'IA le rédiger..."
              className="min-h-[60px] max-h-[150px] resize-none border-none shadow-none focus-visible:ring-0 bg-transparent text-foreground placeholder:text-muted-foreground"
              disabled={disabled}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
            />
          </div>
          
          <Button
            onClick={handleSubmit}
            disabled={!prompt.trim() || disabled}
            className="flex-shrink-0 rounded-full h-10 w-10 p-0 border-[#03A5C0] bg-[#03A5C0]/10 text-[#03A5C0] hover:bg-[#03A5C0]/20 disabled:opacity-50"
            variant="outline"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>

        <p className="text-xs text-muted-foreground mt-2 text-center">
          Appuyez sur Entrée pour générer • Shift+Entrée pour nouvelle ligne
        </p>
      </div>
    </div>
  );
}
