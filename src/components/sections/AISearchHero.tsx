import { Save, Eye, Code2, X, Sparkles, FileText } from 'lucide-react';
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
import trinityLogoLoading from '@/assets/trinity-logo-loading.png';
import { useThemeStore } from '@/stores/themeStore';
import PromptBar from '@/components/PromptBar';
import { Textarea } from '@/components/ui/textarea';
import { useProjectStore, ProjectFile } from '@/stores/projectStore';
import { VitePreview } from '@/components/VitePreview';
import { MonacoEditor } from '@/components/CodeEditor/MonacoEditor';
import { FileTabs } from '@/components/CodeEditor/FileTabs';
import { CodeTreeView } from '@/components/CodeEditor/CodeTreeView';

interface AISearchHeroProps {
  onGeneratedChange?: (hasGenerated: boolean) => void;
}

const AISearchHero = ({ onGeneratedChange }: AISearchHeroProps) => {
  const { isDark } = useThemeStore();
  const { projectFiles, setProjectFiles } = useProjectStore();
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<Array<{role: 'user' | 'assistant', content: string}>>([]);
  const [user, setUser] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [websiteTitle, setWebsiteTitle] = useState('');
  const [viewMode, setViewMode] = useState<'preview' | 'code'>('preview');
  const [attachedFiles, setAttachedFiles] = useState<Array<{ name: string; base64: string; type: string }>>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [openFiles, setOpenFiles] = useState<string[]>([]);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

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

  const handleSubmit = async () => {
    if (!inputValue.trim() && attachedFiles.length === 0) {
      sonnerToast.error("Veuillez entrer votre message");
      return;
    }

    if (!user) {
      localStorage.setItem('redirectAfterAuth', '/');
      sonnerToast.info("Connectez-vous pour générer votre site");
      navigate('/auth');
      return;
    }

    setIsLoading(true);
    
    // Ajouter le message utilisateur
    const userMessage = inputValue;
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-site`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          prompt: userMessage,
          sessionId: sessionId
        }),
      });

      if (!response.ok) {
        throw new Error(`Erreur API: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('Impossible de lire le stream');

      const decoder = new TextDecoder();
      let accumulatedFiles: ProjectFile[] = [];
      let assistantMessage = '';

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
            
            console.log('📦 Event reçu:', event.type);

            switch (event.type) {
              case 'start':
                if (event.data?.sessionId) {
                  setSessionId(event.data.sessionId);
                }
                assistantMessage = 'Génération en cours...';
                setMessages(prev => [...prev.filter(m => m.role === 'user'), { role: 'assistant', content: assistantMessage }]);
                break;

              case 'chunk':
                // Mise à jour progressive du message assistant
                assistantMessage += event.data?.content || '';
                break;

              case 'file_detected':
                const newFile: ProjectFile = {
                  path: event.data.path,
                  content: event.data.content,
                  type: event.data.type
                };
                
                accumulatedFiles.push(newFile);
                setProjectFiles([...accumulatedFiles]);
                
                // Ouvrir automatiquement le premier fichier
                if (accumulatedFiles.length === 1) {
                  setOpenFiles([newFile.path]);
                  setActiveFile(newFile.path);
                }
                
                console.log(`✅ Fichier détecté: ${newFile.path} (${newFile.content.length} chars)`);
                break;

              case 'complete':
                console.log(`🎉 Génération terminée: ${event.data?.totalFiles} fichiers`);
                sonnerToast.success(`${event.data?.totalFiles} fichiers générés !`);
                setMessages(prev => [...prev.filter(m => m.role === 'user'), { 
                  role: 'assistant', 
                  content: `✅ Projet généré avec succès (${event.data?.totalFiles} fichiers - ${event.data?.projectType})` 
                }]);
                break;

              case 'error':
                throw new Error(event.data?.message || 'Erreur de génération');
            }
          } catch (e) {
            console.error('Erreur parsing event:', e);
          }
        }
      }

      setInputValue('');
      setAttachedFiles([]);
      
      if (onGeneratedChange) {
        onGeneratedChange(true);
      }

    } catch (error) {
      console.error('Error:', error);
      sonnerToast.error(error instanceof Error ? error.message : "Une erreur est survenue");
      setMessages(prev => [...prev, { role: 'assistant', content: '❌ Erreur lors de la génération' }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user) {
      navigate('/auth');
      return;
    }

    if (!sessionId) {
      sonnerToast.error("Aucun projet à sauvegarder");
      return;
    }

    sonnerToast.success("Projet sauvegardé dans votre dashboard !");
    setTimeout(() => navigate('/dashboard'), 1000);
  };

  const handleFileClick = (path: string) => {
    if (!openFiles.includes(path)) {
      setOpenFiles([...openFiles, path]);
    }
    setActiveFile(path);
  };

  const handleFileClose = (path: string) => {
    const newOpenFiles = openFiles.filter(f => f !== path);
    setOpenFiles(newOpenFiles);
    
    if (activeFile === path) {
      setActiveFile(newOpenFiles.length > 0 ? newOpenFiles[newOpenFiles.length - 1] : null);
    }
  };

  const handleFileContentChange = (content: string | undefined) => {
    if (activeFile && content !== undefined) {
      const updatedFiles = projectFiles.map(file =>
        file.path === activeFile ? { ...file, content } : file
      );
      setProjectFiles(updatedFiles);
    }
  };

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // État de chargement
  if (isLoading && projectFiles.length === 0) {
    return (
      <div className="min-h-screen flex flex-col">
        <div className="flex-1 flex flex-col items-center justify-center bg-white relative overflow-hidden">
          {/* Grid background animé */}
          <div 
            className="absolute inset-0 animate-scroll-down" 
            style={{ 
              backgroundImage: 'linear-gradient(rgba(148, 163, 184, 0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(148, 163, 184, 0.15) 1px, transparent 1px)',
              backgroundSize: '80px 80px'
            }} 
          />
          
          <div className="w-64 h-1 bg-slate-200 rounded-full overflow-hidden relative z-10">
            <div 
              className="h-full rounded-full"
              style={{ 
                backgroundColor: '#5BE0E5',
                animation: 'loadProgress 20s linear forwards'
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  if (projectFiles.length > 0) {
    const activeFileContent = projectFiles.find(f => f.path === activeFile);
    const activeFileExtension = activeFile?.split('.').pop() || 'txt';
    
    // Convertir ProjectFile[] en Record<string, string> pour VitePreview
    const filesForPreview = projectFiles.reduce((acc, file) => {
      acc[file.path] = file.content;
      return acc;
    }, {} as Record<string, string>);

    return (
      <div className="h-screen">
        {/* Barre d'outils */}
        <div className="h-10 bg-slate-50/80 backdrop-blur-sm border-b border-slate-200 flex items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-slate-500" />
            <span className="text-xs text-slate-600 font-medium">{projectFiles.length} fichiers</span>
          </div>
          
          <div className="flex items-center gap-3">
            <Button
              onClick={handleSave}
              disabled={isSaving}
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
            >
              <Save className="w-3.5 h-3.5 mr-1.5" />
              Enregistrer
            </Button>
            
            <div className="h-5 w-px bg-slate-300" />
            
            <div className="flex items-center gap-1 bg-white rounded-md border border-slate-200 p-0.5">
              <Button
                variant={viewMode === 'preview' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={() => setViewMode('preview')}
              >
                <Eye className="w-3 h-3 mr-1" />
                Preview
              </Button>
              <Button
                variant={viewMode === 'code' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={() => setViewMode('code')}
              >
                <Code2 className="w-3 h-3 mr-1" />
                Code
              </Button>
            </div>
          </div>
        </div>

        <ResizablePanelGroup direction="horizontal" className="h-[calc(100vh-2.5rem)]">
          <ResizablePanel defaultSize={30} minSize={25}>
            <div className="h-full flex flex-col bg-slate-50">
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
                        <p className="text-sm text-slate-700">{msg.content}</p>
                      </div>
                    ) : (
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                          <Sparkles className="w-4 h-4 text-white" />
                        </div>
                        <p className="text-sm text-slate-600">{msg.content}</p>
                      </div>
                    )}
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
              
              {/* Chat input */}
              <div className="border-t border-slate-200 p-4 bg-white">
                <PromptBar
                  inputValue={inputValue}
                  setInputValue={setInputValue}
                  onSubmit={handleSubmit}
                  isLoading={isLoading}
                  showPlaceholderAnimation={false}
                  showConfigButtons={false}
                  attachedFiles={attachedFiles}
                  onRemoveFile={removeFile}
                  onFileSelect={handleFileSelect}
                />
              </div>
            </div>
          </ResizablePanel>
          
          <ResizableHandle withHandle />
          
          <ResizablePanel defaultSize={70}>
            <div className="h-full w-full bg-white flex">
              {viewMode === 'preview' ? (
                <VitePreview projectFiles={filesForPreview} isDark={isDark} />
              ) : (
                <div className="h-full w-full flex">
                  {/* Arborescence fichiers */}
                  <div className="w-64 border-r border-slate-200 bg-slate-50">
                    <CodeTreeView
                      files={projectFiles.map(f => f.path)}
                      onFileClick={handleFileClick}
                      activeFile={activeFile}
                    />
                  </div>
                  
                  {/* Éditeur */}
                  <div className="flex-1 flex flex-col">
                    <FileTabs
                      openFiles={openFiles}
                      activeFile={activeFile}
                      onTabClick={setActiveFile}
                      onTabClose={handleFileClose}
                    />
                    
                    {activeFileContent ? (
                      <MonacoEditor
                        value={activeFileContent.content}
                        language={activeFileExtension}
                        onChange={handleFileContentChange}
                        readOnly={false}
                      />
                    ) : (
                      <div className="flex-1 flex items-center justify-center text-slate-400">
                        <div className="text-center">
                          <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">Sélectionnez un fichier pour commencer</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    );
  }

  // État initial
  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      {/* Animated grid background */}
      <div 
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage: `
            linear-gradient(${isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'} 1px, transparent 1px),
            linear-gradient(90deg, ${isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'} 1px, transparent 1px)
          `,
          backgroundSize: '100px 100px',
          animation: 'moveGrid 20s linear infinite'
        }}
      />

      {/* Cyan glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full blur-3xl opacity-20"
           style={{ backgroundColor: '#5BE0E5' }} />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full blur-3xl opacity-20"
           style={{ backgroundColor: '#03A5C0' }} />

      <div className="relative z-10 container mx-auto px-4 max-w-4xl">
        <div className="text-center mb-12">
          <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-[#03A5C0] to-[#5BE0E5] bg-clip-text text-transparent">
            Créez votre site web
            <br />
            en un instant
          </h1>
          <p className="text-xl text-foreground/70 mb-8">
            Décrivez votre projet et obtenez un site professionnel généré par l'IA
          </p>
        </div>

        <div className="bg-card/80 backdrop-blur-md border border-border rounded-2xl shadow-2xl p-8">
          <PromptBar
            inputValue={inputValue}
            setInputValue={setInputValue}
            onSubmit={handleSubmit}
            isLoading={isLoading}
            showPlaceholderAnimation={true}
            showConfigButtons={true}
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
