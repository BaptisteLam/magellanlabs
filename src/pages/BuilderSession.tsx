import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { Save, Eye, Code2, Home, X, Moon, Sun, Pencil } from "lucide-react";
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
import PromptBar from "@/components/PromptBar";

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
  const streamingRef = useRef<{ abort: () => void } | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [deployedUrl, setDeployedUrl] = useState<string | null>(null);


  useEffect(() => {
    loadSession();
    checkAuth();
  }, [sessionId]);

  // Traiter le prompt initial IMMÉDIATEMENT après chargement session
  useEffect(() => {
    const processInitialPrompt = async () => {
      if (!sessionId || isLoading || generatedHtml) return;
      
      // Vérifier si la session a un message mais pas de fichiers générés
      if (messages.length === 1 && messages[0].role === 'user' && Object.keys(projectFiles).length === 0) {
        const userPrompt = typeof messages[0].content === 'string' ? messages[0].content : '';
        if (userPrompt.trim()) {
          // Déclencher la génération AUTOMATIQUEMENT
          handleSubmit();
        }
      }
    };
    
    if (!sessionLoading) {
      processInitialPrompt();
    }
  }, [sessionId, sessionLoading, messages, projectFiles]);


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
      
      // Récupérer l'URL Cloudflare si elle existe
      const { data: websiteData } = await supabase
        .from('websites')
        .select('cloudflare_url')
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (websiteData?.cloudflare_url) {
        setDeployedUrl(websiteData.cloudflare_url);
      }

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

      // Générer automatiquement le screenshot
      if (generatedHtml) {
        try {
          await supabase.functions.invoke('generate-screenshot', {
            body: {
              projectId: sessionId,
              htmlContent: generatedHtml,
              table: 'build_sessions'
            }
          });
          console.log('Screenshot generation started');
        } catch (screenshotError) {
          console.error('Error generating screenshot:', screenshotError);
          // Ne pas bloquer la sauvegarde si le screenshot échoue
        }
      }
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
    // Utiliser le premier message si inputValue est vide (génération initiale)
    const prompt = inputValue.trim() || (messages.length === 1 && typeof messages[0].content === 'string' ? messages[0].content : '');
    
    if (!prompt && attachedFiles.length === 0) {
      sonnerToast.error("Veuillez entrer votre message ou joindre un fichier");
      return;
    }

    // Construire le message avec texte et images
    let userMessageContent: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
    
    if (attachedFiles.length > 0) {
      const contentArray: Array<{ type: string; text?: string; image_url?: { url: string } }> = [];
      if (prompt) {
        contentArray.push({ type: 'text', text: prompt });
      }
      attachedFiles.forEach(file => {
        contentArray.push({ 
          type: 'image_url', 
          image_url: { url: file.base64 }
        });
      });
      userMessageContent = contentArray;
    } else {
      userMessageContent = prompt;
    }

    // Ne pas dupliquer le message s'il existe déjà (génération initiale)
    const shouldAddMessage = inputValue.trim() || messages.length === 0 || messages[messages.length - 1]?.content !== userMessageContent;
    const newMessages = shouldAddMessage ? [...messages, { role: 'user' as const, content: userMessageContent }] : messages;
    
    if (shouldAddMessage) {
      setMessages(newMessages);
    }
    
    setInputValue('');
    setAttachedFiles([]);
    setIsLoading(true);
    setIsStreaming(true);

    try {
      // Require authentication
      if (!user) {
        navigate('/auth');
        throw new Error('Authentication required');
      }

      const { data: { session } } = await supabase.auth.getSession();
      const abortController = new AbortController();
      
      streamingRef.current = {
        abort: () => {
          abortController.abort();
          setIsStreaming(false);
          setIsLoading(false);
        }
      };

      // 🔥 DÉTECTION INTELLIGENTE : Modification ou Génération ?
      const isModification = generatedHtml.length > 100;
      
      if (isModification) {
        // ✅ MODE MODIFICATION INCRÉMENTALE - Comme Lovable
        const userPrompt = typeof userMessageContent === 'string' 
          ? userMessageContent 
          : (Array.isArray(userMessageContent) 
              ? userMessageContent.find(c => c.type === 'text')?.text || ''
              : String(userMessageContent));

        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/modify-site`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session?.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sessionId,
            message: userPrompt,
            relevantFiles: Object.entries(projectFiles).map(([path, content]) => ({
              path,
              content,
              type: path.endsWith('.html') ? 'html' : 
                    path.endsWith('.css') ? 'stylesheet' : 
                    path.endsWith('.js') ? 'javascript' : 'text'
            })),
            chatHistory: messages.slice(-4).map(m => ({
              role: m.role,
              content: typeof m.content === 'string' ? m.content : '[message multimédia]'
            }))
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
        const modifiedFiles: Set<string> = new Set();

        // STREAMING INCRÉMENTAL - Affiche les modifications en temps réel
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
              const event = JSON.parse(dataStr);
              
              if (event.type === 'chunk') {
                accumulated += event.content;
                
                // Mise à jour visuelle en temps réel
                if (accumulated.includes('<!DOCTYPE html>') || accumulated.includes('<html')) {
                  setGeneratedHtml(accumulated);
                  if (!modifiedFiles.has('index.html')) {
                    modifiedFiles.add('index.html');
                  }
                }
              } else if (event.type === 'file_detected') {
                const filePath = event.data.path;
                modifiedFiles.add(filePath);
                console.log(`📝 Fichier modifié détecté: ${filePath}`);
              }
            } catch (e) {
              // Ignorer erreurs parsing partiel
            }
          }
        }

        // Finaliser les modifications
        const updatedFiles = { ...projectFiles };
        
        // Parser les fichiers modifiés depuis accumulated
        if (accumulated.includes('FILE_MODIFIED:')) {
          const fileMatches = accumulated.matchAll(/FILE_MODIFIED:\s*(.+?)\n([\s\S]*?)(?=FILE_MODIFIED:|$)/g);
          for (const match of fileMatches) {
            const filePath = match[1].trim();
            const fileContent = match[2].trim();
            updatedFiles[filePath] = fileContent;
            
            if (filePath === 'index.html') {
              setGeneratedHtml(fileContent);
            }
          }
        } else if (accumulated.includes('<!DOCTYPE html>') || accumulated.includes('<html')) {
          // Fallback: tout le contenu est du HTML
          updatedFiles['index.html'] = accumulated;
          setGeneratedHtml(accumulated);
        }

        setProjectFiles(updatedFiles);
        setSelectedFileContent(updatedFiles[selectedFile || 'index.html'] || '');

        // Auto-save avec fichiers modifiés uniquement
        const filesArray = Object.entries(updatedFiles).map(([path, content]) => ({
          path,
          content,
          type: path.endsWith('.html') ? 'html' : 
                path.endsWith('.css') ? 'stylesheet' : 
                path.endsWith('.js') ? 'javascript' : 'text'
        }));

        await supabase
          .from('build_sessions')
          .update({
            project_files: filesArray,
            messages: newMessages as any,
            updated_at: new Date().toISOString()
          })
          .eq('id', sessionId);

        const modifiedCount = modifiedFiles.size;
        sonnerToast.success(`✨ ${modifiedCount} fichier${modifiedCount > 1 ? 's modifié' : ' modifié'}${modifiedCount > 1 ? 's' : ''} !`);

      } else {
        // ✅ MODE GÉNÉRATION COMPLÈTE - Première fois uniquement
        const systemPrompt = `Tu es un expert en développement web. Génère un site web complet en HTML, CSS et JavaScript vanilla.

RÈGLES IMPORTANTES :
1. Génère UN SEUL fichier HTML autonome et complet
2. Intègre tout le CSS dans une balise <style> dans le <head>
3. Intègre tout le JavaScript dans une balise <script> avant </body>
4. Utilise Tailwind CSS via CDN pour le styling
5. Design moderne, responsive (mobile-first) et professionnel
6. Maximum 4 images (utilise des URLs Unsplash ou Pexels)
7. Sections : header, hero, features, services, contact (pas de footer)
8. Animations fluides et CTA clairs

FORMAT ATTENDU :
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Titre</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    /* CSS personnalisé ici */
  </style>
</head>
<body>
  <!-- Contenu HTML -->
  <script>
    // JavaScript ici
  </script>
</body>
</html>

Génère directement le code HTML complet sans markdown.`;

        const apiMessages: any[] = [{ role: 'system', content: systemPrompt }];
        
        if (typeof userMessageContent === 'string') {
          apiMessages.push({ role: 'user', content: userMessageContent });
        } else if (Array.isArray(userMessageContent)) {
          apiMessages.push({
            role: 'user',
            content: userMessageContent.map(item => {
              if (item.type === 'text') {
                return { type: 'text', text: item.text };
              } else if (item.type === 'image_url') {
                return { type: 'image_url', image_url: { url: item.image_url?.url || '' } };
              }
              return item;
            })
          });
        }

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

        // STREAMING INSTANTANÉ
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

              if (accumulated.length > 50) {
                setGeneratedHtml(accumulated);
                setProjectFiles({ 'index.html': accumulated });
                setSelectedFile('index.html');
                setSelectedFileContent(accumulated);
              }
            } catch (e) {
              // Ignorer erreurs parsing partiel
            }
          }
        }

        setGeneratedHtml(accumulated);
        setProjectFiles({ 'index.html': accumulated });
        setSelectedFile('index.html');
        setSelectedFileContent(accumulated);

        const filesArray = [{ path: 'index.html', content: accumulated, type: 'html' }];
        await supabase
          .from('build_sessions')
          .update({
            project_files: filesArray,
            messages: newMessages as any,
            updated_at: new Date().toISOString()
          })
          .eq('id', sessionId);

        sonnerToast.success("✨ Site généré avec succès !");
      }
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
      
      // Publier directement le HTML sur Cloudflare (sans conversion React)
      sonnerToast.info("Déploiement sur Cloudflare...");
      
      const deployRes = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/deploy-to-cloudflare`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          htmlContent: generatedHtml,
          title: websiteTitle,
        }),
      });

      const result = await deployRes.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Erreur de déploiement');
      }

      if (result.url) {
        setDeployedUrl(result.url);
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
            onClick={() => navigate('/dashboard')}
            variant="ghost"
            size="icon"
            className="h-8 w-8 hover:bg-[#03A5C0] hover:text-white transition-colors"
            title="Dashboard"
          >
            <Home className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-white rounded-md border border-slate-200 p-0.5">
            <Button
              variant={viewMode === 'preview' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 px-2 text-xs hover:bg-[#03A5C0] hover:text-white transition-colors"
              onClick={() => setViewMode('preview')}
            >
              <Eye className="w-3 h-3 mr-1" />
              Preview
            </Button>
            <Button
              variant={viewMode === 'code' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 px-2 text-xs hover:bg-[#03A5C0] hover:text-white transition-colors"
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
              className="h-8 text-xs hover:bg-[#03A5C0] hover:text-white transition-colors"
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
              className="h-8 text-xs hover:bg-[#03A5C0] hover:text-white transition-colors"
            >
              <Save className="w-3.5 h-3.5 mr-1.5" />
              Enregistrer
            </Button>
          </div>

          <div className="h-6 w-px bg-slate-300" />

          <div className="flex items-center gap-2">
            {deployedUrl && (
              <Button
                onClick={() => window.open(deployedUrl, '_blank')}
                variant="ghost"
                size="icon"
                className="h-8 w-8 hover:bg-[#03A5C0] hover:text-white transition-colors"
                title="Voir le site en ligne"
              >
                <Eye className="w-4 h-4" />
              </Button>
            )}
            
            <Button
              onClick={handlePublish}
              disabled={isPublishing}
              variant="ghost"
              size="icon"
              className="h-8 w-8 hover:bg-[#03A5C0] hover:text-white transition-colors"
              title="Publier"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </Button>
          </div>

          <Button
            onClick={toggleTheme}
            variant="ghost"
            size="icon"
            className="h-8 w-8 hover:bg-[#03A5C0] hover:text-white transition-colors"
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </Button>
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
                  {msg.role === 'user' ? (
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-[#03A5C0] flex items-center justify-center">
                        <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
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
                    </div>
                  ) : (
                    <div className="flex items-start gap-3">
                      <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`}>
                        <svg className={`w-4 h-4 ${isDark ? 'text-slate-300' : 'text-slate-600'}`} fill="currentColor" viewBox="0 0 20 20">
                          <path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5z" />
                          <path d="M15 7v2a4 4 0 01-4 4H9.828l-1.766 1.767c.28.149.599.233.938.233h2l3 3v-3h2a2 2 0 002-2V9a2 2 0 00-2-2h-1z" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <div className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs ${isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
                            <Code2 className="w-3 h-3" />
                            <span>Code généré</span>
                          </div>
                        </div>
                        <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                          {typeof msg.content === 'string' 
                            ? (msg.content.match(/\[EXPLANATION\](.*?)\[\/EXPLANATION\]/s)?.[1]?.trim() || 'Site généré')
                            : 'Contenu généré'
                          }
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ))}


              {/* Affichage du streaming en temps réel */}
              {isStreaming && (
                <div className="flex items-start gap-3">
                  <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`}>
                    <svg className={`w-4 h-4 ${isDark ? 'text-slate-300' : 'text-slate-600'}`} fill="currentColor" viewBox="0 0 20 20">
                      <path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5z" />
                      <path d="M15 7v2a4 4 0 01-4 4H9.828l-1.766 1.767c.28.149.599.233.938.233h2l3 3v-3h2a2 2 0 002-2V9a2 2 0 00-2-2h-1z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs animate-pulse ${isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
                        <Pencil className="w-3 h-3" />
                        <span>Génération en cours...</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={chatEndRef} />
            </div>
            
            {/* Chat input */}
            <div className={`border-t p-4 ${isDark ? 'bg-slate-700 border-slate-600' : 'bg-white border-slate-200'}`}>
              <PromptBar
                inputValue={inputValue}
                setInputValue={setInputValue}
                onSubmit={handleSubmit}
                isLoading={isLoading}
                showPlaceholderAnimation={false}
                showConfigButtons={false}
                attachedFiles={attachedFiles}
                onRemoveFile={removeFile}
                onFileSelect={async (files) => {
                  const newFiles: Array<{ name: string; base64: string; type: string }> = [];
                  for (let i = 0; i < files.length; i++) {
                    const file = files[i];
                    if (!file.type.startsWith('image/')) {
                      sonnerToast.error(`${file.name} n'est pas une image`);
                      continue;
                    }
                    const reader = new FileReader();
                    const base64Promise = new Promise<string>((resolve) => {
                      reader.onloadend = () => resolve(reader.result as string);
                      reader.readAsDataURL(file);
                    });
                    const base64 = await base64Promise;
                    newFiles.push({ name: file.name, base64, type: file.type });
                  }
                  setAttachedFiles([...attachedFiles, ...newFiles]);
                }}
              />
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
                              setProjectFiles((prev) => ({ ...prev, [selectedFile]: value }));
                            }
                          }}
                        />
                      ) : (
                        <div className="h-full flex items-center justify-center text-gray-500">
                          Sélectionnez un fichier pour le modifier
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
            <DialogTitle>Enregistrer le projet</DialogTitle>
            <DialogDescription>
              Donnez un titre à votre site web pour le retrouver facilement.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Titre du site</Label>
              <Input
                id="title"
                value={websiteTitle}
                onChange={(e) => setWebsiteTitle(e.target.value)}
                placeholder="Mon site web"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowSaveDialog(false)}>
              Annuler
            </Button>
            <Button onClick={confirmSave} disabled={isSaving}>
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
