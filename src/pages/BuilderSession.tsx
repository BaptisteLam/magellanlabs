import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { Save, Eye, Code2, Home, X, Moon, Sun, Pencil, Download, Paperclip } from "lucide-react";
import { useThemeStore } from '@/stores/themeStore';
import { toast as sonnerToast } from "sonner";
import JSZip from "jszip";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileTree } from "@/components/FileTree";
import { VitePreview } from "@/components/VitePreview";
import { CodeTreeView } from "@/components/CodeEditor/CodeTreeView";
import { FileTabs } from "@/components/CodeEditor/FileTabs";
import { MonacoEditor } from "@/components/CodeEditor/MonacoEditor";
import PromptBar from "@/components/PromptBar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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
  const [isHoveringFavicon, setIsHoveringFavicon] = useState(false);
  const faviconInputRef = useRef<HTMLInputElement>(null);
  const [currentFavicon, setCurrentFavicon] = useState<string | null>(null);


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
      
      // Récupérer l'URL Netlify si elle existe
      const { data: websiteData } = await supabase
        .from('websites')
        .select('netlify_url')
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (websiteData?.netlify_url) {
        setDeployedUrl(websiteData.netlify_url);
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
            
            // Charger le favicon s'il existe
            const faviconFile = Object.keys(filesMap).find(path => path.startsWith('public/favicon.'));
            if (faviconFile) {
              setCurrentFavicon(filesMap[faviconFile]);
            }
            
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

  const handleFaviconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Vérifier que c'est une image
    if (!file.type.startsWith('image/')) {
      sonnerToast.error("Veuillez sélectionner une image");
      return;
    }

    try {
      // Convertir en base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onloadend = () => {
          resolve(reader.result as string);
        };
        reader.readAsDataURL(file);
      });

      const base64 = await base64Promise;
      
      // Stocker le favicon pour l'affichage
      setCurrentFavicon(base64);
      
      // Déterminer l'extension
      const extension = file.type.split('/')[1];
      const faviconPath = `public/favicon.${extension}`;
      
      // Ajouter le favicon aux fichiers du projet
      setProjectFiles(prev => ({
        ...prev,
        [faviconPath]: base64
      }));

      // Mettre à jour index.html pour référencer le nouveau favicon
      const updatedIndexHtml = generatedHtml.replace(
        /<link rel="icon"[^>]*>/,
        `<link rel="icon" type="${file.type}" href="/favicon.${extension}">`
      );
      
      setGeneratedHtml(updatedIndexHtml);

      // Sauvegarder dans la base de données
      if (sessionId) {
        await supabase
          .from('build_sessions')
          .update({ 
            generated_html: updatedIndexHtml,
            project_files: { ...projectFiles, [faviconPath]: base64 }
          })
          .eq('id', sessionId);
      }

      sonnerToast.success("Favicon mis à jour avec succès");
      
      if (faviconInputRef.current) {
        faviconInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Error uploading favicon:', error);
      sonnerToast.error("Erreur lors de l'upload du favicon");
    }
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

      // 🔥 DÉTECTION : Modification ou Génération
      const isModification = generatedHtml.length > 100;
      
      if (isModification) {
        // ✅ MODE MODIFICATION avec DIFFS
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
        let streamBuffer = '';
        const modifiedFiles: Set<string> = new Set();

        // STREAMING TOKEN-BY-TOKEN
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
              
              if (event.type === 'token') {
                // Affichage token par token dans le chat
                streamBuffer += event.content;
              } else if (event.type === 'file_detected') {
                const filePath = event.data.path;
                modifiedFiles.add(filePath);
              } else if (event.type === 'complete') {
                // Appliquer les diffs côté client
                const diffs = event.data.diffs || [];
                const updatedFiles = { ...projectFiles };

                for (const diff of diffs) {
                  if (diff.change_type === 'full' && diff.full_content) {
                    updatedFiles[diff.file] = diff.full_content;
                    if (diff.file === 'index.html') {
                      setGeneratedHtml(diff.full_content);
                    }
                  } else if (diff.change_type === 'replace' && diff.old_text && diff.new_text) {
                    const currentContent = updatedFiles[diff.file] || '';
                    updatedFiles[diff.file] = currentContent.replace(diff.old_text, diff.new_text);
                    if (diff.file === 'index.html') {
                      setGeneratedHtml(updatedFiles[diff.file]);
                    }
                  }
                }

                setProjectFiles(updatedFiles);
                setSelectedFileContent(updatedFiles[selectedFile || 'index.html'] || '');

                // Auto-save
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
              }
            } catch (e) {
              // Ignorer erreurs parsing partiel
            }
          }
        }

      } else {
        // ✅ MODE GÉNÉRATION STREAMING (3 FICHIERS SÉPARÉS)
        const systemPrompt = `Tu es un expert développeur web. Génère un site web complet, moderne et professionnel en 3 fichiers séparés.

RÈGLES CRITIQUES :
1. EXACTEMENT 3 fichiers : index.html, style.css, script.js
2. HTML épuré SANS aucun CSS ni JS inline (uniquement classes Tailwind)
3. style.css DOIT contenir du CSS custom RÉEL : animations, transitions, gradients, effets hover, keyframes
4. script.js DOIT contenir du JavaScript RÉEL : menu mobile, scroll smooth, animations au scroll, interactions
5. Design moderne, responsive, animations fluides
6. Max 4 images (Unsplash/Pexels)
7. Structure : header, hero, features/services, contact (NO footer)

CONTENU OBLIGATOIRE PAR FICHIER :

index.html:
- Uniquement HTML sémantique avec classes Tailwind
- Liens vers style.css et script.js
- Pas de <style> ni <script> inline

style.css:
- Minimum 100 lignes de CSS custom
- @keyframes pour animations (fadeIn, slideUp, etc.)
- Gradients personnalisés
- Transitions et effets hover
- Variables CSS custom si nécessaire

script.js:
- Minimum 50 lignes de JavaScript
- Menu mobile toggle
- Smooth scroll
- Animations au scroll (Intersection Observer)
- Form validation si formulaire présent

FORMAT OBLIGATOIRE (utilise // FILE: exactement) :
// FILE: index.html
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>...</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <!-- HTML ici (classes Tailwind uniquement) -->
  <script src="script.js"></script>
</body>
</html>

// FILE: style.css
/* Animations */
@keyframes fadeIn { ... }
@keyframes slideUp { ... }

/* Styles custom */
...

// FILE: script.js
// Menu mobile
const menuToggle = ...

// Smooth scroll
...

// Animations au scroll
...

Génère DIRECTEMENT les 3 fichiers avec du contenu COMPLET dans chaque fichier. Ne génère JAMAIS de fichiers vides.`;

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
        let updateCounter = 0;

        // STREAMING TEMPS RÉEL - Mise à jour progressive token-by-token
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
              updateCounter++;

              // Mise à jour visuelle tous les 5 tokens pour fluidité
              if (updateCounter % 5 === 0 && accumulated.length > 100) {
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

        // Parser les 3 fichiers du format // FILE:
        const fileRegex = /\/\/\s*FILE:\s*(.+?)\n/g;
        const matches = [...accumulated.matchAll(fileRegex)];
        
        let parsedFiles: Record<string, string> = {};
        let filesArray: Array<{ path: string; content: string; type: string }> = [];
        
        if (matches.length > 0) {
          // Format multi-fichiers détecté
          for (let i = 0; i < matches.length; i++) {
            const match = matches[i];
            const filePath = match[1].trim();
            const startIndex = match.index! + match[0].length;
            const nextMatch = matches[i + 1];
            const endIndex = nextMatch ? nextMatch.index! : accumulated.length;
            const content = accumulated.slice(startIndex, endIndex).trim();
            
            parsedFiles[filePath] = content;
            
            const extension = filePath.split('.').pop() || '';
            const type = extension === 'html' ? 'html' : 
                        extension === 'css' ? 'stylesheet' : 
                        extension === 'js' ? 'javascript' : 'text';
            
            filesArray.push({ path: filePath, content, type });
            
            if (filePath === 'index.html') {
              setGeneratedHtml(content);
            }
          }
        } else {
          // Fallback: fichier HTML unique
          parsedFiles = { 'index.html': accumulated };
          filesArray = [{ path: 'index.html', content: accumulated, type: 'html' }];
          setGeneratedHtml(accumulated);
        }
        
        setProjectFiles(parsedFiles);
        setSelectedFile('index.html');
        setSelectedFileContent(parsedFiles['index.html'] || accumulated);

        await supabase
          .from('build_sessions')
          .update({
            project_files: filesArray,
            messages: newMessages as any,
            updated_at: new Date().toISOString()
          })
          .eq('id', sessionId);

        const fileCount = filesArray.length;
        sonnerToast.success(`✨ ${fileCount} fichier${fileCount > 1 ? 's généré' : ' généré'}${fileCount > 1 ? 's' : ''} !`);
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

  const handleDownloadZip = async () => {
    if (!generatedHtml) {
      sonnerToast.error("Aucun contenu à télécharger");
      return;
    }

    try {
      // Extraire CSS et JS du HTML
      let extractedCss = '';
      let extractedJs = '';
      
      // Extraire tous les <style> tags
      const styleMatches = generatedHtml.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi);
      for (const match of styleMatches) {
        extractedCss += match[1] + '\n';
      }
      
      // Extraire tous les <script> tags (non-module)
      const scriptMatches = generatedHtml.matchAll(/<script(?![^>]*type=["']module["'])[^>]*>([\s\S]*?)<\/script>/gi);
      for (const match of scriptMatches) {
        extractedJs += match[1] + '\n';
      }
      
      // Créer le HTML nettoyé avec liens externes
      let cleanHtml = generatedHtml
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<script(?![^>]*type=["']module["'])[^>]*>[\s\S]*?<\/script>/gi, '');
      
      cleanHtml = cleanHtml.replace(
        '</head>',
        '  <link rel="stylesheet" href="style.css">\n</head>'
      );
      cleanHtml = cleanHtml.replace(
        '</body>',
        '  <script src="script.js"></script>\n</body>'
      );
      
      // Créer le ZIP
      const zip = new JSZip();
      
      zip.file('index.html', cleanHtml);
      zip.file('style.css', extractedCss || '/* Styles générés par Trinity AI */\n');
      zip.file('script.js', extractedJs || '// Scripts générés par Trinity AI\n');
      
      const blob = await zip.generateAsync({ type: 'blob' });
      
      // Télécharger le ZIP
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${websiteTitle || 'mon-site'}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      sonnerToast.success("✅ ZIP téléchargé avec succès !");
    } catch (error: any) {
      console.error('Error downloading ZIP:', error);
      sonnerToast.error(error.message || "❌ Erreur lors du téléchargement");
    }
  };

  const handlePublish = async () => {
    if (!user) {
      localStorage.setItem('redirectAfterAuth', `/builder/${sessionId}`);
      navigate('/auth');
      return;
    }

    if (!projectFiles || Object.keys(projectFiles).length === 0) {
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
      
      if (!session?.access_token) {
        throw new Error('Session non valide, veuillez vous reconnecter');
      }
      
      // Préparer tous les fichiers du projet pour le déploiement
      const files = Object.entries(projectFiles).map(([name, content]) => {
        const extension = name.split('.').pop() || '';
        const type = extension === 'html' ? 'html' : 
                    extension === 'css' ? 'stylesheet' : 
                    extension === 'js' ? 'javascript' :
                    extension === 'tsx' || extension === 'ts' ? 'typescript' :
                    extension === 'jsx' ? 'javascript' : 'text';
        
        return {
          name,
          content,
          type
        };
      });

      sonnerToast.info("Déploiement sur Netlify...");
      
      const deployRes = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/deploy-to-netlify`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId,
          projectFiles: files,
        }),
      });

      const result = await deployRes.json();
      
      if (!deployRes.ok) {
        throw new Error(result?.error || 'Erreur de déploiement');
      }
      
      if (!result?.success) {
        throw new Error(result?.error || 'Erreur de déploiement');
      }

      if (result.url) {
        setDeployedUrl(result.url);
        
        // Afficher popup de succès (sans redirection)
        if (result.state === 'ready') {
          sonnerToast.success("✅ Site publié avec succès !", {
            description: result.url,
            duration: 10000,
            action: {
              label: 'Voir le site',
              onClick: () => window.open(result.url, '_blank')
            }
          });
        } else {
          sonnerToast.info(`Déploiement en cours (${result.state})`, {
            description: result.url,
            duration: 8000,
          });
        }
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
    <div className={`h-screen flex flex-col`} style={{ backgroundColor: isDark ? '#1F1F20' : '#ffffff' }}>
      {/* Barre d'action */}
      <div className={`h-12 backdrop-blur-sm border-b flex items-center justify-between px-4 ${isDark ? 'border-slate-700' : 'bg-slate-50/80 border-slate-200'}`} style={{ backgroundColor: isDark ? '#1F1F20' : undefined }}>
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

        {/* Barre URL - repositionnée à gauche et rétrécie */}
        <div className="absolute left-[30%] right-[43%] flex items-center gap-2 px-3 py-1.5 rounded-md border" style={{
          backgroundColor: isDark ? '#181818' : '#ffffff',
          borderColor: isDark ? '#333' : '#e2e8f0'
        }}>
          <input
            type="file"
            ref={faviconInputRef}
            onChange={handleFaviconUpload}
            accept="image/*"
            className="hidden"
          />
          <button
            onClick={() => faviconInputRef.current?.click()}
            onMouseEnter={() => setIsHoveringFavicon(true)}
            onMouseLeave={() => setIsHoveringFavicon(false)}
            className="flex-shrink-0 hover:text-[#03A5C0] transition-colors cursor-pointer bg-transparent border-0 p-0"
            title="Changer le favicon"
          >
            {currentFavicon ? (
              <img src={currentFavicon} alt="favicon" className="w-4 h-4 object-contain" />
            ) : isHoveringFavicon ? (
              <Paperclip className="w-4 h-4" />
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
          </button>
          <span className={`text-sm flex-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
            {websiteTitle ? websiteTitle.toLowerCase().replace(/\s+/g, '') : 'monsite'}.com
          </span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 flex-shrink-0 hover:bg-[#03A5C0] hover:text-white transition-colors"
                  onClick={() => {
                    const domain = (websiteTitle ? websiteTitle.toLowerCase().replace(/\s+/g, '') : 'monsite') + '.com';
                    window.open(`https://www.namecheap.com/domains/registration/results/?domain=${domain}`, '_blank');
                  }}
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" align="center">
                <p>Vérifier si le nom de domaine est disponible</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <div className="flex items-center gap-3">
          <div 
            className="flex items-center gap-1 rounded-md border p-0.5"
            style={{
              backgroundColor: isDark ? '#181818' : '#ffffff',
              borderColor: isDark ? '#1F1F20' : 'rgba(203, 213, 225, 1)'
            }}
          >
            <Button
              variant="iconOnly"
              size="sm"
              className={`h-7 px-2 text-xs ${viewMode === 'preview' ? 'text-[#03A5C0]' : ''}`}
              onClick={() => setViewMode('preview')}
            >
              <Eye className="w-3 h-3 mr-1" />
              Preview
            </Button>
            <Button
              variant="iconOnly"
              size="sm"
              className={`h-7 px-2 text-xs ${viewMode === 'code' ? 'text-[#03A5C0]' : ''}`}
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
              variant="iconOnly"
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
              variant="iconOnly"
              size="sm"
              className="h-8 text-xs"
            >
              <Save className="w-3.5 h-3.5 mr-1.5" />
              Enregistrer
            </Button>
          </div>

          <div className="h-6 w-px bg-slate-300" />

          <div className="flex items-center gap-2">
            <Button
              onClick={handlePublish}
              disabled={isPublishing}
              className="text-sm gap-2 transition-all border rounded-full px-6 py-0.5"
              style={{
                borderColor: '#03A5C0',
                backgroundColor: 'rgba(3, 165, 192, 0.1)',
                color: '#03A5C0'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(3, 165, 192, 0.2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(3, 165, 192, 0.1)';
              }}
            >
              {isPublishing ? 'Publication...' : 'Publier'}
            </Button>
          </div>

          <Button
            onClick={toggleTheme}
            variant="iconOnly"
            size="icon"
            className="h-8 w-8"
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {/* Panneau principal */}
      <ResizablePanelGroup direction="horizontal" className="flex-1">
        <ResizablePanel defaultSize={30} minSize={25}>
          <div className={`h-full flex flex-col ${isDark ? '' : 'bg-slate-50'}`} style={{ backgroundColor: isDark ? '#1F1F20' : undefined }}>
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
            <div className="border-t p-4" style={{ backgroundColor: isDark ? '#1F1F20' : '#ffffff', borderTopColor: isDark ? '#1F1F20' : 'rgb(226, 232, 240)' }}>
              <PromptBar
                inputValue={inputValue}
                setInputValue={setInputValue}
                onSubmit={handleSubmit}
                isLoading={isLoading}
                showPlaceholderAnimation={false}
                showConfigButtons={false}
                modificationMode={true}
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
            <Button 
              onClick={confirmSave} 
              disabled={isSaving}
              className="bg-[hsl(var(--magellan-cyan))] hover:bg-[hsl(var(--magellan-cyan-light))] text-white"
            >
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
