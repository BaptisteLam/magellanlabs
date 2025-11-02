import { ArrowUp, Paperclip, Settings, Globe, Monitor, Smartphone, X } from 'lucide-react';
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
  attachedFiles?: Array<{ name: string; base64: string; type: string }>;
  onRemoveFile?: (index: number) => void;
  showConfigButtons?: boolean; // Nouveau: afficher les boutons de config (paramètres, type de projet)
}

const PromptBar = ({ 
  inputValue, 
  setInputValue, 
  onSubmit, 
  isLoading,
  placeholder = "",
  showPlaceholderAnimation = true,
  onFileSelect,
  attachedFiles = [],
  onRemoveFile,
  showConfigButtons = true // Par défaut on affiche les boutons (accueil/build)
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

  const iconButtonStyle = (isSelected: boolean) => {
    const baseColor = isDark ? 'hsl(var(--foreground))' : '#64748b';
    return {
      borderColor: isSelected ? '#03A5C0' : (isDark ? 'hsl(var(--border))' : 'rgba(203, 213, 225, 0.5)'),
      backgroundColor: 'transparent',
      color: isSelected ? '#03A5C0' : baseColor,
      borderWidth: '1px',
      borderStyle: 'solid'
    };
  };

  return (
    <div 
      className="w-full rounded-xl shadow-sm p-3 border transition-colors"
      style={{
        backgroundColor: isDark ? 'hsl(var(--card))' : '#ffffff',
        borderColor: isDark ? 'hsl(var(--border))' : 'rgba(203, 213, 225, 0.5)'
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
      
      {/* Affichage des fichiers attachés */}
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
              <Paperclip className="w-3 h-3" />
              <span className="max-w-[200px] truncate">{file.name}</span>
              {onRemoveFile && (
                <button
                  onClick={() => onRemoveFile(index)}
                  className="ml-1 hover:text-red-500 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      
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
          className="w-full min-h-[100px] resize-none border-0 p-3 text-sm focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent"
          style={{ 
            fontSize: '14px',
            color: isDark ? 'hsl(var(--foreground))' : '#334155'
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
      
      <div className="flex items-center justify-between mt-2 gap-2">
        <TooltipProvider>
          <div className="flex items-center gap-1">
            {/* Bouton déposer un document */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={handleFileClick}
                  className="w-8 h-8 rounded-lg transition-all hover:bg-primary/10 hover:border-primary p-0 border"
                  style={iconButtonStyle(false)}
                >
                  <Paperclip className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p className="text-xs">Déposer un document</p>
              </TooltipContent>
            </Tooltip>

            {/* Boutons de configuration - uniquement pour accueil/build */}
            {showConfigButtons && (
              <>
                {/* Bouton changer le moteur IA */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          className="w-8 h-8 rounded-lg transition-all hover:bg-primary/10 hover:border-primary p-0 border"
                          style={iconButtonStyle(false)}
                        >
                          <Settings className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="bg-popover">
                        <DropdownMenuItem onClick={() => setSelectedModel('sonnet')}>
                          Claude Sonnet (Recommandé)
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setSelectedModel('grok')}>
                          Grok 2
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <p className="text-xs">Changer le moteur IA</p>
                  </TooltipContent>
                </Tooltip>

                {/* Bouton Site Web */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => setSelectedType('website')}
                      className="w-8 h-8 rounded-lg transition-all hover:bg-primary/10 hover:border-primary p-0 border"
                      style={iconButtonStyle(selectedType === 'website')}
                    >
                      <Globe className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <p className="text-xs">site web</p>
                  </TooltipContent>
                </Tooltip>

                {/* Bouton Application Web */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => setSelectedType('webapp')}
                      className="w-8 h-8 rounded-lg transition-all hover:bg-primary/10 hover:border-primary p-0 border"
                      style={iconButtonStyle(selectedType === 'webapp')}
                    >
                      <Monitor className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <p className="text-xs">application web</p>
                  </TooltipContent>
                </Tooltip>

                {/* Bouton Mobile */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => setSelectedType('mobile')}
                      className="w-8 h-8 rounded-lg transition-all hover:bg-primary/10 hover:border-primary p-0 border"
                      style={iconButtonStyle(selectedType === 'mobile')}
                    >
                      <Smartphone className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <p className="text-xs">application mobile</p>
                  </TooltipContent>
                </Tooltip>
              </>
            )}
          </div>

          {/* Bouton d'envoi */}
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
