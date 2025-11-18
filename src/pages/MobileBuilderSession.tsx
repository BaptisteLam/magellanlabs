import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { Save, Home, X, Moon, Sun, Download, Smartphone } from "lucide-react";
import { useThemeStore } from '@/stores/themeStore';
import { toast as sonnerToast } from "sonner";
import JSZip from "jszip";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileTree } from "@/components/FileTree";
import { MobilePreview } from "@/components/MobilePreview";
import { CodeTreeView } from "@/components/CodeEditor/CodeTreeView";
import { FileTabs } from "@/components/CodeEditor/FileTabs";
import { MonacoEditor } from "@/components/CodeEditor/MonacoEditor";
import PromptBar from "@/components/PromptBar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useAgentAPI } from "@/hooks/useAgentAPI";
import type { AIEvent, GenerationEvent } from '@/types/agent';
import AiTaskList from '@/components/chat/AiTaskList';
import { SimpleAiEvents } from '@/components/chat/SimpleAiEvents';

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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [projectFiles, setProjectFiles] = useState<Record<string, string>>({});
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [selectedFileContent, setSelectedFileContent] = useState<string>('');
  const [openFiles, setOpenFiles] = useState<string[]>([]);
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

        if (hasAppJson && hasPackageJson && Object.keys(filesObj).length > 2) {
          setIsInitialGeneration(false);
          isInitialGenerationRef.current = false;
        } else {
          setIsInitialGeneration(true);
          isInitialGenerationRef.current = true;

          const messagesData = data.messages as any;
          const messagesArray = Array.isArray(messagesData) ? messagesData : [];
          const userMessages = messagesArray.filter((m: any) => m.role === 'user');
          
          if (userMessages.length > 0) {
            const lastUserMessage = userMessages[userMessages.length - 1];
            const prompt = typeof lastUserMessage.content === 'string' 
              ? lastUserMessage.content 
              : (Array.isArray(lastUserMessage.content) ? lastUserMessage.content.map((c: any) => c.text || '').join(' ') : '');

            setTimeout(() => {
              handleAgentGeneration(prompt, filesObj, messagesArray);
            }, 100);
          }
        }
      }
    } catch (error) {
      console.error('Error loading session:', error);
      sonnerToast.error("Erreur lors du chargement de la session");
    } finally {
      setSessionLoading(false);
    }
  };

  const handleAgentGeneration = async (
    prompt: string,
    currentFiles: Record<string, any>,
    currentMessages: any[]
  ) => {
    if (!sessionId) return;

    setAiEvents([]);
    setGenerationEvents([]);

    const relevantFiles: Array<{path: string, content: string}> = Object.entries(currentFiles)
      .filter(([path]) => 
        path.endsWith('.tsx') || 
        path.endsWith('.ts') || 
        path === 'app.json' || 
        path === 'package.json'
      )
      .map(([path, content]) => ({ 
        path, 
        content: typeof content === 'string' ? content : JSON.stringify(content) 
      }));

    const relevantFilesObj = relevantFiles.reduce((acc, { path, content }) => ({ 
      ...acc, 
      [path]: content 
    }), {} as Record<string, string>);

    try {
      await agent.callAgent(
        prompt,
        relevantFilesObj,
        [],
        currentMessages as any[],
        sessionId,
        'mobile',
        {
          onStatus: (status) => {
            setAiEvents(prev => [...prev, { type: 'status', content: status }]);
          },
          onMessage: (msg) => {
            setAiEvents(prev => [...prev, { type: 'message', content: msg }]);
          },
          onCodeUpdate: async (path, code) => {
            setProjectFiles(prev => ({ ...prev, [path]: code }));
            setAiEvents(prev => [...prev, { type: 'code_update', path, code }]);

            await supabase
              .from('build_sessions')
              .update({ 
                project_files: { ...currentFiles, [path]: code },
                updated_at: new Date().toISOString()
              })
              .eq('id', sessionId);
          },
          onComplete: async () => {
            setAiEvents(prev => [...prev, { type: 'complete' }]);
            setIsInitialGeneration(false);
            isInitialGenerationRef.current = false;
            
            const { data } = await supabase
              .from('build_sessions')
              .select('project_files')
              .eq('id', sessionId)
              .single();

            if (data) {
              setProjectFiles(data.project_files as Record<string, any> || {});
            }
          },
          onGenerationEvent: (event) => {
            setGenerationEvents(prev => [...prev, event]);
          }
        }
      );
    } catch (error) {
      console.error('Agent generation error:', error);
      sonnerToast.error("Erreur lors de la génération");
      setIsInitialGeneration(false);
      isInitialGenerationRef.current = false;
    }
  };

  const handleModifyPrompt = async () => {
    if (!inputValue.trim() || !sessionId) return;

    const userMessage: Message = {
      role: 'user',
      content: inputValue
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);

    await supabase
      .from('build_sessions')
      .update({ 
        messages: updatedMessages as any,
        updated_at: new Date().toISOString()
      })
      .eq('id', sessionId);

    setInputValue('');
    setAttachedFiles([]);

    await handleAgentGeneration(inputValue, projectFiles, updatedMessages);
  };

  const handleFileSelect = (path: string, content: string) => {
    setSelectedFile(path);
    setSelectedFileContent(typeof content === 'string' ? content : JSON.stringify(content, null, 2));
    if (!openFiles.includes(path)) {
      setOpenFiles([...openFiles, path]);
    }
  };

  const handleTabClick = (path: string) => {
    const content = projectFiles[path];
    setSelectedFile(path);
    setSelectedFileContent(typeof content === 'string' ? content : JSON.stringify(content, null, 2));
  };

  const handleTabClose = (path: string) => {
    const newOpenFiles = openFiles.filter(f => f !== path);
    setOpenFiles(newOpenFiles);
    if (selectedFile === path && newOpenFiles.length > 0) {
      const newSelected = newOpenFiles[newOpenFiles.length - 1];
      setSelectedFile(newSelected);
      setSelectedFileContent(typeof projectFiles[newSelected] === 'string' 
        ? projectFiles[newSelected] 
        : JSON.stringify(projectFiles[newSelected], null, 2));
    } else if (newOpenFiles.length === 0) {
      setSelectedFile(null);
      setSelectedFileContent('');
    }
  };

  const handleDownload = async () => {
    const zip = new JSZip();
    Object.entries(projectFiles).forEach(([path, content]) => {
      const fileContent = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
      zip.file(path, fileContent);
    });

    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${appTitle || 'mobile-app'}.zip`;
    a.click();
    URL.revokeObjectURL(url);
    sonnerToast.success('Application téléchargée avec succès');
  };

  const handleSave = () => {
    setShowSaveDialog(true);
  };

  const confirmSave = async () => {
    if (!appTitle.trim() || !sessionId) {
      sonnerToast.error("Veuillez entrer un titre");
      return;
    }

    setIsSaving(true);
    try {
      await supabase
        .from('build_sessions')
        .update({ 
          title: appTitle,
          updated_at: new Date().toISOString()
        })
        .eq('id', sessionId);

      sonnerToast.success('Application sauvegardée');
      setShowSaveDialog(false);
      setTimeout(() => navigate('/dashboard'), 1000);
    } catch (error) {
      console.error('Error saving:', error);
      sonnerToast.error('Erreur lors de la sauvegarde');
    } finally {
      setIsSaving(false);
    }
  };

  const removeFile = (index: number) => {
    setAttachedFiles(attachedFiles.filter((_, i) => i !== index));
  };

  const onFileSelectFromBar = (files: File[]) => {
    const newFiles: Array<{ name: string; base64: string; type: string }> = [];
    let processed = 0;
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const base64 = e.target?.result as string;
          newFiles.push({ name: file.name, base64, type: file.type });
          processed++;
          if (processed === files.length) {
            setAttachedFiles([...attachedFiles, ...newFiles]);
          }
        };
        reader.readAsDataURL(file);
      } else {
        processed++;
      }
    }
  };

  if (sessionLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Chargement de la session...</p>
        </div>
      </div>
    );
  }

  if (isInitialGeneration) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-background">
        <MobilePreview 
          files={{}} 
          sessionId={sessionId || ''} 
          isGenerating={true}
        />
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
              <Home className="w-4 h-4" />
              Accueil
            </Button>
            <div className="h-6 w-px bg-border" />
            <Smartphone className="w-5 h-5 text-primary" />
            <span className="font-medium text-sm">{appTitle || 'Mobile App'}</span>
          </div>

          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleTheme}
                >
                  {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Basculer thème</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDownload}
                >
                  <Download className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Télécharger le code</TooltipContent>
            </Tooltip>

            <Button
              size="sm"
              onClick={handleSave}
              className="gap-2"
            >
              <Save className="w-4 h-4" />
              Sauvegarder
            </Button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          <ResizablePanelGroup direction="horizontal">
            {/* File Tree */}
            <ResizablePanel defaultSize={20} minSize={15}>
              <div className={`h-full overflow-auto ${isDark ? 'bg-slate-900' : 'bg-gray-50'}`}>
                <CodeTreeView
                  files={projectFiles}
                  onFileSelect={handleFileSelect}
                  selectedFile={selectedFile}
                />
              </div>
            </ResizablePanel>

            <ResizableHandle />

            {/* Code Editor */}
            <ResizablePanel defaultSize={40} minSize={30}>
              <div className="h-full flex flex-col">
                {openFiles.length > 0 && (
                  <FileTabs
                    openFiles={openFiles}
                    activeFile={selectedFile}
                    onTabClick={handleTabClick}
                    onTabClose={handleTabClose}
                  />
                )}
                <div className="flex-1">
                  <MonacoEditor
                    value={selectedFileContent}
                    onChange={setSelectedFileContent}
                    language={selectedFile?.endsWith('.json') ? 'json' : 
                             selectedFile?.endsWith('.tsx') ? 'tsx' : 
                             selectedFile?.endsWith('.ts') ? 'ts' : 'typescript'}
                  />
                </div>
              </div>
            </ResizablePanel>

            <ResizableHandle />

            {/* Preview/Chat */}
            <ResizablePanel defaultSize={40} minSize={30}>
              <div className={`h-full flex flex-col ${isDark ? 'bg-slate-900' : 'bg-gray-50'}`}>
                {/* Mobile Preview */}
                <div className="flex-1 overflow-hidden border-b">
                  <MobilePreview 
                    files={projectFiles} 
                    sessionId={sessionId || ''} 
                    isGenerating={agent.isLoading || isInitialGeneration}
                  />
                </div>

                {/* Chat */}
                <div className="h-1/3 flex flex-col border-t">
                  <div className="flex-1 overflow-y-auto p-4">
                    <SimpleAiEvents events={aiEvents.filter(e => e.type === 'message' || e.type === 'status') as any} isDark={isDark} />
                    <div ref={chatEndRef} />
                  </div>

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
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
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
              <Button
                variant="outline"
                onClick={() => setShowSaveDialog(false)}
              >
                Annuler
              </Button>
              <Button
                onClick={confirmSave}
                disabled={isSaving || !appTitle.trim()}
              >
                {isSaving ? 'Sauvegarde...' : 'Sauvegarder'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept="image/*"
          multiple
        />
      </div>
    </TooltipProvider>
  );
}
