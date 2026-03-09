import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { Save, Eye, Home, X, Moon, Sun, Pencil, Download, Paperclip, Lightbulb, FileText, Edit, Loader, Smartphone, Monitor, History, MessageSquareText, MonitorPlay } from "lucide-react";
import { useIsMobile } from '@/hooks/use-mobile';
import { useThemeStore } from '@/stores/themeStore';
import { toast as sonnerToast } from "sonner";
import JSZip from "jszip";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileTree } from "@/components/FileTree";
import { InteractiveCodeSandboxPreview } from "@/components/InteractiveCodeSandboxPreview";
import { GeneratingPreview } from "@/components/GeneratingPreview";
import { VibePreviewIframe } from "@/components/builder/VibePreviewIframe";
import { FakeUrlBar } from "@/components/FakeUrlBar";
import { CodeTreeView } from "@/components/CodeEditor/CodeTreeView";
import { FileTabs } from "@/components/CodeEditor/FileTabs";
import { MonacoEditor } from "@/components/CodeEditor/MonacoEditor";
import PromptBar from "@/components/PromptBar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import CloudflareAnalytics from "@/components/CloudflareAnalytics";
import { AiDiffService } from "@/services/aiDiffService";
import { useProjectMemory } from "@/hooks/useProjectMemory";
import type { AIEvent, GenerationEvent } from '@/types/agent';
import { CollapsedAiTasks } from '@/components/chat/CollapsedAiTasks';
import { MessageActions } from '@/components/chat/MessageActions';
import AiGenerationMessage from '@/components/chat/AiGenerationMessage';
import ChatOnlyMessage from '@/components/chat/ChatOnlyMessage';
import { useGenerateSite } from '@/hooks/useGenerateSite';
import html2canvas from 'html2canvas';
import { MessageCounter } from '@/components/MessageCounter';
import { capturePreviewThumbnail } from '@/lib/capturePreviewThumbnail';
import { analyzeIntent, identifyRelevantFiles, estimateGenerationTime } from '@/utils/intentAnalyzer';
import { ASTModification } from '@/types/ast';
import { useOptimizedBuilder } from '@/hooks/useOptimizedBuilder';
import { SyncStatusIndicator } from '@/components/SyncStatusIndicator';
import { PublishSuccessDialog } from '@/components/PublishSuccessDialog';
import { useUnifiedModify } from '@/hooks/useUnifiedModify';
import { useProjectVersions } from '@/hooks/useProjectVersions';
import { VersionHistory } from '@/components/VersionHistory';
import type { ElementInfo } from '@/types/elementInfo';
import { IndexedDBCache } from '@/services/indexedDBCache';
import { parseProjectFiles } from '@/lib/projectFilesParser';
import { useCredits } from '@/hooks/useCredits';
import { UpgradeModal } from '@/components/UpgradeModal';

interface Message {
  role: 'user' | 'assistant';
  content: string | Array<{
    type: string;
    text?: string;
    image_url?: {
      url: string;
    };
  }>;
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

export default function BuilderSession() {
  const {
    sessionId
  } = useParams<{
    sessionId: string;
  }>();
  const navigate = useNavigate();
  const location = useLocation();
  const {
    isDark,
    toggleTheme
  } = useThemeStore();
  const [inputValue, setInputValue] = useState('');
  const [generatedHtml, setGeneratedHtml] = useState('');
  const [messages, setMessages] = useState<Message[]>(() => {
    if (sessionId) {
      try {
        const cached = sessionStorage.getItem(`chat_messages_${sessionId}`);
        if (cached) return JSON.parse(cached) as Message[];
      } catch {}
    }
    return [];
  });
  const [user, setUser] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [websiteTitle, setWebsiteTitle] = useState('');
  // Toujours en mode preview
  const viewMode = 'preview';
  const [sessionLoading, setSessionLoading] = useState(true);
  const [attachedFiles, setAttachedFiles] = useState<Array<{
    name: string;
    base64: string;
    type: string;
  }>>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishStep, setPublishStep] = useState(0);
  const publishIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [showPublishSuccess, setShowPublishSuccess] = useState(false);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [lastPublishResult, setLastPublishResult] = useState<{
    publicUrl: string;
    cloudflareUrl?: string;
    subdomain?: string;
  } | null>(null);
  // URL de preview VibeSDK (deployed React app, utilisée pour la preview et le publish)
  const [vibePreviewUrl, setVibePreviewUrl] = useState<string | null>(null);
  // Ref pour accéder au titre du projet dans les callbacks async (évite les stale closures)
  const websiteTitleRef = useRef<string>('');

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
    isOnline,
    hasLoadedFiles // ✅ FIX: Flag pour savoir si des fichiers ont été chargés
  } = useOptimizedBuilder({
    sessionId: sessionId!,
    autoSave: true,
    debounceMs: 2000,
    autoLoad: false // Désactiver le chargement auto, on utilise loadSession() à la place
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

  // Hook pour la mémoire de projet
  const {
    memory,
    buildContextWithMemory,
    updateMemory,
    initializeMemory
  } = useProjectMemory(sessionId);

  // Hook unifié pour unified-modify (remplace agent-v2 et modify-site)
  const unifiedModify = useUnifiedModify();

  // Hook pour génération de nouveaux sites complets
  const generateSiteHook = useGenerateSite();

  // Hook pour vérifier le quota de messages
  const { isAtLimit, isNearLimit, usage, canDeploy, refetch: refetchCredits } = useCredits();

  // État du modal d'upgrade
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeContext, setUpgradeContext] = useState<'message' | 'publish'>('message');

  // Hook pour versioning R2
  const { versions, isLoading: isVersionsLoading, isRollingBack, fetchVersions, rollbackToVersion } = useProjectVersions(sessionId);

  // Événements IA pour la TaskList
  const [aiEvents, setAiEvents] = useState<AIEvent[]>([]);

  // État pour gérer les événements de génération en temps réel
  // Ref pour stocker les événements de génération de manière synchrone
  const generationEventsRef = useRef<GenerationEvent[]>([]);
  const generationStartTimeRef = useRef<number>(0);
  const [currentVersionIndex, setCurrentVersionIndex] = useState<number | null>(null);

  // État de chargement pour quick modification
  const [isQuickModLoading, setIsQuickModLoading] = useState(false);

  // Flag pour savoir si on est en première génération
  const [isInitialGeneration, setIsInitialGeneration] = useState(false);
  const isInitialGenerationRef = useRef(false);

  // ✅ FIX: Flag pour indiquer que les fichiers générés sont prêts à être affichés
  const [isFilesReady, setIsFilesReady] = useState(false);

  // Flag pour éviter de traiter le prompt initial plusieurs fois
  const [initialPromptProcessed, setInitialPromptProcessed] = useState(false);

  // Mode Inspect pour la preview interactive
  const [inspectMode, setInspectMode] = useState(false);

  // Mode Chat pour discuter avec Claude sans générer de code
  const [chatMode, setChatMode] = useState(false);

  // Mode d'affichage de la preview (desktop/mobile)
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop');

  // Mobile responsive: toggle between chat and preview
  const isMobile = useIsMobile();
  const [mobileView, setMobileView] = useState<'chat' | 'preview'>('chat');

  // Fonction pour scroller automatiquement vers le bas du chat
  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({
      behavior: 'smooth'
    });
  };

  // Auto-scroll quand les messages changent
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Mettre en cache les messages dans sessionStorage pour éviter le flash au rechargement
  useEffect(() => {
    if (sessionId && messages.length > 0) {
      try {
        sessionStorage.setItem(`chat_messages_${sessionId}`, JSON.stringify(messages));
      } catch {}
    }
  }, [messages, sessionId]);

  // Fonction pour générer automatiquement un nom de projet
  const generateProjectName = async (prompt: string) => {
    try {
      console.log('🎯 Génération du nom de projet pour:', prompt.substring(0, 100));
      const {
        data,
        error
      } = await supabase.functions.invoke('generate-project-name', {
        body: {
          prompt
        }
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
          const {
            error: updateError
          } = await supabase.from('build_sessions').update({
            title: data.projectName
          }).eq('id', sessionId);
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
      if (!sessionId) {
        console.warn('⚠️ No sessionId, skipping load');
        return;
      }
      console.log('🔄 Starting session load:', sessionId);
      setSessionLoading(true);
      try {
        // 1. Charger d'abord depuis le cache IndexedDB (instantané)
        console.log('📦 Attempting to load from IndexedDB cache...');
        const cachedProject = await IndexedDBCache.getProject(sessionId);
        if (cachedProject?.projectFiles && Object.keys(cachedProject.projectFiles).length > 0) {
          console.log('✅ Loaded from IndexedDB cache:', {
            fileCount: Object.keys(cachedProject.projectFiles).length,
            files: Object.keys(cachedProject.projectFiles)
          });
          updateFiles(cachedProject.projectFiles, false); // Ne pas trigger de save
        } else {
          console.log('📦 No cache found or empty cache');
        }

        // 2. Charger depuis Supabase en arrière-plan (pour sync)
        console.log('🌐 Loading from Supabase...');
        await loadSession();
        console.log('✅ Session load complete');
      } catch (error) {
        console.error('❌ Error in loadSessionWithCache:', error);
      } finally {
        setSessionLoading(false);
      }
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

  // Charger les versions R2 au montage de la session
  useEffect(() => {
    if (sessionId && !sessionLoading) {
      console.log('📋 Chargement des versions R2...');
      fetchVersions();
    }
  }, [sessionId, sessionLoading]);

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
    const {
      data: {
        session
      }
    } = await supabase.auth.getSession();
    setUser(session?.user ?? null);
  };
  const loadSession = async () => {
    if (!sessionId) {
      console.warn('⚠️ loadSession: No sessionId');
      return;
    }
    console.log('🌐 loadSession: Fetching session from Supabase...', sessionId);
    try {
      const {
        data,
        error
      } = await supabase.from('build_sessions').select('*').eq('id', sessionId).single();
      console.log('🌐 loadSession: Supabase response:', {
        hasData: !!data,
        hasError: !!error,
        error: error?.message
      });

      // Récupérer le websiteId lié à cette session
      const {
        data: websiteData
      } = await supabase.from('build_sessions').select('website_id, websites!inner(id, netlify_url, ga_property_id)').eq('id', sessionId).maybeSingle();
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
        sonnerToast.error("Session not found");
        navigate('/builder');
        return;
      }
      if (data) {
        // Charger le nom du projet Cloudflare
        if (data.cloudflare_project_name) {
          setCloudflareProjectName(data.cloudflare_project_name);
        }

        // Restaurer l'URL de preview VibeSDK
        if (data.cloudflare_deployment_url) {
          console.log('🌐 Restoring VibeSDK preview URL:', data.cloudflare_deployment_url);
          setVibePreviewUrl(data.cloudflare_deployment_url);
        }

        // Restaurer l'URL publique builtbymagellan.com si déjà publiée
        if ((data as any).public_url) {
          console.log('🌐 Restoring published URL:', (data as any).public_url);
          setDeployedUrl((data as any).public_url);
        }

        // Charger le type de projet
        if (data.project_type) {
          setProjectType(data.project_type as 'website' | 'webapp' | 'mobile');
        }

        // 📦 Parser et restaurer les fichiers de projet avec la fonction utilitaire
        console.log('📦 Starting project files restoration...');
        try {
          const validatedFilesMap = parseProjectFiles(data.project_files);
          
          if (Object.keys(validatedFilesMap).length > 0) {
            console.log('✅ PROJECT FILES RESTORATION SUCCESS:', Object.keys(validatedFilesMap).length, 'files');
            updateFiles(validatedFilesMap, false); // Pas de sync car c'est un chargement initial
            setIsFilesReady(true); // ✅ FIX: Marquer les fichiers comme prêts
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
            console.error('❌ PROJECT FILES RESTORATION FAILED - No files found');
            setGeneratedHtml('');
          }
        } catch (err) {
          console.error('❌ Error parsing project_files:', err);
          setGeneratedHtml('');
        }

        // Charger l'historique complet des messages depuis chat_messages
        const {
          data: chatMessages,
          error: chatError
        } = await supabase.from('chat_messages').select('*').eq('session_id', sessionId).order('created_at', {
          ascending: true
        });
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

          // Mettre en cache dans sessionStorage pour éviter le flash au rechargement
          try {
            sessionStorage.setItem(`chat_messages_${sessionId}`, JSON.stringify(loadedMessages));
          } catch {}

          // Extraire les images attachées du premier message utilisateur s'il y en a
          const firstUserMessage = loadedMessages.find(m => m.role === 'user');
          if (firstUserMessage?.metadata?.attachedFiles) {
            console.log('📎 Images attachées trouvées dans le message initial:', firstUserMessage.metadata.attachedFiles.length);
            setAttachedFiles(firstUserMessage.metadata.attachedFiles);
          }
        } else {
          // Fallback sur l'ancienne méthode si pas de messages dans chat_messages
          const parsedMessages = Array.isArray(data.messages) ? data.messages as any[] : [];
          setMessages(parsedMessages.map(m => ({
            role: m.role as 'user' | 'assistant',
            content: m.content
          })));
        }

        // Charger le titre et s'assurer qu'il est synchronisé avec cloudflare_project_name
        const loadedTitle = data.title || '';
        setWebsiteTitle(loadedTitle);
        websiteTitleRef.current = loadedTitle; // sync ref au chargement
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
      const filesObject = {
        ...projectFiles
      };

      // Limiter aux 50 derniers messages pour optimiser l'espace
      const limitedMessages = messages.slice(-50);

      // Récupérer le thumbnail existant
      const {
        data: existingSession
      } = await supabase.from('build_sessions').select('thumbnail_url').eq('id', sessionId).single();
      const {
        error
      } = await supabase.from('build_sessions').update({
        project_files: filesObject,
        messages: limitedMessages as any,
        title: websiteTitle,
        project_type: projectType,
        thumbnail_url: existingSession?.thumbnail_url || null,
        // Garder le thumbnail existant
        ...(vibePreviewUrl && { cloudflare_deployment_url: vibePreviewUrl }),
        updated_at: new Date().toISOString()
      }).eq('id', sessionId);
      if (error) throw error;

      // Publier automatiquement le projet sur builtbymagellan.com
      if (websiteTitle && Object.keys(projectFiles).length > 0) {
        try {
          console.log('🚀 Publishing project to builtbymagellan.com...');
          const {
            data: publishData,
            error: publishError
          } = await supabase.functions.invoke('publish-project', {
            body: {
              sessionId
            }
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

      // Récupérer l'ancien thumbnail pour le supprimer
      const {
        data: existingSession
      } = await supabase.from('build_sessions').select('thumbnail_url').eq('id', sessionId).single();

      // Supprimer l'ancien screenshot si existant
      if (existingSession?.thumbnail_url) {
        try {
          // Extraire le nom du fichier de l'URL
          const oldUrl = existingSession.thumbnail_url;
          const oldFileName = oldUrl.split('/').pop();
          if (oldFileName) {
            console.log('🗑️ Suppression de l\'ancien thumbnail:', oldFileName);
            await supabase.storage.from('screenshots').remove([oldFileName]);
          }
        } catch (deleteErr) {
          console.warn('⚠️ Impossible de supprimer l\'ancien thumbnail:', deleteErr);
        }
      }

      // Utiliser notre helper pour capturer le thumbnail
      const blob = await capturePreviewThumbnail(contentToCapture);
      if (blob) {
        // Uploader vers Supabase Storage avec un nom unique
        const fileName = `${sessionId}-${Date.now()}.png`;
        const {
          data: uploadData,
          error: uploadError
        } = await supabase.storage.from('screenshots').upload(fileName, blob, {
          contentType: 'image/png',
          upsert: true
        });
        if (uploadError) {
          console.error('❌ Error uploading screenshot:', uploadError);
        } else {
          // Obtenir l'URL publique
          const {
            data: {
              publicUrl
            }
          } = supabase.storage.from('screenshots').getPublicUrl(fileName);

          // Mettre à jour uniquement le thumbnail
          await supabase.from('build_sessions').update({
            thumbnail_url: publicUrl
          }).eq('id', sessionId);
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
      const {
        error
      } = await supabase.from('build_sessions').update({
        project_files: filesObject,
        messages: messagesArray as any,
        title: title,
        project_type: projectType,
        updated_at: new Date().toISOString()
      }).eq('id', sessionId);
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
      type: path.endsWith('.html') ? 'html' : path.endsWith('.css') ? 'stylesheet' : path.endsWith('.js') ? 'javascript' : 'text'
    }));
  };
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const newFiles: Array<{
      name: string;
      base64: string;
      type: string;
    }> = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // Vérifier que c'est une image
      if (!file.type.startsWith('image/')) {
        sonnerToast.error(`${file.name} is not an image`);
        continue;
      }

      // Convertir en base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>(resolve => {
        reader.onloadend = () => {
          resolve(reader.result as string);
        };
        reader.readAsDataURL(file);
      });
      const base64 = await base64Promise;
      newFiles.push({
        name: file.name,
        base64,
        type: file.type
      });
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
      sonnerToast.error("Please select an image");
      return;
    }
    try {
      // Convertir en base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>(resolve => {
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
      const updatedIndexHtml = generatedHtml.replace(/<link rel="icon"[^>]*>/, `<link rel="icon" type="${file.type}" href="/favicon.${extension}">`);
      setGeneratedHtml(updatedIndexHtml);

      // Sauvegarder dans la base de données
      if (sessionId) {
        await supabase.from('build_sessions').update({
          generated_html: updatedIndexHtml,
          project_files: {
            ...projectFiles,
            [faviconPath]: base64
          }
        }).eq('id', sessionId);
      }
      sonnerToast.success("Favicon updated successfully");
      if (faviconInputRef.current) {
        faviconInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Error uploading favicon:', error);
      sonnerToast.error("Error uploading favicon");
    }
  };

  // 🆕 GENERATE SITE HANDLER - Pour la création de nouveaux sites complets
  const handleGenerateSite = async (userPrompt: string) => {
    console.log('🎨 GENERATE SITE - Starting', {
      userPrompt: userPrompt.substring(0, 100),
      sessionId
    });

    if (!user) {
      console.error('❌ No user, redirecting to auth');
      navigate('/auth');
      return;
    }

    // Ajouter le message utilisateur
    const userMessage: Message = {
      role: 'user',
      content: userPrompt,
      created_at: new Date().toISOString()
    };

    // Éviter d'ajouter le message s'il existe déjà
    setMessages(prev => {
      const lastUserMessage = [...prev].reverse().find(m => m.role === 'user');
      if (lastUserMessage && typeof lastUserMessage.content === 'string' && lastUserMessage.content === userPrompt) {
        return prev;
      }
      return [...prev, userMessage];
    });

    // Activer le mode génération initiale
    console.log('🎬 Activating initial generation mode');
    setIsInitialGeneration(true);
    isInitialGenerationRef.current = true;
    setIsQuickModLoading(true);

    // Ajouter un message contextuel avant la génération
    const contextMessage: Message = {
      role: 'assistant',
      content: "D'accord, je vais créer votre site. Laissez-moi analyser votre demande et planifier l'architecture du projet.",
      created_at: new Date().toISOString(),
      metadata: {
        type: 'message'
      }
    };
    setMessages(prev => [...prev, contextMessage]);

    // Créer le message de génération
    const generationStartTime = Date.now();
    generationStartTimeRef.current = generationStartTime;

    const generationMessage: Message = {
      role: 'assistant',
      content: '',
      created_at: new Date().toISOString(),
      metadata: {
        type: 'generation',
        thought_duration: 0,
        intent_message: 'Creating your site...',
        generation_events: [],
        files_modified: 0,
        modified_files: [],
        total_tokens: 0,
        project_files: {},
        startTime: generationStartTime
      }
    };
    setMessages(prev => [...prev, generationMessage]);
    generationEventsRef.current = [];

    // Variable pour stocker les tokens
    let receivedTokens = {
      input: 0,
      output: 0,
      total: 0
    };

    try {
      const result = await generateSiteHook.generateSite({
        prompt: userPrompt,
        sessionId: sessionId!
      }, {
        onGenerationEvent: (event) => {
          console.log('📌 Generation event:', event);
          // Ajouter l'événement à la liste
          generationEventsRef.current = [...generationEventsRef.current, event];
          
          // Mettre à jour les métadonnées du message en temps réel
          setMessages(prev => {
            const lastMsg = prev[prev.length - 1];
            if (lastMsg?.metadata?.type === 'generation') {
              return prev.map((msg, idx) =>
                idx === prev.length - 1
                  ? {
                      ...msg,
                      metadata: {
                        ...msg.metadata,
                        generation_events: [...generationEventsRef.current]
                      }
                    }
                  : msg
              );
            }
            return prev;
          });
        },
        onProjectName: (name) => {
          console.log('📛 [BuilderSession] Project name received:', name);
          setWebsiteTitle(name);
          websiteTitleRef.current = name; // sync ref immédiatement pour les callbacks async
        },
        onPreviewUrl: async (url) => {
          console.log('🌐 [BuilderSession] VibeSDK preview URL received:', url);
          setVibePreviewUrl(url);
          // Sauvegarder l'URL de preview en base de données
          if (sessionId) {
            try {
              await supabase
                .from('build_sessions')
                .update({ cloudflare_deployment_url: url })
                .eq('id', sessionId);
              console.log('✅ VibeSDK preview URL saved to DB');
            } catch (err) {
              console.warn('⚠️ Failed to save preview URL to DB:', err);
            }
          }
          // ──────────────────────────────────────────────
          // Auto-publish: enregistre le subdomain builtbymagellan.com
          // dès qu'une nouvelle URL VibeSDK est disponible
          // ──────────────────────────────────────────────
          if (canDeploy && sessionId) {
            try {
              const title = websiteTitleRef.current;
              const siteName = (title || 'mon-projet')
                .toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/[^a-z0-9\s-]/g, '')
                .trim()
                .replace(/\s+/g, '-')
                .replace(/-+/g, '-')
                .substring(0, 50) || 'mon-projet';

              console.log('🚀 [BuilderSession] Auto-publishing to builtbymagellan.com...');
              const { data: result } = await supabase.functions.invoke('publish-to-cloudflare', {
                body: { sessionId, siteName, vibePreviewUrl: url },
              });
              if (result?.success && result?.url) {
                console.log('✅ [BuilderSession] Auto-published:', result.url);
                setDeployedUrl(result.url);
                setLastPublishResult({
                  publicUrl: result.url,
                  cloudflareUrl: result.cloudflareUrl || result.url,
                  subdomain: result.subdomain,
                });
                // Persister l'URL publique
                await supabase.from('build_sessions').update({ public_url: result.url }).eq('id', sessionId);
              }
            } catch (publishErr) {
              console.warn('⚠️ [BuilderSession] Auto-publish failed (non-blocking):', publishErr);
            }
          }
        },
        onProgress: (content) => {
          console.log('📝 Progress:', content.length, 'characters');
        },
        onFiles: async (files) => {
          // 🔍 DEBUG: Logs détaillés pour diagnostic preview
          console.log('📦 [BuilderSession] Files received:', {
            count: Object.keys(files).length,
            paths: Object.keys(files),
            hasApp: Object.keys(files).some(k => k.toLowerCase().includes('app.tsx')),
            hasMain: Object.keys(files).some(k => k.toLowerCase().includes('main.tsx')),
            sample: Object.entries(files)[0]?.[1]?.substring(0, 100)
          });

          // Mettre à jour les fichiers
          await updateFiles(files, true);

          // ✅ FIX: Marquer les fichiers comme prêts pour la preview
          if (Object.keys(files).length > 0) {
            console.log('✅ [BuilderSession] Setting isFilesReady = true');
            setIsFilesReady(true);
          }

          // Définir le HTML généré
          if (files['index.html']) {
            setGeneratedHtml(files['index.html']);
          }

          // Sauvegarder en base de données
          if (sessionId && user) {
            try {
              const { error: updateError } = await supabase
                .from('build_sessions')
                .update({
                  project_files: files,
                  updated_at: new Date().toISOString()
                })
                .eq('id', sessionId);

              if (updateError) {
                console.error('Erreur lors de la sauvegarde:', updateError);
              } else {
                console.log('✅ Projet sauvegardé avec succès');
              }
            } catch (error) {
              console.error('Erreur lors de la sauvegarde:', error);
            }
          }
        },
        onTokens: (tokens) => {
          console.log('💰 Tokens:', tokens);
          receivedTokens = tokens;

          // Mettre à jour les métadonnées du message
          setMessages(prev => {
            const lastMsg = prev[prev.length - 1];
            if (lastMsg?.metadata?.type === 'generation') {
              return prev.map((msg, idx) =>
                idx === prev.length - 1
                  ? {
                      ...msg,
                      metadata: {
                        ...msg.metadata,
                        total_tokens: tokens.total,
                        input_tokens: tokens.input,
                        output_tokens: tokens.output
                      }
                    }
                  : msg
              );
            }
            return prev;
          });
        },
        onError: (error) => {
          console.error('❌ Generate site error:', error);

          // Messages d'erreur clairs
          let userMessage = 'An error occurred while generating the site.';
          if (error.includes('timeout')) {
            userMessage = 'Generation took too long. Try a simpler request.';
          } else if (error.includes('No modifications generated')) {
            userMessage = 'Unable to generate the site. Try rephrasing your request more precisely.';
          }

          sonnerToast.error(userMessage);

          // ✅ FIX BUG #2: Reset isInitialGeneration en cas d'erreur
          setIsInitialGeneration(false);
          isInitialGenerationRef.current = false;
        },
        onComplete: async (result) => {
          console.log('✅ Generation complete:', {
            filesCount: Object.keys(result.files).length,
            tokens: result.tokens,
            duration: result.duration
          });

          const thoughtSeconds = Math.round(result.duration / 1000);
          const fileCount = Object.keys(result.files).length;

          // Mettre à jour le message avec les résultats
          setMessages(prev => {
            const lastMsg = prev[prev.length - 1];
            if (lastMsg?.metadata?.type === 'generation') {
              return prev.map((msg, idx) =>
                idx === prev.length - 1
                  ? {
                      ...msg,
                      content: `Created ${fileCount} files in ${thoughtSeconds}s`,
                      metadata: {
                        ...msg.metadata,
                        files_created: fileCount,
                        new_files: Object.keys(result.files),
                        thought_duration: result.duration,
                        total_tokens: result.tokens.total,
                        input_tokens: result.tokens.input,
                        output_tokens: result.tokens.output,
                        project_files: result.files
                      }
                    }
                  : msg
              );
            }
            return prev;
          });

          // Message de résumé contextuel basé sur le prompt utilisateur
          const lastUserMsgForContext = messages.filter(m => m.role === 'user').pop();
          const userPromptContext = typeof lastUserMsgForContext?.content === 'string' ? lastUserMsgForContext.content : '';
          
          // Extraire le type de projet du prompt
          const projectKeywords = userPromptContext.toLowerCase();
          let projectDescription = 'votre projet';
          if (projectKeywords.includes('restaurant')) projectDescription = 'votre restaurant';
          else if (projectKeywords.includes('agence')) projectDescription = 'votre agence';
          else if (projectKeywords.includes('portfolio')) projectDescription = 'votre portfolio';
          else if (projectKeywords.includes('boutique') || projectKeywords.includes('shop')) projectDescription = 'votre boutique';
          else if (projectKeywords.includes('cabinet')) projectDescription = 'votre cabinet';
          else if (projectKeywords.includes('blog')) projectDescription = 'votre blog';
          else if (projectKeywords.includes('entreprise') || projectKeywords.includes('business')) projectDescription = 'votre entreprise';
          else if (projectKeywords.includes('voyage')) projectDescription = 'votre agence de voyage';
          
          const hasContactForm = Object.values(result.files).some(content => 
            content.includes('ContactForm') || content.includes('contact-form') || content.includes('formulaire')
          );
          const hasNavigation = Object.values(result.files).some(content => 
            content.includes('Nav') || content.includes('navigation') || content.includes('menu')
          );
          
          const features = [];
          if (hasContactForm) features.push('un formulaire de contact fonctionnel');
          if (hasNavigation) features.push('une navigation intuitive');
          if (fileCount > 5) features.push('plusieurs sections bien structurées');
          
          const featuresText = features.length > 0 
            ? `Le site inclut ${features.join(', ')}.` 
            : '';

          const summaryMessage: Message = {
            role: 'assistant',
            content: `J'ai créé le site pour ${projectDescription} ! Le design est moderne et responsive. ${featuresText} Vous pouvez visualiser le résultat dans la preview et me demander des modifications si besoin.`,
            created_at: new Date().toISOString(),
            metadata: {
              type: 'message'
            }
          };
          setMessages(prev => [...prev, summaryMessage]);

          sonnerToast.success(`Site created successfully! (${fileCount} files)`);

          // ✅ SAUVEGARDER LES MESSAGES EN BASE DE DONNÉES
          if (sessionId) {
            try {
              // 1. Sauvegarder le message utilisateur
              if (lastUserMsgForContext) {
                await supabase.from('chat_messages').insert([{
                  session_id: sessionId,
                  role: 'user',
                  content: typeof lastUserMsgForContext.content === 'string' ? lastUserMsgForContext.content : JSON.stringify(lastUserMsgForContext.content),
                  created_at: lastUserMsgForContext.created_at || new Date().toISOString()
                }]);
              }

              // 2. Sauvegarder le message de génération avec toutes les métadonnées
              await supabase.from('chat_messages').insert([{
                session_id: sessionId,
                role: 'assistant',
                content: `Created ${fileCount} files in ${thoughtSeconds}s`,
                token_count: result.tokens.total,
                metadata: {
                  type: 'generation',
                  thought_duration: result.duration,
                  intent_message: 'Creating your site...',
                  generation_events: generationEventsRef.current,
                  files_created: fileCount,
                  new_files: Object.keys(result.files),
                  total_tokens: result.tokens.total,
                  input_tokens: result.tokens.input,
                  output_tokens: result.tokens.output,
                  project_files: result.files
                }
              }]);

              // 3. Sauvegarder le message de résumé
              await supabase.from('chat_messages').insert([{
                session_id: sessionId,
                role: 'assistant',
                content: summaryMessage.content as string,
                metadata: { type: 'message' }
              }]);

              console.log('✅ Messages sauvegardés en base de données');
            } catch (saveError) {
              console.error('❌ Erreur sauvegarde messages:', saveError);
            }
          }

          // ✅ Désactiver le mode génération initiale
          setIsInitialGeneration(false);
          isInitialGenerationRef.current = false;
        }
      });

      // Incrémenter le compteur de messages utilisateur
      if (user?.id) {
        console.log('💬 Incrementing user message count');
        try {
          const { data: profile, error: fetchError } = await supabase
            .from('profiles')
            .select('messages_used')
            .eq('id', user.id)
            .maybeSingle();

          if (!fetchError && profile) {
            const currentMessages = (profile as any).messages_used || 0;
            const { error: updateError } = await supabase
              .from('profiles')
              .update({ messages_used: currentMessages + 1 } as any)
              .eq('id', user.id);

            if (updateError) {
              console.error('❌ Error updating message count:', updateError);
            } else {
              console.log('✅ Message count incremented:', currentMessages + 1);
            }
          }
        } catch (error) {
          console.error('❌ Message count error:', error);
        }
      }

      console.log('🎨 GENERATE SITE - Complete');
      
      // Recharger les versions R2 après génération
      await fetchVersions();
    } catch (error) {
      console.error('❌ GENERATE SITE - Error:', error);
      sonnerToast.error('Website generation failed');

      // ✅ FIX BUG #2: Reset isInitialGeneration en cas d'erreur
      setIsInitialGeneration(false);
      isInitialGenerationRef.current = false;
    } finally {
      setIsQuickModLoading(false);
    }
  };

  // 🆕 UNIFIED MODIFY HANDLER - Remplace le routing manuel entre agent-v2 et modify-site
  const handleUnifiedModification = async (userPrompt: string, skipFallback: boolean = false) => {
    console.log('🔄 UNIFIED MODIFY - Starting', {
      userPrompt: userPrompt.substring(0, 100),
      hasProjectFiles: Object.keys(projectFiles).length > 0,
      sessionId,
      hasMemory: !!memory,
      skipFallback
    });
    if (!user) {
      console.error('❌ No user, redirecting to auth');
      navigate('/auth');
      return;
    }

    // Ajouter le message utilisateur
    const userMessage: Message = {
      role: 'user',
      content: userPrompt,
      created_at: new Date().toISOString()
    };

    // Éviter d'ajouter le message s'il existe déjà
    setMessages(prev => {
      const lastUserMessage = [...prev].reverse().find(m => m.role === 'user');
      if (lastUserMessage && typeof lastUserMessage.content === 'string' && lastUserMessage.content === userPrompt) {
        return prev;
      }
      return [...prev, userMessage];
    });

    // 🔒 Activer le mode "génération en cours" UNIQUEMENT pour la première génération (pas de fichiers existants)
    const isFirstGeneration = Object.keys(projectFiles).length === 0;
    if (isFirstGeneration) {
      console.log('🎬 First generation detected - showing GeneratingPreview');
      setIsInitialGeneration(true);
      isInitialGenerationRef.current = true;
    }

    // Créer le message de génération
    const generationStartTime = Date.now();
    generationStartTimeRef.current = generationStartTime;
    setIsQuickModLoading(true);
    const generationMessage: Message = {
      role: 'assistant',
      content: '',
      created_at: new Date().toISOString(),
      metadata: {
        type: 'generation',
        thought_duration: 0,
        intent_message: 'Analyzing your request...',
        generation_events: [],
        files_modified: 0,
        modified_files: [],
        total_tokens: 0,
        project_files: {},
        startTime: generationStartTime
      }
    };
    setMessages(prev => [...prev, generationMessage]);
    generationEventsRef.current = [];

    // Variable pour stocker les tokens
    let receivedTokens = {
      input: 0,
      output: 0,
      total: 0
    };
    try {
      // P0: Construire l'historique de conversation pour le contexte Claude
      const conversationHistory = messages
        .filter(m => typeof m.content === 'string' && m.content.trim())
        .slice(-5) // Limiter aux 5 derniers messages
        .map(m => ({
          role: m.role,
          content: typeof m.content === 'string' ? m.content : ''
        }));

      const result = await unifiedModify.unifiedModify({
        message: userPrompt,
        projectFiles,
        sessionId: sessionId!,
        memory,
        conversationHistory // P0: Passer l'historique de conversation
      }, {
        onIntentMessage: message => {
          console.log('💬 Intent:', message);
          sonnerToast.info(message, {
            duration: 3000
          });
          setMessages(prev => {
            const lastMsg = prev[prev.length - 1];
            if (lastMsg?.metadata?.type === 'generation') {
              return prev.map((msg, idx) => idx === prev.length - 1 ? {
                ...msg,
                metadata: {
                  ...msg.metadata,
                  intent_message: message
                }
              } : msg);
            }
            return prev;
          });
        },
        onGenerationEvent: event => {
          console.log('⚙️ Event:', event);

          // ✅ VALIDATION STRICTE : Ignorer les événements de streaming (chunks)
          if (event.type === 'stream') {
            // Les chunks de streaming ne sont pas affichés comme des événements
            return;
          }

          // ✅ VALIDATION STRICTE : Vérifier que la phase est valide
          if (event.type === 'phase' && (!event.phase || typeof event.phase !== 'string')) {
            console.warn('⚠️ Invalid phase event - missing or invalid phase:', event);
            return;
          }

          // Mapper les phases unified-modify vers les types GenerationEvent
          const phaseToType: Record<string, GenerationEvent['type']> = {
            'analyze': 'analyze',
            'context': 'read',
            'generation': 'write',
            'validation': 'edit'
          };

          // Messages clairs par phase et statut
          const getPhaseMessage = (phase: string, status: string): string => {
            if (status === 'starting') {
              const startMessages: Record<string, string> = {
                'analyze': '🔍 Analyzing your request...',
                'context': '📂 Loading relevant files...',
                'generation': '✨ Generating changes...',
                'validation': '🔍 Validating changes...'
              };
              return startMessages[phase] || `Processing ${phase}...`;
            } else {
              const completeMessages: Record<string, string> = {
                'analyze': '✅ Request analyzed',
                'context': '✅ Files loaded',
                'generation': '✅ Changes generated',
                'validation': '✅ Changes validated'
              };
              return completeMessages[phase] || `${phase} completed`;
            }
          };

          // ✅ FIX : Créer l'événement avec message valide
          const newEvent: GenerationEvent = {
            type: event.phase ? (phaseToType[event.phase] || 'thought') : 'thought',
            status: event.status === 'complete' ? 'completed' : 'in-progress',
            message: event.message || (event.phase ? getPhaseMessage(event.phase, event.status || 'starting') : 'Processing...'),
            phase: event.phase,
            data: event.data
          };

          // ✅ OPTIMISATION : Une seule mise à jour de state
          setMessages(prev => {
            const lastMsg = prev[prev.length - 1];
            if (lastMsg?.metadata?.type !== 'generation') {
              return prev;
            }

            const updatedEvents = [...(lastMsg.metadata.generation_events || []), newEvent];
            generationEventsRef.current = updatedEvents; // Sync ref

            return prev.map((msg, idx) =>
              idx === prev.length - 1
                ? {
                    ...msg,
                    metadata: {
                      ...msg.metadata,
                      generation_events: updatedEvents,
                      thought_duration: Date.now() - generationStartTimeRef.current
                    }
                  }
                : msg
            );
          });
        },
        onASTModifications: async (modifications, updatedFiles) => {
          console.log('🔧 AST Modifications:', {
            count: modifications.length,
            files: Object.keys(updatedFiles),
            modificationTypes: modifications.map(m => m.type)
          });
          if (modifications.length === 0) {
            console.warn('⚠️ No modifications generated');
            sonnerToast.warning('No modifications generated');
            return;
          }

          // Mettre à jour les fichiers
          await updateFiles(updatedFiles, true);
          setGeneratedHtml(updatedFiles['index.html'] || generatedHtml);

          // Mettre à jour le fichier sélectionné si modifié
          if (selectedFile && updatedFiles[selectedFile] !== projectFiles[selectedFile]) {
            setSelectedFileContent(updatedFiles[selectedFile]);
          }

          // Sauvegarder en base
          await supabase.from('build_sessions').update({
            project_files: updatedFiles,
            updated_at: new Date().toISOString()
          }).eq('id', sessionId!);

          // Mettre à jour la mémoire
          const modifiedFilesList = Object.keys(updatedFiles).filter(path => updatedFiles[path] !== projectFiles[path]);
          if (modifiedFilesList.length > 0) {
            try {
              const codeChanges = modifiedFilesList.map(path => ({
                path,
                type: 'modify' as const,
                description: `Modified ${path} via unified-modify`
              }));
              await updateMemory(codeChanges, []);
            } catch (memError) {
              console.warn('⚠️ Failed to update memory:', memError);
            }
          }
          sonnerToast.success(`Applied ${modifications.length} modifications`);
        },
        onTokens: tokens => {
          console.log('💰 Tokens received:', {
            input: tokens.input,
            output: tokens.output,
            total: tokens.total,
            willDeduct: user?.id ? true : false
          });
          receivedTokens = tokens;
        },
        onError: async error => {
          console.error('❌ Error:', error);

          // 🔄 FALLBACK AUTOMATIQUE : Si unified-modify échoue sur première génération, utiliser generate-site
          if (!skipFallback && isFirstGeneration && error.includes('No modifications generated')) {
            console.log('🔄 FALLBACK: unified-modify failed on first generation, trying generate-site...');
            sonnerToast.info('Trying with full generator...');

            // Reset l'état avant le fallback
            setIsInitialGeneration(false);
            isInitialGenerationRef.current = false;
            setIsQuickModLoading(false);

            // Supprimer le dernier message d'erreur
            setMessages(prev => prev.slice(0, -1));

            // Essayer avec generate-site
            try {
              await handleGenerateSite(userPrompt);
              return; // Succès, on sort
            } catch (fallbackError) {
              console.error('❌ Fallback also failed:', fallbackError);
              sonnerToast.error('Generation failed even with full generator');
              return;
            }
          }

          // ✅ Messages d'erreur clairs et spécifiques
          let userMessage = 'An error occurred while processing.';
          if (error.includes('No modifications generated')) {
            userMessage = 'No modifications generated. Try rephrasing your request more precisely.';
          } else if (error.includes('timeout')) {
            userMessage = 'Processing took too long. Try a simpler request.';
          } else if (error.includes('validation')) {
            userMessage = 'Modification validation error. Please try again.';
          } else {
            userMessage = error || 'Request processing failed.';
          }

          sonnerToast.error(userMessage);

          // ✅ FIX BUG #2: Reset isInitialGeneration en cas d'erreur
          setIsInitialGeneration(false);
          isInitialGenerationRef.current = false;
        },
        onComplete: async (completeResult) => {
          console.log('✅ Complete:', completeResult);
          const duration = Date.now() - generationStartTime;

          // Désactiver le loading preview si c'était une première génération
          if (isInitialGenerationRef.current) {
            console.log('🎬 Disabling GeneratingPreview after first generation');
            setIsInitialGeneration(false);
            isInitialGenerationRef.current = false;
          }

          // Mettre à jour le message final
          setMessages(prev => {
            const lastMsg = prev[prev.length - 1];
            if (lastMsg?.metadata?.type === 'generation') {
              return prev.map((msg, idx) => idx === prev.length - 1 ? {
                ...msg,
                content: completeResult.message || 'Modifications applied',
                metadata: {
                  ...msg.metadata,
                  thought_duration: duration,
                  files_modified: completeResult.modifications?.length || 0,
                  total_tokens: completeResult.tokens?.total || 0,
                  input_tokens: completeResult.tokens?.input || 0,
                  output_tokens: completeResult.tokens?.output || 0,
                  project_files: completeResult.updatedFiles
                }
              } : msg);
            }
            return prev;
          });

          // ✅ SAUVEGARDER LES MESSAGES EN BASE DE DONNÉES
          if (sessionId) {
            try {
              // 1. Sauvegarder le message utilisateur
              await supabase.from('chat_messages').insert([{
                session_id: sessionId,
                role: 'user',
                content: userPrompt,
                created_at: new Date().toISOString()
              }]);

              // 2. Sauvegarder le message de génération avec toutes les métadonnées
              await supabase.from('chat_messages').insert([{
                session_id: sessionId,
                role: 'assistant',
                content: completeResult.message || 'Modifications applied',
                token_count: completeResult.tokens?.total || 0,
                metadata: {
                  type: 'generation',
                  thought_duration: duration,
                  intent_message: 'Analyzing your request...',
                  generation_events: generationEventsRef.current,
                  files_modified: completeResult.modifications?.length || 0,
                  modified_files: Object.keys(completeResult.updatedFiles || {}),
                  total_tokens: completeResult.tokens?.total || 0,
                  input_tokens: completeResult.tokens?.input || 0,
                  output_tokens: completeResult.tokens?.output || 0,
                  project_files: completeResult.updatedFiles
                }
              }]);
              console.log('✅ Messages sauvegardés en base de données');
            } catch (saveError) {
              console.error('❌ Erreur sauvegarde messages:', saveError);
            }
          }
        }
      });

      // Incrémenter le compteur de messages utilisateur
      if (user?.id) {
        console.log('💬 Incrementing user message count (unified modify)');
        try {
          const { data: profile, error: fetchError } = await supabase
            .from('profiles')
            .select('messages_used')
            .eq('id', user.id)
            .maybeSingle();

          if (!fetchError && profile) {
            const currentMessages = (profile as any).messages_used || 0;
            const { error: updateError } = await supabase
              .from('profiles')
              .update({ messages_used: currentMessages + 1 } as any)
              .eq('id', user.id);

            if (updateError) {
              console.error('❌ Error updating message count:', updateError);
            } else {
              console.log('✅ Message count incremented:', currentMessages + 1);
            }
          }
        } catch (error) {
          console.error('❌ Message count error:', error);
        }
      }
      console.log('🔄 UNIFIED MODIFY - Complete');
      
      // Recharger les versions R2 après modification
      await fetchVersions();
    } catch (error) {
      console.error('❌ UNIFIED MODIFY - Error:', error);
      sonnerToast.error('Request processing failed');

      // ✅ FIX BUG #2: Reset isInitialGeneration en cas d'erreur catch
      setIsInitialGeneration(false);
      isInitialGenerationRef.current = false;
    } finally {
      setIsQuickModLoading(false);

      // ✅ FIX BUG #2: Assurer le reset même en cas de succès incomplet
      if (isInitialGenerationRef.current) {
        console.log('⚠️ Resetting isInitialGeneration in finally block');
        setIsInitialGeneration(false);
        isInitialGenerationRef.current = false;
      }
    }
  };

  // Nouveau handleSubmit qui route entre modifications rapides et génération complète
  const handleSubmit = async () => {
    const prompt = inputValue.trim() || (messages.length === 1 && typeof messages[0].content === 'string' ? messages[0].content : '');
    if (!prompt && attachedFiles.length === 0) {
      sonnerToast.error("Please enter your message or attach a file");
      return;
    }
    if (!user) {
      navigate('/auth');
      throw new Error('Authentication required');
    }

    // Vérification du quota de messages (sauf en mode chat simple)
    if (!chatMode && isAtLimit) {
      setUpgradeContext('message');
      setShowUpgradeModal(true);
      return;
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
        const {
          data,
          error
        } = await supabase.functions.invoke('chat-only', {
          body: {
            message: prompt,
            chatHistory,
            sessionId
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
          await supabase.from('profiles').update({
            tokens_used: (user.tokens_used || 0) + data.tokens.total
          }).eq('id', user.id);
          setUser((prev: any) => ({
            ...prev,
            tokens_used: (prev.tokens_used || 0) + data.tokens.total
          }));
        }
      } catch (error) {
        console.error('Chat error:', error);
        sonnerToast.error('Error during conversation');
        // Supprimer le message de chargement
        setMessages(prev => prev.slice(0, -1));
      }
      return;
    }

    // MODE NORMAL - Génération de code
    // Nettoyer les inputs
    setInputValue('');
    setAttachedFiles([]);

    // 🎯 ROUTING INTELLIGENT : Nouveau site vs Modification
    const isFirstGeneration = Object.keys(projectFiles).length === 0;

    if (isFirstGeneration) {
      // 🎨 Nouveau site : utiliser GENERATE-SITE (création complète)
      console.log('🎨 Routing vers GENERATE-SITE (nouveau site complet)');
      await handleGenerateSite(prompt);
    } else {
      // 🔄 Modification : utiliser UNIFIED-MODIFY (modifications AST)
      console.log('🔄 Routing vers UNIFIED-MODIFY (modification de site existant)');
      await handleUnifiedModification(prompt);
    }

    // Mettre à jour le compteur de messages après génération
    refetchCredits();
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
        sonnerToast.success("Project saved!");
      } catch (error: any) {
        console.error('Error saving:', error);
        sonnerToast.error(error.message || "Error saving");
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
      sonnerToast.error("Please enter a title for your site");
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
      sonnerToast.error("No content to download");
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
      let cleanHtml = generatedHtml.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '').replace(/<script(?![^>]*type=["']module["'])[^>]*>[\s\S]*?<\/script>/gi, '');
      cleanHtml = cleanHtml.replace('</head>', '  <link rel="stylesheet" href="style.css">\n</head>');
      cleanHtml = cleanHtml.replace('</body>', '  <script src="script.js"></script>\n</body>');

      // Créer le ZIP
      const zip = new JSZip();
      zip.file('index.html', cleanHtml);
      zip.file('style.css', extractedCss || '/* Styles générés par Trinity AI */\n');
      zip.file('script.js', extractedJs || '// Scripts générés par Trinity AI\n');
      const blob = await zip.generateAsync({
        type: 'blob'
      });

      // Télécharger le ZIP
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${websiteTitle || 'mon-site'}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      sonnerToast.success("ZIP downloaded successfully!");
    } catch (error: any) {
      console.error('Error downloading ZIP:', error);
      sonnerToast.error(error.message || "Error downloading");
    }
  };
  const PUBLISH_STEPS = [
    'Preparing files...',
    'Deploying to Cloudflare...',
    'Configuring DNS...',
    'Going live...',
  ];

  const handlePublish = async () => {
    if (!user) {
      localStorage.setItem('redirectAfterAuth', `/builder/${sessionId}`);
      navigate('/auth');
      return;
    }
    if (!projectFiles || Object.keys(projectFiles).length === 0) {
      sonnerToast.error("No content to publish");
      return;
    }

    // Vérification du plan pour la publication
    if (!canDeploy) {
      setUpgradeContext('publish');
      setShowUpgradeModal(true);
      return;
    }

    // Si pas de titre, demander d'abord
    if (!websiteTitle.trim()) {
      sonnerToast.error("Please save your project with a title first");
      setShowSaveDialog(true);
      return;
    }
    setPublishStep(0);
    setIsPublishing(true);
    // Animate through publish steps
    let step = 0;
    publishIntervalRef.current = setInterval(() => {
      step += 1;
      if (step < PUBLISH_STEPS.length - 1) {
        setPublishStep(step);
      }
    }, 2500);
    try {
      const {
        data: {
          session
        }
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Session non valide, veuillez vous reconnecter');
      }

      // Générer le nom du projet à partir du titre
      const siteName = (websiteTitle || 'mon-projet')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .substring(0, 50);

      console.log('🚀 Publishing to Cloudflare Pages with siteName:', siteName);
      sonnerToast.info("Deploying to Cloudflare Pages...");

      // Appel à publish-to-cloudflare
      // Si on a un vibePreviewUrl, on le passe pour éviter un redéploiement inutile
      const { data: result, error: publishError } = await supabase.functions.invoke('publish-to-cloudflare', {
        body: {
          sessionId,
          projectFiles,
          siteName,
          vibePreviewUrl: vibePreviewUrl || undefined,
        }
      });

      if (publishError) {
        throw new Error(publishError.message || 'Publishing error');
      }

      if (!result?.success) {
        throw new Error(result?.error || 'Publishing error');
      }

      if (result.url) {
        // Stocker les résultats de publication
        setLastPublishResult({
          publicUrl: result.url,
          cloudflareUrl: result.cloudflareUrl,
          subdomain: result.subdomain
        });
        setDeployedUrl(result.url);

        // Sauvegarder le titre si nécessaire
        if (!websiteTitle || websiteTitle === 'Nouveau projet' || websiteTitle.trim() === '') {
          const siteName = (websiteTitle || 'mon-projet')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9\s-]/g, '')
            .trim()
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .substring(0, 50);
          const formattedTitle = siteName.split('-').map((word: string) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
          setWebsiteTitle(formattedTitle);
          await supabase.from('build_sessions').update({
            title: formattedTitle,
            cloudflare_deployment_url: result.cloudflareUrl || result.url,
            public_url: result.url
          }).eq('id', sessionId);
        } else {
          await supabase.from('build_sessions').update({
            cloudflare_deployment_url: result.cloudflareUrl || result.url,
            public_url: result.url
          }).eq('id', sessionId);
        }

        // Ouvrir la modale de succès
        setShowPublishSuccess(true);
        sonnerToast.success("Site published successfully!");
      }
    } catch (error: any) {
      console.error('Error publishing:', error);
      sonnerToast.error(error.message || "Error publishing");
    } finally {
      if (publishIntervalRef.current) {
        clearInterval(publishIntervalRef.current);
        publishIntervalRef.current = null;
      }
      setIsPublishing(false);
      setPublishStep(0);
    }
  };
  if (sessionLoading) {
    return <div className="min-h-screen flex items-center justify-center">
        <p className="text-slate-600">Loading...</p>
      </div>;
  }
  return <div className={`h-screen flex flex-col`} style={{
    backgroundColor: isDark ? '#1F1F20' : '#ffffff'
  }}>
      {/* Barre d'action */}
      <div className="h-12 backdrop-blur-sm flex items-center justify-between px-2 md:px-4 bg-background">
        <div className="flex items-center gap-2 md:gap-3">
          <button onClick={() => navigate('/dashboard')} className="h-8 w-8 flex items-center justify-center transition-colors group" title="Dashboard">
            <Home className="w-4 h-4 transition-colors" style={{
            color: isDark ? '#fff' : '#1F2937'
          }} onMouseEnter={e => e.currentTarget.style.color = '#03A5C0'} onMouseLeave={e => e.currentTarget.style.color = isDark ? '#fff' : '#1F2937'} />
          </button>

          {/* Mobile toggle: Chat / Preview */}
          {isMobile && (
            <div className="flex items-center gap-1 rounded-md border p-0.5" style={{
              backgroundColor: isDark ? '#181818' : '#ffffff',
              borderColor: isDark ? '#1F1F20' : 'rgba(203, 213, 225, 1)'
            }}>
              <Button
                variant="iconOnly"
                size="sm"
                onClick={() => setMobileView('chat')}
                className={`h-7 px-2 text-xs ${mobileView === 'chat' ? 'text-[#03A5C0]' : 'text-muted-foreground'}`}
                style={{ backgroundColor: mobileView === 'chat' ? 'rgba(3, 165, 192, 0.1)' : 'transparent' }}
              >
                <MessageSquareText className="w-3 h-3 mr-1" />
                Chat
              </Button>
              <Button
                variant="iconOnly"
                size="sm"
                onClick={() => setMobileView('preview')}
                className={`h-7 px-2 text-xs ${mobileView === 'preview' ? 'text-[#03A5C0]' : 'text-muted-foreground'}`}
                style={{ backgroundColor: mobileView === 'preview' ? 'rgba(3, 165, 192, 0.1)' : 'transparent' }}
              >
                <MonitorPlay className="w-3 h-3 mr-1" />
                Preview
              </Button>
            </div>
          )}

          {!isMobile && <MessageCounter isDark={isDark} userId={user?.id} />}
        </div>

        {/* Input caché pour le favicon */}
        <input type="file" ref={faviconInputRef} onChange={handleFaviconUpload} accept="image/*" className="hidden" />

        <div className="flex items-center gap-1.5 md:gap-3">
          {/* Preview mode badge - desktop only */}
          {!isMobile && (
            <>
              <div className="flex items-center gap-1 rounded-md border p-0.5" style={{
                backgroundColor: isDark ? '#181818' : '#ffffff',
                borderColor: isDark ? '#1F1F20' : 'rgba(203, 213, 225, 1)'
              }}>
                <Button variant="iconOnly" size="sm" disabled className="h-7 px-2 text-xs text-[#03A5C0]">
                  <Eye className="w-3 h-3 mr-1" />
                  Preview
                </Button>
              </div>
              <div className="h-6 w-px bg-slate-300" />
            </>
          )}

          <div className="flex items-center gap-1 md:gap-2">
            {!isMobile && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button onClick={() => setPreviewMode(previewMode === 'desktop' ? 'mobile' : 'desktop')} variant="iconOnly" size="sm" className="h-8 w-8 p-0" style={{
                    borderColor: isDark ? 'hsl(var(--border))' : 'rgba(203, 213, 225, 0.5)',
                    backgroundColor: 'transparent',
                    color: isDark ? 'hsl(var(--foreground))' : '#1F2937'
                  }}>
                      {previewMode === 'desktop' ? <Smartphone className="w-3.5 h-3.5" /> : <Monitor className="w-3.5 h-3.5" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <p>{previewMode === 'desktop' ? 'Mode mobile' : 'Mode desktop'}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            {!isMobile && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button onClick={() => setInspectMode(!inspectMode)} type="button" variant="iconOnly" size="sm" className="h-8 w-8 p-0" style={{
                    borderColor: inspectMode ? '#03A5C0' : isDark ? 'hsl(var(--border))' : 'rgba(203, 213, 225, 0.5)',
                    backgroundColor: inspectMode ? 'rgba(3, 165, 192, 0.1)' : 'transparent',
                    color: inspectMode ? '#03A5C0' : isDark ? 'hsl(var(--foreground))' : '#1F2937'
                  }}>
                      <Edit className="w-3.5 h-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <p>{inspectMode ? 'Désactiver le mode édition' : 'Activer le mode édition'}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button onClick={() => setShowVersionHistory(true)} variant="iconOnly" size="sm" className="h-8 w-8 p-0" style={{
                    borderColor: isDark ? 'hsl(var(--border))' : 'rgba(203, 213, 225, 0.5)',
                    backgroundColor: 'transparent',
                    color: isDark ? 'hsl(var(--foreground))' : '#1F2937'
                  }}>
                    <History className="w-3.5 h-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p>Historique des versions</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <Button onClick={handleSave} disabled={isSaving} variant="iconOnly" size="sm" className="h-8 text-xs">
              <Save className="w-3.5 h-3.5 md:mr-1.5" />
              <span className="hidden md:inline">Save</span>
            </Button>
          </div>

          {!isMobile && <div className="h-6 w-px bg-slate-300" />}

          <div className="flex items-center gap-1 md:gap-2">
            <Button onClick={handlePublish} disabled={isPublishing} size="minimal" className="text-xs md:text-sm gap-1 md:gap-2 transition-all border rounded-full px-3 md:px-6" style={{
            borderColor: '#03A5C0',
            backgroundColor: 'rgba(3, 165, 192, 0.1)',
            color: '#03A5C0'
          }} onMouseEnter={e => {
            if (!isPublishing) e.currentTarget.style.backgroundColor = 'rgba(3, 165, 192, 0.2)';
          }} onMouseLeave={e => {
            e.currentTarget.style.backgroundColor = 'rgba(3, 165, 192, 0.1)';
          }}>
              {isPublishing ? (
                <span className="flex items-center gap-1.5">
                  <Loader className="w-3 h-3 animate-spin" />
                  <span className="hidden md:inline">{PUBLISH_STEPS[publishStep]}</span>
                  <span className="md:hidden">Publication...</span>
                </span>
              ) : 'Publier'}
            </Button>
          </div>

          <Button onClick={toggleTheme} variant="iconOnly" size="icon" className="h-8 w-8">
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {/* Barre de progression de publication */}
      {isPublishing && (
        <div
          className="px-4 py-2 flex items-center gap-3 border-b"
          style={{
            backgroundColor: isDark ? 'rgba(3,165,192,0.08)' : 'rgba(3,165,192,0.06)',
            borderColor: 'rgba(3,165,192,0.2)'
          }}
        >
          <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: isDark ? '#2a2a2a' : '#e2e8f0' }}>
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${((publishStep + 1) / PUBLISH_STEPS.length) * 100}%`,
                backgroundColor: '#03A5C0'
              }}
            />
          </div>
          <span className="text-xs font-medium flex-shrink-0" style={{ color: '#03A5C0' }}>
            {publishStep + 1}/{PUBLISH_STEPS.length} — {PUBLISH_STEPS[publishStep]}
          </span>
        </div>
      )}

      {/* Avertissement quota faible */}
      {isNearLimit && !isPublishing && (
        <div
          className="px-4 py-2 flex items-center gap-2 border-b text-sm"
          style={{
            backgroundColor: isDark ? 'rgba(234,179,8,0.08)' : 'rgba(254,249,195,0.9)',
            borderColor: 'rgba(234,179,8,0.3)',
            color: isDark ? '#fcd34d' : '#92400e'
          }}
        >
          <span>⚠️</span>
          <span>
            You only have <strong>{usage?.remaining ?? '?'} message{(usage?.remaining ?? 0) > 1 ? 's' : ''}</strong> left this month.{' '}
            <button
              onClick={() => { setUpgradeContext('message'); setShowUpgradeModal(true); }}
              className="underline font-semibold hover:opacity-80 transition-opacity"
            >
              Upgrade to Premium
            </button>
          </span>
        </div>
      )}

      {/* Panneau principal */}
      {isMobile ? (
        /* Mobile: afficher soit le chat, soit la preview */
        <div className="flex-1 overflow-hidden">
          {mobileView === 'chat' ? (
            <div className="h-full flex flex-col bg-background">
              {/* Chat history - Mobile */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((msg, idx) => {
                const isInactive = currentVersionIndex !== null && idx > currentVersionIndex;
                return <div key={idx} className={isInactive ? 'opacity-40' : ''}>
                    {msg.role === 'user' ? <div className="flex justify-end">
                        <div className="max-w-[85%] rounded-2xl px-4 py-2.5 border border-[#03A5C0] bg-[#03A5C0]/10">
                          {typeof msg.content === 'string' ? <p className={`text-sm ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{msg.content}</p> : <div className="space-y-2">
                              {msg.content.map((item, i) => item.type === 'text' ? <p key={i} className={`text-sm ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{item.text}</p> : <img key={i} src={item.image_url?.url} alt="Attaché" className="max-w-[200px] rounded border" />)}
                            </div>}
                        </div>
                      </div> : msg.metadata?.type === 'generation' ?
                  <AiGenerationMessage
                    message={msg}
                    messageIndex={idx}
                    isLatestMessage={idx === messages.length - 1}
                    isDark={isDark}
                    isLoading={idx === messages.length - 1 && (generateSiteHook.isGenerating || unifiedModify.isLoading || isQuickModLoading)}
                    isFirstGeneration={isInitialGeneration && idx === messages.length - 1}
                    generationStartTime={idx === messages.length - 1 && (generateSiteHook.isGenerating || unifiedModify.isLoading || isQuickModLoading) ? generationStartTimeRef.current : undefined}
                    onRestore={async messageIdx => {
                    const targetMessage = messages[messageIdx];
                    if (!sessionId) return;
                    // Priority 1: use in-memory message metadata (fastest, no DB call)
                    const inMemoryFiles = targetMessage.metadata?.project_files;
                    if (inMemoryFiles && Object.keys(inMemoryFiles).length > 0) {
                      const restoredFiles = inMemoryFiles as Record<string, string>;
                      updateFiles(restoredFiles, false);
                      setGeneratedHtml(restoredFiles['index.html'] || '');
                      if (selectedFile && restoredFiles[selectedFile]) {
                        setSelectedFileContent(restoredFiles[selectedFile]);
                      } else {
                        const firstFile = Object.keys(restoredFiles)[0];
                        if (firstFile) { setSelectedFile(firstFile); setSelectedFileContent(restoredFiles[firstFile]); }
                      }
                      setCurrentVersionIndex(messageIdx);
                      await supabase.from('build_sessions').update({ project_files: convertFilesToArray(restoredFiles), updated_at: new Date().toISOString() }).eq('id', sessionId);
                      sonnerToast.success('Version restored');
                      return;
                    }
                    // Fallback: query chat_messages table if message has an ID
                    if (!targetMessage.id) { sonnerToast.error('Unable to restore this version'); return; }
                    const { data: chatMessage } = await supabase.from('chat_messages').select('metadata').eq('id', targetMessage.id).single();
                    if (chatMessage?.metadata && typeof chatMessage.metadata === 'object' && 'project_files' in chatMessage.metadata) {
                      const restoredFiles = chatMessage.metadata.project_files as Record<string, string>;
                      updateFiles(restoredFiles, false);
                      setGeneratedHtml(restoredFiles['index.html'] || '');
                      if (selectedFile && restoredFiles[selectedFile]) {
                        setSelectedFileContent(restoredFiles[selectedFile]);
                      } else {
                        const firstFile = Object.keys(restoredFiles)[0];
                        if (firstFile) { setSelectedFile(firstFile); setSelectedFileContent(restoredFiles[firstFile]); }
                      }
                      setCurrentVersionIndex(messageIdx);
                      await supabase.from('build_sessions').update({ project_files: convertFilesToArray(restoredFiles), updated_at: new Date().toISOString() }).eq('id', sessionId);
                      sonnerToast.success('Version restored');
                    } else {
                      sonnerToast.error('Unable to restore this version');
                    }
                  }} onGoToPrevious={async () => {
                    if (versions.length < 2) { sonnerToast.error('No previous version available'); return; }
                    const previousVersion = versions[1];
                    const success = await rollbackToVersion(previousVersion.id);
                    if (success) { await fetchVersions(); sonnerToast.success('Previous version restored'); }
                  }} /> : msg.metadata?.type === 'message' ?
                  <ChatOnlyMessage message={msg} messageIndex={idx} isLatestMessage={idx === messages.length - 1} isDark={isDark} showImplementButton={chatMode} onRestore={async () => {
                    sonnerToast.info('Chat messages do not modify files');
                  }} onGoToPrevious={() => {
                    sonnerToast.info('Chat messages are not versioned');
                  }} onImplementPlan={plan => {
                    setChatMode(false);
                    setInputValue(plan);
                    setTimeout(() => { handleSubmit(); }, 100);
                  }} /> : <div className="space-y-3">
                        <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'} whitespace-pre-wrap`}>
                          {typeof msg.content === 'string' ? msg.content.match(/\[EXPLANATION\](.*?)\[\/EXPLANATION\]/s)?.[1]?.trim() || msg.content : 'Generated content'}
                        </p>
                      </div>}
                  </div>;
              })}
                <div ref={chatEndRef} />
              </div>

              {/* Chat input - Mobile */}
              <div className="p-3 backdrop-blur-sm bg-background">
                <PromptBar inputValue={inputValue} setInputValue={setInputValue} onSubmit={handleSubmit} isLoading={generateSiteHook.isGenerating || unifiedModify.isLoading || isQuickModLoading} onStop={() => { generateSiteHook.abort(); unifiedModify.abort(); }} showPlaceholderAnimation={false} showConfigButtons={false} modificationMode={true} inspectMode={inspectMode} onInspectToggle={() => setInspectMode(!inspectMode)} chatMode={chatMode} onChatToggle={() => setChatMode(!chatMode)} projectType={projectType} onProjectTypeChange={setProjectType} attachedFiles={attachedFiles} onRemoveFile={removeFile} onFileSelect={async files => {
                const newFiles: Array<{ name: string; base64: string; type: string }> = [];
                for (let i = 0; i < files.length; i++) {
                  const file = files[i];
                  if (!file.type.startsWith('image/')) { sonnerToast.error(`${file.name} is not an image`); continue; }
                  const reader = new FileReader();
                  const base64Promise = new Promise<string>(resolve => { reader.onloadend = () => resolve(reader.result as string); reader.readAsDataURL(file); });
                  const base64 = await base64Promise;
                  newFiles.push({ name: file.name, base64, type: file.type });
                }
                setAttachedFiles([...attachedFiles, ...newFiles]);
              }} />
              </div>
            </div>
          ) : (
            /* Mobile Preview */
            <div className="h-full w-full flex flex-col overflow-hidden" style={{ backgroundColor: isDark ? 'hsl(var(--background))' : 'hsl(var(--background))' }}>
              {(Object.keys(projectFiles).length === 0 && !vibePreviewUrl && !deployedUrl) || generateSiteHook.isGenerating ? <GeneratingPreview /> : <>
                <FakeUrlBar projectTitle={websiteTitle || 'Mon Projet'} isDark={isDark} sessionId={sessionId} onTitleChange={setWebsiteTitle} cloudflareProjectName={cloudflareProjectName || undefined} previewMode="mobile" />
                {(deployedUrl || vibePreviewUrl) ? (
                  <VibePreviewIframe src={deployedUrl || vibePreviewUrl!} />
                ) : (
                  <InteractiveCodeSandboxPreview projectFiles={projectFiles} previewMode="mobile" inspectMode={false} onInspectModeChange={() => {}} />
                )}
              </>}
            </div>
          )}
        </div>
      ) : (
      /* Desktop: ResizablePanelGroup */
      <ResizablePanelGroup direction="horizontal" className="flex-1">
        <ResizablePanel defaultSize={30} minSize={25}>
          <div className="h-full flex flex-col bg-background">
            {/* Chat history */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {messages.map((msg, idx) => {
              // Calculer si ce message est "inactif" (après la version courante)
              const isInactive = currentVersionIndex !== null && idx > currentVersionIndex;
              return <div key={idx} className={isInactive ? 'opacity-40' : ''}>
                  {msg.role === 'user' ? <div className="flex justify-end">
                      <div className="max-w-[80%] rounded-2xl px-4 py-2.5 border border-[#03A5C0] bg-[#03A5C0]/10">
                        {typeof msg.content === 'string' ? <p className={`text-sm ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{msg.content}</p> : <div className="space-y-2">
                            {msg.content.map((item, i) => item.type === 'text' ? <p key={i} className={`text-sm ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{item.text}</p> : <img key={i} src={item.image_url?.url} alt="Attaché" className="max-w-[200px] rounded border" />)}
                          </div>}
                      </div>
                    </div> : msg.metadata?.type === 'generation' ?
                // Message de génération unifié
                <AiGenerationMessage 
                  message={msg} 
                  messageIndex={idx} 
                  isLatestMessage={idx === messages.length - 1} 
                  isDark={isDark} 
                  isLoading={idx === messages.length - 1 && (generateSiteHook.isGenerating || unifiedModify.isLoading || isQuickModLoading)} 
                  isFirstGeneration={isInitialGeneration && idx === messages.length - 1}
                  generationStartTime={idx === messages.length - 1 && (generateSiteHook.isGenerating || unifiedModify.isLoading || isQuickModLoading) ? generationStartTimeRef.current : undefined} 
                  onRestore={async messageIdx => {
                  const targetMessage = messages[messageIdx];
                  if (!sessionId) return;
                  // Priority 1: use in-memory message metadata (fastest, no DB call)
                  const inMemoryFiles = targetMessage.metadata?.project_files;
                  if (inMemoryFiles && Object.keys(inMemoryFiles).length > 0) {
                    const restoredFiles = inMemoryFiles as Record<string, string>;
                    updateFiles(restoredFiles, false);
                    setGeneratedHtml(restoredFiles['index.html'] || '');
                    if (selectedFile && restoredFiles[selectedFile]) {
                      setSelectedFileContent(restoredFiles[selectedFile]);
                    } else {
                      const firstFile = Object.keys(restoredFiles)[0];
                      if (firstFile) { setSelectedFile(firstFile); setSelectedFileContent(restoredFiles[firstFile]); }
                    }
                    setCurrentVersionIndex(messageIdx);
                    await supabase.from('build_sessions').update({ project_files: convertFilesToArray(restoredFiles), updated_at: new Date().toISOString() }).eq('id', sessionId);
                    sonnerToast.success('Version restored');
                    return;
                  }
                  // Fallback: query chat_messages table
                  if (!targetMessage.id) { sonnerToast.error('Unable to restore this version'); return; }
                  const { data: chatMessage } = await supabase.from('chat_messages').select('metadata').eq('id', targetMessage.id).single();
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
                    setCurrentVersionIndex(messageIdx);
                    await supabase.from('build_sessions').update({
                      project_files: convertFilesToArray(restoredFiles),
                      updated_at: new Date().toISOString()
                    }).eq('id', sessionId);
                    sonnerToast.success('Version restored');
                  } else {
                    console.error('❌ No project_files found in message metadata');
                    sonnerToast.error('Unable to restore this version');
                  }
                }} onGoToPrevious={async () => {
                  // Utiliser le système de versioning Cloudflare
                  if (versions.length < 2) {
                    sonnerToast.error('No previous version available');
                    return;
                  }
                  
                  // La version actuelle est versions[0], la précédente est versions[1]
                  const previousVersion = versions[1];
                  console.log('🔄 Rollback vers version précédente:', previousVersion.id);
                  
                  const success = await rollbackToVersion(previousVersion.id);
                  
                  if (success) {
                    // Recharger les versions après rollback
                    await fetchVersions();
                    // Notifier l'utilisateur
                    sonnerToast.success('Previous version restored');
                  }
                }} /> : msg.metadata?.type === 'message' ?
                // Message chat uniquement (plan d'action)
                <ChatOnlyMessage message={msg} messageIndex={idx} isLatestMessage={idx === messages.length - 1} isDark={isDark} showImplementButton={chatMode} onRestore={async messageIdx => {
                  // Pas de restauration pour les messages chat
                  sonnerToast.info('Chat messages do not modify files');
                }} onGoToPrevious={() => {
                  // Pas de version précédente pour les messages chat
                  sonnerToast.info('Chat messages are not versioned');
                }} onImplementPlan={plan => {
                  // Passer en mode génération avec le plan
                  setChatMode(false);
                  setInputValue(plan);
                  // Petit délai pour s'assurer que le mode chat est désactivé
                  setTimeout(() => {
                    handleSubmit();
                  }, 100);
                }} /> : <div className="space-y-3">
                      {/* Message simple (ancien format) - pour compatibilité */}
                      <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'} whitespace-pre-wrap`}>
                        {typeof msg.content === 'string' ? msg.content.match(/\[EXPLANATION\](.*?)\[\/EXPLANATION\]/s)?.[1]?.trim() || msg.content : 'Generated content'}
                      </p>
                    </div>}
                </div>;
            })}


              {/* Le streaming est maintenant géré par le message intro avec CollapsedAiTasks */}

              
              <div ref={chatEndRef} />
            </div>
            
            {/* Chat input - Desktop */}
            <div className="p-4 backdrop-blur-sm bg-background">
              <PromptBar inputValue={inputValue} setInputValue={setInputValue} onSubmit={handleSubmit} isLoading={generateSiteHook.isGenerating || unifiedModify.isLoading || isQuickModLoading} onStop={() => { generateSiteHook.abort(); unifiedModify.abort(); }} showPlaceholderAnimation={false} showConfigButtons={false} modificationMode={true} inspectMode={inspectMode} onInspectToggle={() => setInspectMode(!inspectMode)} chatMode={chatMode} onChatToggle={() => setChatMode(!chatMode)} projectType={projectType} onProjectTypeChange={setProjectType} attachedFiles={attachedFiles} onRemoveFile={removeFile} onFileSelect={async files => {
              const newFiles: Array<{
                name: string;
                base64: string;
                type: string;
              }> = [];
              for (let i = 0; i < files.length; i++) {
                const file = files[i];
                if (!file.type.startsWith('image/')) {
                  sonnerToast.error(`${file.name} is not an image`);
                  continue;
                }
                const reader = new FileReader();
                const base64Promise = new Promise<string>(resolve => {
                  reader.onloadend = () => resolve(reader.result as string);
                  reader.readAsDataURL(file);
                });
                const base64 = await base64Promise;
                newFiles.push({
                  name: file.name,
                  base64,
                  type: file.type
                });
              }
              setAttachedFiles([...attachedFiles, ...newFiles]);
            }} />
            </div>
          </div>
        </ResizablePanel>
        
        {previewMode === 'desktop' && <ResizableHandle className="w-px bg-transparent hover:bg-transparent data-[resize-handle-active]:bg-transparent" />}
        
          <ResizablePanel defaultSize={70} minSize={previewMode === 'mobile' ? 70 : 30}>
            <div className={`h-full w-full flex ${previewMode === 'mobile' ? 'justify-center items-start' : 'flex-col'} overflow-hidden`} style={{
          backgroundColor: isDark ? 'hsl(var(--background))' : 'hsl(var(--background))'
        }}>
              {previewMode === 'mobile' ? <div className={`w-[375px] h-full flex flex-col shadow-2xl rounded-3xl border overflow-hidden`} style={{
            backgroundColor: isDark ? 'hsl(var(--background))' : 'hsl(var(--background))',
            borderColor: isDark ? 'hsl(var(--border))' : 'hsl(var(--border))'
          }}>
                  {(Object.keys(projectFiles).length === 0 && !vibePreviewUrl && !deployedUrl) || generateSiteHook.isGenerating ? <GeneratingPreview /> : <>
                      <FakeUrlBar projectTitle={websiteTitle || 'Mon Projet'} isDark={isDark} sessionId={sessionId} onTitleChange={setWebsiteTitle} cloudflareProjectName={cloudflareProjectName || undefined} previewMode="mobile" />
                      {vibePreviewUrl ? (
                        <VibePreviewIframe src={vibePreviewUrl} />
                      ) : (
                      <InteractiveCodeSandboxPreview
                        projectFiles={projectFiles}
                        previewMode="mobile"
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

                // IMPORTANT: Forcer le mode génération (pas chatMode)
                setChatMode(false);
                setInputValue(contextualPrompt);
                setTimeout(() => handleSubmit(), 100);
              }} />
                      )}
                    </>}
                </div> : <>
                  {(Object.keys(projectFiles).length === 0 && !vibePreviewUrl && !deployedUrl) || generateSiteHook.isGenerating ? <GeneratingPreview /> : <>
                      <FakeUrlBar projectTitle={websiteTitle || 'Mon Projet'} isDark={isDark} sessionId={sessionId} onTitleChange={setWebsiteTitle} currentFavicon={currentFavicon} onFaviconChange={setCurrentFavicon} cloudflareProjectName={cloudflareProjectName || undefined} previewMode={previewMode} />
                      {vibePreviewUrl ? (
                        <VibePreviewIframe src={vibePreviewUrl} />
                      ) : (
                      <InteractiveCodeSandboxPreview
                        projectFiles={projectFiles}
                        previewMode="desktop"
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
                setAiEvents([]);
                generationEventsRef.current = [];
                try {
                  const result = await unifiedModify.unifiedModify({
                    message: contextualPrompt,
                    projectFiles,
                    sessionId: sessionId!
                  }, {
                    onIntentMessage: message => {
                      console.log('🎯 Intent:', message);
                    },
                    onGenerationEvent: event => {
                      console.log('🔄 Generation:', event);
                    },
                    onASTModifications: async (modifications, updatedFiles) => {
                      console.log('📦 Modifications:', modifications.length);
                      await updateFiles(updatedFiles, true);
                      if (updatedFiles['index.html']) {
                        setGeneratedHtml(updatedFiles['index.html']);
                      }
                    },
                    onTokens: tokens => {
                      console.log('📊 Tokens:', tokens);
                    },
                    onError: error => {
                      console.error('❌ Error:', error);
                      sonnerToast.error(error);
                    },
                    onComplete: async result => {
                      console.log('✅ Complete:', result);
                      if (result?.success) {
                        sonnerToast.success('Modification applied');
                        await supabase.from('chat_messages').insert({
                          session_id: sessionId,
                          role: 'assistant',
                          content: result.message,
                          token_count: result.tokens.total,
                          metadata: {
                            input_tokens: result.tokens.input,
                            output_tokens: result.tokens.output,
                            total_tokens: result.tokens.total,
                            project_files: result.updatedFiles,
                            type: 'generation'
                          }
                        });
                      }
                    }
                  });
                } catch (error) {
                  console.error('❌ Inspect mode error:', error);
                  sonnerToast.error('Error applying modification');
                }
              }} />
                      )}
                    </>}
                </>}
            </div>
          </ResizablePanel>
      </ResizablePanelGroup>
      )}

      {/* Dialog pour sauvegarder */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save project</DialogTitle>
            <DialogDescription>
              Give your website a title so you can find it easily.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Website title</Label>
              <Input id="title" value={websiteTitle} onChange={e => setWebsiteTitle(e.target.value)} placeholder="My website" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowSaveDialog(false)}>
              Cancel
            </Button>
            <Button onClick={confirmSave} disabled={isSaving} className="bg-[hsl(var(--magellan-cyan))] hover:bg-[hsl(var(--magellan-cyan-light))] text-white">
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de succès de publication */}
      <PublishSuccessDialog 
        open={showPublishSuccess} 
        onOpenChange={setShowPublishSuccess} 
        publicUrl={lastPublishResult?.publicUrl || deployedUrl || ''} 
        cloudflareUrl={lastPublishResult?.cloudflareUrl}
        projectName={cloudflareProjectName || websiteTitle} 
        sessionId={sessionId} 
        cloudflareProjectName={cloudflareProjectName || undefined} 
      />

      {/* Dialog historique des versions */}
      <VersionHistory
        sessionId={sessionId}
        open={showVersionHistory}
        onOpenChange={setShowVersionHistory}
        onRollback={() => {
          // Recharger les fichiers après rollback
          loadSession();
          sonnerToast.success('Version restored');
        }}
      />

      {/* Modal d'upgrade (limite messages / publication) */}
      <UpgradeModal
        open={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        context={upgradeContext}
      />
    </div>;
}