import { Sparkles, ArrowUp, Paperclip, Save, User, Eye, Code2, X } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import TextType from '@/components/ui/TextType';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { useNavigate } from 'react-router-dom';
import { toast as sonnerToast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import trinityLogoLoading from '@/assets/trinity-logo-loading.png';
import { useThemeStore } from '@/stores/themeStore';

interface AISearchHeroProps {
  onGeneratedChange?: (hasGenerated: boolean) => void;
}

const AISearchHero = ({ onGeneratedChange }: AISearchHeroProps) => {
  const { isDark } = useThemeStore();
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [generatedHtml, setGeneratedHtml] = useState('');
  const [messages, setMessages] = useState<Array<{role: 'user' | 'assistant', content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>}>>([]);
  const [user, setUser] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [websiteTitle, setWebsiteTitle] = useState('');
  const [viewMode, setViewMode] = useState<'preview' | 'code'>('preview');
  const [attachedFiles, setAttachedFiles] = useState<Array<{ name: string; base64: string; type: string }>>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

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
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeFile = (index: number) => {
    setAttachedFiles(attachedFiles.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!inputValue.trim() && attachedFiles.length === 0) {
      sonnerToast.error("Veuillez entrer votre message ou joindre un fichier");
      return;
    }

    setIsLoading(true);

    try {
      // Construire le message avec texte et images
      let userMessageContent: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
      
      if (attachedFiles.length > 0) {
        const contentArray: Array<{ type: string; text?: string; image_url?: { url: string } }> = [];
        if (inputValue.trim()) {
          contentArray.push({ type: 'text', text: inputValue });
        }
        attachedFiles.forEach(file => {
          contentArray.push({ 
            type: 'image_url', 
            image_url: { url: file.base64 }
          });
        });
        userMessageContent = contentArray;
      } else {
        userMessageContent = inputValue;
      }

      // Prompt système
      const systemPrompt = `Tu es un expert en création de sites web complets. Format: [EXPLANATION]explication courte[/EXPLANATION] suivi d'un JSON valide:
{"index.html":"<!DOCTYPE html>...","style.css":"...","script.js":"...","pages/about.html":"..."}

RÈGLES:
- JSON valide sans markdown
- Chaque HTML complet avec <!DOCTYPE>
- Liens entre fichiers: <link rel="stylesheet" href="/style.css">
- Images: unsplash.com ou SVG inline
- Design responsive et moderne`;

      // Format correct pour OpenRouter
      const apiMessages: any[] = [
        { role: 'system', content: systemPrompt }
      ];

      if (generatedHtml) {
        // Mode modification : texte uniquement, limité à 5000 tokens
        const modificationText = typeof userMessageContent === 'string' 
          ? userMessageContent 
          : (Array.isArray(userMessageContent)
              ? userMessageContent.map(c => c.type === 'text' ? c.text : '[image]').join(' ')
              : String(userMessageContent));
        
        apiMessages.push({
          role: 'user',
          content: `Structure actuelle:\n${generatedHtml.substring(0, 3000)}\n\nModification: ${modificationText}`
        });
      } else {
        // Première génération - format OpenRouter multimodal
        if (typeof userMessageContent === 'string') {
          apiMessages.push({
            role: 'user',
            content: userMessageContent
          });
        } else if (Array.isArray(userMessageContent)) {
          apiMessages.push({
            role: 'user',
            content: userMessageContent.map(item => {
              if (item.type === 'text') {
                return { type: 'text', text: item.text };
              } else if (item.type === 'image_url') {
                return { 
                  type: 'image_url', 
                  image_url: { url: item.image_url?.url || '' }
                };
              }
              return item;
            })
          });
        }
      }

      // Récupérer la clé API
      const { data: secretData } = await supabase.functions.invoke('get-openrouter-key');
      const OPENROUTER_API_KEY = secretData?.key;

      if (!OPENROUTER_API_KEY) {
        throw new Error('Clé API OpenRouter non configurée');
      }

      // Appeler OpenRouter en streaming avec limite de tokens
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': window.location.origin,
        },
        body: JSON.stringify({
          model: 'anthropic/claude-sonnet-4-5',
          messages: apiMessages,
          max_tokens: generatedHtml ? 5000 : 10000, // Limite pour modifications
          stream: true,
        }),
      });

      if (!response.ok) {
        throw new Error(`Erreur API: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('Impossible de lire le stream');

      const decoder = new TextDecoder();
      let accumulatedHtml = '';
      let currentExplanation = '';

      // STREAMING EN TEMPS RÉEL avec extraction d'explication
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content || '';
              
              if (content) {
                accumulatedHtml += content;
                
                // Extraire l'explication en temps réel
                const explanationMatch = accumulatedHtml.match(/\[EXPLANATION\](.*?)(?:\[\/EXPLANATION\]|$)/s);
                if (explanationMatch) {
                  currentExplanation = explanationMatch[1].trim();
                }
                
                // Parser et afficher JSON en temps réel
                const jsonOnly = accumulatedHtml.replace(/\[EXPLANATION\].*?\[\/EXPLANATION\]/s, '').trim();
                if (jsonOnly.startsWith('{')) {
                  try {
                    JSON.parse(jsonOnly); // Vérifier validité
                    setGeneratedHtml(jsonOnly);
                  } catch {
                    // JSON incomplet
                  }
                }
              }
            } catch (e) {
              // Ignorer les erreurs de parsing JSON partiel
            }
          }
        }
      }

      // Extraire explication et parser JSON final
      const explanationMatch = accumulatedHtml.match(/\[EXPLANATION\](.*?)\[\/EXPLANATION\]/s);
      const explanation = explanationMatch ? explanationMatch[1].trim() : "Site généré";
      const finalJson = accumulatedHtml.replace(/\[EXPLANATION\].*?\[\/EXPLANATION\]/s, '').trim();

      // Parser les fichiers finaux
      let finalFiles = {};
      try {
        const parsedData = JSON.parse(finalJson);
        finalFiles = parsedData.files || parsedData;
      } catch (e) {
        console.error('Erreur parsing JSON:', e);
        // Fallback: créer un fichier index.html avec le contenu brut
        finalFiles = { 'index.html': finalJson };
      }

      // Sauvegarder la session avec structure de fichiers
      const { data: sessionData, error: sessionError } = await supabase
        .from('build_sessions')
        .insert({
          user_id: user?.id || null,
          html_content: JSON.stringify(finalFiles),
          messages: [
            { role: 'user', content: userMessageContent },
            { role: 'assistant', content: explanation }
          ]
        })
        .select()
        .single();

      if (sessionError) throw sessionError;

      setInputValue('');
      setAttachedFiles([]);
      setIsLoading(false);
      
      if (onGeneratedChange) {
        onGeneratedChange(true);
      }

      sonnerToast.success("Site généré !");
      
      // Rediriger uniquement après que tout soit terminé
      setTimeout(() => navigate(`/builder/${sessionData.id}`), 500);
    } catch (error) {
      console.error('Error:', error);
      sonnerToast.error(error instanceof Error ? error.message : "Une erreur est survenue");
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

  // État de chargement
  if (isLoading && !generatedHtml) {
    return (
      <div className="min-h-screen flex flex-col">
        <div className="flex-1 flex flex-col items-center justify-center bg-white relative overflow-hidden">
          {/* Grid background animé */}
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

  if (generatedHtml) {
    return (
      <div className="h-screen">
        {/* Barre d'outils discrète */}
        <div className="h-10 bg-slate-50/80 backdrop-blur-sm border-b border-slate-200 flex items-center justify-end px-4 gap-3">
          <Button
            onClick={handleSave}
            disabled={isSaving}
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
          >
            <Save className="w-3.5 h-3.5 mr-1.5" />
            Enregistrer
          </Button>
          
          <div className="h-5 w-px bg-slate-300" />
          
          <div className="flex items-center gap-1 bg-white rounded-md border border-slate-200 p-0.5">
            <Button
              variant={viewMode === 'preview' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => setViewMode('preview')}
            >
              <Eye className="w-3 h-3 mr-1" />
              Preview
            </Button>
            <Button
              variant={viewMode === 'code' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => setViewMode('code')}
            >
              <Code2 className="w-3 h-3 mr-1" />
              Code
            </Button>
          </div>
        </div>

        <ResizablePanelGroup direction="horizontal" className="h-[calc(100vh-2.5rem)]">
          <ResizablePanel defaultSize={30} minSize={25}>
            <div className="h-full flex flex-col bg-slate-50">
              {/* Chat history */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {messages.map((msg, idx) => (
                  <div key={idx} className={`p-4 rounded-lg ${msg.role === 'user' ? 'bg-white border border-slate-200 ml-4' : 'bg-gradient-to-br from-blue-50 to-cyan-50 border border-blue-100 mr-4'}`}>
                    <p className="text-xs font-semibold text-slate-500 mb-2">
                      {msg.role === 'user' ? 'Vous' : 'Trinity'}
                    </p>
                    {msg.role === 'user' ? (
                      <div>
                        {typeof msg.content === 'string' ? (
                          <p className="text-sm text-slate-700">{msg.content}</p>
                        ) : (
                          <div className="space-y-2">
                            {msg.content.map((item, i) => (
                              item.type === 'text' ? (
                                <p key={i} className="text-sm text-slate-700">{item.text}</p>
                              ) : (
                                <img key={i} src={item.image_url?.url} alt="Attaché" className="max-w-[200px] rounded border" />
                              )
                            ))}
                          </div>
                        )}
                      </div>
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
            <div className="h-full w-full bg-white flex flex-col">
              {viewMode === 'preview' ? (
                <iframe 
                  srcDoc={generatedHtml}
                  className="w-full h-full border-0"
                  title="Site web généré"
                  sandbox="allow-same-origin allow-scripts"
                />
              ) : (
                <div className="h-full w-full flex flex-col">
                  {/* Toolbar for code view */}
                  <div className="bg-slate-800 border-b border-slate-700 px-4 py-2 flex items-center gap-2">
                    <span className="text-xs text-slate-300 font-mono">index.html</span>
                    <span className="text-xs text-slate-500">({generatedHtml.length} caractères)</span>
                  </div>
                  {/* Code content with line numbers */}
                  <div className="flex-1 overflow-auto bg-slate-900">
                    <div className="flex">
                      {/* Line numbers */}
                      <div className="bg-slate-800 px-3 py-4 text-right select-none">
                        {generatedHtml.split('\n').map((_, i) => (
                          <div key={i} className="text-xs text-slate-500 leading-6 font-mono">
                            {i + 1}
                          </div>
                        ))}
                      </div>
                      {/* Code content */}
                      <pre className="flex-1 p-4 text-xs text-slate-100 font-mono overflow-x-auto">
                        <code>{generatedHtml}</code>
                      </pre>
                    </div>
                  </div>
                </div>
              )}
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
    <div className={`relative min-h-screen flex items-center justify-center overflow-hidden pt-20 ${isDark ? 'bg-slate-900' : 'bg-white'}`}>
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
          <span className="text-sm font-light" style={{ color: '#014AAD' }}>Propulsé par Claude AI</span>
        </div>

        {/* Main title */}
        <h1 className={`text-4xl md:text-5xl font-bold mb-4 leading-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
          Crée ton site web en quelques secondes avec l'IA
        </h1>

        {/* Subtitle */}
        <p className={`text-lg md:text-xl font-light mb-10 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
          Décris ton activité en une phrase... l'IA s'occupe du reste.
        </p>

        {/* AI Input Area */}
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-lg border border-slate-300 shadow-xl p-4">
            {/* Fichiers attachés */}
            {attachedFiles.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-2">
                {attachedFiles.map((file, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-md px-3 py-1.5">
                    <span className="text-xs text-blue-700 truncate max-w-[150px]">{file.name}</span>
                    <button
                      onClick={() => removeFile(idx)}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      <X className="w-3 h-3" />
                    </button>
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
                    handleSubmit();
                  }
                }}
                placeholder=""
                className="w-full min-h-[100px] resize-none border-0 p-0 text-sm text-slate-700 placeholder:text-slate-400 focus-visible:ring-0 focus-visible:ring-offset-0"
                style={{ fontSize: '14px' }}
                disabled={isLoading}
              />
              {!inputValue && attachedFiles.length === 0 && (
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
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileSelect}
                className="hidden"
                disabled={isLoading}
              />
              <Button 
                variant="ghost" 
                className="text-sm text-slate-600 hover:text-white hover:bg-[#014AAD] gap-2 transition-colors [&_svg]:hover:text-white"
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading}
              >
                <Paperclip className="w-4 h-4" />
                Joindre une image
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
