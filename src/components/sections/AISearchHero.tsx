import { Save, Eye, Code2, X, Sparkles, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import { useProjectStore } from '@/stores/projectStore';
import PromptBar from '@/components/PromptBar';
import { Textarea } from '@/components/ui/textarea';

interface AISearchHeroProps {
  onGeneratedChange?: (hasGenerated: boolean) => void;
}

const AISearchHero = ({ onGeneratedChange }: AISearchHeroProps) => {
  const { isDark } = useThemeStore();
  const { setProjectFiles, setGeneratedHtml: setStoreGeneratedHtml } = useProjectStore();
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
  const { toast } = useToast();
  const navigate = useNavigate();

  // Sync local state with store
  useEffect(() => {
    setStoreGeneratedHtml(generatedHtml);
  }, [generatedHtml, setStoreGeneratedHtml]);

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
    if (!inputValue.trim() && attachedFiles.length === 0) {
      sonnerToast.error("Veuillez entrer votre message ou joindre un fichier");
      return;
    }

    // Vérifier si l'utilisateur est connecté
    if (!user) {
      localStorage.setItem('redirectAfterAuth', '/');
      sonnerToast.info("Connectez-vous pour générer votre site");
      navigate('/auth');
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

      // Mode modification incrémentale
      if (generatedHtml) {
        const modificationText = typeof userMessageContent === 'string' 
          ? userMessageContent 
          : (Array.isArray(userMessageContent)
              ? userMessageContent.map(c => c.type === 'text' ? c.text : '[image jointe]').join(' ')
              : String(userMessageContent));

        // Prompt pour modification incrémentale uniquement
        const systemPrompt = `Tu es Claude Sonnet 4.5, expert en modification de code HTML.

RÈGLE CRITIQUE : Tu MODIFIES UNIQUEMENT la partie demandée, pas tout le HTML.

Instructions :
1. Commence par [EXPLANATION]phrase courte expliquant ce que tu modifies[/EXPLANATION]
2. Ensuite, retourne UNIQUEMENT le HTML modifié de la section concernée
3. Utilise Tailwind CDN si nécessaire
4. Garde le même style et structure globale
5. Ne régénère PAS tout le HTML, seulement ce qui change`;

        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/claude-stream`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            system: systemPrompt,
            isModification: true,
            messages: [
              {
                role: 'user',
                content: `HTML actuel:\n${generatedHtml}\n\nModification demandée:\n${modificationText}\n\nRetourne UNIQUEMENT la partie HTML modifiée avec le marqueur [EXPLANATION].`
              }
            ]
          }),
        });

        if (!response.ok) {
          throw new Error(`Erreur API Claude: ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error('Impossible de lire le stream');

        const decoder = new TextDecoder('utf-8');
        let accumulated = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n').filter(Boolean);

          for (const line of lines) {
            if (!line.startsWith('data:')) continue;
            
            const dataStr = line.replace('data:', '').trim();
            if (dataStr === '[DONE]') continue;

            try {
              const json = JSON.parse(dataStr);
              
              if (json.type === 'content_block_delta') {
                const delta = json.delta?.text || '';
                if (!delta) continue;

                accumulated += delta;

                // Afficher explication
                const explanation = accumulated.match(/\[EXPLANATION\]([\s\S]*?)\[\/EXPLANATION\]/);
                if (explanation) {
                  setMessages(prev => {
                    const filtered = prev.filter(m => m.role !== 'assistant');
                    return [...filtered, { role: 'assistant', content: explanation[1].trim() }];
                  });
                }

                // Appliquer modification incrémentale
                const modifiedPart = accumulated.replace(/\[EXPLANATION\][\s\S]*?\[\/EXPLANATION\]/, '').trim();
                if (modifiedPart) {
                  // Intégrer la modification dans le HTML existant
                  setGeneratedHtml(prev => {
                    // Logique simple : remplacer ou ajouter
                    if (modifiedPart.includes('<!DOCTYPE html>')) {
                      return modifiedPart; // Remplacement complet
                    }
                    // Sinon, fusion intelligente (remplacer balises similaires)
                    return prev; // Pour l'instant, garde l'ancien
                  });
                }
              }
            } catch (e) {
              // Ignorer erreurs parsing
            }
          }
        }

        const finalExplanation = accumulated.match(/\[EXPLANATION\]([\s\S]*?)\[\/EXPLANATION\]/);
        const finalModified = accumulated.replace(/\[EXPLANATION\][\s\S]*?\[\/EXPLANATION\]/, '').trim();

        // Appliquer modification finale
        setGeneratedHtml(finalModified.includes('<!DOCTYPE html>') ? finalModified : generatedHtml);
        
        setInputValue('');
        setAttachedFiles([]);
        setIsLoading(false);
        sonnerToast.success("Modification appliquée !");
        return;
      }

      // Première génération (HTML complet)
      const systemPrompt = `Tu es Claude Sonnet 4.5, expert en génération de sites web modernes.
Tu produis un HTML complet, responsive, professionnel.

Règles :
1. Commence toujours par [EXPLANATION]phrase courte[/EXPLANATION].
2. Ensuite, le HTML complet sans markdown.
3. Utilise Tailwind CDN (<script src="https://cdn.tailwindcss.com"></script>)
4. Icônes Lucide inline (pas d'emojis)
5. 4 images maximum (Unsplash/Pexels)
6. Sections : header, hero, features, contact, footer
7. Mobile-first, cohérence visuelle, CTA clair.`;

      const apiMessages: any[] = [];
      
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
                source: { 
                  type: 'base64',
                  media_type: 'image/jpeg',
                  data: item.image_url?.url?.split(',')[1] || ''
                }
              };
            }
            return item;
          })
        });
      }

      // Call Claude API via edge function
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/claude-stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          system: systemPrompt,
          isModification: false,
          messages: apiMessages
        }),
      });

      if (!response.ok) {
        throw new Error(`Erreur API: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('Impossible de lire le stream');

      const decoder = new TextDecoder('utf-8');
      let accumulated = '';

      // STREAMING TEMPS RÉEL (Claude API format)
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(Boolean);

        for (const line of lines) {
          if (!line.startsWith('data:')) continue;
          
          const dataStr = line.replace('data:', '').trim();
          if (dataStr === '[DONE]') continue;

          try {
            const json = JSON.parse(dataStr);
            
            // Format Claude API streaming
            if (json.type === 'content_block_delta') {
              const delta = json.delta?.text || '';
              if (!delta) continue;

              accumulated += delta;

              // Afficher explication dans le chat
              const explanation = accumulated.match(/\[EXPLANATION\]([\s\S]*?)\[\/EXPLANATION\]/);
              if (explanation) {
                setMessages(prev => {
                  const filtered = prev.filter(m => m.role !== 'assistant');
                  return [...filtered, { role: 'assistant', content: explanation[1].trim() }];
                });
              }

              // HTML live (instantané)
              const htmlPreview = accumulated.replace(/\[EXPLANATION\][\s\S]*?\[\/EXPLANATION\]/, '').trim();
              if (htmlPreview.startsWith('<!DOCTYPE html>') || htmlPreview.startsWith('<html')) {
                setGeneratedHtml(htmlPreview);
              }
            }
          } catch (e) {
            // Ignorer erreurs parsing partiel
          }
        }
      }

      // Finaliser
      const explanation = accumulated.match(/\[EXPLANATION\]([\s\S]*?)\[\/EXPLANATION\]/);
      const finalHtml = accumulated.replace(/\[EXPLANATION\][\s\S]*?\[\/EXPLANATION\]/, '').trim();

      // Créer la session (avec ou sans utilisateur connecté)
      const projectFiles = [
        {
          path: 'index.html',
          content: finalHtml,
          type: 'html'
        }
      ];

      // Update store with generated files
      setProjectFiles(projectFiles);

      const { data: sessionData, error: sessionError } = await supabase
        .from('build_sessions')
        .insert({
          user_id: user?.id || null,
          project_files: projectFiles,
          messages: [
            { role: 'user', content: userMessageContent },
            { role: 'assistant', content: explanation }
          ],
          title: 'Nouveau projet'
        })
        .select()
        .single();

      if (sessionError) {
        console.error('Session creation error:', sessionError);
        sonnerToast.error("Erreur lors de la création de la session");
        setIsLoading(false);
        return;
      }

      // Générer automatiquement le screenshot
      if (finalHtml && sessionData?.id) {
        try {
          await supabase.functions.invoke('generate-screenshot', {
            body: {
              projectId: sessionData.id,
              htmlContent: finalHtml,
              table: 'build_sessions'
            }
          });
          console.log('Screenshot generation started');
        } catch (screenshotError) {
          console.error('Error generating screenshot:', screenshotError);
          // Ne pas bloquer la création du site si le screenshot échoue
        }
      }

      setInputValue('');
      setAttachedFiles([]);
      setIsLoading(false);
      
      if (onGeneratedChange) {
        onGeneratedChange(true);
      }

      sonnerToast.success("Site généré !");
      
      // Rediriger vers la page de l'éditeur
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

  const handleDownload = async () => {
    try {
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();

      // Ajouter le fichier HTML
      zip.file('index.html', generatedHtml);

      // Générer le ZIP
      const blob = await zip.generateAsync({ type: 'blob' });

      // Créer un lien de téléchargement
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'magellan-site.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      sonnerToast.success('Site téléchargé avec succès !');
    } catch (error) {
      console.error('Erreur lors du téléchargement:', error);
      sonnerToast.error('Erreur lors du téléchargement');
    }
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
                  <div key={idx}>
                    {msg.role === 'user' ? (
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 w-7 h-7 rounded-full bg-[#03A5C0] flex items-center justify-center">
                          <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
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
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500 font-mono">HTML généré/modifié</p>
                    )}
                  </div>
                ))}
              </div>
              
              {/* Chat input */}
              <div className="border-t border-slate-200 p-4 bg-white">
                <PromptBar
                  inputValue={inputValue}
                  setInputValue={setInputValue}
                  onSubmit={handleSubmit}
                  isLoading={isLoading}
                  showPlaceholderAnimation={false}
                  showConfigButtons={false}
                  attachedFiles={attachedFiles}
                  onRemoveFile={removeFile}
                  onFileSelect={handleFileSelect}
                />
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
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20" style={{ backgroundColor: isDark ? '#1F1F20' : '#ffffff' }}>
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
             style={{ borderColor: 'rgba(59, 130, 246, 0.3)', backgroundColor: 'rgba(59, 130, 246, 0.1)' }}>
          <Sparkles className="w-4 h-4" style={{ color: '#3B82F6' }} />
          <span className="text-sm font-light" style={{ color: '#3B82F6' }}>Chat avec Magellan</span>
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
          <PromptBar
            inputValue={inputValue}
            setInputValue={setInputValue}
            onSubmit={handleSubmit}
            isLoading={isLoading}
            showPlaceholderAnimation={true}
            attachedFiles={attachedFiles}
            onRemoveFile={removeFile}
            onFileSelect={handleFileSelect}
          />
        </div>
      </div>
    </div>
  );
};

export default AISearchHero;
