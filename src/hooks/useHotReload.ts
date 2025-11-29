import { useRef, useEffect, useState } from 'react';

interface HotReloadOptions {
  onUpdate?: (type: 'css' | 'html' | 'full', file?: string) => void;
}

interface FileChange {
  path: string;
  type: 'added' | 'modified' | 'deleted';
  content?: string;
}

export function useHotReload(
  projectFiles: Record<string, string>,
  options: HotReloadOptions = {}
) {
  const previousFilesRef = useRef<Record<string, string>>({});
  const [isUpdating, setIsUpdating] = useState(false);
  const [lastUpdateType, setLastUpdateType] = useState<'css' | 'html' | 'full' | null>(null);
  const isInitialMount = useRef(true);

  useEffect(() => {
    // Skip initial mount to avoid unnecessary reload
    if (isInitialMount.current) {
      previousFilesRef.current = { ...projectFiles };
      isInitialMount.current = false;
      return;
    }

    // Skip if previous files is empty (first load)
    if (Object.keys(previousFilesRef.current).length === 0) {
      previousFilesRef.current = { ...projectFiles };
      return;
    }

    const detectChanges = (): FileChange[] => {
      const changes: FileChange[] = [];
      const currentFiles = projectFiles;
      const previousFiles = previousFilesRef.current;

      // Détecter fichiers modifiés et ajoutés
      for (const [path, content] of Object.entries(currentFiles)) {
        if (!previousFiles[path]) {
          changes.push({ path, type: 'added', content });
        } else if (previousFiles[path] !== content) {
          changes.push({ path, type: 'modified', content });
        }
      }

      // Détecter fichiers supprimés
      for (const path of Object.keys(previousFiles)) {
        if (!currentFiles[path]) {
          changes.push({ path, type: 'deleted' });
        }
      }

      return changes;
    };

    const changes = detectChanges();

    if (changes.length > 0) {
      console.log('🔥 Hot Reload: Changements détectés:', changes.length);
      
      // Classifier le type de changement
      const hasCSSOnly = changes.every(c => c.path.endsWith('.css'));
      const hasHTML = changes.some(c => c.path.endsWith('.html'));
      const hasJS = changes.some(c => c.path.endsWith('.js') || c.path.endsWith('.jsx') || c.path.endsWith('.ts') || c.path.endsWith('.tsx'));

      let updateType: 'css' | 'html' | 'full' = 'full';

      if (hasCSSOnly) {
        updateType = 'css';
        console.log('🎨 Hot Reload: CSS uniquement');
      } else if (hasHTML && !hasJS) {
        updateType = 'html';
        console.log('📄 Hot Reload: HTML uniquement');
      } else {
        updateType = 'full';
        console.log('🔄 Hot Reload: Rechargement complet requis');
      }

      setIsUpdating(true);
      setLastUpdateType(updateType);
      options.onUpdate?.(updateType, changes[0]?.path);

      // Animation de feedback
      setTimeout(() => {
        setIsUpdating(false);
        setLastUpdateType(null);
      }, 300);
    }

    // Mettre à jour la référence
    previousFilesRef.current = { ...projectFiles };
  }, [projectFiles]);

  return {
    isUpdating,
    lastUpdateType,
  };
}
