import { Sparkles, ArrowUp, Paperclip, Save, User } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import TextType from '@/components/ui/TextType';
import RippleGrid from '@/components/ui/RippleGrid';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { useNavigate } from 'react-router-dom';
import { toast as sonnerToast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const AISearchHero = () => {
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [generatedHtml, setGeneratedHtml] = useState('');
  const [messages, setMessages] = useState<Array<{role: 'user' | 'assistant', content: string}>>([]);
  const [user, setUser] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [websiteTitle, setWebsiteTitle] = useState('');
  const { toast } = useToast();
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
      toast({
        title: "Erreur",
        description: "Veuillez entrer votre message",
        variant: "destructive",
      });
      return;
    }

    const userMessage = inputValue;
    const newMessages = [...messages, { role: 'user' as const, content: userMessage }];
    setMessages(newMessages);
    setInputValue('');
    setIsLoading(true);

    try {
      console.log('Envoi des messages à OpenRouter:', newMessages);
      
      const { data, error } = await supabase.functions.invoke('mistral-chat', {
        body: { messages: newMessages }
      });

      if (error) {
        console.error('Erreur Edge Function:', error);
        throw error;
      }

      console.log('Réponse reçue:', data);
      
      if (data?.response) {
        const aiResponse = data.response;
        setGeneratedHtml(aiResponse);
        setMessages([...newMessages, { role: 'assistant', content: aiResponse }]);
        
        if (!generatedHtml) {
          toast({
            title: "Site généré !",
            description: "Votre site web a été créé. Vous pouvez maintenant le modifier via le chat.",
          });
        } else {
          toast({
            title: "Modifications appliquées !",
            description: "Le site a été mis à jour selon vos demandes.",
          });
        }
      }
    } catch (error) {
      console.error('Erreur lors de l\'appel à OpenRouter:', error);
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Une erreur est survenue",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user) {
      navigate('/auth');
      return;
    }

    setShowSaveDialog(true);
  };

  const confirmSave = async () => {
    if (!websiteTitle.trim()) {
      sonnerToast.error("Veuillez entrer un titre pour votre site");
      return;
    }

    setIsSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke('deploy-to-cloudflare', {
        body: { 
          htmlContent: generatedHtml,
          title: websiteTitle 
        }
      });

      if (error) throw error;

      sonnerToast.success(`Site enregistré et déployé sur Cloudflare !`, {
        description: `URL: ${data.url}`,
        duration: 5000,
      });

      setShowSaveDialog(false);
      setWebsiteTitle('');
      
      // Rediriger vers le dashboard après 2 secondes
      setTimeout(() => {
        navigate('/dashboard');
      }, 2000);
    } catch (error: any) {
      console.error('Erreur lors de la sauvegarde:', error);
      sonnerToast.error(error.message || "Erreur lors de la sauvegarde du site");
    } finally {
      setIsSaving(false);
    }
  };

  if (generatedHtml) {
    return (
      <div className="h-screen pt-16">
        {/* Barre d'action en haut */}
        <div className="absolute top-16 right-4 z-50 flex gap-2">
          <Button
            onClick={() => navigate('/dashboard')}
            variant="outline"
            className="bg-white/90 backdrop-blur-sm"
          >
            <User className="w-4 h-4 mr-2" />
            {user ? 'Dashboard' : 'Connexion'}
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700"
          >
            <Save className="w-4 h-4 mr-2" />
            {isSaving ? 'Enregistrement...' : 'Enregistrer'}
          </Button>
        </div>

        <ResizablePanelGroup direction="horizontal" className="h-full">
          <ResizablePanel defaultSize={30} minSize={25}>
            <div className="h-full flex flex-col bg-slate-50">
              {/* Chat history */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {messages.map((msg, idx) => (
                  <div key={idx} className={`p-4 rounded-lg ${msg.role === 'user' ? 'bg-white border border-slate-200 ml-4' : 'bg-gradient-to-br from-blue-50 to-cyan-50 border border-blue-100 mr-4'}`}>
                    <p className="text-xs font-semibold text-slate-500 mb-2">
                      {msg.role === 'user' ? '👤 Vous' : '🤖 Mistral AI'}
                    </p>
                    {msg.role === 'user' ? (
                      <p className="text-sm text-slate-700">{msg.content}</p>
                    ) : (
                      <p className="text-xs text-slate-500 font-mono">HTML généré/modifié</p>
                    )}
                  </div>
                ))}
              </div>
              
              {/* Chat input */}
              <div className="border-t border-slate-200 p-4 bg-white">
                <div className="flex gap-2">
                  <Textarea
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSubmit();
                      }
                    }}
                    placeholder="Demandez des modifications..."
                    className="min-h-[60px] resize-none text-sm"
                    disabled={isLoading}
                  />
                  <Button
                    onClick={handleSubmit}
                    disabled={isLoading}
                    className="self-end"
                    style={{ backgroundColor: '#014AAD' }}
                  >
                    <ArrowUp className="w-5 h-5" />
                  </Button>
                </div>
              </div>
            </div>
          </ResizablePanel>
          
          <ResizableHandle withHandle />
          
          <ResizablePanel defaultSize={70}>
            <div className="h-full w-full bg-white">
              <iframe 
                srcDoc={generatedHtml}
                className="w-full h-full border-0"
                title="Site web généré"
                sandbox="allow-same-origin allow-scripts"
              />
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>

        {/* Dialog pour sauvegarder */}
        <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Enregistrer votre site</DialogTitle>
              <DialogDescription>
                Votre site sera déployé sur Cloudflare et enregistré dans votre dashboard
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="title">Titre du site</Label>
                <Input
                  id="title"
                  placeholder="Mon super site web"
                  value={websiteTitle}
                  onChange={(e) => setWebsiteTitle(e.target.value)}
                  disabled={isSaving}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowSaveDialog(false)}
                disabled={isSaving}
              >
                Annuler
              </Button>
              <Button
                onClick={confirmSave}
                disabled={isSaving}
                className="bg-gradient-to-r from-blue-600 to-cyan-600"
              >
                {isSaving ? 'Déploiement...' : 'Enregistrer et déployer'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-white pt-20">
      {/* RippleGrid Background */}
      <div className="absolute inset-0">
        <RippleGrid
          enableRainbow={false}
          gridColor="#5BE0E5"
          rippleIntensity={0.02}
          gridSize={22}
          gridThickness={13}
          fadeDistance={1.2}
          vignetteStrength={5}
          glowIntensity={1}
          mouseInteraction={true}
          mouseInteractionRadius={2.5}
          opacity={1}
        />
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
