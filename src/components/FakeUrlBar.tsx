import { Search, Pencil, Copy, Check, Paperclip, Settings, ChevronLeft, ChevronRight, RotateCw } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { CustomDomainDialog } from './CustomDomainDialog';

interface FakeUrlBarProps {
  projectTitle: string;
  isDark?: boolean;
  sessionId?: string;
  onTitleChange?: (newTitle: string) => void;
  currentFavicon?: string;
  onFaviconChange?: (faviconUrl: string) => void;
  cloudflareProjectName?: string;
  currentRoute?: string;
  onNavigate?: (path: string) => void;
  onReload?: () => void;
  onGoBack?: () => void;
  onGoForward?: () => void;
  iframeRef?: React.RefObject<HTMLIFrameElement>;
}

export function FakeUrlBar({ 
  projectTitle, 
  isDark = false, 
  sessionId, 
  onTitleChange, 
  currentFavicon, 
  onFaviconChange, 
  cloudflareProjectName,
  currentRoute = '/',
  onNavigate,
  onReload,
  onGoBack,
  onGoForward,
  iframeRef
}: FakeUrlBarProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState(projectTitle);
  const [copied, setCopied] = useState(false);
  const [isHoveringFavicon, setIsHoveringFavicon] = useState(false);
  const [showCustomDomain, setShowCustomDomain] = useState(false);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [displayRoute, setDisplayRoute] = useState(currentRoute);
  const [isEditingUrl, setIsEditingUrl] = useState(false);
  const faviconInputRef = useRef<HTMLInputElement | null>(null);
  
  useEffect(() => {
    setEditedTitle(projectTitle);
  }, [projectTitle]);

  // Synchroniser la route affichée avec la prop
  useEffect(() => {
    if (!isEditingUrl) {
      setDisplayRoute(currentRoute);
    }
  }, [currentRoute, isEditingUrl]);

  // Écouter les messages de l'iframe pour l'état de navigation (supporte E2B et ancien format)
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Message depuis l'iframe E2B
      if (event.data?.type === 'PAGE_LOADED') {
        if (!isEditingUrl) {
          setDisplayRoute(event.data.path || '/');
        }
      }
      // Navigation interne depuis E2B
      if (event.data?.type === 'INTERNAL_NAVIGATION') {
        if (!isEditingUrl) {
          setDisplayRoute(event.data.path || '/');
        }
      }
      // Ancien format pour compatibilité (router.js)
      if (event.data?.type === 'ROUTE_CHANGE') {
        setCanGoBack(event.data.canGoBack ?? false);
        setCanGoForward(event.data.canGoForward ?? false);
        if (!isEditingUrl) {
          setDisplayRoute(event.data.path || '/');
        }
      }
      if (event.data?.type === 'navigation-state') {
        setCanGoBack(event.data.canGoBack);
        setCanGoForward(event.data.canGoForward);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [isEditingUrl]);

  // Envoyer un message de navigation à l'iframe via postMessage
  const sendNavigationMessage = (type: string, path?: string) => {
    if (iframeRef?.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage({ type, path }, '*');
    } else {
      // Fallback: envoyer via window pour que SandpackPreview le capte
      window.postMessage({ type: type.toLowerCase().replace('_', '-'), path }, '*');
    }
  };

  const handleNavigateBack = () => {
    console.log('⬅️ FakeUrlBar: Navigation arrière');
    if (onGoBack) {
      onGoBack();
    } else {
      sendNavigationMessage('NAVIGATE_BACK');
    }
  };

  const handleNavigateForward = () => {
    console.log('➡️ FakeUrlBar: Navigation avant');
    if (onGoForward) {
      onGoForward();
    } else {
      sendNavigationMessage('NAVIGATE_FORWARD');
    }
  };

  const handleReload = () => {
    console.log('🔄 FakeUrlBar: Rechargement');
    if (onReload) {
      onReload();
    } else {
      sendNavigationMessage('RELOAD');
    }
  };

  const handleUrlSubmit = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      let path = displayRoute.trim();
      
      // Normaliser le chemin
      if (!path.startsWith('/')) {
        path = '/' + path;
      }
      
      console.log('🔗 FakeUrlBar: Navigation vers', path);
      
      // Appeler le callback ou envoyer le message
      if (onNavigate) {
        onNavigate(path);
      } else {
        sendNavigationMessage('NAVIGATE', path);
      }
      
      setIsEditingUrl(false);
    } else if (e.key === 'Escape') {
      setDisplayRoute(currentRoute);
      setIsEditingUrl(false);
    }
  };

  // Convertir le titre en nom de domaine
  const domainName = editedTitle
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Retirer les accents
    .replace(/[^a-z0-9\s-]/g, '') // Retirer les caractères spéciaux
    .trim()
    .replace(/\s+/g, '-') // Remplacer espaces par tirets
    .replace(/-+/g, '-') // Éviter tirets multiples
    || 'monsite';

  const fullDomain = `${domainName}.builtbymagellan.com`;

  const handleSave = async () => {
    if (!sessionId || !editedTitle.trim()) return;

    try {
      // Sauvegarder le nouveau titre
      const { error } = await supabase
        .from('build_sessions')
        .update({ title: editedTitle })
        .eq('id', sessionId);

      if (error) throw error;
      
      if (onTitleChange) {
        onTitleChange(editedTitle);
      }

      // Republier automatiquement le projet avec le nouveau subdomain
      console.log('🔄 Updating public URL with new title...');
      const { data: publishData, error: publishError } = await supabase.functions.invoke('publish-project', {
        body: { sessionId }
      });

      if (publishError) {
        console.error('❌ Error updating public URL:', publishError);
      } else if (publishData?.publicUrl) {
        console.log('✅ Public URL updated:', publishData.publicUrl);
      }
    } catch (error) {
      console.error('Error saving title:', error);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      setIsEditing(false);
      handleSave();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setEditedTitle(projectTitle);
    }
  };

  const handleBlur = () => {
    setIsEditing(false);
    if (editedTitle !== projectTitle) {
      handleSave();
    }
  };

  const handleSearchClick = () => {
    window.open(`https://${fullDomain}`, '_blank');
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(`https://${fullDomain}`);
    setCopied(true);
    toast.success('URL copiée !');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFaviconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !sessionId) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Veuillez sélectionner une image');
      return;
    }

    try {
      // Convertir l'image en base64
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        
        // Récupérer les fichiers actuels du projet
        const { data: session, error: fetchError } = await supabase
          .from('build_sessions')
          .select('project_files')
          .eq('id', sessionId)
          .single();

        if (fetchError) throw fetchError;

        const updatedFiles = {
          ...(session.project_files as any || {}),
          favicon: base64
        };

        // Mettre à jour avec le nouveau favicon
        const { error } = await supabase
          .from('build_sessions')
          .update({ project_files: updatedFiles })
          .eq('id', sessionId);

        if (error) throw error;
        
        if (onFaviconChange) {
          onFaviconChange(base64);
        }
        
        toast.success('Favicon mis à jour !');
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Error uploading favicon:', error);
      toast.error('Erreur lors de la mise à jour du favicon');
    }
  };

  return (
    <div 
      className="h-10 border-b flex items-center px-4 gap-3 w-full rounded-t-xl"
      style={{ 
        backgroundColor: isDark ? '#2A2A2B' : '#F8F9FA',
        borderBottomColor: isDark ? '#3A3A3B' : '#E5E7EB'
      }}
    >
      {/* Boutons de navigation */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <button
          onClick={handleNavigateBack}
          disabled={!canGoBack}
          className="w-6 h-6 rounded flex items-center justify-center transition-colors disabled:opacity-40 hover:bg-opacity-80"
          style={{ backgroundColor: isDark ? '#3A3A3B' : '#E5E7EB' }}
          title="Retour"
          onMouseEnter={(e) => {
            if (canGoBack) {
              const icon = e.currentTarget.querySelector('svg');
              if (icon) icon.style.color = '#03A5C0';
            }
          }}
          onMouseLeave={(e) => {
            const icon = e.currentTarget.querySelector('svg');
            if (icon) icon.style.color = isDark ? '#6B7280' : '#9CA3AF';
          }}
        >
          <ChevronLeft 
            className="w-3.5 h-3.5 transition-colors"
            style={{ color: isDark ? '#6B7280' : '#9CA3AF' }}
          />
        </button>
        <button
          onClick={handleNavigateForward}
          disabled={!canGoForward}
          className="w-6 h-6 rounded flex items-center justify-center transition-colors disabled:opacity-40 hover:bg-opacity-80"
          style={{ backgroundColor: isDark ? '#3A3A3B' : '#E5E7EB' }}
          title="Suivant"
          onMouseEnter={(e) => {
            if (canGoForward) {
              const icon = e.currentTarget.querySelector('svg');
              if (icon) icon.style.color = '#03A5C0';
            }
          }}
          onMouseLeave={(e) => {
            const icon = e.currentTarget.querySelector('svg');
            if (icon) icon.style.color = isDark ? '#6B7280' : '#9CA3AF';
          }}
        >
          <ChevronRight 
            className="w-3.5 h-3.5 transition-colors"
            style={{ color: isDark ? '#6B7280' : '#9CA3AF' }}
          />
        </button>
        <button
          onClick={handleReload}
          className="w-6 h-6 rounded flex items-center justify-center transition-colors hover:bg-opacity-80"
          style={{ backgroundColor: isDark ? '#3A3A3B' : '#E5E7EB' }}
          title="Recharger"
          onMouseEnter={(e) => {
            const icon = e.currentTarget.querySelector('svg');
            if (icon) icon.style.color = '#03A5C0';
          }}
          onMouseLeave={(e) => {
            const icon = e.currentTarget.querySelector('svg');
            if (icon) icon.style.color = isDark ? '#6B7280' : '#9CA3AF';
          }}
        >
          <RotateCw 
            className="w-3.5 h-3.5 transition-colors"
            style={{ color: isDark ? '#6B7280' : '#9CA3AF' }}
          />
        </button>
      </div>

      {/* Barre d'URL */}
      <div 
        className="flex-1 h-7 px-3 flex items-center gap-2 min-w-0"
        style={{ 
          backgroundColor: isDark ? '#1F1F20' : '#FFFFFF',
          border: `1px solid ${isDark ? '#3A3A3B' : '#E5E7EB'}`,
          borderRadius: '9999px'
        }}
      >
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
          {currentFavicon && !isHoveringFavicon ? (
            <img src={currentFavicon} alt="favicon" className="w-3.5 h-3.5 object-contain flex-shrink-0" />
          ) : isHoveringFavicon ? (
            <Paperclip className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#03A5C0' }} />
          ) : (
            <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: isDark ? '#6B7280' : '#9CA3AF' }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
        </button>
        
        {isEditing ? (
          <input
            type="text"
            value={editedTitle}
            onChange={(e) => setEditedTitle(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            autoFocus
            className="flex-1 bg-transparent outline-none text-sm font-medium min-w-0"
            style={{ color: isDark ? '#E5E7EB' : '#1F2937' }}
          />
        ) : (
          <div 
            className="flex-1 flex items-center gap-1 min-w-0 cursor-pointer"
            onClick={() => setIsEditing(true)}
          >
            <span 
              className="text-sm font-medium truncate"
              style={{ color: isDark ? '#E5E7EB' : '#1F2937' }}
            >
              {domainName}
            </span>
            <span 
              className="text-sm font-medium flex-shrink-0"
              style={{ color: isDark ? '#6B7280' : '#9CA3AF' }}
            >
              .builtbymagellan.com
            </span>
            <button
              onClick={() => setShowCustomDomain(true)}
              className="flex-shrink-0 ml-1 p-0.5 hover:text-[#03A5C0] transition-colors cursor-pointer bg-transparent border-0"
              title="Configurer un domaine personnalisé"
            >
              <Settings 
                className="w-3 h-3"
                style={{ color: isDark ? '#6B7280' : '#9CA3AF' }}
              />
            </button>
          </div>
        )}
      </div>

      {/* Icônes d'actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={handleCopyUrl}
          className="w-6 h-6 rounded flex items-center justify-center hover:bg-opacity-80 transition-colors"
          style={{ backgroundColor: isDark ? '#3A3A3B' : '#E5E7EB' }}
          title="Copier l'URL"
        >
          {copied ? (
            <Check 
              className="w-3.5 h-3.5"
              style={{ color: '#03A5C0' }}
            />
          ) : (
            <Copy 
              className="w-3.5 h-3.5"
              style={{ color: isDark ? '#6B7280' : '#9CA3AF' }}
            />
          )}
        </button>

        <button
          onClick={() => setIsEditing(true)}
          className="w-6 h-6 rounded flex items-center justify-center hover:bg-opacity-80 transition-colors"
          style={{ backgroundColor: isDark ? '#3A3A3B' : '#E5E7EB' }}
          title="Modifier le nom"
        >
          <Pencil 
            className="w-3.5 h-3.5"
            style={{ color: isDark ? '#6B7280' : '#9CA3AF' }}
          />
        </button>
        
        <button
          onClick={handleSearchClick}
          className="w-6 h-6 rounded flex items-center justify-center transition-colors"
          style={{ 
            backgroundColor: isDark ? '#3A3A3B' : '#E5E7EB',
          }}
          title="Voir le site publié"
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#03A5C0';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = isDark ? '#3A3A3B' : '#E5E7EB';
          }}
        >
          <Search 
            className="w-3.5 h-3.5"
            style={{ color: isDark ? '#6B7280' : '#9CA3AF' }}
          />
        </button>
      </div>

      <CustomDomainDialog
        open={showCustomDomain}
        onOpenChange={setShowCustomDomain}
        sessionId={sessionId}
        cloudflareProjectName={cloudflareProjectName}
      />
    </div>
  );
}
