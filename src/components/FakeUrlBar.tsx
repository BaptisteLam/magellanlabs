import { Search, Pencil, Copy, Check } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface FakeUrlBarProps {
  projectTitle: string;
  isDark?: boolean;
  sessionId?: string;
  onTitleChange?: (newTitle: string) => void;
  currentFavicon?: string;
}

export function FakeUrlBar({ projectTitle, isDark = false, sessionId, onTitleChange, currentFavicon }: FakeUrlBarProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState(projectTitle);
  const [copied, setCopied] = useState(false);
  
  useEffect(() => {
    setEditedTitle(projectTitle);
  }, [projectTitle]);

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

  return (
    <div 
      className="h-10 border-b flex items-center px-4 gap-3 w-full"
      style={{ 
        backgroundColor: isDark ? '#2A2A2B' : '#F8F9FA',
        borderBottomColor: isDark ? '#3A3A3B' : '#E5E7EB'
      }}
    >
      {/* Boutons de navigation */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <div className="flex items-center gap-1">
          <div 
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: isDark ? '#4A4A4B' : '#E5E7EB' }}
          />
          <div 
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: isDark ? '#4A4A4B' : '#E5E7EB' }}
          />
          <div 
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: isDark ? '#4A4A4B' : '#E5E7EB' }}
          />
        </div>
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
        {currentFavicon ? (
          <img src={currentFavicon} alt="favicon" className="w-3.5 h-3.5 object-contain flex-shrink-0" />
        ) : (
          <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: isDark ? '#6B7280' : '#9CA3AF' }}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )}
        
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
    </div>
  );
}
