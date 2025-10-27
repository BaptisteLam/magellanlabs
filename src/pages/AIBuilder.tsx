import { Sparkles, ArrowUp, Paperclip } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import TextType from '@/components/ui/TextType';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { toast as sonnerToast } from 'sonner';
import trinityLogoLoading from '@/assets/trinity-logo-loading.png';

const AIBuilder = () => {
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
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

  const handleSubmit = async () => {
    if (!inputValue.trim()) {
      sonnerToast.error("Veuillez entrer votre message");
      return;
    }

    setIsLoading(true);

    try {
      // Créer une nouvelle session
      const { data: sessionData, error: sessionError } = await supabase
        .from('build_sessions')
        .insert({
          user_id: user?.id || null,
          messages: [{ role: 'user', content: inputValue }],
          project_files: [],
        })
        .select()
        .single();

      if (sessionError) throw sessionError;

      // Appeler l'IA
      const messages = [{ role: 'user', content: inputValue }];
      const { data, error } = await supabase.functions.invoke('claude', {
        body: { messages }
      });

      if (error) throw error;

      if (data?.response) {
        // Mettre à jour la session avec le HTML généré
        const filesArray = [{ path: 'index.html', content: data.response, type: 'html' }];
        await supabase
          .from('build_sessions')
          .update({
            project_files: filesArray,
            messages: [
              { role: 'user', content: inputValue },
              { role: 'assistant', content: data.response }
            ]
          })
          .eq('id', sessionData.id);

        // Rediriger vers la session
        navigate(`/builder/${sessionData.id}`);
      }
    } catch (error) {
      console.error('Error:', error);
      sonnerToast.error(error instanceof Error ? error.message : "Une erreur est survenue");
      setIsLoading(false);
    }
  };

  // État de chargement
  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <div className="flex-1 flex flex-col items-center justify-center bg-white relative overflow-hidden">
          <div 
            className="absolute inset-0 animate-scroll-down" 
            style={{ 
              backgroundImage: 'linear-gradient(rgba(148, 163, 184, 0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(148, 163, 184, 0.15) 1px, transparent 1px)',
              backgroundSize: '80px 80px'
            }} 
          />
          
          <img 
            src={trinityLogoLoading} 
            alt="Loading" 
            className="w-20 h-20 mb-12 relative z-10 -mt-32"
            style={{ 
              animation: 'spin 2s linear infinite'
            }}
          />
          <div className="w-64 h-1 bg-slate-200 rounded-full overflow-hidden relative z-10">
            <div 
              className="h-full rounded-full"
              style={{ 
                backgroundColor: '#5BE0E5',
                animation: 'loadProgress 20s linear forwards'
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-white">
      {/* Grid background */}
      <div className="absolute inset-0" 
           style={{ 
             backgroundImage: 'linear-gradient(rgba(148, 163, 184, 0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(148, 163, 184, 0.15) 1px, transparent 1px)',
             backgroundSize: '80px 80px'
           }} 
      />
      
      {/* Glows */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[800px] h-[800px] rounded-full blur-[150px] animate-pulse-slow" 
             style={{ backgroundColor: 'rgba(91, 224, 229, 0.3)' }} />
        <div className="absolute bottom-0 right-1/4 w-[800px] h-[800px] rounded-full blur-[150px] animate-pulse-slower" 
             style={{ backgroundColor: 'rgba(3, 165, 192, 0.3)' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full blur-[120px] animate-pulse" 
             style={{ backgroundColor: 'rgba(91, 224, 229, 0.25)' }} />
        <div className="absolute top-1/3 right-1/3 w-[700px] h-[700px] rounded-full blur-[140px] animate-pulse-slow" 
             style={{ backgroundColor: 'rgba(3, 165, 192, 0.25)' }} />
      </div>

      {/* Main content */}
      <div className="relative z-10 w-full max-w-4xl px-4 text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border backdrop-blur-sm mb-6"
             style={{ borderColor: 'rgba(1, 74, 173, 0.3)', backgroundColor: 'rgba(1, 74, 173, 0.1)' }}>
          <Sparkles className="w-4 h-4" style={{ color: '#014AAD' }} />
          <span className="text-sm font-light" style={{ color: '#014AAD' }}>Propulsé par Claude AI</span>
        </div>

        {/* Main title */}
        <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4 leading-tight">
          Crée ton site web en quelques secondes avec l'IA
        </h1>

        {/* Subtitle */}
        <p className="text-lg md:text-xl text-slate-600 font-light mb-10">
          Décris ton activité en une phrase... l'IA s'occupe du reste.
        </p>

        {/* AI Input Area */}
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-lg border border-slate-300 shadow-xl p-4">
            <div className="relative">
              <Textarea
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder=""
                className="w-full min-h-[100px] resize-none border-0 p-0 text-sm text-slate-700 placeholder:text-slate-400 focus-visible:ring-0 focus-visible:ring-offset-0"
                style={{ fontSize: '14px' }}
              />
              {!inputValue && (
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
            <div className="flex items-center justify-between mt-3">
              <Button 
                variant="ghost" 
                className="text-sm text-slate-600 hover:text-white hover:bg-[#014AAD] gap-2 transition-colors [&_svg]:hover:text-white"
              >
                <Paperclip className="w-4 h-4" />
                Joindre un fichier
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={isLoading}
                className="w-10 h-10 rounded-full p-0 transition-all hover:shadow-lg hover:shadow-blue-500/30 disabled:opacity-50"
                style={{ backgroundColor: '#014AAD' }}
              >
                <ArrowUp className="w-5 h-5 text-white" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIBuilder;
