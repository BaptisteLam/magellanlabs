import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
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
import Analytics from "@/components/Analytics";
import { AiDiffService } from "@/services/aiDiffService";
import { useAgentAPI } from "@/hooks/useAgentAPI";
import type { AIEvent, GenerationEvent } from '@/types/agent';
import AiTaskList from '@/components/chat/AiTaskList';
import { SimpleAiEvents } from '@/components/chat/SimpleAiEvents';
import html2canvas from 'html2canvas';

interface Message {
  role: 'user' | 'assistant';
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
}

export default function BuilderSession() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
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
  
  // Hook pour la nouvelle API Agent
  const agent = useAgentAPI();
  
  // Événements IA pour la TaskList
  const [aiEvents, setAiEvents] = useState<AIEvent[]>([]);
  
  // Événements de génération pour l'affichage de pensée
  const [generationEvents, setGenerationEvents] = useState<GenerationEvent[]>([]);
  
  // Flag pour savoir si on est en première génération
  const [isInitialGeneration, setIsInitialGeneration] = useState(false);
  const isInitialGenerationRef = useRef(false);
  
  // Flag pour éviter de traiter le prompt initial plusieurs fois
  const [initialPromptProcessed, setInitialPromptProcessed] = useState(false);
  
  // Mode Inspect pour la preview interactive
  const [inspectMode, setInspectMode] = useState(false);
  
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

  // Traiter le prompt initial IMMÉDIATEMENT après chargement session
  useEffect(() => {
    const processInitialPrompt = async () => {
      // Ne rien faire si déjà traité ou si on a des fichiers
      if (initialPromptProcessed || Object.keys(projectFiles).length > 0) return;
      
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
  }, [sessionId, sessionLoading, user, projectFiles, messages, initialPromptProcessed]);


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

        // Charger l'historique complet des messages depuis chat_messages
        const { data: chatMessages, error: chatError } = await supabase
          .from('chat_messages')
          .select('*')
          .eq('session_id', sessionId)
          .order('created_at', { ascending: true });

        if (!chatError && chatMessages && chatMessages.length > 0) {
          const loadedMessages: Message[] = chatMessages.map(msg => ({
            role: msg.role as 'user' | 'assistant',
            content: msg.content
          }));
          setMessages(loadedMessages);
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

      // Capturer le screenshot avec html2canvas
      let thumbnailUrl: string | null = null;
      try {
        // Trouver l'iframe de preview
        const iframe = document.querySelector('iframe[title="Preview"]') as HTMLIFrameElement;
        if (iframe && iframe.contentDocument) {
          console.log('📸 Capturing screenshot with html2canvas...');
          
          // Attendre un peu que le contenu soit bien chargé
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          const canvas = await html2canvas(iframe.contentDocument.body, {
            allowTaint: true,
            useCORS: true,
            scale: 1,
            width: 1200,
            height: 630,
            windowWidth: 1200,
            windowHeight: 900
          });
          
          // Convertir le canvas en blob
          const blob = await new Promise<Blob>((resolve) => {
            canvas.toBlob((blob) => resolve(blob!), 'image/png', 0.9);
          });
          
          // Uploader vers Supabase Storage
          const fileName = `${sessionId}-${Date.now()}.png`;
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('screenshots')
            .upload(fileName, blob, {
              contentType: 'image/png',
              upsert: true
            });
          
          if (uploadError) {
            console.error('Error uploading screenshot:', uploadError);
          } else {
            // Obtenir l'URL publique
            const { data: { publicUrl } } = supabase.storage
              .from('screenshots')
              .getPublicUrl(fileName);
            
            thumbnailUrl = publicUrl;
            console.log('✅ Screenshot uploaded:', publicUrl);
          }
        }
      } catch (screenshotError) {
        console.error('Error generating screenshot:', screenshotError);
        // Ne pas bloquer la sauvegarde si le screenshot échoue
      }

      const { error } = await supabase
        .from('build_sessions')
        .update({
          project_files: filesArray,
          messages: messages as any,
          title: websiteTitle,
          project_type: projectType,
          thumbnail_url: thumbnailUrl,
          updated_at: new Date().toISOString()
        })
        .eq('id', sessionId);

      if (error) throw error;
    } catch (error) {
      console.error('Error saving session:', error);
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
    setGenerationEvents([]);
    
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
    await agent.callAgent(
      `${projectContext}\n\n${userPrompt}`,
      projectFiles,
      relevantFilesArray,
      chatHistory,
      sessionId!,
      projectType,
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
          setMessages(updatedMessages);

          // Sauvegarder dans chat_messages
          await supabase
            .from('chat_messages')
            .insert({
              session_id: sessionId,
              role: 'assistant',
              content: finalMessage,
              metadata: { files_updated: Object.keys(updatedFiles).length }
            });

          // Mettre à jour build_sessions pour rétrocompatibilité
          await supabase
            .from('build_sessions')
            .update({
              project_files: filesArray,
              messages: updatedMessages as any,
              updated_at: new Date().toISOString()
            })
            .eq('id', sessionId);

          // ✅ MAINTENANT on peut appliquer les fichiers à la preview
          console.log('📦 Application des fichiers à la preview:', Object.keys(updatedFiles));
          setProjectFiles({ ...updatedFiles });
          
          // Désactiver le mode "génération en cours"
          setIsInitialGeneration(false);
          isInitialGenerationRef.current = false;
          
          // Forcer le passage en mode preview
          setTimeout(() => {
            if (viewMode !== 'preview') {
              setViewMode('preview');
            }
          }, 100);

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

      sonnerToast.info("Déploiement sur Cloudflare Pages...");
      
      const deployRes = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/deploy-to-cloudflare`, {
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
        
        // Update websiteId if returned
        if (result.websiteId) {
          setWebsiteId(result.websiteId);
        }
        
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
      <div className={`h-12 backdrop-blur-sm flex items-center justify-between px-4 ${isDark ? '' : 'bg-slate-50/80'}`} style={{ backgroundColor: isDark ? '#1F1F20' : undefined }}>
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
              {messages.map((msg, idx) => (
                <div key={idx}>
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
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* Affichage des événements de génération simples pour les reprompts */}
              {generationEvents.length > 0 && agent.isLoading && !isInitialGeneration && (
                <div className="flex flex-col space-y-2 mb-4 px-4">
                  <SimpleAiEvents events={generationEvents} isDark={isDark} />
                </div>
              )}

              {/* Affichage du streaming en temps réel */}
              {agent.isStreaming && (
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

              {/* AI Task List - Affichage pendant toute génération */}
              {aiEvents.length > 0 && agent.isLoading && (
                <div className="px-4 pb-4">
                  <AiTaskList events={aiEvents} />
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
                    {isInitialGeneration && Object.keys(projectFiles).length === 0 ? (
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
                  <Analytics 
                    isPublished={!!deployedUrl} 
                    isDark={isDark} 
                    gaPropertyId={gaPropertyId || undefined}
                    websiteId={websiteId || undefined}
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
