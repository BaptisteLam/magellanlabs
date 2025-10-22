import { Sparkles, ArrowUp, Paperclip } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import TextType from '@/components/ui/TextType';
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';

const AISearchHero = () => {
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [generatedHtml, setGeneratedHtml] = useState('');
  const [messages, setMessages] = useState<Array<{role: 'user' | 'assistant', content: string}>>([]);
  const { toast } = useToast();

  const handleSubmit = async () => {
    if (!inputValue.trim()) {
      toast({
        title: "Erreur",
        description: "Veuillez entrer une description de votre activité",
        variant: "destructive",
      });
      return;
    }

    const userMessage = inputValue;
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setInputValue('');
    setIsLoading(true);

    try {
      console.log('Envoi du prompt à l\'IA:', userMessage);
      
      const { data, error } = await supabase.functions.invoke('mistral-chat', {
        body: { prompt: userMessage }
      });

      if (error) {
        console.error('Erreur Edge Function:', error);
        throw error;
      }

      console.log('Réponse reçue:', data);
      
      if (data?.response) {
        setGeneratedHtml(data.response);
        setMessages(prev => [...prev, { role: 'assistant', content: 'Très bien, je crée votre site web !' }]);
        toast({
          title: "Site généré !",
          description: "Votre site web a été créé avec succès",
        });
      }
    } catch (error) {
      console.error('Erreur lors de l\'appel à l\'IA:', error);
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Une erreur est survenue",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (generatedHtml) {
    return (
      <div className="h-screen pt-16">
        <ResizablePanelGroup direction="horizontal" className="h-full">
          <ResizablePanel defaultSize={25} minSize={20}>
            <div className="h-full overflow-y-auto bg-slate-50 p-6">
              <div className="space-y-4">
                {messages.map((msg, idx) => (
                  <div key={idx} className={`p-3 rounded-lg ${msg.role === 'user' ? 'bg-white border border-slate-200' : 'bg-blue-50 border border-blue-100'}`}>
                    <p className="text-sm font-medium text-slate-700 mb-1">
                      {msg.role === 'user' ? 'Vous' : 'Assistant IA'}
                    </p>
                    <p className="text-sm text-slate-600">{msg.content}</p>
                  </div>
                ))}
              </div>
            </div>
          </ResizablePanel>
          
          <ResizableHandle withHandle />
          
          <ResizablePanel defaultSize={75}>
            <div className="h-full w-full">
              <iframe 
                srcDoc={generatedHtml}
                className="w-full h-full border-0"
                title="Site web généré"
                sandbox="allow-same-origin allow-scripts"
              />
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-white pt-20">
      {/* Grid background - large squares, light gray */}
      <div className="absolute inset-0" 
           style={{ 
             backgroundImage: 'linear-gradient(rgba(148, 163, 184, 0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(148, 163, 184, 0.15) 1px, transparent 1px)',
             backgroundSize: '80px 80px'
           }} 
      />
      {/* Large cyan and teal glows with animation */}
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
      <div className="relative z-10 w-full max-w-4xl px-4 text-center -mt-64">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border backdrop-blur-sm mb-6"
             style={{ borderColor: 'rgba(1, 74, 173, 0.3)', backgroundColor: 'rgba(1, 74, 173, 0.1)' }}>
          <Sparkles className="w-4 h-4" style={{ color: '#014AAD' }} />
          <span className="text-sm font-light" style={{ color: '#014AAD' }}>Propulsé par Mistral AI</span>
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

export default AISearchHero;
