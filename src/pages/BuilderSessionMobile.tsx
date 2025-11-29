import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { Save, Eye, Code2, Home, X, Moon, Sun, Pencil, Download, Paperclip, BarChart3, Lightbulb, FileText, Edit, Loader, Smartphone, Monitor } from "lucide-react";
import { useThemeStore } from '@/stores/themeStore';
import { toast as sonnerToast } from "sonner";
import JSZip from "jszip";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileTree } from "@/components/FileTree";
import { InteractivePreview } from "@/components/InteractivePreview";
import { ExpoSnackPreview } from "@/components/ExpoSnackPreview";
import { GeneratingPreview } from "@/components/GeneratingPreview";
import { FakeUrlBar } from "@/components/FakeUrlBar";
import { CodeTreeView } from "@/components/CodeEditor/CodeTreeView";
import { FileTabs } from "@/components/CodeEditor/FileTabs";
import { MonacoEditor } from "@/components/CodeEditor/MonacoEditor";
import PromptBar from "@/components/PromptBar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import CloudflareAnalytics from "@/components/CloudflareAnalytics";
import { AiDiffService } from "@/services/aiDiffService";
import { useAgentAPI } from "@/hooks/useAgentAPI";
import type { AIEvent, GenerationEvent } from '@/types/agent';
import { CollapsedAiTasks } from '@/components/chat/CollapsedAiTasks';
import { MessageActions } from '@/components/chat/MessageActions';
import html2canvas from 'html2canvas';
import { capturePreviewThumbnail } from '@/lib/capturePreviewThumbnail';

interface Message {
  role: 'user' | 'assistant';
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
  token_count?: number;
  id?: string;
  metadata?: {
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
    project_files?: Record<string, string>;
    generation_events?: GenerationEvent[];
    attachedFiles?: Array<{ name: string; base64: string; type: string }>;
  };
}

export default function BuilderSession() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { isDark, toggleTheme } = useThemeStore();
  const [inputValue, setInputValue] = useState('');
  const [generatedHtml, setGeneratedHtml] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [user, setUser] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [websiteTitle, setWebsiteTitle] = useState('');
  const [viewMode, setViewMode] = useState<'preview' | 'code' | 'analytics'>('preview');
  const [sessionLoading, setSessionLoading] = useState(true);
  const [attachedFiles, setAttachedFiles] = useState<Array<{ name: string; base64: string; type: string }>>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [projectFiles, setProjectFiles] = useState<Record<string, string>>({});
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [selectedFileContent, setSelectedFileContent] = useState<string>('');
  const [openFiles, setOpenFiles] = useState<string[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [deployedUrl, setDeployedUrl] = useState<string | null>(null);
  const [isHoveringFavicon, setIsHoveringFavicon] = useState(false);
  const faviconInputRef = useRef<HTMLInputElement>(null);
  const [currentFavicon, setCurrentFavicon] = useState<string | null>(null);
  const [gaPropertyId, setGaPropertyId] = useState<string | null>(null);
  const [websiteId, setWebsiteId] = useState<string | null>(null);
  const [projectType, setProjectType] = useState<'website' | 'webapp' | 'mobile'>('website');
  const [cloudflareProjectName, setCloudflareProjectName] = useState<string | null>(null);
  
  // Hook pour la nouvelle API Agent
  const agent = useAgentAPI();
  
  // Événements IA pour la TaskList
  const [aiEvents, setAiEvents] = useState<AIEvent[]>([]);
  
  // Événements de génération pour l'affichage de pensée
  const [generationEvents, setGenerationEvents] = useState<GenerationEvent[]>([]);
  const [currentMessageEvents, setCurrentMessageEvents] = useState<GenerationEvent[]>([]);
  
  // Flag pour savoir si on est en première génération
  const [isInitialGeneration, setIsInitialGeneration] = useState(false);
  const isInitialGenerationRef = useRef(false);
  
  // Flag pour éviter de traiter le prompt initial plusieurs fois
  const [initialPromptProcessed, setInitialPromptProcessed] = useState(false);
  
  // Mode Inspect pour la preview interactive
  const [inspectMode, setInspectMode] = useState(false);
  
  // Index de la version actuellement affichée (null = dernière version)
  const [currentVersionIndex, setCurrentVersionIndex] = useState<number | null>(null);
  
  // Mode d'affichage de la preview (toujours mobile pour cette page)
  const previewMode = 'mobile';

  // Fonction pour générer automatiquement un nom de projet
  const generateProjectName = async (prompt: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('generate-project-name', {
        body: { prompt }
      });

      if (error) {
        console.error('Erreur génération nom:', error);
        return;
      }

      if (data?.projectName) {
        console.log('📝 Nom de projet généré:', data.projectName);
        setWebsiteTitle(data.projectName);
      }
    } catch (error) {
      console.error('Erreur lors de la génération du nom:', error);
    }
  };


  useEffect(() => {
    loadSession();
    checkAuth();
  }, [sessionId]);

  // Auto-save désactivé
  // useEffect(() => {
  //   if (!sessionId || Object.keys(projectFiles).length === 0) return;
  //   
  //   const autoSaveInterval = setInterval(() => {
  //     console.log('💾 Auto-sauvegarde périodique (mobile)...');
  //     saveSession();
  //   }, 30000); // 30 secondes
  //
  //   return () => clearInterval(autoSaveInterval);
  // }, [sessionId, projectFiles, messages, websiteTitle]);

  // Sauvegarde avant fermeture de la page
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (sessionId && Object.keys(projectFiles).length > 0) {
        console.log('💾 Sauvegarde avant fermeture (mobile)...');
        saveSession();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [sessionId, projectFiles, messages, websiteTitle]);

  // Traiter le prompt initial IMMÉDIATEMENT après chargement session
  useEffect(() => {
    const processInitialPrompt = async () => {
      // Ne rien faire si déjà traité ou si on a des fichiers
      if (initialPromptProcessed || Object.keys(projectFiles).length > 0) return;
      
      // Vérifier s'il y a des images dans l'état de navigation
      const stateAttachedFiles = location.state?.attachedFiles;
      if (stateAttachedFiles && Array.isArray(stateAttachedFiles) && stateAttachedFiles.length > 0) {
        console.log('📎 Images attachées trouvées dans l\'état de navigation:', stateAttachedFiles.length);
        setAttachedFiles(stateAttachedFiles);
      }
      
      const urlParams = new URLSearchParams(window.location.search);
      const promptFromUrl = urlParams.get('prompt');
      
      if (promptFromUrl) {
        console.log('🚀 Traitement du prompt initial depuis URL:', promptFromUrl);
        setInputValue(promptFromUrl);
        setInitialPromptProcessed(true);
        
        // Petit délai pour s'assurer que tout est initialisé
        setTimeout(() => {
          handleSubmit();
        }, 100);
      } else if (messages.length === 1 && messages[0].role === 'user') {
        const userPrompt = typeof messages[0].content === 'string' ? messages[0].content : '';
        if (userPrompt.trim()) {
          console.log('🚀 Traitement du prompt initial depuis messages:', userPrompt);
          setInputValue(userPrompt);
          setInitialPromptProcessed(true);
          
          setTimeout(() => {
            handleSubmit();
          }, 100);
        }
      }
    };
    
    // NE traiter le prompt initial QUE si :
    // 1. La session a fini de charger (sessionLoading === false)
    // 2. L'utilisateur est authentifié
    // 3. On n'a pas déjà traité le prompt
    if (!sessionLoading && user && !initialPromptProcessed) {
      processInitialPrompt();
    }
  }, [sessionId, sessionLoading, user, projectFiles, messages, initialPromptProcessed, location.state]);


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
      
      // Récupérer le websiteId lié à cette session
      const { data: websiteData } = await supabase
        .from('build_sessions')
        .select('website_id, websites!inner(id, netlify_url, ga_property_id)')
        .eq('id', sessionId)
        .maybeSingle();
      
      if (websiteData?.websites) {
        const website = Array.isArray(websiteData.websites) ? websiteData.websites[0] : websiteData.websites;
        if (website.netlify_url) {
          setDeployedUrl(website.netlify_url);
        }
        if (website.ga_property_id) {
          setGaPropertyId(website.ga_property_id);
        }
        setWebsiteId(website.id);
      }

      if (error) {
        console.error('Error loading session:', error);
        sonnerToast.error("Session introuvable");
        navigate('/builder');
        return;
      }

      if (data) {
        // Charger le type de projet
        if (data.project_type) {
          setProjectType(data.project_type as 'website' | 'webapp' | 'mobile');
        }
        
        // 📦 Parser et restaurer les fichiers de projet avec validation stricte
        console.log('📦 Starting project files restoration...');
        try {
          const projectFilesData = data.project_files as any;
          console.log('📦 Raw project_files data type:', typeof projectFilesData, Array.isArray(projectFilesData) ? `(array, ${projectFilesData.length} items)` : '');
          
          if (projectFilesData) {
            let filesMap: Record<string, string> = {};
            
            // Support des deux formats: array ET object
            if (Array.isArray(projectFilesData) && projectFilesData.length > 0) {
              // Format array: [{path, content}, ...]
              console.log('📦 Loading project files (array format):', projectFilesData.length, 'files');
              projectFilesData.forEach((file: any, index: number) => {
                if (file.path && file.content) {
                  filesMap[file.path] = file.content;
                  console.log(`  ✅ [${index + 1}/${projectFilesData.length}] ${file.path} : ${file.content.length} chars`);
                } else {
                  console.warn(`  ⚠️ [${index + 1}/${projectFilesData.length}] Invalid file structure`);
                }
              });
            } else if (typeof projectFilesData === 'object' && Object.keys(projectFilesData).length > 0) {
              // Format object: {path: content, ...}
              console.log('📦 Loading project files (object format):', Object.keys(projectFilesData).length, 'files');
              filesMap = projectFilesData;
              Object.entries(filesMap).forEach(([path, content], index) => {
                console.log(`  ✅ [${index + 1}/${Object.keys(filesMap).length}] ${path} : ${content.length} chars`);
              });
            }
            
            if (Object.keys(filesMap).length > 0) {
              console.log('✅ =====================================');
              console.log('✅ PROJECT FILES RESTORATION SUCCESS');
              console.log('✅ Total files restored:', Object.keys(filesMap).length);
              console.log('✅ Files:', Object.keys(filesMap).join(', '));
              console.log('✅ =====================================');
              
              setProjectFiles(filesMap);
              setGeneratedHtml(filesMap['index.html'] || '');
              
              // Charger le favicon s'il existe
              const faviconFile = Object.keys(filesMap).find(path => path.startsWith('public/favicon.'));
              if (faviconFile) {
                setCurrentFavicon(filesMap[faviconFile]);
                console.log('✅ Favicon restored:', faviconFile);
              }
              
              const firstFile = Object.keys(filesMap)[0];
              if (firstFile) {
                setSelectedFile(firstFile);
                setSelectedFileContent(filesMap[firstFile]);
                console.log('✅ First file selected:', firstFile);
              }
            } else {
              console.error('❌ =====================================');
              console.error('❌ PROJECT FILES RESTORATION FAILED');
              console.error('❌ No files found after parsing');
              console.error('❌ =====================================');
              setProjectFiles({});
              setGeneratedHtml('');
            }
          } else {
            console.error('❌ =====================================');
            console.error('❌ PROJECT FILES DATA IS NULL/UNDEFINED');
            console.error('❌ =====================================');
            setProjectFiles({});
            setGeneratedHtml('');
          }
        } catch (err) {
          console.error('Erreur parsing project_files:', err);
          setProjectFiles({});
          setGeneratedHtml('');
        }

        // Charger l'historique complet des messages depuis chat_messages
        const { data: chatMessages, error: chatError } = await supabase
          .from('chat_messages')
          .select('*')
          .eq('session_id', sessionId)
          .order('created_at', { ascending: true });

        if (!chatError && chatMessages && chatMessages.length > 0) {
          const loadedMessages: Message[] = chatMessages.map(msg => ({
            role: msg.role as 'user' | 'assistant',
            content: msg.content,
            token_count: msg.token_count || undefined,
            id: msg.id
          }));
          setMessages(loadedMessages);
          
          // Extraire les images attachées du premier message utilisateur s'il y en a
          const firstUserMessage = loadedMessages.find(m => m.role === 'user');
          if (firstUserMessage?.metadata?.attachedFiles) {
            console.log('📎 Images attachées trouvées dans le message initial:', firstUserMessage.metadata.attachedFiles.length);
            setAttachedFiles(firstUserMessage.metadata.attachedFiles);
          }
        } else {
          // Fallback sur l'ancienne méthode si pas de messages dans chat_messages
          const parsedMessages = Array.isArray(data.messages) ? data.messages as any[] : [];
          setMessages(parsedMessages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })));
        }
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

      // Récupérer le thumbnail existant
      const { data: existingSession } = await supabase
        .from('build_sessions')
        .select('thumbnail_url')
        .eq('id', sessionId)
        .single();

      const { error } = await supabase
        .from('build_sessions')
        .update({
          project_files: filesArray,
          messages: messages as any,
          title: websiteTitle,
          project_type: projectType,
          thumbnail_url: existingSession?.thumbnail_url || null, // Garder le thumbnail existant
          updated_at: new Date().toISOString()
        })
        .eq('id', sessionId);

      if (error) throw error;
    } catch (error) {
      console.error('Error saving session:', error);
    }
  };

  // Fonction pour capturer le thumbnail UNIQUEMENT après une génération
  const captureThumbnail = async (htmlContent?: string) => {
    if (!sessionId) return;

    try {
      console.log('📸 Capture du thumbnail après génération...');
      
      const contentToCapture = htmlContent || generatedHtml || projectFiles['index.html'] || '';
      
      if (contentToCapture) {
        // Utiliser notre helper pour capturer le thumbnail
        const blob = await capturePreviewThumbnail(contentToCapture);
        
        if (blob) {
          // Uploader vers Supabase Storage
          const fileName = `${sessionId}-${Date.now()}.png`;
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('screenshots')
            .upload(fileName, blob, {
              contentType: 'image/png',
              upsert: true
            });
          
          if (uploadError) {
            console.error('❌ Error uploading screenshot:', uploadError);
          } else {
            // Obtenir l'URL publique
            const { data: { publicUrl } } = supabase.storage
              .from('screenshots')
              .getPublicUrl(fileName);
            
            // Mettre à jour uniquement le thumbnail
            await supabase
              .from('build_sessions')
              .update({ thumbnail_url: publicUrl })
              .eq('id', sessionId);
            
            console.log('✅ Thumbnail capturé et enregistré:', publicUrl);
          }
        } else {
          console.warn('⚠️ Thumbnail capture returned null');
        }
      }
    } catch (error) {
      console.error('❌ Error capturing thumbnail:', error);
    }
  };

  // Fonction auxiliaire pour sauvegarder avec un titre spécifique
  const saveSessionWithTitle = async (title: string, filesArray: any[], messagesArray: any[]) => {
    if (!sessionId) return;

    try {
      const { error } = await supabase
        .from('build_sessions')
        .update({
          project_files: filesArray,
          messages: messagesArray as any,
          title: title,
          project_type: projectType,
          updated_at: new Date().toISOString()
        })
        .eq('id', sessionId);

      if (error) throw error;

      console.log('✅ Projet sauvegardé automatiquement:', title);
    } catch (error) {
      console.error('Erreur sauvegarde automatique:', error);
    }
  };

  // Helper: convertir Record<string, string> en array pour Supabase
  const convertFilesToArray = (filesObject: Record<string, string>) => {
    return Object.entries(filesObject).map(([path, content]) => ({
      path,
      content,
      type: path.endsWith('.html') ? 'html' : 
            path.endsWith('.css') ? 'stylesheet' : 
            path.endsWith('.js') ? 'javascript' : 'text'
    }));
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
        const updatedProjectFiles = { ...projectFiles, [faviconPath]: base64 };
        await supabase
          .from('build_sessions')
          .update({ 
            generated_html: updatedIndexHtml,
            project_files: convertFilesToArray(updatedProjectFiles)
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
    const prompt = inputValue.trim() || (messages.length === 1 && typeof messages[0].content === 'string' ? messages[0].content : '');
    
    if (!prompt && attachedFiles.length === 0) {
      sonnerToast.error("Veuillez entrer votre message ou joindre un fichier");
      return;
    }

    if (!user) {
      navigate('/auth');
      throw new Error('Authentication required');
    }

    // Construire le message
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

    const shouldAddMessage = inputValue.trim() || messages.length === 0 || messages[messages.length - 1]?.content !== userMessageContent;
    const newMessages = shouldAddMessage ? [...messages, { role: 'user' as const, content: userMessageContent }] : messages;
    
    if (shouldAddMessage) {
      setMessages(newMessages);
      
      const userMessageText = typeof userMessageContent === 'string' 
        ? userMessageContent 
        : (Array.isArray(userMessageContent) 
            ? userMessageContent.find(c => c.type === 'text')?.text || '[message multimédia]'
            : String(userMessageContent));

      await supabase
        .from('chat_messages')
        .insert({
          session_id: sessionId,
          role: 'user',
          content: userMessageText,
          metadata: { has_images: attachedFiles.length > 0 }
        });
    }
    
    setInputValue('');
    setAttachedFiles([]);

    // Préparer les fichiers pertinents
    const selectRelevantFiles = (prompt: string, files: Record<string, string>) => {
      const keywords = prompt.toLowerCase().split(/\s+/);
      const scored = Object.entries(files).map(([path, content]) => {
        let score = 0;
        keywords.forEach(k => {
          if (path.toLowerCase().includes(k)) score += 50;
          if (content.toLowerCase().includes(k)) score += 10;
        });
        if (path.includes('index.html') || path.includes('App.tsx')) score += 100;
        return { path, content, score };
      });
      
      return scored
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);
    };

    const userPrompt = typeof userMessageContent === 'string' 
      ? userMessageContent 
      : (Array.isArray(userMessageContent) 
          ? userMessageContent.find(c => c.type === 'text')?.text || ''
          : String(userMessageContent));

    const relevantFilesArray = selectRelevantFiles(userPrompt, projectFiles);
    
    const chatHistory = messages.slice(-3).map(m => ({
      role: m.role,
      content: typeof m.content === 'string' ? m.content : '[message multimédia]'
    }));

    let assistantMessage = '';
    const updatedFiles = { ...projectFiles };

    // Réinitialiser les événements pour une nouvelle requête
    setAiEvents([]);
    setCurrentMessageEvents([]);
    
    // 🔒 TOUJOURS activer le mode "génération en cours" pour bloquer la preview jusqu'à completion
    setIsInitialGeneration(true);
    isInitialGenerationRef.current = true;
    
    // Générer automatiquement un nom de projet si les fichiers sont vides
    if (Object.keys(projectFiles).length === 0) {
      generateProjectName(userPrompt);
    }

    // Ajouter le type de projet au contexte
    // Pour le mode mobile, toujours forcer React Native/Expo
    const projectContext = `Generate a REACT NATIVE application using Expo for mobile devices.
    
INSTRUCTIONS CRITIQUES - STRUCTURE DE FICHIERS:
1. Tu DOIS générer ces fichiers dans cet ordre exact:
   a. package.json - Contient toutes les dépendances Expo/React Native
   b. App.js - Point d'entrée principal de l'application
   c. (optionnel) components/*.js - Composants réutilisables si nécessaire

2. CONTENU OBLIGATOIRE du package.json:
{
  "name": "magellan-mobile-app",
  "version": "1.0.0",
  "main": "App.js",
  "dependencies": {
    "expo": "~50.0.0",
    "expo-status-bar": "~1.11.1",
    "react": "18.2.0",
    "react-native": "0.73.0"
  }
}

3. CONTENU OBLIGATOIRE du App.js:
- Import React et composants React Native (View, Text, ScrollView, StyleSheet, etc.)
- Export default function App()
- Utilise StyleSheet.create() pour tous les styles
- Composants React Native UNIQUEMENT (pas de HTML/JSX web)

4. COMPOSANTS REACT NATIVE autorisés:
   View, Text, ScrollView, Image, TouchableOpacity, TextInput, FlatList, StatusBar

5. STYLES:
   - TOUJOURS utiliser StyleSheet.create()
   - Pas de CSS inline complexe
   - Propriétés React Native uniquement (flex, padding, margin, backgroundColor, etc.)

EXEMPLE DE STRUCTURE COMPLÈTE:
// App.js
import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';

export default function App() {
  return (
    <View style={styles.container}>
      <StatusBar style="auto" />
      <ScrollView style={styles.scrollView}>
        <Text style={styles.title}>Mon Application</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    padding: 20,
  },
});

Now generate the mobile app based on this request:`;

    // Appeler l'API Agent avec callbacks
    let usedTokens = { input: 0, output: 0, total: 0 };

    await agent.callAgent(
      `${projectContext}\n\n${userPrompt}`,
      projectFiles,
      relevantFilesArray,
      chatHistory,
      sessionId!,
      projectType,
      attachedFiles,
      {
        onStatus: (status) => {
          console.log('📊 Status:', status);
          setAiEvents(prev => [...prev, { type: 'status', content: status }]);
        },
        onMessage: (message) => {
          assistantMessage += message;
          setMessages(prev => {
            const withoutLastAssistant = prev.filter((m, i) => 
              !(i === prev.length - 1 && m.role === 'assistant')
            );
            return [...withoutLastAssistant, { role: 'assistant' as const, content: assistantMessage }];
          });
        },
        onLog: (log) => {
          console.log('📝 Log:', log);
          setAiEvents(prev => [...prev, { type: 'log', content: log }]);
        },
        onIntent: (intent) => {
          console.log('🎯 Intent:', intent);
          setAiEvents(prev => [...prev, intent]);
        },
        onGenerationEvent: (event) => {
          console.log('🔄 Generation:', event);
          setGenerationEvents(prev => [...prev, event]);
          setCurrentMessageEvents(prev => [...prev, event]);
        },
        onTokens: (tokens) => {
          usedTokens = tokens;
        },
        onCodeUpdate: (path, code) => {
          console.log('📦 Accumulating file:', path);
          setAiEvents(prev => [...prev, { type: 'code_update', path, code }]);
          updatedFiles[path] = code;
          
          // ⏸️ NE JAMAIS mettre à jour la preview pendant la génération
          // Les fichiers seront appliqués tous ensemble dans onComplete
          
          if (path === 'index.html') {
            setGeneratedHtml(code);
          }
          
          if (selectedFile === path || !selectedFile) {
            setSelectedFile(path);
            setSelectedFileContent(code);
          }
        },
        onComplete: async () => {
          console.log('✅ Génération terminée - Validation des fichiers avant affichage');
          setAiEvents(prev => [...prev, { type: 'complete' }]);
          
          // 🔍 VALIDATION CRITIQUE : Pour React Native, vérifier App.js
          const hasAppJs = 'App.js' in updatedFiles || 'App.jsx' in updatedFiles || 'App.tsx' in updatedFiles;
          const appFile = updatedFiles['App.js'] || updatedFiles['App.jsx'] || updatedFiles['App.tsx'] || '';
          
          console.log('📊 Validation fichiers React Native:', {
            hasAppJs,
            appFileLength: appFile.length,
            files: Object.keys(updatedFiles)
          });
          
          // ⚠️ ERREURS CRITIQUES - Validation stricte pour React Native
          if (!hasAppJs) {
            console.error('❌ FICHIER App.js MANQUANT');
            sonnerToast.error('Fichier App.js manquant. Impossible d\'afficher la preview mobile.');
            setGenerationEvents(prev => [...prev, { 
              type: 'error', 
              message: 'App.js file is missing' 
            }]);
            setIsInitialGeneration(false);
            isInitialGenerationRef.current = false;
            return;
          }
          
          // Validation du contenu App.js (doit être substantiel)
          if (appFile.length < 100) {
            console.error('❌ App.js VIDE OU TROP COURT:', appFile.length, 'caractères');
            sonnerToast.error('Le fichier App.js est vide ou incomplet. Impossible d\'afficher la preview.');
            setGenerationEvents(prev => [...prev, { 
              type: 'error', 
              message: 'App.js file is empty or too short' 
            }]);
            setIsInitialGeneration(false);
            isInitialGenerationRef.current = false;
            return;
          }
          
          // Vérifier que le code React Native est valide
          const hasReactImport = appFile.includes('react');
          const hasReactNativeImport = appFile.includes('react-native');
          
          if (!hasReactImport || !hasReactNativeImport) {
            console.error('❌ App.js INVALIDE: imports React/React Native manquants');
            sonnerToast.error('Le fichier App.js ne contient pas les imports React Native nécessaires.');
            setGenerationEvents(prev => [...prev, { 
              type: 'error', 
              message: 'Invalid React Native code: missing imports' 
            }]);
            setIsInitialGeneration(false);
            isInitialGenerationRef.current = false;
            return;
          }
          
          // ✅ VALIDATION RÉUSSIE
          console.log('✅ Validation réussie - Préparation de la sauvegarde');
          setGenerationEvents(prev => [...prev, { type: 'complete', message: 'React Native app generated successfully' }]);
          
          // Sauvegarder les fichiers
          const filesArray = Object.entries(updatedFiles).map(([path, content]) => ({
            path,
            content,
            type: path.endsWith('.html') ? 'html' : 
                  path.endsWith('.css') ? 'stylesheet' : 
                  path.endsWith('.js') ? 'javascript' : 'text'
          }));

          // Créer un message de conclusion simple
          const filesChangedList = Object.keys(updatedFiles);
          const newFiles = filesChangedList.filter(path => !projectFiles[path]);
          const modifiedFiles = filesChangedList.filter(path => projectFiles[path]);
          
          let finalMessage = '';
          
          // Si c'est la première génération
          if (isInitialGenerationRef.current) {
            if (newFiles.length > 0) {
              finalMessage = `J'ai créé votre application mobile avec ${newFiles.length} fichier${newFiles.length > 1 ? 's' : ''} !`;
            } else {
              finalMessage = '✨ Votre application mobile est prête !';
            }
          } else {
            // Pour les modifications
            if (newFiles.length > 0 && modifiedFiles.length > 0) {
              finalMessage = `J'ai créé ${newFiles.length} fichier${newFiles.length > 1 ? 's' : ''} et modifié ${modifiedFiles.length} fichier${modifiedFiles.length > 1 ? 's' : ''}.`;
            } else if (newFiles.length > 0) {
              finalMessage = `J'ai créé ${newFiles.length} fichier${newFiles.length > 1 ? 's' : ''}.`;
            } else if (modifiedFiles.length > 0) {
              finalMessage = `J'ai modifié ${modifiedFiles.length} fichier${modifiedFiles.length > 1 ? 's' : ''}.`;
            } else {
              finalMessage = '✨ Modifications appliquées !';
            }
          }
          const updatedMessages = [...newMessages, { role: 'assistant' as const, content: finalMessage }];
          
          // Sauvegarder automatiquement le projet avec le nom généré
          if (websiteTitle && websiteTitle !== 'Sans titre') {
            console.log('💾 Sauvegarde automatique du projet:', websiteTitle);
            await saveSessionWithTitle(websiteTitle, filesArray, updatedMessages);
          }
          

          // Sauvegarder dans chat_messages avec token_count exact et project_files
          const { data: insertedMessage } = await supabase
            .from('chat_messages')
            .insert({
              session_id: sessionId,
              role: 'assistant',
              content: finalMessage,
              token_count: usedTokens.total, // Utiliser les tokens exacts de Claude
              metadata: { 
                files_updated: Object.keys(updatedFiles).length,
                project_files: updatedFiles, // Sauvegarder l'état des fichiers à ce moment
                input_tokens: usedTokens.input,
                output_tokens: usedTokens.output,
                total_tokens: usedTokens.total,
                generation_events: currentMessageEvents // Sauvegarder les events pour affichage groupé
              }
            })
            .select()
            .single();

          // Mettre à jour le message avec l'ID et token_count exact
          const messageWithId = { 
            role: 'assistant' as const, 
            content: finalMessage,
            token_count: usedTokens.total,
            id: insertedMessage?.id,
            metadata: {
              input_tokens: usedTokens.input,
              output_tokens: usedTokens.output,
              total_tokens: usedTokens.total,
              project_files: updatedFiles,
              generation_events: currentMessageEvents
            }
          };
          const updatedMessagesWithId = [...newMessages, messageWithId];
          setMessages(updatedMessagesWithId);

          // Mettre à jour build_sessions avec format array
          await supabase
            .from('build_sessions')
            .update({
              project_files: convertFilesToArray(updatedFiles),
              messages: updatedMessagesWithId as any,
              updated_at: new Date().toISOString()
            })
            .eq('id', sessionId);

          // 📸 Capturer le thumbnail UNIQUEMENT après une génération réussie
          console.log('📸 Capture du thumbnail après génération...');
          await captureThumbnail(updatedFiles['index.html'] || updatedFiles['app.html'] || Object.values(updatedFiles).find(f => typeof f === 'string' && f.includes('<html')));

          // ✅ MAINTENANT on peut appliquer les fichiers à la preview
          console.log('📦 Application des fichiers à la preview:', Object.keys(updatedFiles));
          setProjectFiles({ ...updatedFiles });
          
          // Attendre que Sandpack soit prêt avant de désactiver le mode génération
          setTimeout(() => {
            // Désactiver le mode "génération en cours"
            setIsInitialGeneration(false);
            isInitialGenerationRef.current = false;
            
            // Forcer le passage en mode preview
            if (viewMode !== 'preview') {
              setViewMode('preview');
            }
          }, 1500); // Délai pour laisser Sandpack initialiser la preview

          sonnerToast.success('Modifications terminées !');
        },
        onError: (error) => {
          sonnerToast.error(`Erreur: ${error}`);
        }
      }
    );
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
      let filesToDeploy: Record<string, string> = { ...projectFiles };

      // 🔧 EXTRACTION AUTOMATIQUE : Si index.html contient du CSS/JS inline, extraire dans des fichiers séparés
      const indexHtml = filesToDeploy['index.html'];
      if (indexHtml && (indexHtml.includes('<style') || indexHtml.includes('<script'))) {
        console.warn('⚠️ Détection de CSS/JS inline dans index.html - Extraction automatique en cours...');
        
        // Extraire CSS depuis les balises <style>
        let extractedCss = '';
        const styleMatches = indexHtml.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi);
        for (const match of styleMatches) {
          extractedCss += match[1] + '\n';
        }
        
        // Extraire JS depuis les balises <script> (sauf les modules externes)
        let extractedJs = '';
        const scriptMatches = indexHtml.matchAll(/<script(?![^>]*src=["'])(?![^>]*type=["']module["'])[^>]*>([\s\S]*?)<\/script>/gi);
        for (const match of scriptMatches) {
          extractedJs += match[1] + '\n';
        }
        
        // Nettoyer le HTML en supprimant les balises <style> et <script> inline
        let cleanHtml = indexHtml
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<script(?![^>]*src=["'])(?![^>]*type=["']module["'])[^>]*>[\s\S]*?<\/script>/gi, '');
        
        // Ajouter les liens vers les fichiers séparés si pas déjà présents
        if (!cleanHtml.includes('href="styles.css"')) {
          cleanHtml = cleanHtml.replace('</head>', '  <link rel="stylesheet" href="styles.css">\n</head>');
        }
        if (!cleanHtml.includes('src="script.js"')) {
          cleanHtml = cleanHtml.replace('</body>', '  <script src="script.js"></script>\n</body>');
        }
        
        // Remplacer dans les fichiers à déployer
        filesToDeploy['index.html'] = cleanHtml;
        
        // Créer ou fusionner styles.css
        if (extractedCss.trim()) {
          filesToDeploy['styles.css'] = (filesToDeploy['styles.css'] || '') + '\n' + extractedCss;
          console.log('✅ CSS extrait dans styles.css');
        }
        
        // Créer ou fusionner script.js
        if (extractedJs.trim()) {
          filesToDeploy['script.js'] = (filesToDeploy['script.js'] || '') + '\n' + extractedJs;
          console.log('✅ JavaScript extrait dans script.js');
        }
      }

      // Transformer en format attendu par l'API
      const files = Object.entries(filesToDeploy).map(([name, content]) => {
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

      // 🔍 VALIDATION : Vérifier qu'on a bien des fichiers CSS et JS séparés pour les sites HTML
      const hasHtml = files.some(f => f.name.endsWith('.html'));
      const hasCss = files.some(f => f.name.endsWith('.css'));
      const hasJs = files.some(f => f.name.endsWith('.js'));

      if (hasHtml && (!hasCss || !hasJs)) {
        sonnerToast.error("⚠️ Fichiers CSS et JS manquants. Le déploiement nécessite styles.css et script.js séparés pour Cloudflare Pages.");
        console.error('❌ Validation échouée:', { hasHtml, hasCss, hasJs, files: files.map(f => f.name) });
        return;
      }

      // Générer le nom du projet à partir du titre
      const projectName = cloudflareProjectName || (websiteTitle || 'mon-projet')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .substring(0, 50);

      sonnerToast.info("⚡ Publication instantanée via KV...");
      
      const deployRes = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/publish-to-kv`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId,
          projectFiles: files,
          projectName,
        }),
      });

      const result = await deployRes.json();
      
      if (!deployRes.ok) {
        throw new Error(result?.error || 'Erreur de publication');
      }
      
      if (!result?.success) {
        throw new Error(result?.error || 'Erreur de publication');
      }

      if (result.publicUrl) {
        setDeployedUrl(result.publicUrl);
        setCloudflareProjectName(projectName);
        
        sonnerToast.success(`✅ Publié en ${result.uploadTime} !`, {
          description: result.publicUrl,
          duration: 5000,
        });
      }
    } catch (error: any) {
      console.error('Error publishing:', error);
      sonnerToast.error(error.message || "❌ Erreur lors de la publication");
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
      <div className={`h-12 backdrop-blur-sm flex items-center justify-between px-4 ${isDark ? '' : 'bg-slate-50/80'}`} style={{ backgroundColor: isDark ? '#1F1F20' : undefined }}>
        <div className="flex items-center gap-3">
          <Button
            onClick={() => navigate('/dashboard')}
            variant="ghost"
            size="icon"
            className="h-8 w-8 hover:text-[#03A5C0] transition-colors"
            title="Dashboard"
          >
            <Home className="w-4 h-4" />
          </Button>
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
            <Button
              variant="iconOnly"
              size="sm"
              className={`h-7 px-2 text-xs ${viewMode === 'analytics' ? 'text-[#03A5C0]' : ''}`}
              onClick={() => setViewMode('analytics')}
            >
              <BarChart3 className="w-3 h-3 mr-1" />
              Analytics
            </Button>
          </div>

          <div className="h-6 w-px bg-slate-300" />

          <div className="flex items-center gap-2">
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
              size="minimal"
              className="text-sm gap-2 transition-all border rounded-full px-6"
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
              {messages.map((msg, idx) => {
                // Calculer si ce message est "inactif" (après la version courante)
                const isInactive = currentVersionIndex !== null && idx > currentVersionIndex;
                
                return (
                <div key={idx} className={isInactive ? 'opacity-40' : ''}>
                  {msg.role === 'user' ? (
                    <div className="flex justify-end">
                      <div className="max-w-[80%] rounded-2xl px-4 py-2.5 border border-[#03A5C0] bg-[#03A5C0]/10">
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
                      <img src="/lovable-uploads/icon_magellan.svg" alt="Magellan" className="w-7 h-7 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <div className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs ${isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
                            <Code2 className="w-3 h-3" />
                            <span>Magellan</span>
                          </div>
                        </div>
                        <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'} whitespace-pre-wrap`}>
                          {typeof msg.content === 'string' 
                            ? (msg.content.match(/\[EXPLANATION\](.*?)\[\/EXPLANATION\]/s)?.[1]?.trim() || msg.content)
                            : 'Contenu généré'
                          }
                        </p>
                        
                        {/* AI Tasks regroupées - uniquement pour les messages avec generation_events ET qui sont le dernier message assistant */}
                        {msg.metadata && typeof msg.metadata === 'object' && 'generation_events' in msg.metadata && 
                         idx === messages.filter(m => m.role === 'assistant').length + messages.filter(m => m.role === 'user').length - 1 && (
                          <div className="mt-3">
                            <CollapsedAiTasks 
                              events={msg.metadata.generation_events as GenerationEvent[]} 
                              isDark={isDark} 
                            />
                          </div>
                        )}
                        
                        {/* MessageActions - uniquement pour le dernier message assistant (récap final) */}
                        {idx === messages.filter(m => m.role === 'assistant').length + messages.filter(m => m.role === 'user').length - 1 && (
                          <MessageActions
                            content={typeof msg.content === 'string' ? msg.content : 'Contenu généré'}
                            messageIndex={idx}
                            isLatestMessage={idx === messages.length - 1}
                            tokenCount={msg.metadata && typeof msg.metadata === 'object' && 'total_tokens' in msg.metadata 
                              ? (msg.metadata.total_tokens as number) 
                              : msg.token_count}
                            onRestore={async (messageIdx) => {
                              const targetMessage = messages[messageIdx];
                              
                              if (targetMessage?.metadata && typeof targetMessage.metadata === 'object' && 'project_files' in targetMessage.metadata) {
                                const restoredFiles = targetMessage.metadata.project_files as Record<string, string>;
                                
                                if (Object.keys(restoredFiles).length > 0) {
                                  setProjectFiles(restoredFiles);
                                  
                                  // Ne pas tronquer les messages, juste marquer la version courante
                                  setCurrentVersionIndex(messageIdx);
                                  
                                  await supabase
                                    .from('build_sessions')
                                    .update({
                                      project_files: convertFilesToArray(restoredFiles),
                                      updated_at: new Date().toISOString()
                                    })
                                    .eq('id', sessionId);
                                  
                                  sonnerToast.success('Version restaurée avec succès !');
                                } else {
                                  sonnerToast.error('Impossible de restaurer cette version (fichiers non sauvegardés)');
                                }
                              } else {
                                sonnerToast.error('Les fichiers de cette version ne sont pas disponibles');
                              }
                            }}
                            onGoToPrevious={async () => {
                              const assistantMessages = messages
                                .map((m, i) => ({ message: m, index: i }))
                                .filter(({ message }) => message.role === 'assistant')
                                .slice(-15);
                              
                              // Trouver l'index actuel dans la liste des messages assistant
                              const currentAssistantIndex = currentVersionIndex !== null
                                ? assistantMessages.findIndex(a => a.index === currentVersionIndex)
                                : assistantMessages.length - 1;
                              
                              if (currentAssistantIndex <= 0) {
                                sonnerToast.error('Aucune version précédente disponible');
                                return;
                              }
                              
                              const previousMessage = assistantMessages[currentAssistantIndex - 1];
                              const targetMessage = previousMessage.message;
                              
                              if (targetMessage?.metadata && typeof targetMessage.metadata === 'object' && 'project_files' in targetMessage.metadata) {
                                const restoredFiles = targetMessage.metadata.project_files as Record<string, string>;
                                
                                if (Object.keys(restoredFiles).length > 0) {
                                  setProjectFiles(restoredFiles);
                                  
                                  // Ne pas tronquer les messages, juste marquer la version courante
                                  setCurrentVersionIndex(previousMessage.index);
                                  
                                  await supabase
                                    .from('build_sessions')
                                    .update({
                                      project_files: convertFilesToArray(restoredFiles),
                                      updated_at: new Date().toISOString()
                                    })
                                    .eq('id', sessionId);
                                  
                                  sonnerToast.success('Version précédente restaurée');
                                } else {
                                  sonnerToast.error('Impossible de restaurer cette version (fichiers non sauvegardés)');
                                }
                              }
                            }}
                            isDark={isDark}
                          />
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
              })}

              {/* Affichage des événements de génération en cours - toujours sauf premier prompt */}
              {!isInitialGeneration && (
                <div className="flex items-start gap-3 mb-4">
                  <img src="/lovable-uploads/icon_magellan.svg" alt="Magellan" className="w-7 h-7 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <CollapsedAiTasks events={currentMessageEvents} isDark={isDark} isLoading={agent.isLoading} />
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
                isLoading={agent.isLoading}
                showPlaceholderAnimation={false}
                showConfigButtons={false}
                modificationMode={true}
                inspectMode={inspectMode}
                onInspectToggle={() => setInspectMode(!inspectMode)}
                projectType={projectType}
                onProjectTypeChange={setProjectType}
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
        
        
          {/* Panel principal - Desktop en mode code, Mobile en mode preview */}
          <ResizablePanel 
            defaultSize={70} 
            minSize={viewMode === 'code' ? 70 : 70}
          >
            <div className="h-full flex flex-col" style={{ 
              backgroundColor: isDark ? '#0A0A0A' : '#F8F9FA'
            }}>
              {viewMode === 'preview' ? (
                // Mode Preview - Affichage Mobile
                <div className="h-full w-full flex justify-center items-start overflow-hidden" style={{ backgroundColor: isDark ? '#181818' : '#ffffff' }}>
                  <div className="w-[375px] h-full flex flex-col shadow-2xl rounded-3xl border overflow-hidden" style={{ backgroundColor: isDark ? '#1F1F20' : '#ffffff', borderColor: isDark ? 'rgb(51, 65, 85)' : '#ffffff' }}>
                    {isInitialGeneration ? (
                      <GeneratingPreview />
                    ) : (
                      <ExpoSnackPreview 
                        files={projectFiles} 
                        isDark={isDark}
                      />
                    )}
                  </div>
                </div>
              ) : viewMode === 'analytics' ? (
                // Mode Analytics
                <div className="h-full overflow-auto">
                  <CloudflareAnalytics 
                    sessionId={sessionId!}
                    isDark={isDark}
                  />
                </div>
              ) : (
                // Mode Code - Affichage Desktop Full Width
                <div className="h-full flex flex-col">
                  {/* Top Bar */}
                  <div 
                    className="border-b px-4 py-2 flex items-center justify-between"
                    style={{
                      backgroundColor: isDark ? '#1A1A1B' : '#FFFFFF',
                      borderColor: isDark ? '#2A2A2B' : '#E2E8F0'
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <Code2 
                        className="w-4 h-4"
                        style={{ color: '#03A5C0' }}
                      />
                      <span 
                        className="text-sm font-medium"
                        style={{ color: isDark ? '#E2E8F0' : '#1E293B' }}
                      >
                        Éditeur de Code
                      </span>
                    </div>
                    
                    {selectedFile && (
                      <Button
                        onClick={() => {
                          if (selectedFile) {
                            setProjectFiles({
                              ...projectFiles,
                              [selectedFile]: selectedFileContent
                            });
                            sonnerToast.success('Fichier enregistré !');
                          }
                        }}
                        size="sm"
                        style={{
                          borderColor: '#03A5C0',
                          backgroundColor: 'rgba(3,165,192,0.1)',
                          color: '#03A5C0'
                        }}
                        className="text-sm gap-2 transition-all border rounded-full px-4 py-0 font-medium"
                      >
                        <Save className="w-3 h-3" />
                        Sauvegarder
                      </Button>
                    )}
                  </div>

                  {/* Code Editor Area */}
                  <div className="flex-1 flex overflow-hidden">
                    {/* File Tree Sidebar */}
                    <div 
                      className="w-64 border-r flex flex-col"
                      style={{
                        backgroundColor: isDark ? '#0F0F10' : '#F8F9FA',
                        borderColor: isDark ? '#2A2A2B' : '#E2E8F0'
                      }}
                    >
                      <div 
                        className="px-4 py-3 border-b"
                        style={{
                          backgroundColor: isDark ? '#1A1A1B' : '#FFFFFF',
                          borderColor: isDark ? '#2A2A2B' : '#E2E8F0'
                        }}
                      >
                        <h3 
                          className="text-sm font-semibold"
                          style={{ color: isDark ? '#E2E8F0' : '#1E293B' }}
                        >
                          Fichiers
                        </h3>
                      </div>
                      <div className="flex-1 overflow-y-auto">
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
                    </div>

                    {/* Editor Area */}
                    <div className="flex-1 flex flex-col">
                      {/* File Tabs */}
                      {openFiles.length > 0 && (
                        <FileTabs
                          openFiles={openFiles}
                          activeFile={selectedFile}
                          onTabClick={(path) => {
                            setSelectedFile(path);
                            setSelectedFileContent(projectFiles[path] || '');
                          }}
                          onTabClose={(path) => {
                            setOpenFiles(openFiles.filter(f => f !== path));
                            if (selectedFile === path) {
                              const remainingFiles = openFiles.filter(f => f !== path);
                              if (remainingFiles.length > 0) {
                                const newSelectedFile = remainingFiles[remainingFiles.length - 1];
                                setSelectedFile(newSelectedFile);
                                setSelectedFileContent(projectFiles[newSelectedFile] || '');
                              } else {
                                setSelectedFile(null);
                                setSelectedFileContent('');
                              }
                            }
                          }}
                        />
                      )}

                      {/* Monaco Editor */}
                      <div className="flex-1">
                        {selectedFile ? (
                          <MonacoEditor
                            value={selectedFileContent}
                            language={selectedFile.split('.').pop() || 'txt'}
                            onChange={(value) => setSelectedFileContent(value || '')}
                          />
                        ) : (
                          <div 
                            className="h-full flex items-center justify-center"
                            style={{ backgroundColor: isDark ? '#0A0A0A' : '#FFFFFF' }}
                          >
                            <div className="text-center">
                              <FileText 
                                className="w-12 h-12 mx-auto mb-4 opacity-30"
                                style={{ color: isDark ? '#64748B' : '#94A3B8' }}
                              />
                              <p 
                                className="text-sm"
                                style={{ color: isDark ? '#64748B' : '#94A3B8' }}
                              >
                                Sélectionnez un fichier pour commencer
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
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
