import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { ArrowUp, Save, Eye, Code2, Home, Paperclip, X } from "lucide-react";
import { toast as sonnerToast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Message {
  role: 'user' | 'assistant';
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
}

export default function BuilderSession() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
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

  useEffect(() => {
    loadSession();
    checkAuth();
  }, [sessionId]);

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

      if (error) {
        console.error('Error loading session:', error);
        sonnerToast.error("Session introuvable");
        navigate('/builder');
        return;
      }

      if (data) {
        setGeneratedHtml(data.html_content || '');
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
      const { error } = await supabase
        .from('build_sessions')
        .update({
          html_content: generatedHtml,
          messages: messages as any,
          title: websiteTitle,
          updated_at: new Date().toISOString()
        })
        .eq('id', sessionId);

      if (error) throw error;
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

  const handleSubmit = async () => {
    if (!inputValue.trim() && attachedFiles.length === 0) {
      sonnerToast.error("Veuillez entrer votre message ou joindre un fichier");
      return;
    }

    // Construire le message avec texte et images
    let userMessageContent: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
    
    if (attachedFiles.length > 0) {
      const contentArray: Array<{ type: string; text?: string; image_url?: { url: string } }> = [];
      if (inputValue.trim()) {
        contentArray.push({ type: 'text', text: inputValue });
      }
      attachedFiles.forEach(file => {
        contentArray.push({ 
          type: 'image_url', 
          image_url: { url: file.base64 }
        });
      });
      userMessageContent = contentArray;
    } else {
      userMessageContent = inputValue;
    }

    const newMessages = [...messages, { role: 'user' as const, content: userMessageContent }];
    setMessages(newMessages);
    setInputValue('');
    setAttachedFiles([]);
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('claude', {
        body: { messages: newMessages }
      });

      if (error) throw error;

      if (data?.response) {
        const aiResponse = data.response;
        setGeneratedHtml(aiResponse);
        const updatedMessages = [...newMessages, { role: 'assistant' as const, content: aiResponse }];
        setMessages(updatedMessages);

        // Auto-save session
        await supabase
          .from('build_sessions')
          .update({
            html_content: aiResponse,
            messages: updatedMessages as any,
            updated_at: new Date().toISOString()
          })
          .eq('id', sessionId);

        sonnerToast.success(messages.length > 0 ? "Modifications appliquées !" : "Site généré !");
      }
    } catch (error) {
      console.error('Error:', error);
      sonnerToast.error(error instanceof Error ? error.message : "Une erreur est survenue");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user) {
      // Sauvegarder la session actuelle dans localStorage pour y revenir après connexion
      localStorage.setItem('redirectAfterAuth', `/session/${sessionId}`);
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
      await saveSession();

      const { data, error } = await supabase.functions.invoke('deploy-to-cloudflare', {
        body: { 
          htmlContent: generatedHtml,
          title: websiteTitle 
        }
      });

      if (error) throw error;

      sonnerToast.success(`Site enregistré et déployé !`, {
        description: `URL: ${data.url}`,
        duration: 5000,
      });

      setShowSaveDialog(false);
      
      setTimeout(() => {
        navigate('/dashboard');
      }, 2000);
    } catch (error: any) {
      console.error('Error saving:', error);
      sonnerToast.error(error.message || "Erreur lors de la sauvegarde");
    } finally {
      setIsSaving(false);
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
    <div className="h-screen flex flex-col">
      {/* Barre d'action */}
      <div className="h-12 bg-slate-50/80 backdrop-blur-sm border-b border-slate-200 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <Button
            onClick={() => navigate('/')}
            variant="ghost"
            size="icon"
            className="h-8 w-8"
          >
            <Home className="w-4 h-4" />
          </Button>

          {user && (
            <Button
              onClick={() => navigate('/dashboard')}
              variant="ghost"
              size="sm"
              className="h-8 text-xs"
            >
              Dashboard
            </Button>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-white rounded-md border border-slate-200 p-0.5">
            <Button
              variant={viewMode === 'preview' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setViewMode('preview')}
            >
              <Eye className="w-3 h-3 mr-1" />
              Preview
            </Button>
            <Button
              variant={viewMode === 'code' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setViewMode('code')}
            >
              <Code2 className="w-3 h-3 mr-1" />
              Code
            </Button>
          </div>

          <div className="h-6 w-px bg-slate-300" />

          <div className="flex items-center gap-2">
            <Button
              onClick={handleSave}
              disabled={isSaving}
              variant="ghost"
              size="sm"
              className="h-8 text-xs"
            >
              <Save className="w-3.5 h-3.5 mr-1.5" />
              Enregistrer
            </Button>

            <Button
              onClick={() => sonnerToast.info("Fonction de publication à venir")}
              disabled={!generatedHtml}
              variant="ghost"
              size="sm"
              className="h-8 text-xs"
            >
              <Eye className="w-3.5 h-3.5 mr-1.5" />
              Publier
            </Button>
          </div>
        </div>
      </div>

      {/* Panneau principal */}
      <ResizablePanelGroup direction="horizontal" className="flex-1">
        <ResizablePanel defaultSize={30} minSize={25}>
          <div className="h-full flex flex-col bg-slate-50">
            {/* Chat history */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {messages.map((msg, idx) => (
                <div key={idx} className={`p-4 rounded-lg ${msg.role === 'user' ? 'bg-white border border-slate-200 ml-4' : 'bg-gradient-to-br from-blue-50 to-cyan-50 border border-blue-100 mr-4'}`}>
                  <p className="text-xs font-semibold text-slate-500 mb-2">
                    {msg.role === 'user' ? 'Vous' : 'Trinity'}
                  </p>
                  {msg.role === 'user' ? (
                    <div>
                      {typeof msg.content === 'string' ? (
                        <p className="text-sm text-slate-700">{msg.content}</p>
                      ) : (
                        <div className="space-y-2">
                          {msg.content.map((item, i) => (
                            item.type === 'text' ? (
                              <p key={i} className="text-sm text-slate-700">{item.text}</p>
                            ) : (
                              <img key={i} src={item.image_url?.url} alt="Attaché" className="max-w-[200px] rounded border" />
                            )
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 font-mono">HTML généré/modifié</p>
                  )}
                </div>
              ))}
            </div>
            
            {/* Chat input */}
            <div className="border-t border-slate-200 p-4 bg-white">
              {/* Fichiers attachés */}
              {attachedFiles.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-2">
                  {attachedFiles.map((file, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-md px-3 py-1.5">
                      <span className="text-xs text-blue-700 truncate max-w-[150px]">{file.name}</span>
                      <button
                        onClick={() => removeFile(idx)}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              
              <div className="flex gap-2">
                <div className="flex flex-col gap-2 flex-1">
                  <Textarea
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSubmit();
                      }
                    }}
                    placeholder="Demandez des modifications..."
                    className="min-h-[60px] resize-none text-sm"
                    disabled={isLoading}
                  />
                  <div className="flex items-center gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleFileSelect}
                      className="hidden"
                      disabled={isLoading}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isLoading}
                      className="text-xs"
                    >
                      <Paperclip className="w-3.5 h-3.5 mr-1" />
                      Joindre une image
                    </Button>
                  </div>
                </div>
                <Button
                  onClick={handleSubmit}
                  disabled={isLoading}
                  className="self-end"
                  style={{ backgroundColor: '#014AAD' }}
                >
                  <ArrowUp className="w-5 h-5" />
                </Button>
              </div>
            </div>
          </div>
        </ResizablePanel>
        
        <ResizableHandle withHandle />
        
          <ResizablePanel defaultSize={70}>
            <div className="h-full w-full bg-white flex flex-col">
              {viewMode === 'preview' ? (
                <iframe 
                  srcDoc={`
                    ${generatedHtml}
                    <script>
                      // Bloquer TOUTE navigation dans l'iframe pour isoler de Trinity
                      document.addEventListener('click', function(e) {
                        const target = e.target.closest('a');
                        if (target) {
                          const href = target.getAttribute('href');
                          // Autoriser uniquement les liens externes (http/https complets)
                          if (href && (href.startsWith('http://') || href.startsWith('https://'))) {
                            target.setAttribute('target', '_blank');
                            target.setAttribute('rel', 'noopener noreferrer');
                          } else {
                            // Bloquer tous les autres liens (relatifs, #, vides)
                            e.preventDefault();
                            e.stopPropagation();
                            return false;
                          }
                        }
                      }, true);
                      
                      // Bloquer la soumission de formulaires
                      document.addEventListener('submit', function(e) {
                        e.preventDefault();
                        return false;
                      }, true);
                    </script>
                  `}
                  className="w-full h-full border-0"
                  title="Site web généré"
                  sandbox="allow-same-origin allow-scripts allow-popups"
                />
            ) : (
              <div className="h-full w-full flex flex-col">
                <div className="bg-slate-800 border-b border-slate-700 px-4 py-2 flex items-center gap-2">
                  <span className="text-xs text-slate-300 font-mono">index.html</span>
                  <span className="text-xs text-slate-500">({generatedHtml.length} caractères)</span>
                </div>
                <div className="flex-1 overflow-auto bg-slate-900">
                  <div className="flex">
                    <div className="bg-slate-800 px-3 py-4 text-right select-none">
                      {generatedHtml.split('\n').map((_, i) => (
                        <div key={i} className="text-xs text-slate-500 leading-6 font-mono">
                          {i + 1}
                        </div>
                      ))}
                    </div>
                    <pre className="flex-1 p-4 text-xs text-slate-100 font-mono overflow-x-auto">
                      <code>{generatedHtml}</code>
                    </pre>
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
            <DialogTitle>Enregistrer votre site</DialogTitle>
            <DialogDescription>
              Votre site sera déployé sur Cloudflare et enregistré dans votre dashboard
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
