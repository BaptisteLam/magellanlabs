import { Sparkles } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { toast as sonnerToast } from 'sonner';
import { useThemeStore } from '@/stores/themeStore';
import PromptBar from '@/components/PromptBar';
interface AISearchHeroProps {
  onGeneratedChange?: (hasGenerated: boolean) => void;
}

const AISearchHero = ({ onGeneratedChange }: AISearchHeroProps) => {
  const { isDark } = useThemeStore();
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [attachedFiles, setAttachedFiles] = useState<Array<{ name: string; base64: string; type: string }>>([]);
  const [projectType, setProjectType] = useState<'website' | 'webapp' | 'mobile'>('website');
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleFileSelect = async (files: File[]) => {
    const newFiles: Array<{ name: string; base64: string; type: string }> = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      if (!file.type.startsWith('image/')) {
        sonnerToast.error(`${file.name} n'est pas une image`);
        continue;
      }

      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onloadend = () => {
          resolve(reader.result as string);
        };
        reader.readAsDataURL(file);
      });

      const base64 = await base64Promise;
      newFiles.push({ name: file.name, base64, type: file.type });
    }

    setAttachedFiles([...attachedFiles, ...newFiles]);
  };

  const removeFile = (index: number) => {
    setAttachedFiles(attachedFiles.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!inputValue.trim()) {
      sonnerToast.error("Veuillez entrer votre message");
      return;
    }

    if (!user) {
      localStorage.setItem('redirectAfterAuth', '/');
      sonnerToast.info("Connectez-vous pour générer votre site");
      navigate('/auth');
      return;
    }

    setIsLoading(true);
    try {
      const prompt = inputValue.trim();

      const { data: session, error: sessionError } = await supabase
        .from('build_sessions')
        .insert({
          user_id: user.id,
          title: null,
          project_files: [],
          project_type: projectType,
          messages: [{ role: 'user', content: prompt }]
        })
        .select()
        .single();

      if (sessionError) {
        throw new Error('Erreur lors de la création de la session');
      }

      setInputValue('');
      setAttachedFiles([]);
      
      navigate(`/builder/${session.id}`, { 
        state: { attachedFiles } 
      });
    } catch (error) {
      console.error('Erreur:', error);
      sonnerToast.error(error instanceof Error ? error.message : "Une erreur est survenue");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex flex-col items-center overflow-hidden pt-12 sm:pt-20" style={{ backgroundColor: isDark ? '#1F1F20' : '#ffffff' }}>
      {/* Grid background */}
      <div className="absolute inset-0"
           style={{
             backgroundImage: 'linear-gradient(rgba(148, 163, 184, 0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(148, 163, 184, 0.15) 1px, transparent 1px)',
             backgroundSize: '80px 80px'
           }}
      />
      {/* Glows */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[200px] left-1/4 w-[400px] sm:w-[800px] h-[400px] sm:h-[800px] rounded-full blur-[100px] sm:blur-[150px] animate-pulse-slow"
             style={{ backgroundColor: 'rgba(91, 224, 229, 0.3)' }} />
        <div className="absolute top-[100px] right-1/4 w-[400px] sm:w-[800px] h-[400px] sm:h-[800px] rounded-full blur-[100px] sm:blur-[150px] animate-pulse-slower"
             style={{ backgroundColor: 'rgba(3, 165, 192, 0.3)' }} />
        <div className="absolute top-[50px] left-1/2 -translate-x-1/2 w-[300px] sm:w-[600px] h-[300px] sm:h-[600px] rounded-full blur-[80px] sm:blur-[120px] animate-pulse"
             style={{ backgroundColor: 'rgba(91, 224, 229, 0.25)' }} />
        <div className="absolute top-0 right-1/3 w-[350px] sm:w-[700px] h-[350px] sm:h-[700px] rounded-full blur-[90px] sm:blur-[140px] animate-pulse-slow"
             style={{ backgroundColor: 'rgba(3, 165, 192, 0.25)' }} />
      </div>

      {/* Main content */}
      <div className="relative z-10 w-full max-w-4xl px-4 sm:px-6 text-center mt-8 sm:mt-16">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 rounded-full border border-[#4cc9f0] bg-transparent mb-4 sm:mb-6 leading-none cursor-pointer backdrop-blur-sm">
          <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#4cc9f0]" />
          <span className="text-xs sm:text-sm font-light text-[#4cc9f0]">Chat avec Magellan</span>
        </div>

        {/* Main title */}
        <h1 className={`text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-3 sm:mb-4 leading-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
          Crée ton site web en quelques secondes avec l'IA
        </h1>

        {/* Subtitle */}
        <p className={`text-sm sm:text-lg md:text-xl font-light mb-6 sm:mb-10 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
          Décris ton activité en une phrase... l'IA s'occupe du reste.
        </p>

        {/* AI Input Area */}
        <div className="max-w-2xl mx-auto">
          <PromptBar
            inputValue={inputValue}
            setInputValue={setInputValue}
            onSubmit={handleSubmit}
            isLoading={isLoading}
            showPlaceholderAnimation={true}
            attachedFiles={attachedFiles}
            onRemoveFile={removeFile}
            onFileSelect={handleFileSelect}
            projectType={projectType}
            onProjectTypeChange={setProjectType}
          />
        </div>
      </div>

    </div>
  );
};

export default AISearchHero;
