import { Save, Eye, Code2, X, Sparkles, Home, Download, Paperclip, Moon, Sun, BarChart3, Pencil, Lightbulb } from 'lucide-react';
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
import { useThemeStore } from '@/stores/themeStore';
import PromptBar from '@/components/PromptBar';
import { CodeTreeView } from '@/components/CodeEditor/CodeTreeView';
import { MonacoEditor } from '@/components/CodeEditor/MonacoEditor';
import { GeneratingPreview } from '@/components/GeneratingPreview';
import { InteractivePreview } from '@/components/InteractivePreview';
import { FakeUrlBar } from '@/components/FakeUrlBar';
import { FileTabs } from '@/components/CodeEditor/FileTabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import JSZip from 'jszip';
import Analytics from '@/components/Analytics';
import { useAgentAPI } from '@/hooks/useAgentAPI';
import type { AIEvent } from '@/types/agent';
import AiTaskList from '@/components/chat/AiTaskList';

interface AISearchHeroProps {
  onGeneratedChange?: (hasGenerated: boolean) => void;
}

interface Message {
  role: 'user' | 'assistant';
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
}

const AISearchHero = ({ onGeneratedChange }: AISearchHeroProps) => {
  const { isDark, toggleTheme } = useThemeStore();
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [projectFiles, setProjectFiles] = useState<Record<string, string>>({});
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [selectedFileContent, setSelectedFileContent] = useState('');
  const [openFiles, setOpenFiles] = useState<string[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [user, setUser] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [websiteTitle, setWebsiteTitle] = useState('');
  const [viewMode, setViewMode] = useState<'preview' | 'code' | 'analytics'>('preview');
  const [attachedFiles, setAttachedFiles] = useState<Array<{ name: string; base64: string; type: string }>>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [deployedUrl, setDeployedUrl] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [generatedHtml, setGeneratedHtml] = useState('');
  const [inspectMode, setInspectMode] = useState(false);
  const [gaPropertyId, setGaPropertyId] = useState<string | null>(null);
  const [websiteId, setWebsiteId] = useState<string | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Hook pour la nouvelle API Agent
  const agent = useAgentAPI();
  
  // Événements IA pour la TaskList
  const [aiEvents, setAiEvents] = useState<AIEvent[]>([]);
  
  // Événements de génération pour l'affichage de pensée
  const [generationEvents, setGenerationEvents] = useState<Array<{ type: string; message: string; duration?: number; file?: string }>>([]);
  
  // Flag pour savoir si on est en première génération
  const [isInitialGeneration, setIsInitialGeneration] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

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

  const selectFile = (path: string, content: string) => {
    setSelectedFile(path);
    setSelectedFileContent(content);
    if (!openFiles.includes(path)) {
      setOpenFiles([...openFiles, path]);
    }
  };

  const closeFile = (path: string) => {
    const newOpenFiles = openFiles.filter(f => f !== path);
    setOpenFiles(newOpenFiles);
    if (selectedFile === path) {
      setSelectedFile(newOpenFiles[newOpenFiles.length - 1] || null);
      if (newOpenFiles.length > 0) {
        setSelectedFileContent(projectFiles[newOpenFiles[newOpenFiles.length - 1]]);
      }
    }
  };

  const handleDownloadZip = async () => {
    try {
      const zip = new JSZip();
      
      Object.entries(projectFiles).forEach(([path, content]) => {
        zip.file(path, content);
      });
      
      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${websiteTitle || 'mon-site'}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      sonnerToast.success('Site téléchargé !');
    } catch (error) {
      console.error('Error creating zip:', error);
      sonnerToast.error('Erreur lors du téléchargement');
    }
  };

  const handlePublish = async () => {
    if (!sessionId || !user) {
      sonnerToast.error("Veuillez d'abord sauvegarder votre projet");
      return;
    }

    setIsPublishing(true);

    try {
      const filesArray = Object.entries(projectFiles).map(([path, content]) => ({
        path,
        content,
        type: path.endsWith('.html') ? 'html' : 
              path.endsWith('.css') ? 'stylesheet' : 
              path.endsWith('.js') ? 'javascript' : 'text'
      }));

      const { data, error } = await supabase.functions.invoke('deploy-to-netlify', {
        body: {
          files: filesArray,
          siteName: websiteTitle.toLowerCase().replace(/\s+/g, '-'),
          sessionId: sessionId
        }
      });

      if (error) throw error;

      if (data?.url) {
        setDeployedUrl(data.url);
        sonnerToast.success('Site publié avec succès !', {
          description: data.url,
          action: {
            label: 'Ouvrir',
            onClick: () => window.open(data.url, '_blank')
          }
        });

        if (data.websiteId) {
          setWebsiteId(data.websiteId);
        }
      }
    } catch (error: any) {
      console.error('Error publishing:', error);
      sonnerToast.error(error.message || 'Erreur lors de la publication');
    } finally {
      setIsPublishing(false);
    }
  };

  const handleSubmit = async () => {
    const prompt = inputValue.trim();
    
    if (!prompt && attachedFiles.length === 0) {
      sonnerToast.error("Veuillez entrer votre message");
      return;
    }

    // Vérifier si l'utilisateur est connecté
    if (!user) {
      localStorage.setItem('redirectAfterAuth', '/');
      sonnerToast.info("Connectez-vous pour générer votre site");
      navigate('/auth');
      return;
    }

    // Si c'est la première génération, créer une session
    if (!sessionId && Object.keys(projectFiles).length === 0) {
      try {
        const { data: session, error: sessionError } = await supabase
          .from('build_sessions')
          .insert({
            user_id: user.id,
            title: 'Nouveau projet',
            project_files: [],
            messages: [{ role: 'user', content: prompt }]
          })
          .select()
          .single();

        if (sessionError) throw sessionError;

        setSessionId(session.id);
        
        // Continuer avec la génération
        await generateSite(prompt, session.id);
      } catch (error) {
        console.error('Erreur création session:', error);
        sonnerToast.error("Erreur lors de la création de la session");
        return;
      }
    } else {
      // Modification incrémentale
      await generateSite(prompt, sessionId!);
    }
  };

  const generateSite = async (prompt: string, currentSessionId: string) => {
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

    const newMessages = [...messages, { role: 'user' as const, content: userMessageContent }];
    setMessages(newMessages);
    
    const userMessageText = typeof userMessageContent === 'string' 
      ? userMessageContent 
      : (Array.isArray(userMessageContent) 
          ? userMessageContent.find(c => c.type === 'text')?.text || '[message multimédia]'
          : String(userMessageContent));

    await supabase
      .from('chat_messages')
      .insert({
        session_id: currentSessionId,
        role: 'user',
        content: userMessageText,
        metadata: { has_images: attachedFiles.length > 0 }
      });
    
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
    
    // Activer le mode "première génération" si les fichiers sont vides
    if (Object.keys(projectFiles).length === 0) {
      setIsInitialGeneration(true);
      generateProjectName(userPrompt);
    }

    // Appeler l'API Agent avec callbacks
    await agent.callAgent(
      userPrompt,
      projectFiles,
      relevantFilesArray,
      chatHistory,
      currentSessionId,
      {
        onStatus: (status) => {
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
          setAiEvents(prev => [...prev, { type: 'log', content: log }]);
        },
        onIntent: (intent) => {
          setAiEvents(prev => [...prev, intent]);
        },
        onGenerationEvent: (event) => {
          setGenerationEvents(prev => [...prev, event]);
        },
        onCodeUpdate: (path, code) => {
          updatedFiles[path] = code;
          setProjectFiles(prev => ({ ...prev, [path]: code }));
          
          if (path === 'index.html') {
            setGeneratedHtml(code);
          }
          
          if (selectedFile === path || !selectedFile) {
            setSelectedFile(path);
            setSelectedFileContent(code);
          }
        },
        onComplete: async () => {
          setAiEvents(prev => [...prev, { type: 'complete' }]);
          setGenerationEvents(prev => [...prev, { type: 'complete', message: 'Changes applied' }]);
          setIsInitialGeneration(false);
          setProjectFiles({ ...updatedFiles });
          
          // Sauvegarder les fichiers
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
              updated_at: new Date().toISOString()
            })
            .eq('id', currentSessionId);

          // Sauvegarder le message assistant
          if (assistantMessage) {
            await supabase
              .from('chat_messages')
              .insert({
                session_id: currentSessionId,
                role: 'assistant',
                content: assistantMessage
              });
          }

          onGeneratedChange?.(true);
        },
        onError: (error) => {
          sonnerToast.error(error);
          setIsInitialGeneration(false);
        }
      }
    );
  };

  const handleSave = async () => {
    if (!user) {
      navigate('/auth');
      return;
    }

    setShowSaveDialog(true);
  };

  const confirmSave = async () => {
    if (!websiteTitle.trim()) {
      sonnerToast.error("Veuillez entrer un titre pour votre site");
      return;
    }

    setIsSaving(true);
    try {
      if (sessionId) {
        await supabase
          .from('build_sessions')
          .update({ title: websiteTitle })
          .eq('id', sessionId);
      }

      sonnerToast.success(`Projet enregistré !`);
      setShowSaveDialog(false);
      
      setTimeout(() => {
        navigate('/dashboard');
      }, 1000);
    } catch (error: any) {
      console.error('Erreur lors de la sauvegarde:', error);
      sonnerToast.error(error.message || "Erreur lors de la sauvegarde du projet");
    } finally {
      setIsSaving(false);
    }
  };

  const handleElementModify = async (elementInfo: any, modification: string) => {
    const prompt = `Dans l'élément ${elementInfo.tagName} avec le contenu "${elementInfo.textContent?.substring(0, 50)}", ${modification}`;
    setInputValue(prompt);
    setInspectMode(false);
    await handleSubmit();
  };

  // État de chargement initial
  if (isInitialGeneration || (agent.isLoading && Object.keys(projectFiles).length === 0)) {
    return (
      <div className="min-h-screen flex flex-col">
        <GeneratingPreview />
      </div>
    );
  }

  // Interface complète avec fichiers générés
  if (Object.keys(projectFiles).length > 0) {
    return (
      <div className="h-screen flex flex-col">
        {/* Barre d'outils */}
        <div className="h-14 bg-background border-b border-border flex items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setProjectFiles({});
                setSessionId(null);
                setMessages([]);
                setWebsiteTitle('');
                onGeneratedChange?.(false);
              }}
              className="h-8"
            >
              <Home className="w-4 h-4 mr-2" />
              Nouveau
            </Button>
            <div className="h-6 w-px bg-border" />
            <h2 className="text-sm font-semibold text-foreground">{websiteTitle || 'Sans titre'}</h2>
          </div>
          
          <div className="flex items-center gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setInspectMode(!inspectMode)}
                    className={`h-8 ${inspectMode ? 'bg-accent' : ''}`}
                  >
                    <Lightbulb className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Mode inspection</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <div className="flex items-center gap-1 bg-muted rounded-md p-0.5">
              <Button
                variant={viewMode === 'preview' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-7 px-3 text-xs"
                onClick={() => setViewMode('preview')}
              >
                <Eye className="w-3.5 h-3.5 mr-1.5" />
                Preview
              </Button>
              <Button
                variant={viewMode === 'code' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-7 px-3 text-xs"
                onClick={() => setViewMode('code')}
              >
                <Code2 className="w-3.5 h-3.5 mr-1.5" />
                Code
              </Button>
              {gaPropertyId && (
                <Button
                  variant={viewMode === 'analytics' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-7 px-3 text-xs"
                  onClick={() => setViewMode('analytics')}
                >
                  <BarChart3 className="w-3.5 h-3.5 mr-1.5" />
                  Analytics
                </Button>
              )}
            </div>

            <Button
              onClick={toggleTheme}
              variant="ghost"
              size="sm"
              className="h-8"
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>

            <Button
              onClick={handleDownloadZip}
              variant="ghost"
              size="sm"
              className="h-8"
            >
              <Download className="w-4 h-4 mr-2" />
              Télécharger
            </Button>

            <Button
              onClick={handleSave}
              disabled={isSaving}
              size="sm"
              className="h-8"
              style={{
                borderColor: 'rgb(3,165,192)',
                backgroundColor: 'rgba(3,165,192,0.1)',
                color: 'rgb(3,165,192)'
              }}
            >
              <Save className="w-4 h-4 mr-2" />
              Enregistrer
            </Button>

            <Button
              onClick={handlePublish}
              disabled={isPublishing || !sessionId}
              size="sm"
              className="h-8 bg-gradient-to-r from-blue-600 to-cyan-600 text-white"
            >
              {isPublishing ? 'Publication...' : 'Publier'}
            </Button>
          </div>
        </div>

        {/* Interface principale */}
        <ResizablePanelGroup direction="horizontal" className="flex-1">
          {/* Chat sidebar */}
          <ResizablePanel defaultSize={25} minSize={20} maxSize={40}>
            <div className="h-full flex flex-col bg-background">
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((msg, idx) => (
                  <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] rounded-lg p-3 ${
                      msg.role === 'user' 
                        ? 'bg-primary text-primary-foreground' 
                        : 'bg-muted text-foreground'
                    }`}>
                      <p className="text-sm whitespace-pre-wrap">
                        {typeof msg.content === 'string' ? msg.content : '[message multimédia]'}
                      </p>
                    </div>
                  </div>
                ))}
                
                {agent.isLoading && (
                  <AiTaskList events={aiEvents} />
                )}
                
                <div ref={chatEndRef} />
              </div>

              <div className="p-4 border-t border-border">
                <PromptBar
                  inputValue={inputValue}
                  setInputValue={setInputValue}
                  onSubmit={handleSubmit}
                  isLoading={agent.isLoading}
                  showPlaceholderAnimation={false}
                  attachedFiles={attachedFiles}
                  onRemoveFile={removeFile}
                  onFileSelect={handleFileSelect}
                />
              </div>
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Zone de code/preview */}
          <ResizablePanel defaultSize={75} minSize={50}>
            <ResizablePanelGroup direction="horizontal">
              {/* File tree */}
              <ResizablePanel defaultSize={20} minSize={15} maxSize={30}>
                <CodeTreeView
                  files={projectFiles}
                  selectedFile={selectedFile}
                  onFileSelect={selectFile}
                />
              </ResizablePanel>
              
              <ResizableHandle withHandle />
              
              {/* Éditeur de code */}
              {viewMode === 'code' && (
                <>
                  <ResizablePanel defaultSize={40} minSize={30}>
                    <div className="h-full flex flex-col">
                      <FileTabs
                        openFiles={openFiles}
                        activeFile={selectedFile}
                        onTabClick={(path) => {
                          setSelectedFile(path);
                          setSelectedFileContent(projectFiles[path]);
                        }}
                        onTabClose={closeFile}
                      />
                      {selectedFile ? (
                        <MonacoEditor
                          value={selectedFileContent}
                          onChange={(value) => {
                            setSelectedFileContent(value || '');
                            setProjectFiles({ ...projectFiles, [selectedFile]: value || '' });
                          }}
                          language={selectedFile.split('.').pop() || 'typescript'}
                        />
                      ) : (
                        <div className="h-full flex items-center justify-center text-muted-foreground">
                          Sélectionnez un fichier
                        </div>
                      )}
                    </div>
                  </ResizablePanel>
                  
                  <ResizableHandle withHandle />
                </>
              )}
              
              {/* Preview / Analytics */}
              <ResizablePanel defaultSize={viewMode === 'code' ? 40 : 80} minSize={30}>
                {viewMode === 'analytics' && gaPropertyId && websiteId ? (
                  <Analytics isPublished={!!deployedUrl} isDark={isDark} gaPropertyId={gaPropertyId} websiteId={websiteId} />
                ) : (
                  <div className="h-full flex flex-col bg-slate-100">
                    <FakeUrlBar projectTitle={websiteTitle || 'Sans titre'} isDark={isDark} />
                    <div className="flex-1">
                      <InteractivePreview
                        projectFiles={projectFiles}
                        isDark={isDark}
                        onElementModify={(prompt, elementInfo) => handleElementModify(elementInfo, prompt)}
                        inspectMode={inspectMode}
                        onInspectModeChange={setInspectMode}
                      />
                    </div>
                  </div>
                )}
              </ResizablePanel>
            </ResizablePanelGroup>
          </ResizablePanel>
        </ResizablePanelGroup>

        {/* Dialog pour sauvegarder */}
        <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Enregistrer votre site</DialogTitle>
              <DialogDescription>
                Votre site sera enregistré dans votre dashboard
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
                {isSaving ? 'Enregistrement...' : 'Enregistrer'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // État initial : Prompt uniquement
  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20" style={{ backgroundColor: isDark ? '#1F1F20' : '#ffffff' }}>
      {/* Grid background */}
      <div className="absolute inset-0" 
           style={{ 
             backgroundImage: 'linear-gradient(rgba(148, 163, 184, 0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(148, 163, 184, 0.15) 1px, transparent 1px)',
             backgroundSize: '80px 80px'
           }} 
      />
      
      {/* Glows animés */}
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

      {/* Contenu principal */}
      <div className="relative z-10 w-full max-w-4xl px-4 text-center -mt-64">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#4cc9f0] bg-transparent mb-6 leading-none cursor-pointer backdrop-blur-sm">
          <Sparkles className="w-4 h-4 text-[#4cc9f0]" />
          <span className="text-sm font-light text-[#4cc9f0]">Chat avec Magellan</span>
        </div>

        {/* Titre principal */}
        <h1 className={`text-4xl md:text-5xl font-bold mb-4 leading-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
          Crée ton site web en quelques secondes avec l'IA
        </h1>

        {/* Sous-titre */}
        <p className={`text-lg md:text-xl font-light mb-10 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
          Décris ton activité en une phrase... l'IA s'occupe du reste.
        </p>

        {/* Zone de saisie */}
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
