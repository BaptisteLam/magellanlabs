import { ArrowUp, Paperclip, Settings, Globe, Monitor, Smartphone } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import TextType from '@/components/ui/TextType';
import { useState, useRef } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
    <div className="bg-white rounded-lg shadow-md p-4 border border-slate-200">
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
          placeholder=""
          className="w-full min-h-[100px] resize-none border-0 p-0 text-sm text-slate-700 placeholder:text-slate-400 focus-visible:ring-0 focus-visible:ring-offset-0"
          style={{ fontSize: '14px' }}
        />
        {!inputValue && showPlaceholderAnimation && (
          <div className="absolute top-0 left-0 pointer-events-none text-slate-400" style={{ fontSize: '14px' }}>
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
              textColors={['#94a3b8']}
            />
          </div>
        )}
      </div>
      
      <div className="flex items-center justify-between mt-3 gap-2">
        <div className="flex items-center gap-2">
          {/* Icône trombone - envoi fichier */}
          <Button 
            variant="ghost" 
            size="icon"
            onClick={handleFileClick}
            className="w-8 h-8 rounded-full transition-all border"
            style={iconButtonStyle(false)}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#03A5C0';
              e.currentTarget.style.backgroundColor = 'rgba(3, 165, 192, 0.1)';
              e.currentTarget.style.color = '#03A5C0';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'transparent';
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = '#64748b';
            }}
          >
            <Paperclip className="w-4 h-4" />
          </Button>

          {/* Dropdown pour moteur IA */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon"
                className="w-8 h-8 rounded-full transition-all border"
                style={iconButtonStyle(false)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#03A5C0';
                  e.currentTarget.style.backgroundColor = 'rgba(3, 165, 192, 0.1)';
                  e.currentTarget.style.color = '#03A5C0';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'transparent';
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = '#64748b';
                }}
              >
                <Settings className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="bg-white border-slate-200 z-50">
              <DropdownMenuItem 
                onClick={() => setSelectedModel('sonnet')}
                className="cursor-pointer transition-all"
                style={{
                  borderColor: selectedModel === 'sonnet' ? '#03A5C0' : 'transparent',
                  backgroundColor: selectedModel === 'sonnet' ? 'rgba(3, 165, 192, 0.1)' : 'transparent',
                  color: selectedModel === 'sonnet' ? '#03A5C0' : '#64748b'
                }}
              >
                Sonnet 4.5
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => setSelectedModel('grok')}
                className="cursor-pointer transition-all"
                style={{
                  borderColor: selectedModel === 'grok' ? '#03A5C0' : 'transparent',
                  backgroundColor: selectedModel === 'grok' ? 'rgba(3, 165, 192, 0.1)' : 'transparent',
                  color: selectedModel === 'grok' ? '#03A5C0' : '#64748b'
                }}
              >
                Grok Code Fast 1
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Boutons type de projet */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSelectedType('website')}
              className="w-8 h-8 rounded-full transition-all border"
              style={iconButtonStyle(selectedType === 'website')}
              onMouseEnter={(e) => {
                if (selectedType !== 'website') {
                  e.currentTarget.style.borderColor = '#03A5C0';
                  e.currentTarget.style.backgroundColor = 'rgba(3, 165, 192, 0.1)';
                  e.currentTarget.style.color = '#03A5C0';
                }
              }}
              onMouseLeave={(e) => {
                if (selectedType !== 'website') {
                  e.currentTarget.style.borderColor = 'transparent';
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = '#64748b';
                }
              }}
            >
              <Globe className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSelectedType('webapp')}
              className="w-8 h-8 rounded-full transition-all border"
              style={iconButtonStyle(selectedType === 'webapp')}
              onMouseEnter={(e) => {
                if (selectedType !== 'webapp') {
                  e.currentTarget.style.borderColor = '#03A5C0';
                  e.currentTarget.style.backgroundColor = 'rgba(3, 165, 192, 0.1)';
                  e.currentTarget.style.color = '#03A5C0';
                }
              }}
              onMouseLeave={(e) => {
                if (selectedType !== 'webapp') {
                  e.currentTarget.style.borderColor = 'transparent';
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = '#64748b';
                }
              }}
            >
              <Monitor className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSelectedType('mobile')}
              className="w-8 h-8 rounded-full transition-all border"
              style={iconButtonStyle(selectedType === 'mobile')}
              onMouseEnter={(e) => {
                if (selectedType !== 'mobile') {
                  e.currentTarget.style.borderColor = '#03A5C0';
                  e.currentTarget.style.backgroundColor = 'rgba(3, 165, 192, 0.1)';
                  e.currentTarget.style.color = '#03A5C0';
                }
              }}
              onMouseLeave={(e) => {
                if (selectedType !== 'mobile') {
                  e.currentTarget.style.borderColor = 'transparent';
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = '#64748b';
                }
              }}
            >
              <Smartphone className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Bouton d'envoi */}
        <Button
          onClick={onSubmit}
          disabled={isLoading}
          className="w-10 h-10 rounded-full p-0 transition-all hover:shadow-lg disabled:opacity-50 border-0"
          style={{ backgroundColor: '#03A5C0' }}
          onMouseEnter={(e) => {
            if (!isLoading) {
              e.currentTarget.style.backgroundColor = '#028CA3';
              e.currentTarget.style.boxShadow = '0 8px 20px -4px rgba(3, 165, 192, 0.4)';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#03A5C0';
            e.currentTarget.style.boxShadow = '';
          }}
        >
          <ArrowUp className="w-5 h-5 text-white" />
        </Button>
      </div>
    </div>
  );
};

export default PromptBar;
