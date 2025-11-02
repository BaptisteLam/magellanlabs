import { ArrowUp, Paperclip, Settings, Globe, Monitor, Smartphone } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import TextType from '@/components/ui/TextType';
import { useState, useRef } from 'react';
import { useThemeStore } from '@/stores/themeStore';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface PromptBarProps {
  inputValue: string;
  setInputValue: (value: string) => void;
  onSubmit: () => void;
  isLoading: boolean;
  placeholder?: string;
  showPlaceholderAnimation?: boolean;
  onFileSelect?: (files: File[]) => void;
}

const PromptBar = ({ 
  inputValue, 
  setInputValue, 
  onSubmit, 
  isLoading,
  placeholder = "",
  showPlaceholderAnimation = true,
  onFileSelect
}: PromptBarProps) => {
  const { isDark } = useThemeStore();
  const [selectedModel, setSelectedModel] = useState<'sonnet' | 'grok'>('sonnet');
  const [selectedType, setSelectedType] = useState<'website' | 'webapp' | 'mobile'>('website');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0 && onFileSelect) {
      onFileSelect(Array.from(files));
    }
  };

  const iconButtonStyle = (isSelected: boolean) => ({
    borderColor: isSelected ? '#03A5C0' : 'transparent',
    backgroundColor: isSelected ? 'rgba(3, 165, 192, 0.1)' : 'transparent',
    color: isSelected ? '#03A5C0' : '#64748b'
  });

  return (
    <div 
      className="w-full rounded-xl shadow-sm p-3 border"
      style={{
        backgroundColor: '#ffffff',
        borderColor: 'rgba(203, 213, 225, 0.5)'
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileChange}
        className="hidden"
      />
      
      <div className="relative">
        <Textarea
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              if (!isLoading && inputValue.trim()) {
                onSubmit();
              }
            }
          }}
          placeholder=""
          className="w-full min-h-[100px] resize-none border-0 p-3 text-sm placeholder:text-slate-400 focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent text-slate-700"
          style={{ 
            fontSize: '14px'
          }}
        />
        {!inputValue && showPlaceholderAnimation && (
          <div className="absolute top-3 left-3 pointer-events-none text-slate-400" style={{ fontSize: '14px' }}>
            <TextType
              text={[
                "J'ai un foodtruck de burgers artisanaux",
                "Je suis naturopathe pour les femmes",
                "Consultant RH à Bordeaux",
                "Je veux un site pro pour mon activité de drone",
                "J'ai un bureau d'études en bâtiment"
              ]}
              typingSpeed={60}
              deletingSpeed={40}
              pauseDuration={3000}
              showCursor={true}
              cursorCharacter="|"
              loop={true}
              textColors={['rgba(148, 163, 184, 0.7)']}
            />
          </div>
        )}
      </div>
      
      <div className="flex items-center justify-end mt-2 gap-2">
        <TooltipProvider>
          {/* Bouton fichier bleu minimaliste */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon"
                onClick={handleFileClick}
                className="w-8 h-8 rounded-full transition-all hover:bg-[#03A5C0]/10 p-0"
              >
                <Paperclip className="w-4 h-4 text-[#03A5C0]" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p className="text-xs">Joindre</p>
            </TooltipContent>
          </Tooltip>

          {/* Bouton d'envoi bleu */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={onSubmit}
                disabled={isLoading}
                className="w-9 h-9 rounded-full p-0 transition-all hover:scale-105 disabled:opacity-50 border-0"
                style={{ backgroundColor: '#03A5C0' }}
              >
                <ArrowUp className="w-4 h-4 text-white" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p className="text-xs">Envoyer</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
};

export default PromptBar;
