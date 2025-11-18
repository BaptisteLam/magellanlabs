import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { Save, Home, Moon, Sun, Download, Smartphone } from "lucide-react";
import { useThemeStore } from '@/stores/themeStore';
import { toast as sonnerToast } from "sonner";
import JSZip from "jszip";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import PromptBar from "@/components/PromptBar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useAgentAPI } from "@/hooks/useAgentAPI";
import type { AIEvent, GenerationEvent } from '@/types/agent';
import AiTaskList from '@/components/chat/AiTaskList';
import { SimpleAiEvents } from '@/components/chat/SimpleAiEvents';
import { MobilePreview } from "@/components/MobilePreview";

interface Message {
  role: 'user' | 'assistant';
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
}

export default function MobileBuilderSession() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { isDark, toggleTheme } = useThemeStore();
  const [inputValue, setInputValue] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [user, setUser] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [appTitle, setAppTitle] = useState('');
  const [sessionLoading, setSessionLoading] = useState(true);
  const [attachedFiles, setAttachedFiles] = useState<Array<{ name: string; base64: string; type: string }>>([]);
  const [projectFiles, setProjectFiles] = useState<Record<string, string>>({});
  const chatEndRef = useRef<HTMLDivElement>(null);

  const agent = useAgentAPI();
  const [aiEvents, setAiEvents] = useState<AIEvent[]>([]);
  const [generationEvents, setGenerationEvents] = useState<GenerationEvent[]>([]);
  const [isInitialGeneration, setIsInitialGeneration] = useState(false);
  const isInitialGenerationRef = useRef(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    loadSession();
  }, [sessionId]);

  const loadSession = async () => {
    if (!sessionId) return;

    setSessionLoading(true);
    try {
      const { data, error } = await supabase
        .from('build_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (error) throw error;

      if (data) {
        const messagesData = data.messages as any;
        setMessages(Array.isArray(messagesData) ? messagesData : []);
        setProjectFiles((data.project_files as Record<string, any>) || {});
        setAppTitle(data.title || '');

        const filesObj = data.project_files as Record<string, any> || {};
        const hasAppJson = 'app.json' in filesObj;
        const hasPackageJson = 'package.json' in filesObj;
        const hasNoFiles = Object.keys(filesObj).length === 0;

        if (hasNoFiles || (!hasAppJson && !hasPackageJson)) {
          console.log('🚀 Démarrage génération initiale mobile');
          setIsInitialGeneration(true);
          isInitialGenerationRef.current = true;
          await handleAgentGeneration(
            Array.isArray(messagesData) && messagesData.length > 0 
              ? (typeof messagesData[0].content === 'string' ? messagesData[0].content : 'Créer une application mobile')
              : 'Créer une application mobile'
          );
        }
      }

      setSessionLoading(false);
    } catch (error) {
      console.error('Error loading session:', error);
      sonnerToast.error('Erreur lors du chargement de la session');
      setSessionLoading(false);
    }
  };

  const handleAgentGeneration = async (prompt: string) => {
    if (!sessionId) return;

    const contextualPrompt = prompt;
    const relevantFilesArray = Object.entries(projectFiles).map(([path, content]) => ({
      path,
      content: content as string
    })).slice(0, 5);

    const chatHistory = messages.slice(-3).map(m => ({
      role: m.role,
      content: typeof m.content === 'string' ? m.content : '[message multimédia]'
    }));

    let assistantMessage = '';
    const updatedFiles = { ...projectFiles };

    setAiEvents([]);
    setGenerationEvents([]);
    
    setIsInitialGeneration(true);
    isInitialGenerationRef.current = true;

    const projectContext = 'Generate a React Native/Expo mobile application with TypeScript. Use Expo Router for navigation and NativeWind for styling.';

    await agent.callAgent(
      `${projectContext}\n\n${contextualPrompt}`,
      projectFiles,
      relevantFilesArray,
      chatHistory,
      sessionId!,
      'mobile',
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
        },
        onComplete: async () => {
          console.log('✅ Génération terminée');
          
          const hasAppJson = 'app.json' in updatedFiles;
          const hasPackageJson = 'package.json' in updatedFiles;

          if (!hasAppJson || !hasPackageJson) {
            console.error('❌ FICHIERS EXPO MANQUANTS');
            sonnerToast.error('Les fichiers Expo essentiels sont manquants');
            setGenerationEvents(prev => [...prev, { 
              type: 'error', 
              message: 'Missing Expo configuration files' 
            }]);
            setIsInitialGeneration(false);
            isInitialGenerationRef.current = false;
            return;
          }
          
          console.log('✅ Validation réussie - Application de TOUS les fichiers');
          setGenerationEvents(prev => [...prev, { type: 'complete', message: 'All files generated successfully' }]);
          
          console.log('📦 Fichiers à appliquer:', Object.keys(updatedFiles));
          setProjectFiles({ ...updatedFiles });
          
          setIsInitialGeneration(false);
          isInitialGenerationRef.current = false;
          
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
              content: assistantMessage
            });
        },
        onError: (error) => {
          console.error('❌ Error:', error);
          sonnerToast.error(error);
          setIsInitialGeneration(false);
          isInitialGenerationRef.current = false;
        }
      }
    );
  };

  const handleModifyPrompt = async () => {
    if (!inputValue.trim() || agent.isLoading) return;

    const userMessage: Message = {
      role: 'user',
      content: attachedFiles.length > 0
        ? [
            { type: 'text', text: inputValue },
            ...attachedFiles.map(file => ({
              type: 'image_url',
              image_url: { url: file.base64 }
            }))
          ]
        : inputValue
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setAttachedFiles([]);

    await supabase
      .from('chat_messages')
      .insert({
        session_id: sessionId,
        role: 'user',
        content: inputValue
      });

    await handleAgentGeneration(inputValue);
  };

  const removeFile = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const onFileSelectFromBar = (files: File[]) => {
    if (!files || files.length === 0) return;

    files.forEach(file => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setAttachedFiles(prev => [...prev, {
            name: file.name,
            base64: reader.result as string,
            type: file.type
          }]);
        };
        reader.readAsDataURL(file);
      }
    });
  };

  const handleDownload = async () => {
    const zip = new JSZip();

    Object.entries(projectFiles).forEach(([path, content]) => {
      zip.file(path, content);
    });

    const blob = await zip.generateAsync({ type: 'blob' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${appTitle || 'mobile-app'}.zip`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);

    sonnerToast.success('Application téléchargée avec succès');
  };

  const handleSave = () => {
    if (!appTitle.trim()) {
      setShowSaveDialog(true);
      return;
    }
    confirmSave();
  };

  const confirmSave = async () => {
    if (!appTitle.trim()) {
      sonnerToast.error('Veuillez donner un nom à votre application');
      return;
    }

    setIsSaving(true);

    try {
      const { error } = await supabase
        .from('build_sessions')
        .update({
          title: appTitle,
          project_files: projectFiles,
          updated_at: new Date().toISOString()
        })
        .eq('id', sessionId);

      if (error) throw error;

      sonnerToast.success('Application sauvegardée avec succès');
      setShowSaveDialog(false);
      navigate('/dashboard');
    } catch (error) {
      console.error('Error saving:', error);
      sonnerToast.error('Erreur lors de la sauvegarde');
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, aiEvents]);

  if (sessionLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Chargement de la session...</p>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className={`h-screen flex flex-col ${isDark ? 'dark bg-slate-950' : 'bg-white'}`}>
        {/* Header */}
        <div className={`h-14 border-b flex items-center justify-between px-4 ${isDark ? 'border-slate-800 bg-slate-900' : 'border-gray-200 bg-white'}`}>
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/')}
              className="gap-2"
            >
              <Home className="h-4 w-4" />
              Accueil
            </Button>
            
            <div className="h-6 w-px bg-border" />
            
            <span className="text-sm font-medium flex items-center gap-2">
              <Smartphone className="h-4 w-4" />
              {appTitle || 'Application Mobile'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleTheme}
                >
                  {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {isDark ? 'Mode clair' : 'Mode sombre'}
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDownload}
                >
                  <Download className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Télécharger le projet</TooltipContent>
            </Tooltip>

            <Button
              onClick={handleSave}
              disabled={isSaving}
              size="sm"
              className="gap-2"
            >
              <Save className="h-4 w-4" />
              {isSaving ? 'Sauvegarde...' : 'Sauvegarder'}
            </Button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-hidden">
          <ResizablePanelGroup direction="horizontal">
            {/* Chat Panel - Left */}
            <ResizablePanel defaultSize={40} minSize={30}>
              <div className={`h-full flex flex-col ${isDark ? 'bg-slate-900' : 'bg-gray-50'}`}>
                {/* Chat Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {messages.length === 0 && aiEvents.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8">
                      <Smartphone className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p className="text-sm">Commencez à créer votre application mobile</p>
                    </div>
                  ) : (
                    <>
                      {messages.map((msg, idx) => (
                        <div
                          key={idx}
                          className={`p-3 rounded-lg ${
                            msg.role === 'user'
                              ? isDark ? 'bg-slate-800 ml-8' : 'bg-white ml-8'
                              : isDark ? 'bg-slate-800/50 mr-8' : 'bg-gray-100 mr-8'
                          }`}
                        >
                          <div className="text-xs font-medium mb-1 opacity-70">
                            {msg.role === 'user' ? 'Vous' : 'Assistant'}
                          </div>
                          <div className="text-sm whitespace-pre-wrap">
                            {typeof msg.content === 'string' ? msg.content : '[message multimédia]'}
                          </div>
                        </div>
                      ))}
                      
                      {aiEvents.length > 0 && (
                        <div className="space-y-2">
                          <AiTaskList events={aiEvents} />
                          <SimpleAiEvents 
                            events={aiEvents.filter(e => e.type === 'message' || e.type === 'status') as any} 
                            isDark={isDark} 
                          />
                        </div>
                      )}
                    </>
                  )}
                  <div ref={chatEndRef} />
                </div>

                {/* Prompt Bar */}
                <div className="p-3 border-t">
                  <PromptBar
                    inputValue={inputValue}
                    setInputValue={setInputValue}
                    onSubmit={handleModifyPrompt}
                    onFileSelect={onFileSelectFromBar}
                    attachedFiles={attachedFiles}
                    onRemoveFile={removeFile}
                    isLoading={agent.isLoading}
                    modificationMode={true}
                    projectType="mobile"
                  />
                </div>
              </div>
            </ResizablePanel>

            <ResizableHandle />

            {/* Preview Panel - Right */}
            <ResizablePanel defaultSize={60} minSize={40}>
              <div className="h-full bg-background">
                <MobilePreview 
                  files={projectFiles} 
                  sessionId={sessionId || ''} 
                  isGenerating={agent.isLoading || isInitialGeneration}
                />
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>

        {/* Save Dialog */}
        <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Sauvegarder l'application mobile</DialogTitle>
              <DialogDescription>
                Donnez un nom à votre application pour la retrouver facilement.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="title">Nom de l'application</Label>
                <Input
                  id="title"
                  value={appTitle}
                  onChange={(e) => setAppTitle(e.target.value)}
                  placeholder="Mon Application Mobile"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowSaveDialog(false)}>
                Annuler
              </Button>
              <Button onClick={confirmSave} disabled={isSaving}>
                {isSaving ? 'Sauvegarde...' : 'Sauvegarder'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}

