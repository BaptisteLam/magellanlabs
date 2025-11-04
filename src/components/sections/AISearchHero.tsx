import { Save, Eye, Code2, X, Sparkles } from 'lucide-react';
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
import { CodeTreeView } from '@/components/CodeEditor/CodeTreeView';
import { MonacoEditor } from '@/components/CodeEditor/MonacoEditor';
import { VitePreview } from '@/components/VitePreview';

interface AISearchHeroProps {
  onGeneratedChange?: (hasGenerated: boolean) => void;
}

const AISearchHero = ({ onGeneratedChange }: AISearchHeroProps) => {
  const { isDark } = useThemeStore();
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [projectFiles, setProjectFiles] = useState<Record<string, string>>({});
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [selectedFileContent, setSelectedFileContent] = useState('');
  const [messages, setMessages] = useState<Array<{role: 'user' | 'assistant', content: string}>>([]);
  const [user, setUser] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [websiteTitle, setWebsiteTitle] = useState('');
  const [viewMode, setViewMode] = useState<'preview' | 'code'>('preview');
  const [attachedFiles, setAttachedFiles] = useState<Array<{ name: string; base64: string; type: string }>>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

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

  const selectFile = (path: string, content: string) => {
    setSelectedFile(path);
    setSelectedFileContent(content);
  };

  const handleSubmit = async () => {
    console.log('🔥 handleSubmit appelé');
    console.log('📝 Input value:', inputValue);
    console.log('👤 User:', user);
    console.log('📁 Project files count:', Object.keys(projectFiles).length);
    console.log('📂 Selected file:', selectedFile);
    
    if (!inputValue.trim()) {
      sonnerToast.error("Veuillez entrer votre message");
      return;
    }

    // Vérifier si l'utilisateur est connecté
    if (!user) {
      console.log('❌ Utilisateur non connecté, redirection vers /auth');
      localStorage.setItem('redirectAfterAuth', '/');
      sonnerToast.info("Connectez-vous pour générer votre site");
      navigate('/auth');
      return;
    }

    console.log('✅ Validation OK, début du processus...');
    setIsLoading(true);

    try {
      const prompt = inputValue.trim();

      // 🔥 MODE MODIFICATION : Si un fichier est sélectionné, on modifie juste ce fichier
      if (selectedFile && Object.keys(projectFiles).length > 0) {
        console.log(`🔧 Modification incrémentale du fichier: ${selectedFile}`);
        
        const { data: authData } = await supabase.auth.getSession();
        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/modify-site`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authData.session?.access_token}`,
          },
          body: JSON.stringify({
            modification: prompt,
            filePath: selectedFile,
            fileContent: selectedFileContent,
            sessionId: sessionId
          }),
        });

        if (!response.ok) {
          throw new Error(`Erreur API: ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error('Impossible de lire le stream');

        const decoder = new TextDecoder('utf-8');
        let modifiedContent = '';
        
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n').filter(Boolean);

          for (const line of lines) {
            if (!line.startsWith('data:')) continue;
            
            const dataStr = line.replace('data:', '').trim();
            if (!dataStr) continue;

            try {
              const event = JSON.parse(dataStr);
              
              if (event.type === 'delta') {
                // Streaming du contenu modifié
                modifiedContent += event.data.content;
                setSelectedFileContent(modifiedContent);
                setProjectFiles({ ...projectFiles, [selectedFile]: modifiedContent });
              } else if (event.type === 'complete') {
                console.log(`✅ Modification complète`);
                setIsLoading(false);
                sonnerToast.success(`Fichier ${selectedFile} modifié !`);
              } else if (event.type === 'error') {
                throw new Error(event.data.message);
              }
            } catch (e) {
              console.error('Erreur parsing SSE:', e);
            }
          }
        }

        setInputValue('');
        return;
      }

      // 🆕 MODE CRÉATION : Génération complète d'un nouveau projet
      console.log('🆕 Génération complète d\'un nouveau projet');
      
      // Créer une session builder
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

      if (sessionError) {
        throw new Error('Erreur lors de la création de la session');
      }

      // Rediriger immédiatement vers la session builder
      navigate(`/builder/${session.id}?prompt=${encodeURIComponent(prompt)}`);
      setInputValue('');
      setAttachedFiles([]);
      setIsLoading(false);
    } catch (error) {
      console.error('💥 Erreur complète:', error);
      console.error('💥 Type d\'erreur:', error instanceof Error ? 'Error' : typeof error);
      console.error('💥 Message:', error instanceof Error ? error.message : String(error));
      console.error('💥 Stack:', error instanceof Error ? error.stack : 'N/A');
      
      sonnerToast.error(error instanceof Error ? error.message : "Une erreur est survenue");
      setIsLoading(false);
    }
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
      // Mettre à jour la session avec le titre
      if (sessionId) {
        await supabase
          .from('build_sessions')
          .update({ title: websiteTitle })
          .eq('id', sessionId);
      }

      sonnerToast.success(`Projet enregistré !`);
      setShowSaveDialog(false);
      setWebsiteTitle('');
      
      // Rediriger vers le dashboard
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


  // État de chargement
  if (isLoading && Object.keys(projectFiles).length === 0) {
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

  if (Object.keys(projectFiles).length > 0) {
    return (
      <div className="h-screen flex flex-col">
        {/* Barre d'outils */}
        <div className="h-12 bg-slate-50 border-b border-slate-200 flex items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold text-slate-700">Projet</h2>
            {selectedFile && (
              <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700 font-medium">
                Mode modification • {selectedFile}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-white rounded-md border border-slate-200 p-0.5">
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
            </div>
            <Button
              onClick={handleSave}
              disabled={isSaving}
              size="sm"
              className="h-7 text-xs bg-gradient-to-r from-blue-600 to-cyan-600"
            >
              <Save className="w-3.5 h-3.5 mr-1.5" />
              Enregistrer
            </Button>
          </div>
        </div>

        <ResizablePanelGroup direction="horizontal" className="flex-1">
          <ResizablePanel defaultSize={20} minSize={15} maxSize={30}>
            <CodeTreeView
              files={projectFiles}
              selectedFile={selectedFile}
              onFileSelect={selectFile}
            />
          </ResizablePanel>
          
          <ResizableHandle withHandle />
          
          <ResizablePanel defaultSize={40} minSize={30}>
            {viewMode === 'code' && selectedFile ? (
              <MonacoEditor
                value={selectedFileContent}
                onChange={(value) => {
                  setSelectedFileContent(value || '');
                  setProjectFiles({ ...projectFiles, [selectedFile]: value || '' });
                }}
                language={selectedFile.split('.').pop() || 'typescript'}
              />
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400">
                Sélectionnez un fichier pour voir le code
              </div>
            )}
          </ResizablePanel>
          
          <ResizableHandle withHandle />
          
          <ResizablePanel defaultSize={40} minSize={30}>
            {viewMode === 'preview' ? (
              <div className="h-full bg-white">
                <VitePreview projectFiles={projectFiles} />
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400">
                Preview disponible en mode Preview
              </div>
            )}
          </ResizablePanel>
        </ResizablePanelGroup>

        {/* Dialog pour sauvegarder */}
        <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Enregistrer votre site</DialogTitle>
              <DialogDescription>
                Votre site sera déployé sur Netlify et enregistré dans votre dashboard
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
                {isSaving ? 'Déploiement...' : 'Enregistrer et déployer'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20" style={{ backgroundColor: isDark ? '#1F1F20' : '#ffffff' }}>
      {/* Grid background - large squares, light gray */}
      <div className="absolute inset-0" 
           style={{ 
             backgroundImage: 'linear-gradient(rgba(148, 163, 184, 0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(148, 163, 184, 0.15) 1px, transparent 1px)',
             backgroundSize: '80px 80px'
           }} 
      />
      {/* Large cyan and teal glows with animation */}
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


      {/* Main content */}
      <div className="relative z-10 w-full max-w-4xl px-4 text-center -mt-64">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border backdrop-blur-sm mb-6"
             style={{ borderColor: 'rgba(59, 130, 246, 0.3)', backgroundColor: 'rgba(59, 130, 246, 0.1)' }}>
          <Sparkles className="w-4 h-4" style={{ color: '#3B82F6' }} />
          <span className="text-sm font-light" style={{ color: '#3B82F6' }}>Chat avec Magellan</span>
        </div>

        {/* Main title */}
        <h1 className={`text-4xl md:text-5xl font-bold mb-4 leading-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
          Crée ton site web en quelques secondes avec l'IA
        </h1>

        {/* Subtitle */}
        <p className={`text-lg md:text-xl font-light mb-10 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
          Décris ton activité en une phrase... l'IA s'occupe du reste.
        </p>

        {/* AI Input Area */}
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
