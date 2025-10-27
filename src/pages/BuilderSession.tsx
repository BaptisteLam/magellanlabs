import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { ArrowUp, Save, Eye, Code2, Home, Paperclip, X, Moon, Sun, Pencil, Pause, Play, StopCircle } from "lucide-react";
import TextType from "@/components/ui/TextType";
import { useThemeStore } from '@/stores/themeStore';
import { toast as sonnerToast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileTree } from "@/components/FileTree";
import { VitePreview } from "@/components/VitePreview";
import { CodeTreeView } from "@/components/CodeEditor/CodeTreeView";
import { FileTabs } from "@/components/CodeEditor/FileTabs";
import { MonacoEditor } from "@/components/CodeEditor/MonacoEditor";

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
  const [isPublishing, setIsPublishing] = useState(false);
  const [projectFiles, setProjectFiles] = useState<Record<string, string>>({});
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [selectedFileContent, setSelectedFileContent] = useState<string>('');
  const [openFiles, setOpenFiles] = useState<string[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const streamingRef = useRef<{ abort: () => void } | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);


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
        // Parser les fichiers de projet
        try {
          const projectFilesData = data.project_files as any;
          
          if (projectFilesData && Array.isArray(projectFilesData) && projectFilesData.length > 0) {
            // Nouveau format: array de fichiers
            const filesMap: Record<string, string> = {};
            projectFilesData.forEach((file: any) => {
              if (file.path && file.content) {
                filesMap[file.path] = file.content;
              }
            });
            
            setProjectFiles(filesMap);
            setGeneratedHtml(projectFilesData.find((f: any) => f.path === 'index.html')?.content || '');
            
            const firstFile = Object.keys(filesMap)[0];
            if (firstFile) {
              setSelectedFile(firstFile);
              setSelectedFileContent(filesMap[firstFile]);
            }
          } else {
            // Fallback: projet vide
            setProjectFiles({});
            setGeneratedHtml('');
          }
        } catch {
          // Fallback si parsing échoue
          setProjectFiles({});
          setGeneratedHtml('');
        }

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
      // Convertir projectFiles en array de ProjectFile
      const filesArray = Object.entries(projectFiles).map(([path, content]) => ({
        path,
        content,
        type: path.endsWith('.html') ? 'html' : 
              path.endsWith('.css') ? 'stylesheet' : 
              path.endsWith('.js') ? 'javascript' : 'text'
      }));

      const { error } = await supabase
        .from('build_sessions')
        .update({
          project_files: filesArray,
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
    setIsStreaming(true);
    setStreamingText('');

    try {
      // Prompt système pour HTML complet
      const systemPrompt = `Tu es Claude Sonnet 4.5, expert en génération de sites web modernes.
Tu produis un HTML complet, responsive, professionnel.

Règles :
1. Commence toujours par [EXPLANATION]phrase courte[/EXPLANATION].
2. Ensuite, le HTML complet sans markdown.
3. Utilise Tailwind CDN (<script src="https://cdn.tailwindcss.com"></script>)
4. Icônes Lucide inline (pas d'emojis)
5. 4 images maximum (Unsplash/Pexels)
6. Sections : header, hero, features, contact (PAS de footer)
7. Mobile-first, cohérence visuelle, CTA clair.`;

      // Format messages pour OpenRouter
      const apiMessages: any[] = [
        { role: 'system', content: systemPrompt }
      ];

      if (generatedHtml) {
        // Mode modification
        const modificationText = typeof userMessageContent === 'string' 
          ? userMessageContent 
          : (Array.isArray(userMessageContent) 
              ? userMessageContent.map(c => c.type === 'text' ? c.text : '[image jointe]').join(' ')
              : String(userMessageContent));
        
        apiMessages.push({
          role: 'user',
          content: `HTML actuel:\n${generatedHtml}\n\nApplique exactement cette modification:\n${modificationText}`
        });
      } else {
        // Première génération
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

      // Require authentication
      if (!user) {
        navigate('/auth');
        throw new Error('Authentication required');
      }

      // Call authenticated AI proxy
      const { data: { session } } = await supabase.auth.getSession();
      const abortController = new AbortController();
      
      streamingRef.current = {
        abort: () => {
          abortController.abort();
          setIsStreaming(false);
          setIsLoading(false);
        }
      };

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-generate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: apiMessages,
          model: 'anthropic/claude-sonnet-4.5',
        }),
        signal: abortController.signal,
      });

      if (!response.ok) {
        throw new Error(`Erreur API: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('Impossible de lire le stream');

      const decoder = new TextDecoder('utf-8');
      let accumulated = '';
      let displayQueue: string[] = [];
      let isDisplaying = false;

      // Fonction pour afficher caractère par caractère
      const displayCharByChar = async () => {
        if (isDisplaying) return;
        isDisplaying = true;

        while (displayQueue.length > 0) {
          // Vérifier si en pause
          while (isPaused) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }

          const char = displayQueue.shift()!;
          setStreamingText(prev => prev + char);
          
          // Scroll automatique
          chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
          
          // Délai pour l'effet typing (ajustable)
          await new Promise(resolve => setTimeout(resolve, 10));
        }

        isDisplaying = false;
      };

      // STREAMING TEMPS RÉEL
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
            const delta = json?.choices?.[0]?.delta?.content || '';
            if (!delta) continue;

            accumulated += delta;
            
            // Ajouter caractères à la queue d'affichage
            for (const char of delta) {
              displayQueue.push(char);
            }
            
            // Démarrer l'affichage si pas déjà en cours
            if (!isDisplaying) {
              displayCharByChar();
            }

            // Afficher explication dans le chat
            const explanation = accumulated.match(/\[EXPLANATION\]([\s\S]*?)\[\/EXPLANATION\]/);
            if (explanation) {
              setMessages(prev => {
                const filtered = prev.filter(m => m.role !== 'assistant');
                return [...newMessages, { role: 'assistant' as const, content: explanation[1].trim() }];
              });
            }

            // HTML live (instantané)
            const htmlPreview = accumulated.replace(/\[EXPLANATION\][\s\S]*?\[\/EXPLANATION\]/, '').trim();
            if (htmlPreview.startsWith('<!DOCTYPE html>') || htmlPreview.startsWith('<html')) {
              setGeneratedHtml(htmlPreview);
              setProjectFiles({ 'index.html': htmlPreview });
              setSelectedFile('index.html');
              setSelectedFileContent(htmlPreview);
            }
          } catch (e) {
            // Ignorer erreurs parsing partiel
          }
        }
      }

      // Attendre que tout soit affiché
      while (displayQueue.length > 0) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Finaliser
      const finalHtml = accumulated.replace(/\[EXPLANATION\][\s\S]*?\[\/EXPLANATION\]/, '').trim();
      
      setGeneratedHtml(finalHtml);
      setProjectFiles({ 'index.html': finalHtml });
      setSelectedFile('index.html');
      setSelectedFileContent(finalHtml);

      // Auto-save session
      await supabase
        .from('build_sessions')
        .update({
          html_content: finalHtml,
          messages: messages as any,
          updated_at: new Date().toISOString()
        })
        .eq('id', sessionId);

      sonnerToast.success(messages.length > 0 ? "Modifications appliquées !" : "Site généré !");
    } catch (error: any) {
      if (error.name === 'AbortError') {
        sonnerToast.info("Génération arrêtée");
      } else {
        console.error('Error:', error);
        sonnerToast.error(error instanceof Error ? error.message : "Une erreur est survenue");
      }
    } finally {
      setIsLoading(false);
      setIsStreaming(false);
      setStreamingText('');
      streamingRef.current = null;
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
      
      // ÉTAPE A : Conversion HTML → React
      sonnerToast.info("Conversion du HTML en projet React...");
      
      const convertRes = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/html-to-react`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          htmlContent: generatedHtml,
          title: websiteTitle,
        }),
      });

      if (!convertRes.ok) {
        throw new Error('Échec de la conversion du projet');
      }

      const zipBuffer = await convertRes.arrayBuffer();
      
      // ÉTAPE B : Déploiement Cloudflare
      sonnerToast.info("Déploiement sur Cloudflare...");
      
      const deployRes = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/deploy-to-cloudflare`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: zipBuffer,
      });

      const result = await deployRes.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Erreur de déploiement');
      }

      if (result.url) {
        sonnerToast.success("✅ Site publié avec succès !");
        sonnerToast.info(`URL: ${result.url}`, { duration: 10000 });
        
        // Rediriger vers le dashboard
        setTimeout(() => {
          navigate('/dashboard');
        }, 2000);
      }
    } catch (error: any) {
      console.error('Error publishing:', error);
      sonnerToast.error(error.message || "❌ Erreur lors du déploiement");
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
              onClick={() => window.location.reload()}
              variant="ghost"
              size="sm"
              className="h-8 text-xs"
              title="Actualiser la preview"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </Button>

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
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-medium">AI typing</span>
                        <span className="inline-flex gap-0.5">
                          <span className="w-1 h-1 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '0ms' }}></span>
                          <span className="w-1 h-1 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '150ms' }}></span>
                          <span className="w-1 h-1 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '300ms' }}></span>
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* Affichage du streaming en temps réel */}
              {isStreaming && streamingText && (
                <div className={`p-4 rounded-lg ${isDark ? 'bg-gradient-to-br from-blue-900/50 to-cyan-900/50 border border-blue-800 mr-4' : 'bg-gradient-to-br from-blue-50 to-cyan-50 border border-blue-100 mr-4'}`}>
                  <p className={`text-xs font-semibold mb-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Code en génération...
                  </p>
                  <pre className={`text-xs font-mono ${isDark ? 'text-slate-200' : 'text-slate-700'} whitespace-pre-wrap break-words`}>
                    {streamingText}<span className="animate-pulse">|</span>
                  </pre>
                  
                  {/* Contrôles de streaming */}
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-300/20">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setIsPaused(!isPaused)}
                      className="h-7 px-3 text-xs"
                    >
                      {isPaused ? (
                        <>
                          <Play className="w-3 h-3 mr-1.5" />
                          Reprendre
                        </>
                      ) : (
                        <>
                          <Pause className="w-3 h-3 mr-1.5" />
                          Pause
                        </>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => streamingRef.current?.abort()}
                      className="h-7 px-3 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <StopCircle className="w-3 h-3 mr-1.5" />
                      Arrêter
                    </Button>
                  </div>
                </div>
              )}
              
              <div ref={chatEndRef} />
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
            <div className="h-full w-full flex flex-col">
              {viewMode === 'preview' ? (
                <VitePreview projectFiles={projectFiles} isDark={isDark} />
              ) : (
                <div className="h-full flex bg-white">
                  {/* TreeView - 20% */}
                  <div className="w-[20%] min-w-[200px]">
                    <CodeTreeView
                      files={projectFiles}
                      selectedFile={selectedFile}
                      onFileSelect={(path, content) => {
                        setSelectedFile(path);
                        setSelectedFileContent(content);
                        if (!openFiles.includes(path)) {
                          setOpenFiles([...openFiles, path]);
                        }
                      }}
                    />
                  </div>

                  {/* Monaco Editor - 80% */}
                  <div className="flex-1 flex flex-col">
                    <FileTabs
                      openFiles={openFiles}
                      activeFile={selectedFile}
                      onTabClick={(path) => {
                        setSelectedFile(path);
                        setSelectedFileContent(projectFiles[path]);
                      }}
                      onTabClose={(path) => {
                        const newOpenFiles = openFiles.filter((f) => f !== path);
                        setOpenFiles(newOpenFiles);
                        if (selectedFile === path) {
                          const nextFile = newOpenFiles[newOpenFiles.length - 1] || null;
                          setSelectedFile(nextFile);
                          setSelectedFileContent(nextFile ? projectFiles[nextFile] : '');
                        }
                      }}
                    />
                    <div className="flex-1">
                      {selectedFileContent ? (
                        <MonacoEditor
                          value={selectedFileContent}
                          language={selectedFile?.split('.').pop() || 'plaintext'}
                          onChange={(value) => {
                            if (value !== undefined && selectedFile) {
                              setSelectedFileContent(value);
                              setProjectFiles((prev) => ({
                                ...prev,
                                [selectedFile]: value,
                              }));
                            }
                          }}
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full bg-slate-50">
                          <p className="text-sm text-slate-400">Select a file to start editing</p>
                        </div>
                      )}
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
