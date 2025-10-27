import { useEffect, useState, useRef, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { ArrowUp, Save, Eye, Code2, Home, Paperclip, X, Moon, Sun, Pencil } from "lucide-react";
import TextType from "@/components/ui/TextType";
import { useThemeStore } from '@/stores/themeStore';
import { toast as sonnerToast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Message {
  role: 'user' | 'assistant';
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
}

export default function BuilderSession() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { isDark, toggleTheme } = useThemeStore();
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [generatedHtml, setGeneratedHtml] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [user, setUser] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [websiteTitle, setWebsiteTitle] = useState('');
  const [viewMode, setViewMode] = useState<'preview' | 'code'>('preview');
  const [sessionLoading, setSessionLoading] = useState(true);
  const [attachedFiles, setAttachedFiles] = useState<Array<{ name: string; base64: string; type: string }>>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [codeTab, setCodeTab] = useState<'html' | 'css' | 'js'>('html');
  const [isPublishing, setIsPublishing] = useState(false);

  // Extraire CSS et JS du HTML généré (mémorisé pour performance)
  const extractedCode = useMemo(() => ({
    html: generatedHtml,
    css: (() => {
      const styleMatch = generatedHtml.match(/<style[^>]*>([\s\S]*?)<\/style>/gi);
      return styleMatch ? styleMatch.map(s => s.replace(/<\/?style[^>]*>/gi, '')).join('\n\n') : '/* Aucun CSS trouvé */';
    })(),
    js: (() => {
      const scriptMatch = generatedHtml.match(/<script[^>]*>([\s\S]*?)<\/script>/gi);
      return scriptMatch ? scriptMatch.map(s => s.replace(/<\/?script[^>]*>/gi, '')).join('\n\n') : '// Aucun JavaScript trouvé';
    })()
  }), [generatedHtml]);

  useEffect(() => {
    loadSession();
    checkAuth();
  }, [sessionId]);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    setUser(session?.user ?? null);
  };

  const loadSession = async () => {
    if (!sessionId) return;

    try {
      const { data, error } = await supabase
        .from('build_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (error) {
        console.error('Error loading session:', error);
        sonnerToast.error("Session introuvable");
        navigate('/builder');
        return;
      }

      if (data) {
        setGeneratedHtml(data.html_content || '');
        const parsedMessages = Array.isArray(data.messages) ? data.messages as any[] : [];
        setMessages(parsedMessages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })));
        setWebsiteTitle(data.title || '');
      }
    } catch (error) {
      console.error('Error loading session:', error);
    } finally {
      setSessionLoading(false);
    }
  };

  const saveSession = async () => {
    if (!sessionId) return;

    try {
      const { error } = await supabase
        .from('build_sessions')
        .update({
          html_content: generatedHtml,
          messages: messages as any,
          title: websiteTitle,
          updated_at: new Date().toISOString()
        })
        .eq('id', sessionId);

      if (error) throw error;
    } catch (error) {
      console.error('Error saving session:', error);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newFiles: Array<{ name: string; base64: string; type: string }> = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      // Vérifier que c'est une image
      if (!file.type.startsWith('image/')) {
        sonnerToast.error(`${file.name} n'est pas une image`);
        continue;
      }

      // Convertir en base64
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

    const newMessages = [...messages, { role: 'user' as const, content: userMessageContent }];
    setMessages(newMessages);
    setInputValue('');
    setAttachedFiles([]);
    setIsLoading(true);

    try {
      // Prompt système optimisé
      const systemPrompt = `Génère un site web HTML complet, responsive avec Tailwind CSS. Format: [EXPLANATION]courte explication[/EXPLANATION]<!DOCTYPE html>...`;

      // OPTIMISATION TOKENS : Envoyer seulement le dernier HTML + nouvelle demande
      const apiMessages: any[] = [
        { role: 'system', content: systemPrompt }
      ];

      if (generatedHtml) {
        const modificationPrompt = typeof userMessageContent === 'string' 
          ? userMessageContent 
          : userMessageContent.map(c => c.text || '[image]').join(' ');
        
        apiMessages.push({
          role: 'user',
          content: `HTML actuel:\n${generatedHtml}\n\nModification: ${modificationPrompt}`
        });
      } else {
        apiMessages.push({
          role: 'user',
          content: userMessageContent
        });
      }

      // Récupérer la clé API
      const { data: secretData } = await supabase.functions.invoke('get-openrouter-key');
      const OPENROUTER_API_KEY = secretData?.key;

      if (!OPENROUTER_API_KEY) {
        throw new Error('Clé API OpenRouter non configurée');
      }

      // Streaming OpenRouter
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

      // Streaming en temps réel
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
                
                // Mise à jour immédiate du HTML
                const htmlOnly = accumulatedHtml.replace(/\[EXPLANATION\].*?\[\/EXPLANATION\]/s, '').trim();
                if (htmlOnly) {
                  setGeneratedHtml(htmlOnly);
                }
              }
            } catch (e) {
              // Ignorer les erreurs de parsing JSON partiel
            }
          }
        }
      }

      // Extraire l'explication finale
      const explanationMatch = accumulatedHtml.match(/\[EXPLANATION\](.*?)\[\/EXPLANATION\]/s);
      const explanation = explanationMatch ? explanationMatch[1].trim() : "Site modifié";
      const finalHtml = accumulatedHtml.replace(/\[EXPLANATION\].*?\[\/EXPLANATION\]/s, '').trim();
      
      setGeneratedHtml(finalHtml);
      const updatedMessages = [...newMessages, { role: 'assistant' as const, content: explanation }];
      setMessages(updatedMessages);

      // Auto-save session
      await supabase
        .from('build_sessions')
        .update({
          html_content: finalHtml,
          messages: updatedMessages as any,
          updated_at: new Date().toISOString()
        })
        .eq('id', sessionId);

      sonnerToast.success(messages.length > 0 ? "Modifications appliquées !" : "Site généré !");
    } catch (error) {
      console.error('Error:', error);
      sonnerToast.error(error instanceof Error ? error.message : "Une erreur est survenue");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user) {
      // Sauvegarder la session actuelle dans localStorage pour y revenir après connexion
      localStorage.setItem('redirectAfterAuth', `/builder/${sessionId}`);
      navigate('/auth');
      return;
    }

    // Si le projet a déjà un titre, enregistrer directement sans dialogue
    if (websiteTitle.trim()) {
      setIsSaving(true);
      try {
        await saveSession();
        sonnerToast.success("Projet enregistré !");
      } catch (error: any) {
        console.error('Error saving:', error);
        sonnerToast.error(error.message || "Erreur lors de la sauvegarde");
      } finally {
        setIsSaving(false);
      }
      return;
    }

    // Sinon, afficher le dialogue pour un nouveau projet
    setShowSaveDialog(true);
  };

  const confirmSave = async () => {
    if (!websiteTitle.trim()) {
      sonnerToast.error("Veuillez entrer un titre pour votre site");
      return;
    }

    setIsSaving(true);
    try {
      await saveSession();
      sonnerToast.success("Projet enregistré !");
      setShowSaveDialog(false);
    } catch (error: any) {
      console.error('Error saving:', error);
      sonnerToast.error(error.message || "Erreur lors de la sauvegarde");
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!user) {
      localStorage.setItem('redirectAfterAuth', `/builder/${sessionId}`);
      navigate('/auth');
      return;
    }

    if (!generatedHtml) {
      sonnerToast.error("Aucun contenu à publier");
      return;
    }

    // Si pas de titre, demander d'abord
    if (!websiteTitle.trim()) {
      sonnerToast.error("Veuillez d'abord enregistrer votre projet avec un titre");
      setShowSaveDialog(true);
      return;
    }

    setIsPublishing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const { data, error } = await supabase.functions.invoke('deploy-to-cloudflare', {
        body: { 
          htmlContent: generatedHtml,
          title: websiteTitle
        },
        headers: {
          Authorization: `Bearer ${session?.access_token}`
        }
      });

      if (error) throw error;

      if (data?.url) {
        sonnerToast.success("Site publié avec succès !");
        sonnerToast.info(`URL: ${data.url}`, { duration: 10000 });
        
        // Rediriger vers le dashboard
        setTimeout(() => {
          navigate('/dashboard');
        }, 2000);
      }
    } catch (error: any) {
      console.error('Error publishing:', error);
      sonnerToast.error(error.message || "Erreur lors de la publication");
    } finally {
      setIsPublishing(false);
    }
  };

  if (sessionLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-slate-600">Chargement...</p>
      </div>
    );
  }

  return (
    <div className={`h-screen flex flex-col ${isDark ? 'bg-slate-900' : 'bg-white'}`}>
      {/* Barre d'action */}
      <div className={`h-12 backdrop-blur-sm border-b flex items-center justify-between px-4 ${isDark ? 'bg-slate-800/80 border-slate-700' : 'bg-slate-50/80 border-slate-200'}`}>
        <div className="flex items-center gap-3">
          <Button
            onClick={() => navigate('/')}
            variant="ghost"
            size="icon"
            className="h-8 w-8"
          >
            <Home className="w-4 h-4" />
          </Button>

          {user && (
            <Button
              onClick={() => navigate('/dashboard')}
              variant="ghost"
              className="text-sm gap-2 transition-all hover:border hover:backdrop-blur-sm rounded-full px-4 py-2"
              style={{ 
                color: '#014AAD',
                borderColor: 'transparent'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'rgba(1, 74, 173, 0.3)';
                e.currentTarget.style.backgroundColor = 'rgba(1, 74, 173, 0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'transparent';
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              Dashboard
            </Button>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-white rounded-md border border-slate-200 p-0.5">
            <Button
              variant={viewMode === 'preview' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setViewMode('preview')}
            >
              <Eye className="w-3 h-3 mr-1" />
              Preview
            </Button>
            <Button
              variant={viewMode === 'code' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setViewMode('code')}
            >
              <Code2 className="w-3 h-3 mr-1" />
              Code
            </Button>
          </div>

          <div className="h-6 w-px bg-slate-300" />

          <div className="flex items-center gap-2">
            <Button
              onClick={handleSave}
              disabled={isSaving}
              variant="ghost"
              size="sm"
              className="h-8 text-xs"
            >
              <Save className="w-3.5 h-3.5 mr-1.5" />
              Enregistrer
            </Button>

            <Button
              onClick={handlePublish}
              disabled={!generatedHtml || isPublishing}
              variant="ghost"
              size="sm"
              className="h-8 text-xs"
            >
              <Eye className="w-3.5 h-3.5 mr-1.5" />
              {isPublishing ? "Publication..." : "Publier"}
            </Button>

            <div className="h-6 w-px bg-slate-300" />

            <Button
              onClick={toggleTheme}
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full"
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Panneau principal */}
      <ResizablePanelGroup direction="horizontal" className="flex-1">
        <ResizablePanel defaultSize={30} minSize={25}>
          <div className={`h-full flex flex-col ${isDark ? 'bg-slate-800' : 'bg-slate-50'}`}>
            {/* Chat history */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {messages.map((msg, idx) => (
                <div key={idx}>
                  <div className={`p-4 rounded-lg ${
                    msg.role === 'user' 
                      ? isDark ? 'bg-slate-700 border border-slate-600 ml-4' : 'bg-white border border-slate-200 ml-4'
                      : isDark ? 'bg-gradient-to-br from-blue-900/50 to-cyan-900/50 border border-blue-800 mr-4' : 'bg-gradient-to-br from-blue-50 to-cyan-50 border border-blue-100 mr-4'
                  }`}>
                    <p className={`text-xs font-semibold mb-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      {msg.role === 'user' ? 'Vous' : 'Trinity'}
                    </p>
                    {msg.role === 'user' ? (
                      <div>
                        {typeof msg.content === 'string' ? (
                          <p className={`text-sm ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{msg.content}</p>
                        ) : (
                          <div className="space-y-2">
                            {msg.content.map((item, i) => (
                              item.type === 'text' ? (
                                <p key={i} className={`text-sm ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{item.text}</p>
                              ) : (
                                <img key={i} src={item.image_url?.url} alt="Attaché" className="max-w-[200px] rounded border" />
                              )
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className={`text-sm ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                        {typeof msg.content === 'string' 
                          ? (msg.content.match(/\[EXPLANATION\](.*?)\[\/EXPLANATION\]/s)?.[1]?.trim() || msg.content)
                          : 'Contenu généré'
                        }
                      </p>
                    )}
                  </div>
                  
                  {/* Animation de chargement sous le dernier message utilisateur */}
                  {msg.role === 'user' && idx === messages.length - 1 && isLoading && (
                    <div className={`ml-4 mt-2 flex items-center gap-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      <Pencil className="w-3.5 h-3.5 animate-pulse" />
                      <TextType 
                        text="En modification" 
                        typingSpeed={80}
                        showCursor={false}
                        loop={true}
                        className="text-xs font-medium"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
            
            {/* Chat input */}
            <div className={`border-t p-4 ${isDark ? 'bg-slate-700 border-slate-600' : 'bg-white border-slate-200'}`}>
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
              
              <div className="flex gap-2">
                <div className="flex flex-col gap-2 flex-1">
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
                  <div className="flex items-center gap-2">
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
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isLoading}
                      className="text-xs"
                    >
                      <Paperclip className="w-3.5 h-3.5 mr-1" />
                      Joindre une image
                    </Button>
                  </div>
                </div>
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
                  srcDoc={`
                    ${generatedHtml.replace(/\[EXPLANATION\].*?\[\/EXPLANATION\]/gs, '')}
                    <script>
                      // Bloquer TOUTE navigation dans l'iframe pour isoler de Trinity
                      document.addEventListener('click', function(e) {
                        const target = e.target.closest('a');
                        if (target) {
                          const href = target.getAttribute('href');
                          // Autoriser uniquement les liens externes (http/https complets)
                          if (href && (href.startsWith('http://') || href.startsWith('https://'))) {
                            target.setAttribute('target', '_blank');
                            target.setAttribute('rel', 'noopener noreferrer');
                          } else {
                            // Bloquer tous les autres liens (relatifs, #, vides)
                            e.preventDefault();
                            e.stopPropagation();
                            return false;
                          }
                        }
                      }, true);
                      
                      // Bloquer la soumission de formulaires
                      document.addEventListener('submit', function(e) {
                        e.preventDefault();
                        return false;
                      }, true);
                    </script>
                  `}
                  className="w-full h-full border-0"
                  title="Site web généré"
                  sandbox="allow-same-origin allow-scripts allow-popups"
                />
            ) : (
              <div className="h-full w-full flex flex-col bg-slate-900">
                <Tabs value={codeTab} onValueChange={(v) => setCodeTab(v as 'html' | 'css' | 'js')} className="flex-1 flex flex-col">
                  <div className="bg-slate-800 border-b border-slate-700 px-4 py-2 flex items-center gap-3">
                    <TabsList className="bg-slate-700 h-8">
                      <TabsTrigger value="html" className="text-xs h-7 data-[state=active]:bg-slate-900">HTML</TabsTrigger>
                      <TabsTrigger value="css" className="text-xs h-7 data-[state=active]:bg-slate-900">CSS</TabsTrigger>
                      <TabsTrigger value="js" className="text-xs h-7 data-[state=active]:bg-slate-900">JavaScript</TabsTrigger>
                    </TabsList>
                    <span className="text-xs text-slate-500">
                      ({codeTab === 'html' ? extractedCode.html.length : codeTab === 'css' ? extractedCode.css.length : extractedCode.js.length} caractères)
                    </span>
                  </div>
                  
                  <TabsContent value="html" className="flex-1 overflow-auto m-0">
                    <div className="flex h-full">
                      <div className="bg-slate-800 px-3 py-4 text-right select-none">
                        {extractedCode.html.split('\n').map((_, i) => (
                          <div key={i} className="text-xs text-slate-500 leading-6 font-mono">
                            {i + 1}
                          </div>
                        ))}
                      </div>
                      <pre className="flex-1 p-4 text-xs text-slate-100 font-mono overflow-x-auto">
                        <code>{extractedCode.html}</code>
                      </pre>
                    </div>
                  </TabsContent>

                  <TabsContent value="css" className="flex-1 overflow-auto m-0">
                    <div className="flex h-full">
                      <div className="bg-slate-800 px-3 py-4 text-right select-none">
                        {extractedCode.css.split('\n').map((_, i) => (
                          <div key={i} className="text-xs text-slate-500 leading-6 font-mono">
                            {i + 1}
                          </div>
                        ))}
                      </div>
                      <pre className="flex-1 p-4 text-xs text-slate-100 font-mono overflow-x-auto">
                        <code>{extractedCode.css}</code>
                      </pre>
                    </div>
                  </TabsContent>

                  <TabsContent value="js" className="flex-1 overflow-auto m-0">
                    <div className="flex h-full">
                      <div className="bg-slate-800 px-3 py-4 text-right select-none">
                        {extractedCode.js.split('\n').map((_, i) => (
                          <div key={i} className="text-xs text-slate-500 leading-6 font-mono">
                            {i + 1}
                          </div>
                        ))}
                      </div>
                      <pre className="flex-1 p-4 text-xs text-slate-100 font-mono overflow-x-auto">
                        <code>{extractedCode.js}</code>
                      </pre>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            )}
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>

      {/* Dialog pour sauvegarder */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enregistrer votre projet</DialogTitle>
            <DialogDescription>
              Donnez un titre à votre projet pour le retrouver facilement
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Titre du projet</Label>
              <Input
                id="title"
                placeholder="Mon super site"
                value={websiteTitle}
                onChange={(e) => setWebsiteTitle(e.target.value)}
                disabled={isSaving}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setShowSaveDialog(false)}
              disabled={isSaving}
              className="text-sm gap-2 transition-all hover:border hover:backdrop-blur-sm rounded-full px-4 py-2"
              style={{ 
                color: '#014AAD',
                borderColor: 'transparent'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'rgba(1, 74, 173, 0.3)';
                e.currentTarget.style.backgroundColor = 'rgba(1, 74, 173, 0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'transparent';
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              Annuler
            </Button>
            <Button
              onClick={confirmSave}
              disabled={isSaving}
              className="text-sm gap-2 transition-all hover:border hover:backdrop-blur-sm rounded-full px-4 py-2"
              style={{ 
                color: '#014AAD',
                borderColor: 'transparent'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'rgba(1, 74, 173, 0.3)';
                e.currentTarget.style.backgroundColor = 'rgba(1, 74, 173, 0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'transparent';
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              {isSaving ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
