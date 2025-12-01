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
import AiGenerationMessage from '@/components/chat/AiGenerationMessage';
import ChatOnlyMessage from '@/components/chat/ChatOnlyMessage';
import html2canvas from 'html2canvas';
import { TokenCounter } from '@/components/TokenCounter';
import { capturePreviewThumbnail } from '@/lib/capturePreviewThumbnail';
import { analyzeIntent, identifyRelevantFiles, estimateGenerationTime } from '@/utils/intentAnalyzer';
import { useModifySite } from '@/hooks/useModifySite';
import { ASTModification } from '@/types/ast';
import { useOptimizedBuilder } from '@/hooks/useOptimizedBuilder';
import { SyncStatusIndicator } from '@/components/SyncStatusIndicator';
import { PublishSuccessDialog } from '@/components/PublishSuccessDialog';

interface Message {
  role: 'user' | 'assistant';
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
  token_count?: number;
  id?: string;
  created_at?: string;
  metadata?: {
    type?: 'intro' | 'recap' | 'generation' | 'message';
    thought_duration?: number;
    intent_message?: string;
    generation_events?: any[];
    files_updated?: number;
    files_created?: number;
    files_modified?: number;
    new_files?: string[];
    modified_files?: string[];
    project_files?: Record<string, string>;
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
    [key: string]: any;
  };
}

import { IndexedDBCache } from '@/services/indexedDBCache';

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
  const [showPublishSuccess, setShowPublishSuccess] = useState(false);
  
  // Hook optimisé pour la gestion des fichiers avec cache et sync
  const {
    projectFiles,
    isLoading: filesLoading,
    syncStatus,
    lastSyncTime,
    pendingChanges,
    updateFiles,
    updateFile,
    saveNow,
    isOnline
  } = useOptimizedBuilder({
    sessionId: sessionId!,
    autoSave: true,
    debounceMs: 2000
  });
  
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
  
  // Hook pour les modifications rapides
  const modifySiteHook = useModifySite();
  
  // Événements IA pour la TaskList
  const [aiEvents, setAiEvents] = useState<AIEvent[]>([]);
  
  // État pour gérer les événements de génération en temps réel
  const [generationEvents, setGenerationEvents] = useState<GenerationEvent[]>([]);
  const generationEventsRef = useRef<GenerationEvent[]>([]); // Ref synchrone pour éviter stale state
  const generationStartTimeRef = useRef<number>(0);
  const [currentVersionIndex, setCurrentVersionIndex] = useState<number | null>(null);
  
  // État de chargement pour quick modification
  const [isQuickModLoading, setIsQuickModLoading] = useState(false);
  
  // Flag pour savoir si on est en première génération
  const [isInitialGeneration, setIsInitialGeneration] = useState(false);
  const isInitialGenerationRef = useRef(false);
  
  // Flag pour éviter de traiter le prompt initial plusieurs fois
  const [initialPromptProcessed, setInitialPromptProcessed] = useState(false);
  
  // Mode Inspect pour la preview interactive
  const [inspectMode, setInspectMode] = useState(false);
  
  // Mode Chat pour discuter avec Claude sans générer de code
  const [chatMode, setChatMode] = useState(false);
  
  // Mode d'affichage de la preview (desktop/mobile)
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop');

  // Fonction pour générer automatiquement un nom de projet
  const generateProjectName = async (prompt: string) => {
    try {
      console.log('🎯 Génération du nom de projet pour:', prompt.substring(0, 100));
      const { data, error } = await supabase.functions.invoke('generate-project-name', {
        body: { prompt }
      });

      if (error) {
        console.error('❌ Erreur génération nom:', error);
        return;
      }

      if (data?.projectName) {
        console.log('✅ Nom de projet généré:', data.projectName);
        setWebsiteTitle(data.projectName);
        
        // Sauvegarder immédiatement le titre dans la session
        if (sessionId) {
          const { error: updateError } = await supabase
            .from('build_sessions')
            .update({ title: data.projectName })
            .eq('id', sessionId);
          
          if (updateError) {
            console.error('❌ Erreur sauvegarde titre:', updateError);
          } else {
            console.log('💾 Titre sauvegardé dans la session:', data.projectName);
          }
        }
      }
    } catch (error) {
      console.error('❌ Erreur lors de la génération du nom:', error);
    }
  };


  // Charger la session depuis le cache puis Supabase
  useEffect(() => {
    const loadSessionWithCache = async () => {
      if (!sessionId) return;
      
      setSessionLoading(true);
      
      // 1. Charger d'abord depuis le cache IndexedDB (instantané)
      const cachedProject = await IndexedDBCache.getProject(sessionId);
      if (cachedProject?.projectFiles && Object.keys(cachedProject.projectFiles).length > 0) {
        console.log('📦 Loaded from IndexedDB cache:', Object.keys(cachedProject.projectFiles).length, 'files');
        updateFiles(cachedProject.projectFiles, false); // Ne pas trigger de save
      }
      
      // 2. Charger depuis Supabase en arrière-plan (pour sync)
      await loadSession();
      setSessionLoading(false);
    };
    
    loadSessionWithCache();
    checkAuth();
  }, [sessionId]);

  // Auto-save désactivé
  // useEffect(() => {
  //   if (!sessionId || Object.keys(projectFiles).length === 0) return;
  //   
  //   const autoSaveInterval = setInterval(() => {
  //     console.log('💾 Auto-sauvegarde périodique...');
  //     saveSession();
  //   }, 30000); // 30 secondes
  //
  //   return () => clearInterval(autoSaveInterval);
  // }, [sessionId, projectFiles, messages, websiteTitle]);

  // Sauvegarde avant fermeture de la page
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (sessionId && Object.keys(projectFiles).length > 0) {
        console.log('💾 Sauvegarde avant fermeture...');
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
        // Charger le nom du projet Cloudflare
        if (data.cloudflare_project_name) {
          setCloudflareProjectName(data.cloudflare_project_name);
        }
        
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
            
            // 🔧 Support de 3 formats: array, object direct, ou object-qui-était-un-array
            if (Array.isArray(projectFilesData) && projectFilesData.length > 0) {
              // Format array: [{path, content}, ...]
              console.log('📦 Loading project files (array format):', projectFilesData.length, 'files');
              projectFilesData.forEach((file: any, index: number) => {
                if (file.path && file.content) {
                  filesMap[file.path] = file.content;
                  console.log(`  ✅ [${index + 1}/${projectFilesData.length}] ${file.path} : ${file.content.length} chars`);
                } else {
                  console.warn(`  ⚠️ [${index + 1}/${projectFilesData.length}] Invalid file structure:`, { hasPath: !!file.path, hasContent: !!file.content });
                }
              });
            } else if (typeof projectFilesData === 'object' && Object.keys(projectFilesData).length > 0) {
              // Détecter si c'est un objet-qui-était-un-array: clés numériques avec {path, content}
              const firstKey = Object.keys(projectFilesData)[0];
              const firstValue = projectFilesData[firstKey];
              
              if (/^\d+$/.test(firstKey) && typeof firstValue === 'object' && firstValue.path && firstValue.content) {
                // Format object-array corrompu: {"0": {path, content}, "1": {...}}
                console.log('📦 Loading project files (corrupted array-as-object format):', Object.keys(projectFilesData).length, 'files');
                Object.values(projectFilesData).forEach((file: any, index: number) => {
                  if (file.path && file.content) {
                    filesMap[file.path] = file.content;
                    console.log(`  ✅ [${index + 1}] ${file.path} : ${file.content.length} chars`);
                  } else {
                    console.warn(`  ⚠️ [${index + 1}] Invalid file structure:`, { hasPath: !!file.path, hasContent: !!file.content });
                  }
                });
              } else {
                // Format object standard: {path: content, ...}
                console.log('📦 Loading project files (object format):', Object.keys(projectFilesData).length, 'files');
                filesMap = projectFilesData;
                Object.entries(filesMap).forEach(([path, content], index) => {
                  console.log(`  ✅ [${index + 1}/${Object.keys(filesMap).length}] ${path} : ${typeof content === 'string' ? content.length : 0} chars`);
                });
              }
            }
            
            // 🔍 Validation finale des noms de fichiers
            const validatedFilesMap: Record<string, string> = {};
            let hasInvalidKeys = false;
            
            Object.entries(filesMap).forEach(([key, value]) => {
              // Vérifier que la clé est un nom de fichier valide ET que la valeur est une string
              if (typeof key === 'string' && key.includes('.') && !(/^\d+$/.test(key)) && typeof value === 'string') {
                validatedFilesMap[key] = value;
              } else {
                console.warn('⚠️ Invalid file entry detected and skipped:', { key, valueType: typeof value });
                hasInvalidKeys = true;
              }
            });
            
            if (hasInvalidKeys) {
              console.warn('⚠️ Some invalid file keys were found and removed from the project');
            }
            
            if (Object.keys(validatedFilesMap).length > 0) {
              console.log('✅ =====================================');
              console.log('✅ PROJECT FILES RESTORATION SUCCESS');
              console.log('✅ Total files restored:', Object.keys(validatedFilesMap).length);
              console.log('✅ Files:', Object.keys(validatedFilesMap).join(', '));
              console.log('✅ =====================================');
              
              updateFiles(validatedFilesMap, false); // Pas de sync car c'est un chargement initial
              setGeneratedHtml(validatedFilesMap['index.html'] || '');
              
              // Charger le favicon s'il existe
              const faviconFile = Object.keys(validatedFilesMap).find(path => path.startsWith('public/favicon.'));
              if (faviconFile) {
                setCurrentFavicon(validatedFilesMap[faviconFile]);
                console.log('✅ Favicon restored:', faviconFile);
              }
              
              const firstFile = Object.keys(validatedFilesMap)[0];
              if (firstFile) {
                setSelectedFile(firstFile);
                setSelectedFileContent(validatedFilesMap[firstFile]);
                console.log('✅ First file selected:', firstFile);
              }
            } else {
              console.error('❌ =====================================');
              console.error('❌ PROJECT FILES RESTORATION FAILED');
              console.error('❌ No files found after parsing');
              console.error('❌ =====================================');
              // Pas besoin d'initialiser à vide, le hook le gère
              setGeneratedHtml('');
            }
          } else {
            console.error('❌ =====================================');
            console.error('❌ PROJECT FILES DATA IS NULL/UNDEFINED');
            console.error('❌ Cannot restore project files');
            console.error('❌ =====================================');
            // Pas besoin d'initialiser à vide, le hook le gère
            setGeneratedHtml('');
          }
        } catch (err) {
          console.error('❌ Error parsing project_files:', err);
          // Pas besoin d'initialiser à vide, le hook le gère
          setGeneratedHtml('');
        }

        // Charger l'historique complet des messages depuis chat_messages
        const { data: chatMessages, error: chatError } = await supabase
          .from('chat_messages')
          .select('*')
          .eq('session_id', sessionId)
          .order('created_at', { ascending: true });

        if (!chatError && chatMessages && chatMessages.length > 0) {
          const loadedMessages: Message[] = chatMessages.map(msg => {
            const metadata = msg.metadata as any;
            return {
              role: msg.role as 'user' | 'assistant',
              content: msg.content,
              token_count: msg.token_count ?? metadata?.total_tokens ?? undefined,
              id: msg.id,
              created_at: msg.created_at,
              metadata: metadata ? {
                ...metadata,
                total_tokens: metadata.total_tokens ?? msg.token_count ?? 0,
                input_tokens: metadata.input_tokens ?? 0,
                output_tokens: metadata.output_tokens ?? 0
              } : undefined
            };
          });
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
        
        // Charger le titre et s'assurer qu'il est synchronisé avec cloudflare_project_name
        const loadedTitle = data.title || '';
        setWebsiteTitle(loadedTitle);
        console.log('📋 Titre du projet chargé:', loadedTitle);
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
      // 🔧 CORRECTION: Sauvegarder directement en format object {path: content}
      // au lieu d'array pour éviter la corruption par PostgreSQL
      const filesObject = { ...projectFiles };

      // Récupérer le thumbnail existant
      const { data: existingSession } = await supabase
        .from('build_sessions')
        .select('thumbnail_url')
        .eq('id', sessionId)
        .single();

      const { error } = await supabase
        .from('build_sessions')
        .update({
          project_files: filesObject,
          messages: messages as any,
          title: websiteTitle,
          project_type: projectType,
          thumbnail_url: existingSession?.thumbnail_url || null, // Garder le thumbnail existant
          updated_at: new Date().toISOString()
        })
        .eq('id', sessionId);

      if (error) throw error;

      // Publier automatiquement le projet sur builtbymagellan.com
      if (websiteTitle && Object.keys(projectFiles).length > 0) {
        try {
          console.log('🚀 Publishing project to builtbymagellan.com...');
          const { data: publishData, error: publishError } = await supabase.functions.invoke('publish-project', {
            body: { sessionId }
          });

          if (publishError) {
            console.error('❌ Error publishing project:', publishError);
          } else if (publishData?.publicUrl) {
            console.log('✅ Project published at:', publishData.publicUrl);
          }
        } catch (publishErr) {
          console.error('❌ Error calling publish function:', publishErr);
        }
      }
    } catch (error) {
      console.error('Error saving session:', error);
    }
  };

  // Fonction pour capturer le thumbnail UNIQUEMENT après une génération
  const captureThumbnail = async (htmlContent?: string) => {
    const contentToCapture = htmlContent || generatedHtml;
    if (!sessionId || !contentToCapture) return;

    try {
      console.log('📸 Capture du thumbnail après génération...');
      
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
    } catch (error) {
      console.error('❌ Error capturing thumbnail:', error);
    }
  };

  // Fonction auxiliaire pour sauvegarder avec un titre spécifique
  const saveSessionWithTitle = async (title: string, filesObject: Record<string, string>, messagesArray: any[]) => {
    if (!sessionId) return;

    try {
      const { error } = await supabase
        .from('build_sessions')
        .update({
          project_files: filesObject,
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
      updateFiles({
        ...projectFiles,
        [faviconPath]: base64
      }, true);

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

  // Fonction pour gérer la génération complète (mode original avec loading preview)
  const handleFullGeneration = async (userPromptInput?: string) => {
    const prompt = userPromptInput || inputValue.trim() || (messages.length === 1 && typeof messages[0].content === 'string' ? messages[0].content : '');
    
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

    // Vérifier si le message utilisateur n'est pas déjà le dernier message
    const lastMessage = messages[messages.length - 1];
    const isUserMessageAlreadyAdded = lastMessage && 
                                      lastMessage.role === 'user' && 
                                      lastMessage.content === userMessageContent;
    
    if (!isUserMessageAlreadyAdded) {
      const newMessages = [...messages, { 
        role: 'user' as const, 
        content: userMessageContent,
        created_at: new Date().toISOString()
      }];
      
      setMessages(newMessages);
      
      const userMessageText = typeof userMessageContent === 'string' 
        ? userMessageContent 
        : (Array.isArray(userMessageContent) 
            ? userMessageContent.find(c => c.type === 'text')?.text || '[message multimédia]'
            : String(userMessageContent));

      const { error: insertError } = await supabase
        .from('chat_messages')
        .insert({
          session_id: sessionId,
          role: 'user',
          content: userMessageText,
          created_at: new Date().toISOString(),
          token_count: 0,
          metadata: { 
            has_images: attachedFiles.length > 0,
            attachedFiles: attachedFiles.length > 0 ? attachedFiles : undefined
          }
        });
      
      if (insertError) {
        console.error('❌ Erreur insertion message utilisateur:', insertError);
      }
    }
    
    setInputValue('');
    setAttachedFiles([]);

    // Créer immédiatement le message d'intro avec toutes les métadonnées nécessaires
    const introMessage: Message = {
      role: 'assistant',
      content: "Je vais analyser votre demande et effectuer les modifications nécessaires...",
      created_at: new Date().toISOString(),
      metadata: {
        type: 'generation',
        thought_duration: 0,
        intent_message: 'Analyzing your request...',
        generation_events: [],
        files_created: 0,
        files_modified: 0,
        new_files: [],
        modified_files: [],
        total_tokens: 0
      }
    };
    
    setMessages(prev => [...prev, introMessage]);

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
    let usedTokens = { input: 0, output: 0, total: 0 };

    // Réinitialiser les événements pour une nouvelle requête
    setAiEvents([]);
    setGenerationEvents([]);
    generationEventsRef.current = []; // Réinitialiser la ref
    generationStartTimeRef.current = Date.now();
    
    // 🔒 TOUJOURS activer le mode "génération en cours" pour bloquer la preview jusqu'à completion
    setIsInitialGeneration(true);
    isInitialGenerationRef.current = true;
    
    // Générer automatiquement un nom de projet si les fichiers sont vides
    if (Object.keys(projectFiles).length === 0) {
      generateProjectName(userPrompt);
    }

    // Ajouter le type de projet au contexte
    const projectContext = projectType === 'website' 
      ? 'Generate a static website with HTML, CSS, and vanilla JavaScript files only. No React, no JSX. Use simple HTML structure.'
      : projectType === 'webapp'
      ? 'Generate a React web application with TypeScript/JSX. Use React components and modern web technologies.'
      : 'Generate a mobile-optimized React application with responsive design for mobile devices.';

    // Appeler l'API Agent avec callbacks
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
          // On accumule simplement la réponse de l'agent sans modifier le chat en temps réel
          // pour conserver la structure intro + AI tasks + récap uniquement.
          assistantMessage += message;
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
          generationEventsRef.current = [...generationEventsRef.current, event]; // Mettre à jour la ref de façon synchrone
          setGenerationEvents(prev => [...prev, event]);
          
          // Mettre à jour le message intro avec les nouveaux événements
          setMessages(prev => {
            const lastMessage = prev[prev.length - 1];
            if (lastMessage && (lastMessage.metadata?.type === 'generation' || lastMessage.metadata?.type === 'intro')) {
              return prev.map((msg, idx) => 
                idx === prev.length - 1
                  ? { 
                      ...msg, 
                      metadata: { 
                        ...msg.metadata, 
                        generation_events: [...(msg.metadata.generation_events || []), event],
                        thought_duration: event.type === 'thought' ? Date.now() - generationStartTimeRef.current : msg.metadata.thought_duration
                      }
                    }
                  : msg
              );
            }
            return prev;
          });
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
          
          // Ajouter l'événement complete au message intro
          setMessages(prev => {
            const lastMessage = prev[prev.length - 1];
            if (lastMessage && (lastMessage.metadata?.type === 'generation' || lastMessage.metadata?.type === 'intro')) {
              return prev.map((msg, idx) => 
                idx === prev.length - 1
                  ? { 
                      ...msg, 
                      metadata: { 
                        ...msg.metadata, 
                        generation_events: [...(msg.metadata.generation_events || []), { type: 'complete' as const, message: 'Generation completed' }],
                        thought_duration: Date.now() - generationStartTimeRef.current
                      }
                    }
                  : msg
              );
            }
            return prev;
          });
          
          // 🔍 VALIDATION CRITIQUE : Vérifier que les fichiers essentiels sont créés et NON VIDES
          const hasHtml = 'index.html' in updatedFiles;
          const hasCss = 'styles.css' in updatedFiles;
          const hasJs = 'script.js' in updatedFiles;
          
          const htmlContent = updatedFiles['index.html'] || '';
          const cssContent = updatedFiles['styles.css'] || '';
          const jsContent = updatedFiles['script.js'] || '';
          
          console.log('📊 Validation fichiers:', {
            hasHtml, hasCss, hasJs,
            htmlLength: htmlContent.length,
            cssLength: cssContent.length,
            jsLength: jsContent.length
          });
          
          // Vérifier que index.html contient bien les liens vers CSS et JS
          const hasStyleLink = htmlContent.includes('href="styles.css"') || htmlContent.includes("href='styles.css'");
          const hasScriptLink = htmlContent.includes('src="script.js"') || htmlContent.includes("src='script.js'");
          
          // ⚠️ ERREURS CRITIQUES - Validation stricte de tous les fichiers
          if (!hasHtml || !hasCss || !hasJs) {
            const missing = [];
            if (!hasHtml) missing.push('index.html');
            if (!hasCss) missing.push('styles.css');
            if (!hasJs) missing.push('script.js');
            
            console.error('❌ FICHIERS MANQUANTS:', missing);
            sonnerToast.error(`Fichiers manquants: ${missing.join(', ')}. Impossible d'afficher la preview.`);
            setGenerationEvents(prev => [...prev, { 
              type: 'error', 
              message: `Fichiers manquants: ${missing.join(', ')}` 
            }]);
            setIsInitialGeneration(false);
            isInitialGenerationRef.current = false;
            return;
          }
          
          // Validation du contenu HTML (doit être substantiel)
          if (htmlContent.length < 200) {
            console.error('❌ HTML VIDE OU TROP COURT:', htmlContent.length, 'caractères');
            sonnerToast.error('Le fichier HTML est vide ou incomplet. Impossible d\'afficher la preview.');
            setGenerationEvents(prev => [...prev, { 
              type: 'error', 
              message: 'HTML file is empty or too short' 
            }]);
            setIsInitialGeneration(false);
            isInitialGenerationRef.current = false;
            return;
          }
          
          // Validation du contenu CSS (doit être substantiel)
          if (cssContent.length < 100) {
            console.error('❌ CSS VIDE OU TROP COURT:', cssContent.length, 'caractères');
            sonnerToast.error('Le fichier CSS est vide ou incomplet. Impossible d\'afficher la preview.');
            setGenerationEvents(prev => [...prev, { 
              type: 'error', 
              message: 'CSS file is empty or too short' 
            }]);
            setIsInitialGeneration(false);
            isInitialGenerationRef.current = false;
            return;
          }
          
          // Validation du contenu JS (doit exister, peut être court si pas de logique)
          if (jsContent.length < 10) {
            console.error('❌ JS VIDE OU TROP COURT:', jsContent.length, 'caractères');
            sonnerToast.error('Le fichier JavaScript est vide ou incomplet. Impossible d\'afficher la preview.');
            setGenerationEvents(prev => [...prev, { 
              type: 'error', 
              message: 'JS file is empty or too short' 
            }]);
            setIsInitialGeneration(false);
            isInitialGenerationRef.current = false;
            return;
          }
          
          if (!hasStyleLink || !hasScriptLink) {
            console.error('❌ LIENS CSS/JS MANQUANTS dans index.html');
            sonnerToast.error('Les liens CSS/JS ne sont pas présents dans index.html');
            setGenerationEvents(prev => [...prev, { 
              type: 'error', 
              message: 'Missing CSS/JS links in HTML' 
            }]);
            setIsInitialGeneration(false);
            isInitialGenerationRef.current = false;
            return;
          }
          
          // ✅ VALIDATION RÉUSSIE
          console.log('✅ Validation réussie - Préparation de la sauvegarde');
          setGenerationEvents(prev => [...prev, { type: 'complete', message: 'All files generated successfully' }]);

          // Créer les messages pour la conversation
          const filesChangedList = Object.keys(updatedFiles);
          const newFiles = filesChangedList.filter(path => !projectFiles[path]);
          const modifiedFiles = filesChangedList.filter(path => projectFiles[path]);
          
          // Calculer la durée de génération en millisecondes
          const generationDuration = Date.now() - generationStartTimeRef.current;
          
          // Générer le message d'intent
          const intentMessage = isInitialGenerationRef.current
            ? "Je vais créer votre site..."
            : newFiles.length > 0 && modifiedFiles.length > 0
            ? `Je vais créer ${newFiles.length} fichier${newFiles.length > 1 ? 's' : ''} et modifier ${modifiedFiles.length} fichier${modifiedFiles.length > 1 ? 's' : ''}...`
            : newFiles.length > 0
            ? `Je vais créer ${newFiles.length} fichier${newFiles.length > 1 ? 's' : ''}...`
            : modifiedFiles.length > 0
            ? `Je vais modifier ${modifiedFiles.length} fichier${modifiedFiles.length > 1 ? 's' : ''}...`
            : 'Je vais appliquer les modifications...';
          
          // Générer un message de conclusion détaillé et contextuel
          const getDetailedConclusion = (): string => {
            if (isInitialGenerationRef.current) {
              return `Votre site a été créé avec ${newFiles.length} fichier${newFiles.length > 1 ? 's' : ''} incluant HTML, CSS, JavaScript${newFiles.some(f => f.includes('image')) ? ' et images' : ''}. Le site est maintenant prêt à être publié.`;
            }
            
            const details: string[] = [];
            if (newFiles.length > 0) {
              details.push(`${newFiles.length} nouveau${newFiles.length > 1 ? 'x' : ''} fichier${newFiles.length > 1 ? 's' : ''} créé${newFiles.length > 1 ? 's' : ''}`);
            }
            if (modifiedFiles.length > 0) {
              details.push(`${modifiedFiles.length} fichier${modifiedFiles.length > 1 ? 's' : ''} modifié${modifiedFiles.length > 1 ? 's' : ''}`);
            }
            
            const detailsStr = details.join(' et ');
            return `${detailsStr.charAt(0).toUpperCase() + detailsStr.slice(1)}. Les modifications ont été appliquées avec succès au projet.`;
          };
          
          const conclusionMessage = getDetailedConclusion();

          // 💾 Sauvegarder UN SEUL message unifié style Lovable
          console.log('💾 =====================================');
          console.log('💾 SAVING UNIFIED GENERATION MESSAGE');
          console.log('💾 Files to save:', Object.keys(updatedFiles).length);
          console.log('💾 File list:', Object.keys(updatedFiles).join(', '));
          console.log('💾 Total tokens:', usedTokens.total);
          console.log('💾 Generation duration:', generationDuration, 'ms');
          console.log('💾 Generation events (ref):', generationEventsRef.current.length);
          console.log('💾 =====================================');
          
          // Insérer le message unifié avec toutes les métadonnées
          const { data: insertedMessage } = await supabase
            .from('chat_messages')
            .insert([{
              session_id: sessionId,
              role: 'assistant',
              content: conclusionMessage,
              token_count: usedTokens.total,
              created_at: new Date().toISOString(),
              metadata: { 
                type: 'generation' as const,
                thought_duration: generationDuration,
                intent_message: intentMessage,
                generation_events: generationEventsRef.current, // Utiliser la ref au lieu du state
                files_created: newFiles.length,
                files_modified: modifiedFiles.length,
                new_files: newFiles,
                modified_files: modifiedFiles,
                project_files: updatedFiles,
                input_tokens: usedTokens.input,
                output_tokens: usedTokens.output,
                total_tokens: usedTokens.total,
                saved_at: new Date().toISOString()
              }
            }])
            .select()
            .single();

          // Mettre à jour l'interface avec le message unifié
          setMessages(prev => {
            // Retirer tous les messages temporaires
            const withoutTemp = prev.filter(m => !(m.role === 'assistant' && !m.id));
            
            return [
              ...withoutTemp,
              { 
                role: 'assistant' as const, 
                content: conclusionMessage,
                token_count: usedTokens.total,
                id: insertedMessage?.id,
                created_at: new Date().toISOString(),
                metadata: { 
                  type: 'generation' as const,
                  thought_duration: generationDuration,
                  intent_message: intentMessage,
                  generation_events: generationEventsRef.current, // Utiliser la ref au lieu du state
                  files_created: newFiles.length,
                  files_modified: modifiedFiles.length,
                  new_files: newFiles,
                  modified_files: modifiedFiles,
                  project_files: updatedFiles,
                  input_tokens: usedTokens.input,
                  output_tokens: usedTokens.output,
                  total_tokens: usedTokens.total
                }
              }
            ];
          });

          // 💰 Décompter les tokens du profil utilisateur
          if (user?.id && usedTokens.total > 0) {
            console.log('💰 Mise à jour des tokens utilisés:', usedTokens.total);
            
            try {
              // Récupérer les tokens actuels
              const { data: profile, error: fetchError } = await supabase
                .from('profiles')
                .select('tokens_used')
                .eq('id', user.id)
                .single();
              
              if (fetchError) {
                console.error('❌ Erreur récupération profil:', fetchError);
                throw fetchError;
              }
              
              if (profile) {
                const newTokensUsed = (profile.tokens_used || 0) + usedTokens.total;
                
                console.log('💰 Tokens actuels:', profile.tokens_used || 0);
                console.log('💰 Nouveaux tokens utilisés:', newTokensUsed);
                
                // Mettre à jour le profil avec les nouveaux tokens
                const { error: updateError } = await supabase
                  .from('profiles')
                  .update({ 
                    tokens_used: newTokensUsed
                  })
                  .eq('id', user.id);
                
                if (updateError) {
                  console.error('❌ Erreur mise à jour tokens:', updateError);
                  throw updateError;
                }
                
                console.log('✅ Tokens mis à jour avec succès:', newTokensUsed);
              } else {
                console.warn('⚠️ Profil utilisateur introuvable');
              }
            } catch (error) {
              console.error('❌ Erreur déduction tokens:', error);
              sonnerToast.error('Erreur lors de la mise à jour des tokens');
            }
          }
          
          
          // Sauvegarder automatiquement le projet avec le nom généré
          if (websiteTitle && websiteTitle !== 'Sans titre') {
            console.log('💾 Sauvegarde automatique du projet:', websiteTitle);
            await saveSessionWithTitle(websiteTitle, updatedFiles, messages);
          }

          // Mettre à jour build_sessions avec format object
          await supabase
            .from('build_sessions')
            .update({
              project_files: updatedFiles,
              updated_at: new Date().toISOString()
            })
            .eq('id', sessionId);

          // 📸 Capturer le thumbnail UNIQUEMENT après une génération réussie
          console.log('📸 Capture du thumbnail après génération...');
          await captureThumbnail(updatedFiles['index.html'] || updatedFiles['app.html']);

          // ✅ MAINTENANT on peut appliquer les fichiers à la preview
          console.log('📦 Application des fichiers à la preview:', Object.keys(updatedFiles));
          await updateFiles(updatedFiles, true);
          console.log('✅ Fichiers sauvegardés et prêts pour la preview');
          
          // Attendre que React re-rendre avec les nouveaux fichiers avant d'afficher la preview
          setTimeout(() => {
            // Désactiver le mode "génération en cours"
            setIsInitialGeneration(false);
            isInitialGenerationRef.current = false;
            
            // Forcer le passage en mode preview
            if (viewMode !== 'preview') {
              setViewMode('preview');
            }
          }, 300); // Délai réduit car les fichiers sont déjà sauvegardés

          sonnerToast.success('Modifications terminées !');
        },
        onError: (error) => {
          sonnerToast.error(`Erreur: ${error}`);
        }
      }
    );
  };

  // Fonction pour gérer les modifications rapides (sans rechargement preview)
  const handleQuickModification = async (userPrompt: string) => {
    console.log('⚡ MODE: QUICK MODIFICATION');
    
    if (!user) {
      navigate('/auth');
      throw new Error('Authentication required');
    }
    
    // Ajouter le message utilisateur AVANT la génération
    const userMessage: Message = {
      role: 'user',
      content: userPrompt,
      created_at: new Date().toISOString()
    };
    setMessages(prev => [...prev, userMessage]);
    
    // Analyser la complexité de la modification
    const { analyzeIntentDetailed } = await import('@/utils/intentAnalyzer');
    const analysis = analyzeIntentDetailed(userPrompt, projectFiles);
    console.log(`📊 Complexité: ${analysis.complexity}, Score: ${analysis.score}, Confidence: ${analysis.confidence}%`);
    
    // Identifier les fichiers pertinents (augmenté de 3 à 5)
    const relevantFiles = identifyRelevantFiles(userPrompt, projectFiles, 5);
    
    if (relevantFiles.length === 0) {
      console.warn('⚠️ Aucun fichier pertinent trouvé, fallback sur génération complète');
      return handleFullGeneration(userPrompt);
    }
    
    console.log('📄 Fichiers pertinents:', relevantFiles.map(f => f.path).join(', '));
    
    // Créer message de génération unifié
    const generationStartTime = Date.now();
    generationStartTimeRef.current = generationStartTime;
    setIsQuickModLoading(true);
    
    // Variable pour capturer le message d'intention de Claude depuis le JSON
    let capturedIntentMessage = '';
    
    const generationMessage: Message = {
      role: 'assistant',
      content: '',
      created_at: new Date().toISOString(),
      metadata: { 
        type: 'generation',
        thought_duration: 0,
        intent_message: '',
        generation_events: [],
        files_modified: 0,
        modified_files: [],
        total_tokens: 0,
        project_files: {},
        startTime: generationStartTime
      }
    };
    
    setMessages(prev => [...prev, generationMessage]);
    setGenerationEvents([]);
    generationEventsRef.current = [];
    
    // Variable pour stocker les tokens
    let receivedTokens = { input: 0, output: 0, total: 0 };
    
    // Appeler modify-site avec la complexité
    await modifySiteHook.modifySite(
      userPrompt,
      relevantFiles,
      sessionId!,
      {
        onIntentMessage: (message) => {
          // Capturer le message d'intention du JSON de Claude
          capturedIntentMessage = message;
          console.log('💬 Intent message capturé depuis JSON:', capturedIntentMessage);
        },
        onMessage: (message) => {
          // Messages conversationnels streamés (optionnel)
          console.log('📝 Message streamé:', message);
        },
        onTokens: (tokens) => {
          console.log('💰 Tokens reçus dans BuilderSession:', tokens);
          receivedTokens = tokens;
        },
        onGenerationEvent: (event) => {
          generationEventsRef.current = [...generationEventsRef.current, event];
          setGenerationEvents(prev => [...prev, event]);
          
          // Mettre à jour le message avec les événements
          setMessages(prev => {
            const lastMessage = prev[prev.length - 1];
            if (lastMessage?.metadata?.type === 'generation') {
              return prev.map((msg, idx) => 
                idx === prev.length - 1
                  ? { 
                      ...msg, 
                      metadata: { 
                        ...msg.metadata, 
                        generation_events: generationEventsRef.current,
                        thought_duration: Date.now() - generationStartTimeRef.current
                      } 
                    }
                  : msg
              );
            }
            return prev;
          });
        },
        onASTModifications: async (modifications) => {
          console.log('⚡ AST Modifications reçues:', modifications.length);
          
          // 🔄 FALLBACK AUTOMATIQUE si aucune modification
          if (modifications.length === 0) {
            console.log('⚠️ Aucune modification AST reçue, fallback sur génération complète');
            return handleFullGeneration(userPrompt);
          }
          
          console.log('⚡ Application de', modifications.length, 'modifications AST');
          
          // Importer le service AST
          const { applyModificationsToFiles } = await import('@/services/ast/astModifier');
          
          // Appliquer toutes les modifications AST
          const result = await applyModificationsToFiles(projectFiles, modifications);
          
          if (!result.success) {
            console.error('❌ Échec des modifications AST:', result.errors);
            sonnerToast.error('Échec des modifications, génération complète en cours...');
            return handleFullGeneration(userPrompt);
          }
          
          const updatedFiles = result.updatedFiles;
          const modifiedFilesList = Object.keys(updatedFiles).filter(
            path => updatedFiles[path] !== projectFiles[path]
          );
          
          console.log('✅ Modifications AST appliquées:', modifiedFilesList);
        
          
          // Mettre à jour l'état avec les nouveaux fichiers
          updateFiles(updatedFiles, true);
          setGeneratedHtml(updatedFiles['index.html'] || generatedHtml);
          
          // Mettre à jour le fichier sélectionné si modifié
          if (selectedFile && modifiedFilesList.includes(selectedFile)) {
            setSelectedFileContent(updatedFiles[selectedFile]);
          }
          
          // Sauvegarder
          await supabase
            .from('build_sessions')
            .update({
              project_files: updatedFiles,
              updated_at: new Date().toISOString()
            })
            .eq('id', sessionId!);
          
          const generationDuration = Date.now() - generationStartTime;
          
          // Message de récapitulatif
          const recapMessage = modifiedFilesList.length > 0
            ? `✅ Modifications appliquées sur ${modifiedFilesList.length} fichier${modifiedFilesList.length > 1 ? 's' : ''}: ${modifiedFilesList.join(', ')}`
            : 'Modifications analysées.';
          
          // Sauvegarder le message unifié final - utiliser parsed.message prioritairement
          const finalIntentMessage = capturedIntentMessage || 'Modifications appliquées';
          
          // Désactiver le loading après application des patches
          setIsQuickModLoading(false);
          
          const { data: insertedMessage } = await supabase
            .from('chat_messages')
            .insert([{
              session_id: sessionId,
              role: 'assistant',
              content: recapMessage,
              token_count: receivedTokens.total,
              created_at: new Date().toISOString(),
              metadata: { 
                type: 'generation' as const,
                thought_duration: generationDuration,
                intent_message: finalIntentMessage,
                generation_events: generationEventsRef.current,
                files_modified: modifiedFilesList.length,
                modified_files: modifiedFilesList,
                project_files: updatedFiles,
                input_tokens: receivedTokens.input,
                output_tokens: receivedTokens.output,
                total_tokens: receivedTokens.total,
                saved_at: new Date().toISOString()
              }
            }])
            .select()
            .single();
          
          // Mettre à jour le message avec les données finales
          setMessages(prev => {
            const withoutTemp = prev.filter(m => !(m.role === 'assistant' && !m.id));
            
            return [
              ...withoutTemp,
              { 
                role: 'assistant' as const, 
                content: recapMessage,
                token_count: receivedTokens.total,
                id: insertedMessage?.id,
                created_at: new Date().toISOString(),
                metadata: { 
                  type: 'generation' as const,
                  thought_duration: generationDuration,
                  intent_message: finalIntentMessage,
                  generation_events: generationEventsRef.current,
                  files_modified: modifiedFilesList.length,
                  modified_files: modifiedFilesList,
                  project_files: updatedFiles,
                  input_tokens: receivedTokens.input,
                  output_tokens: receivedTokens.output,
                  total_tokens: receivedTokens.total
                }
              }
            ];
          });
          
          // 💰 Décompter les tokens du profil utilisateur
          if (user?.id && receivedTokens.total > 0) {
            console.log('💰 Mise à jour des tokens utilisés:', receivedTokens.total);
            
            try {
              const { data: profile } = await supabase
                .from('profiles')
                .select('tokens_used')
                .eq('id', user.id)
                .single();
              
              if (profile) {
                const newTokensUsed = (profile.tokens_used || 0) + receivedTokens.total;
                
                await supabase
                  .from('profiles')
                  .update({ tokens_used: newTokensUsed })
                  .eq('id', user.id);
                
                console.log('✅ Tokens mis à jour:', newTokensUsed);
              }
            } catch (error) {
              console.error('❌ Erreur déduction tokens:', error);
            }
          }
          
          sonnerToast.success('Modifications appliquées !');
        },
        onComplete: () => {
          console.log('✅ Modification rapide terminée');
          setIsQuickModLoading(false);
        },
        onError: (error) => {
          console.error('❌ Erreur modification rapide:', error);
          setIsQuickModLoading(false);
          sonnerToast.error(`Erreur: ${error}`);
          // Fallback sur génération complète en cas d'erreur
          handleFullGeneration(userPrompt);
        }
      },
      analysis.complexity // Passer la complexité pour sélection du modèle
    );
  };

  // Nouveau handleSubmit qui route entre modifications rapides et génération complète
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

    // MODE CHAT - Simple conversation sans génération de code
    if (chatMode) {
      const userMessage: Message = {
        role: 'user',
        content: prompt
      };
      
      setMessages(prev => [...prev, userMessage]);
      setInputValue('');
      
      // Afficher un message de chargement
      const loadingMessage: Message = {
        role: 'assistant',
        content: '...'
      };
      setMessages(prev => [...prev, loadingMessage]);
      
      try {
        const chatHistory = messages.slice(-6).map(m => ({
          role: m.role,
          content: typeof m.content === 'string' ? m.content : '[message multimédia]'
        }));
        
        const { data, error } = await supabase.functions.invoke('chat-only', {
          body: {
            message: prompt,
            chatHistory
          }
        });
        
        if (error) throw error;
        
        // Remplacer le message de chargement par la réponse
        setMessages(prev => {
          const newMessages = [...prev];
          newMessages[newMessages.length - 1] = {
            role: 'assistant',
            content: data.response,
            token_count: data.tokens.total,
            metadata: {
              type: 'message',
              thought_duration: data.thoughtDuration || 0,
              total_tokens: data.tokens.total
            }
          };
          return newMessages;
        });
        
        // Déduire les tokens
        if (user?.id && data.tokens.total) {
          await supabase
            .from('profiles')
            .update({ 
              tokens_used: (user.tokens_used || 0) + data.tokens.total 
            })
            .eq('id', user.id);
          
          setUser((prev: any) => ({
            ...prev,
            tokens_used: (prev.tokens_used || 0) + data.tokens.total
          }));
        }
        
      } catch (error) {
        console.error('Chat error:', error);
        sonnerToast.error('Erreur lors de la conversation');
        // Supprimer le message de chargement
        setMessages(prev => prev.slice(0, -1));
      }
      
      return;
    }

    // MODE NORMAL - Génération de code (suite du code existant)
    // Construire le message utilisateur
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

      const { error: insertError } = await supabase
        .from('chat_messages')
        .insert({
          session_id: sessionId,
          role: 'user',
          content: userMessageText,
          created_at: new Date().toISOString(),
          token_count: 0,
          metadata: { has_images: attachedFiles.length > 0 }
        });
      
      if (insertError) {
        console.error('❌ Erreur insertion message utilisateur:', insertError);
      }
    }
    
    setInputValue('');
    setAttachedFiles([]);

    // ⚡ ANALYSE DE L'INTENT : Décider entre modification rapide ou génération complète
    const intent = analyzeIntent(prompt, projectFiles);
    const timeEstimate = estimateGenerationTime(prompt, projectFiles);
    
    console.log(`⏱️ Temps estimé: ${timeEstimate.estimatedTime}s (${timeEstimate.range.min}-${timeEstimate.range.max}s)`);
    
    if (intent === 'quick-modification' && attachedFiles.length === 0) {
      // MODE RAPIDE : Pas de loading preview, modification ciblée
      console.log('🚀 Routing vers QUICK MODIFICATION');
      await handleQuickModification(prompt);
    } else {
      // MODE COMPLET : Loading preview, régénération complète
      console.log('🚀 Routing vers FULL GENERATION');
      await handleFullGeneration(prompt);
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
        // Déterminer si le fichier est binaire (images, fonts, etc.)
        const extension = name.split('.').pop()?.toLowerCase() || '';
        const binaryExtensions = ['png', 'jpg', 'jpeg', 'gif', 'ico', 'svg', 'woff', 'woff2', 'ttf', 'eot', 'otf'];
        const isBinary = binaryExtensions.includes(extension);
        
        return {
          name: name.startsWith('/') ? name : `/${name}`,
          content,
          type: isBinary ? 'binary' as const : 'text' as const
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

      // Générer le nom du projet à partir du titre (utiliser toujours le titre actuel)
      const projectName = (websiteTitle || cloudflareProjectName || 'mon-projet')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .substring(0, 50);
      
      console.log('🔍 Publishing with projectName:', projectName, 'from websiteTitle:', websiteTitle);

      sonnerToast.info("🚀 Déploiement en cours...");
      
      const deployRes = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/deploy-worker`, {
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
        
        // Sauvegarder le projectName comme titre si le titre est vide ou générique
        if (!websiteTitle || websiteTitle === 'Nouveau projet' || websiteTitle.trim() === '') {
          const formattedTitle = projectName
            .split('-')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
          setWebsiteTitle(formattedTitle);
          
          // Sauvegarder dans la base de données
          await supabase
            .from('build_sessions')
            .update({ 
              title: formattedTitle,
              cloudflare_project_name: projectName 
            })
            .eq('id', sessionId);
        } else {
          // Sauvegarder juste le cloudflare_project_name
          await supabase
            .from('build_sessions')
            .update({ cloudflare_project_name: projectName })
            .eq('id', sessionId);
        }
        
        // Ouvrir la modale de succès au lieu du toast
        setShowPublishSuccess(true);
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
          <button
            onClick={() => navigate('/dashboard')}
            className="h-8 w-8 flex items-center justify-center transition-colors group"
            title="Dashboard"
          >
            <Home className="w-4 h-4 transition-colors" style={{ color: isDark ? '#fff' : '#9CA3AF' }} onMouseEnter={(e) => e.currentTarget.style.color = '#03A5C0'} onMouseLeave={(e) => e.currentTarget.style.color = isDark ? '#fff' : '#9CA3AF'} />
          </button>

          <TokenCounter isDark={isDark} userId={user?.id} />
        </div>

        {/* Input caché pour le favicon */}
        <input
          type="file"
          ref={faviconInputRef}
          onChange={handleFaviconUpload}
          accept="image/*"
          className="hidden"
        />

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
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={() => setPreviewMode(previewMode === 'desktop' ? 'mobile' : 'desktop')}
                    variant="iconOnly"
                    size="sm"
                    className="h-8 w-8 p-0"
                    style={{
                      borderColor: isDark ? 'hsl(var(--border))' : 'rgba(203, 213, 225, 0.5)',
                      backgroundColor: 'transparent',
                      color: isDark ? 'hsl(var(--foreground))' : '#64748b',
                    }}
                  >
                    {previewMode === 'desktop' ? (
                      <Smartphone className="w-3.5 h-3.5" />
                    ) : (
                      <Monitor className="w-3.5 h-3.5" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p>{previewMode === 'desktop' ? 'Mode mobile' : 'Mode desktop'}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={() => setInspectMode(!inspectMode)}
                    type="button"
                    variant="iconOnly"
                    size="sm"
                    className="h-8 w-8 p-0"
                    style={{
                      borderColor: inspectMode ? '#03A5C0' : (isDark ? 'hsl(var(--border))' : 'rgba(203, 213, 225, 0.5)'),
                      backgroundColor: inspectMode ? 'rgba(3, 165, 192, 0.1)' : 'transparent',
                      color: inspectMode ? '#03A5C0' : (isDark ? 'hsl(var(--foreground))' : '#64748b'),
                    }}
                  >
                    <Edit className="w-3.5 h-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p>{inspectMode ? 'Désactiver le mode édition' : 'Activer le mode édition'}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

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
                  ) : msg.metadata?.type === 'generation' ? (
                    // Nouveau message unifié style Lovable
                    <AiGenerationMessage
                      message={msg}
                      messageIndex={idx}
                      isLatestMessage={idx === messages.length - 1}
                      isDark={isDark}
                      isLoading={idx === messages.length - 1 && (agent.isLoading || isQuickModLoading)}
                      generationStartTime={idx === messages.length - 1 && (agent.isLoading || isQuickModLoading) ? generationStartTimeRef.current : undefined}
                      onRestore={async (messageIdx) => {
                        const targetMessage = messages[messageIdx];
                        if (!targetMessage.id || !sessionId) return;
                        
                        console.log('🔄 RESTORING VERSION FROM MESSAGE', messageIdx);
                        
                        const { data: chatMessage } = await supabase
                          .from('chat_messages')
                          .select('metadata')
                          .eq('id', targetMessage.id)
                          .single();
                        
                        if (chatMessage?.metadata && typeof chatMessage.metadata === 'object' && 'project_files' in chatMessage.metadata) {
                          const restoredFiles = chatMessage.metadata.project_files as Record<string, string>;
                          
                          console.log('✅ Files to restore:', Object.keys(restoredFiles).length);
                          
                          updateFiles(restoredFiles, false);
                          setGeneratedHtml(restoredFiles['index.html'] || '');
                          
                          if (selectedFile && restoredFiles[selectedFile]) {
                            setSelectedFileContent(restoredFiles[selectedFile]);
                          } else {
                            const firstFile = Object.keys(restoredFiles)[0];
                            if (firstFile) {
                              setSelectedFile(firstFile);
                              setSelectedFileContent(restoredFiles[firstFile]);
                            }
                          }
                          
                          setCurrentVersionIndex(messageIdx);
                          
                          await supabase
                            .from('build_sessions')
                            .update({
                              project_files: convertFilesToArray(restoredFiles),
                              updated_at: new Date().toISOString()
                            })
                            .eq('id', sessionId);
                          
                          console.log('✅ Version restored successfully');
                          sonnerToast.success('Version restaurée');
                        } else {
                          console.error('❌ No project_files found in message metadata');
                          sonnerToast.error('Impossible de restaurer cette version');
                        }
                      }}
                      onGoToPrevious={async () => {
                        const generationMessages = messages
                          .map((m, i) => ({ message: m, index: i }))
                          .filter(({ message }) => message.role === 'assistant' && message.metadata?.type === 'generation')
                          .slice(-15);
                        
                        const currentGenIndex = currentVersionIndex !== null
                          ? generationMessages.findIndex(r => r.index === currentVersionIndex)
                          : generationMessages.length - 1;
                        
                        if (currentGenIndex <= 0) {
                          sonnerToast.error('Aucune version précédente disponible');
                          return;
                        }
                        
                        const previousGen = generationMessages[currentGenIndex - 1];
                        const targetMessage = previousGen.message;
                        
                        if (!targetMessage.id || !sessionId) return;
                        
                        const { data: chatMessage } = await supabase
                          .from('chat_messages')
                          .select('metadata')
                          .eq('id', targetMessage.id)
                          .single();
                        
                        if (chatMessage?.metadata && typeof chatMessage.metadata === 'object' && 'project_files' in chatMessage.metadata) {
                          const restoredFiles = chatMessage.metadata.project_files as Record<string, string>;
                          
                          updateFiles(restoredFiles, false);
                          setGeneratedHtml(restoredFiles['index.html'] || '');
                          
                          if (selectedFile && restoredFiles[selectedFile]) {
                            setSelectedFileContent(restoredFiles[selectedFile]);
                          } else {
                            const firstFile = Object.keys(restoredFiles)[0];
                            if (firstFile) {
                              setSelectedFile(firstFile);
                              setSelectedFileContent(restoredFiles[firstFile]);
                            }
                          }
                          
                          setCurrentVersionIndex(previousGen.index);
                          
                          await supabase
                            .from('build_sessions')
                            .update({
                              project_files: convertFilesToArray(restoredFiles),
                              updated_at: new Date().toISOString()
                            })
                            .eq('id', sessionId);
                          
                          sonnerToast.success('Version précédente restaurée');
                        } else {
                          sonnerToast.error('Impossible de restaurer cette version');
                        }
                      }}
                    />
                  ) : msg.metadata?.type === 'message' ? (
                    // Message chat uniquement (plan d'action)
                    <div className="flex items-start gap-3">
                      <img src="/lovable-uploads/icon_magellan.svg" alt="Magellan" className="w-7 h-7 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <ChatOnlyMessage
                          message={msg}
                          messageIndex={idx}
                          isLatestMessage={idx === messages.length - 1}
                          isDark={isDark}
                          onRestore={async (messageIdx) => {
                            // Pas de restauration pour les messages chat
                            sonnerToast.info('Les messages de conversation ne modifient pas les fichiers');
                          }}
                          onGoToPrevious={() => {
                            // Pas de version précédente pour les messages chat
                            sonnerToast.info('Les messages de conversation ne sont pas versionnés');
                          }}
                          onImplementPlan={(plan) => {
                            // Passer en mode génération avec le plan
                            setChatMode(false);
                            setInputValue(plan);
                            // Petit délai pour s'assurer que le mode chat est désactivé
                            setTimeout(() => {
                              handleSubmit();
                            }, 100);
                          }}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {/* Message simple (ancien format) - pour compatibilité */}
                      <div className="flex items-start gap-3">
                        <img src="/lovable-uploads/icon_magellan.svg" alt="Magellan" className="w-7 h-7 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'} whitespace-pre-wrap`}>
                            {typeof msg.content === 'string' 
                              ? (msg.content.match(/\[EXPLANATION\](.*?)\[\/EXPLANATION\]/s)?.[1]?.trim() || msg.content)
                              : 'Contenu généré'
                            }
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
              })}


              {/* Le streaming est maintenant géré par le message intro avec CollapsedAiTasks */}

              
              <div ref={chatEndRef} />
            </div>
            
            {/* Chat input */}
            <div className="border-t p-4" style={{ backgroundColor: isDark ? '#1F1F20' : '#ffffff', borderTopColor: isDark ? '#1F1F20' : 'rgb(226, 232, 240)' }}>
              <PromptBar
                inputValue={inputValue}
                setInputValue={setInputValue}
                onSubmit={handleSubmit}
                isLoading={agent.isLoading}
                onStop={() => agent.abort()}
                showPlaceholderAnimation={false}
                showConfigButtons={false}
                modificationMode={true}
                inspectMode={inspectMode}
                onInspectToggle={() => setInspectMode(!inspectMode)}
                chatMode={chatMode}
                onChatToggle={() => setChatMode(!chatMode)}
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
        
        {previewMode === 'desktop' && <ResizableHandle withHandle />}
        
          <ResizablePanel defaultSize={70} minSize={previewMode === 'mobile' ? 70 : 30}>
            <div className={`h-full w-full flex ${previewMode === 'mobile' ? 'justify-center items-start' : 'flex-col'} rounded-xl overflow-hidden`} style={previewMode === 'mobile' ? { backgroundColor: isDark ? '#181818' : '#ffffff' } : undefined}>
              {previewMode === 'mobile' ? (
                <div className={`w-[375px] h-full flex flex-col shadow-2xl rounded-3xl border overflow-hidden`} style={{ backgroundColor: isDark ? '#1F1F20' : '#ffffff', borderColor: isDark ? 'rgb(51, 65, 85)' : '#ffffff' }}>
                  {viewMode === 'preview' ? (
                    isInitialGeneration && Object.keys(projectFiles).length === 0 ? (
                      <GeneratingPreview />
                    ) : (
                      <>
                        <FakeUrlBar 
                          projectTitle={websiteTitle || 'Mon Projet'} 
                          isDark={isDark}
                          sessionId={sessionId}
                          onTitleChange={setWebsiteTitle}
                          cloudflareProjectName={cloudflareProjectName || undefined}
                        />
                        <InteractivePreview 
                          projectFiles={projectFiles} 
                          isDark={isDark}
                          inspectMode={inspectMode}
                          onInspectModeChange={setInspectMode}
                          onElementModify={async (prompt, elementInfo) => {
                            const contextualPrompt = `Modifier l'élément suivant dans le code :

Type: <${elementInfo.tagName.toLowerCase()}>
${elementInfo.id ? `ID: #${elementInfo.id}` : ''}
${elementInfo.classList.length > 0 ? `Classes: ${elementInfo.classList.join(', ')}` : ''}
Chemin CSS: ${elementInfo.path}
Contenu actuel: "${elementInfo.textContent.substring(0, 200)}${elementInfo.textContent.length > 200 ? '...' : ''}"

Instruction: ${prompt}

Ne modifie que cet élément spécifique, pas le reste du code.`;
                            
                            setInputValue(contextualPrompt);
                            setTimeout(() => handleSubmit(), 100);
                          }}
                        />
                      </>
                    )
                  ) : viewMode === 'analytics' ? (
                    <CloudflareAnalytics 
                      sessionId={sessionId!}
                      isDark={isDark}
                    />
                  ) : (
                    <div className="p-4 text-center text-slate-500">
                      Mode code non disponible en mode mobile
                    </div>
                  )}
                </div>
              ) : (
                <>
                  {viewMode === 'preview' ? (
                    isInitialGeneration ? (
                      <GeneratingPreview />
                    ) : (
                      <>
                        <FakeUrlBar 
                          projectTitle={websiteTitle || 'Mon Projet'} 
                          isDark={isDark}
                          sessionId={sessionId}
                          onTitleChange={setWebsiteTitle}
                          currentFavicon={currentFavicon}
                          onFaviconChange={setCurrentFavicon}
                          cloudflareProjectName={cloudflareProjectName || undefined}
                        />
                        <InteractivePreview 
                          projectFiles={projectFiles} 
                          isDark={isDark}
                          inspectMode={inspectMode}
                          onInspectModeChange={setInspectMode}
                          onElementModify={async (prompt, elementInfo) => {
                            const contextualPrompt = `Modifier l'élément suivant dans le code :

Type: <${elementInfo.tagName.toLowerCase()}>
${elementInfo.id ? `ID: #${elementInfo.id}` : ''}
${elementInfo.classList.length > 0 ? `Classes: ${elementInfo.classList.join(', ')}` : ''}
Chemin CSS: ${elementInfo.path}
Contenu actuel: "${elementInfo.textContent.substring(0, 200)}${elementInfo.textContent.length > 200 ? '...' : ''}"

Instruction: ${prompt}

Ne modifie que cet élément spécifique, pas le reste du code.`;
                            
                            // Envoyer directement à Claude sans afficher dans le chat
                            if (!user) {
                              navigate('/auth');
                              return;
                            }

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

                            const relevantFilesArray = selectRelevantFiles(contextualPrompt, projectFiles);
                            const chatHistory = messages.slice(-3).map(m => ({
                              role: m.role,
                              content: typeof m.content === 'string' ? m.content : '[message multimédia]'
                            }));

                            let assistantMessage = '';
                            const updatedFiles = { ...projectFiles };
                            let usedTokens = { input: 0, output: 0, total: 0 };

                            setAiEvents([]);
                            setGenerationEvents([]);
                            
                            // 🔒 Activer le mode "génération en cours" pour bloquer la preview
                            setIsInitialGeneration(true);
                            isInitialGenerationRef.current = true;

                          const projectContext = projectType === 'website' 
                            ? 'Generate a static website with HTML, CSS, and vanilla JavaScript files only. No React, no JSX. Use simple HTML structure.'
                            : projectType === 'webapp'
                            ? 'Generate a React web application with TypeScript/JSX. Use React components and modern web technologies.'
                            : 'Generate a mobile-optimized React application with responsive design for mobile devices.';

                          await agent.callAgent(
                            `${projectContext}\n\n${contextualPrompt}`,
                            projectFiles,
                            relevantFilesArray,
                            chatHistory,
                            sessionId!,
                            projectType,
                            [], // pas d'images attachées pour l'inspect mode
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
                                
                                // 🔍 VALIDATION CRITIQUE : Vérifier que les fichiers essentiels sont créés et NON VIDES
                                const hasHtml = 'index.html' in updatedFiles;
                                const hasCss = 'styles.css' in updatedFiles;
                                const hasJs = 'script.js' in updatedFiles;
                                
                                const htmlContent = updatedFiles['index.html'] || '';
                                const cssContent = updatedFiles['styles.css'] || '';
                                const jsContent = updatedFiles['script.js'] || '';
                                
                                console.log('📊 Validation fichiers:', {
                                  hasHtml, hasCss, hasJs,
                                  htmlLength: htmlContent.length,
                                  cssLength: cssContent.length,
                                  jsLength: jsContent.length
                                });
                                
                                // Vérifier que index.html contient bien les liens vers CSS et JS
                                const hasStyleLink = htmlContent.includes('href="styles.css"') || htmlContent.includes("href='styles.css'");
                                const hasScriptLink = htmlContent.includes('src="script.js"') || htmlContent.includes("src='script.js'");
                                
                                // ⚠️ ERREURS CRITIQUES - Validation stricte de tous les fichiers
                                if (!hasHtml || !hasCss || !hasJs) {
                                  const missing = [];
                                  if (!hasHtml) missing.push('index.html');
                                  if (!hasCss) missing.push('styles.css');
                                  if (!hasJs) missing.push('script.js');
                                  
                                  console.error('❌ FICHIERS MANQUANTS:', missing);
                                  sonnerToast.error(`Fichiers manquants: ${missing.join(', ')}. Impossible d'afficher la preview.`);
                                  setGenerationEvents(prev => [...prev, { 
                                    type: 'error', 
                                    message: `Fichiers manquants: ${missing.join(', ')}` 
                                  }]);
                                  setIsInitialGeneration(false);
                                  isInitialGenerationRef.current = false;
                                  return;
                                }
                                
                                // Validation du contenu HTML (doit être substantiel)
                                if (htmlContent.length < 200) {
                                  console.error('❌ HTML VIDE OU TROP COURT:', htmlContent.length, 'caractères');
                                  sonnerToast.error('Le fichier HTML est vide ou incomplet. Impossible d\'afficher la preview.');
                                  setGenerationEvents(prev => [...prev, { 
                                    type: 'error', 
                                    message: 'HTML file is empty or too short' 
                                  }]);
                                  setIsInitialGeneration(false);
                                  isInitialGenerationRef.current = false;
                                  return;
                                }
                                
                                // Validation du contenu CSS (doit être substantiel)
                                if (cssContent.length < 100) {
                                  console.error('❌ CSS VIDE OU TROP COURT:', cssContent.length, 'caractères');
                                  sonnerToast.error('Le fichier CSS est vide ou incomplet. Impossible d\'afficher la preview.');
                                  setGenerationEvents(prev => [...prev, { 
                                    type: 'error', 
                                    message: 'CSS file is empty or too short' 
                                  }]);
                                  setIsInitialGeneration(false);
                                  isInitialGenerationRef.current = false;
                                  return;
                                }
                                
                                // Validation du contenu JS (doit exister, peut être court si pas de logique)
                                if (jsContent.length < 10) {
                                  console.error('❌ JS VIDE OU TROP COURT:', jsContent.length, 'caractères');
                                  sonnerToast.error('Le fichier JavaScript est vide ou incomplet. Impossible d\'afficher la preview.');
                                  setGenerationEvents(prev => [...prev, { 
                                    type: 'error', 
                                    message: 'JS file is empty or too short' 
                                  }]);
                                  setIsInitialGeneration(false);
                                  isInitialGenerationRef.current = false;
                                  return;
                                }
                                
                                if (!hasStyleLink || !hasScriptLink) {
                                  console.error('❌ LIENS CSS/JS MANQUANTS dans index.html');
                                  sonnerToast.error('Les liens CSS/JS ne sont pas présents dans index.html');
                                  setGenerationEvents(prev => [...prev, { 
                                    type: 'error', 
                                    message: 'Missing CSS/JS links in HTML' 
                                  }]);
                                  setIsInitialGeneration(false);
                                  isInitialGenerationRef.current = false;
                                  return;
                                }
                                
                                // ✅ VALIDATION RÉUSSIE
                                console.log('✅ Validation réussie - Application de TOUS les fichiers à la preview');
                                setGenerationEvents(prev => [...prev, { type: 'complete', message: 'All files generated successfully' }]);
                                
                                // ✅ Appliquer TOUS les fichiers générés à la preview en une seule fois
                                console.log('📦 Fichiers à appliquer:', Object.keys(updatedFiles));
                                await updateFiles(updatedFiles, true);
                                console.log('✅ Fichiers sauvegardés et prêts pour la preview');
                                
                                // Attendre que React re-rendre avec les nouveaux fichiers avant d'afficher la preview
                                setTimeout(() => {
                                  setIsInitialGeneration(false);
                                  isInitialGenerationRef.current = false;
                                }, 300); // Délai réduit car les fichiers sont déjà sauvegardés
                                
                                await supabase
                                  .from('build_sessions')
                                  .update({
                                    project_files: updatedFiles,
                                    updated_at: new Date().toISOString()
                                  })
                                  .eq('id', sessionId);

                                await supabase
                                  .from('chat_messages')
                                  .insert({
                                    session_id: sessionId,
                                    role: 'assistant',
                                    content: assistantMessage,
                                    token_count: usedTokens.total,
                                    metadata: {
                                      input_tokens: usedTokens.input,
                                      output_tokens: usedTokens.output,
                                      total_tokens: usedTokens.total,
                                      project_files: updatedFiles,
                                      generation_events: generationEvents
                                    }
                                  });
                              },
                              onError: (error) => {
                                console.error('❌ Error:', error);
                                sonnerToast.error(error);
                              }
                            }
                          );
                          }}
                        />
                      </>
                    )
                  ) : viewMode === 'analytics' ? (
                    <CloudflareAnalytics 
                      sessionId={sessionId!}
                      isDark={isDark}
                    />
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
                                  updateFile(selectedFile, value);
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
                </>
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

      {/* Dialog de succès de publication */}
      <PublishSuccessDialog
        open={showPublishSuccess}
        onOpenChange={setShowPublishSuccess}
        publicUrl={deployedUrl || ''}
        projectName={cloudflareProjectName || websiteTitle}
        sessionId={sessionId}
        cloudflareProjectName={cloudflareProjectName || undefined}
      />
    </div>
  );
}
