import { ArrowUp, Paperclip, Settings, Globe, X, MousePointer2, Square, MessageSquare, Image, FileText } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import TextType from '@/components/ui/TextType';
import { useState, useRef } from 'react';
import { useThemeStore } from '@/stores/themeStore';
import claudeLogo from '@/assets/claude-logo.png';
import xaiLogo from '@/assets/xai-logo.png';
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
  onStop?: () => void;
  placeholder?: string;
  showPlaceholderAnimation?: boolean;
  onFileSelect?: (files: File[]) => void;
  attachedFiles?: Array<{ name: string; base64: string; type: string }>;
  onRemoveFile?: (index: number) => void;
  showConfigButtons?: boolean;
  modificationMode?: boolean;
  inspectMode?: boolean;
  onInspectToggle?: () => void;
  chatMode?: boolean;
  onChatToggle?: () => void;
  projectType?: 'website' | 'webapp' | 'mobile';
  onProjectTypeChange?: (type: 'website' | 'webapp' | 'mobile') => void;
}

const PromptBar = ({ 
  inputValue, 
  setInputValue, 
  onSubmit, 
  isLoading,
  onStop,
  placeholder = "",
  showPlaceholderAnimation = true,
  onFileSelect,
  attachedFiles = [],
  onRemoveFile,
  showConfigButtons = true,
  modificationMode = false,
  inspectMode = false,
  onInspectToggle,
  chatMode = false,
  onChatToggle,
  projectType = 'website',
  onProjectTypeChange
}: PromptBarProps) => {
  const { isDark } = useThemeStore();
  const [selectedModel, setSelectedModel] = useState<'sonnet' | 'grok'>('sonnet');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleTypeChange = (type: 'website' | 'webapp' | 'mobile') => {
    if (onProjectTypeChange) {
      onProjectTypeChange(type);
    }
  };

  const handleFileClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0 && onFileSelect) {
      onFileSelect(Array.from(files));
    }
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
      className={`w-full rounded-xl p-3 border transition-colors ${modificationMode ? 'bg-card/80 backdrop-blur-sm' : ''}`}
      style={{
        backgroundColor: modificationMode ? undefined : (isDark ? 'hsl(var(--card))' : '#ffffff'),
        borderColor: isDark ? 'hsl(var(--border))' : 'rgba(203, 213, 225, 0.8)',
        boxShadow: '0 4px 12px -2px rgba(0, 0, 0, 0.08), 0 2px 6px -1px rgba(0, 0, 0, 0.04)'
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
              {getFileIcon(file.type)}
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
          placeholder={modificationMode ? "Décris les modifications à apporter..." : ""}
          className="w-full min-h-[100px] resize-none border-0 p-3 text-sm focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent"
          style={{ 
            fontSize: '14px',
            color: isDark ? 'hsl(var(--foreground))' : '#334155'
          }}
        />
        {!inputValue && showPlaceholderAnimation && !modificationMode && (
          <div className="absolute top-3 left-3 right-3 pointer-events-none text-slate-400 whitespace-normal text-left" style={{ fontSize: '14px', textAlign: 'left' }}>
            <TextType
              text={[
                "Je veux un site pour présenter mon activité d'artisan et faciliter la prise de contact.",
                "Je souhaite un site professionnel pour valoriser mon cabinet de conseil et mes offres.",
                "Je veux un site attractif pour présenter mon restaurant, le menu et les réservations.",
                "Je souhaite une plateforme claire pour expliquer mon activité de coach ou formateur.",
                "Je veux une présence en ligne moderne pour mettre en avant mon agence digitale.",
                "Je souhaite un site pour présenter mes prestations dans le bâtiment.",
                "Je veux un site visuel pour exposer mon travail de photographe ou vidéaste.",
                "Je souhaite un site institutionnel pour présenter mon cabinet juridique ou comptable.",
                "Je veux un site pour valoriser mon commerce local et mes produits.",
                "Je souhaite un site informatif pour présenter mon association et ses actions."
              ]}
              typingSpeed={30}
              deletingSpeed={20}
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
            {/* Bouton Mode Inspect - uniquement en mode modification */}
            {modificationMode && onInspectToggle && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    type="button"
                    onClick={onInspectToggle}
                    className="w-8 h-8 rounded-lg transition-all hover:bg-primary/10 hover:border-primary p-0 border"
                    style={iconButtonStyle(inspectMode)}
                  >
                    <MousePointer2 className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p className="text-xs">{inspectMode ? 'Désactiver inspection' : 'Mode Inspect'}</p>
                </TooltipContent>
              </Tooltip>
            )}
            {/* Bouton Mode Chat - uniquement en mode modification */}
            {modificationMode && onChatToggle && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    type="button"
                    onClick={onChatToggle}
                    className="w-8 h-8 rounded-lg transition-all hover:bg-primary/10 hover:border-primary p-0 border"
                    style={iconButtonStyle(chatMode)}
                  >
                    <MessageSquare className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p className="text-xs">{chatMode ? 'Désactiver chat' : 'Mode Chat'}</p>
                </TooltipContent>
              </Tooltip>
            )}
            {/* Bouton déposer un document */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon"
                  type="button"
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
                          type="button"
                          className="w-8 h-8 rounded-lg transition-all hover:bg-primary/10 hover:border-primary p-0 border"
                          style={iconButtonStyle(false)}
                        >
                          <Settings className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent 
                        className="min-w-[200px] z-50 overflow-hidden rounded-md border shadow-md"
                        style={{
                          backgroundColor: isDark ? 'hsl(var(--card))' : '#ffffff',
                          borderColor: isDark ? 'hsl(var(--border))' : 'rgba(203, 213, 225, 0.5)',
                        }}
                      >
                        <DropdownMenuItem 
                          onClick={() => setSelectedModel('sonnet')}
                          className="flex items-center gap-2 px-3 py-2 cursor-pointer transition-all rounded-full mx-1 my-0.5"
                          style={{
                            color: selectedModel === 'sonnet' ? '#03A5C0' : (isDark ? 'hsl(var(--foreground))' : '#334155'),
                            borderColor: selectedModel === 'sonnet' ? '#03A5C0' : 'transparent',
                            backgroundColor: selectedModel === 'sonnet' ? 'rgba(3, 165, 192, 0.1)' : 'transparent',
                            border: '1px solid',
                          }}
                          onMouseEnter={(e) => {
                            if (selectedModel !== 'sonnet') {
                              e.currentTarget.style.borderColor = '#03A5C0';
                              e.currentTarget.style.backgroundColor = 'rgba(3, 165, 192, 0.1)';
                              e.currentTarget.style.color = '#03A5C0';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (selectedModel !== 'sonnet') {
                              e.currentTarget.style.borderColor = 'transparent';
                              e.currentTarget.style.backgroundColor = 'transparent';
                              e.currentTarget.style.color = isDark ? 'hsl(var(--foreground))' : '#334155';
                            }
                          }}
                        >
                          <img src={claudeLogo} alt="Claude" className="w-4 h-4" />
                          <span>Claude Sonnet 4.5</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => setSelectedModel('grok')}
                          className="flex items-center gap-2 px-3 py-2 cursor-pointer transition-all rounded-full mx-1 my-0.5"
                          style={{
                            color: selectedModel === 'grok' ? '#03A5C0' : (isDark ? 'hsl(var(--foreground))' : '#334155'),
                            borderColor: selectedModel === 'grok' ? '#03A5C0' : 'transparent',
                            backgroundColor: selectedModel === 'grok' ? 'rgba(3, 165, 192, 0.1)' : 'transparent',
                            border: '1px solid',
                          }}
                          onMouseEnter={(e) => {
                            if (selectedModel !== 'grok') {
                              e.currentTarget.style.borderColor = '#03A5C0';
                              e.currentTarget.style.backgroundColor = 'rgba(3, 165, 192, 0.1)';
                              e.currentTarget.style.color = '#03A5C0';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (selectedModel !== 'grok') {
                              e.currentTarget.style.borderColor = 'transparent';
                              e.currentTarget.style.backgroundColor = 'transparent';
                              e.currentTarget.style.color = isDark ? 'hsl(var(--foreground))' : '#334155';
                            }
                          }}
                        >
                          <img src={xaiLogo} alt="XAI" className="w-4 h-4" />
                          <span>Grok Code Fast 1</span>
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
                      type="button"
                      onClick={() => handleTypeChange('website')}
                      className="w-8 h-8 rounded-lg transition-all hover:bg-primary/10 hover:border-primary p-0 border"
                      style={iconButtonStyle(projectType === 'website')}
                    >
                      <Globe className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <p className="text-xs">site web</p>
                  </TooltipContent>
                </Tooltip>
              </>
            )}
          </div>

          {/* Bouton d'envoi / Stop */}
          <Tooltip>
            <TooltipTrigger asChild>
                <Button
                  onClick={isLoading && onStop ? onStop : onSubmit}
                  type="button"
                  disabled={isLoading && !onStop}
                  className="transition-all hover:scale-105 border-0"
                  style={{ 
                    backgroundColor: '#03A5C0',
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    padding: 0
                  }}
                >
                  {isLoading ? (
                    <Square className="w-4 h-4 text-white" fill="white" />
                  ) : (
                    <ArrowUp className="w-4 h-4 text-white" />
                  )}
                </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p className="text-xs">{isLoading ? 'Arrêter la génération' : 'Envoyer'}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
};

export default PromptBar;
