import { useEffect, useRef, useState } from 'react';
import { SandpackProvider, SandpackLayout, SandpackPreview, useSandpack } from '@codesandbox/sandpack-react';
import { HotReloadIndicator } from './HotReloadIndicator';

interface SandpackHotReloadProps {
  files: Record<string, string>;
  isDark: boolean;
}

function SandpackController({ files }: { files: Record<string, string> }) {
  const { sandpack } = useSandpack();
  const previousFilesRef = useRef<Record<string, string>>({});
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateType, setUpdateType] = useState<'css' | 'html' | 'full' | null>(null);

  useEffect(() => {
    const detectChanges = () => {
      const changes: Array<{ path: string; type: 'modified' | 'added' | 'deleted' }> = [];
      const previous = previousFilesRef.current;

      // Détecter modifications et ajouts
      for (const [path, content] of Object.entries(files)) {
        if (!previous[path]) {
          changes.push({ path, type: 'added' });
        } else if (previous[path] !== content) {
          changes.push({ path, type: 'modified' });
        }
      }

      // Détecter suppressions
      for (const path of Object.keys(previous)) {
        if (!files[path]) {
          changes.push({ path, type: 'deleted' });
        }
      }

      return changes;
    };

    const changes = detectChanges();

    if (changes.length > 0 && Object.keys(previousFilesRef.current).length > 0) {
      console.log('🔥 Sandpack Hot Reload:', changes.length, 'changements');

      // Classifier le type
      const hasCSSOnly = changes.every(c => c.path.endsWith('.css') || c.path.endsWith('.scss'));

      let type: 'css' | 'full' = hasCSSOnly ? 'css' : 'full';
      setUpdateType(type);
      setIsUpdating(true);

      // Utiliser l'API Sandpack updateFile pour HMR
      try {
        for (const change of changes) {
          if (change.type === 'modified' || change.type === 'added') {
            sandpack.updateFile(change.path, files[change.path] || '');
            console.log(`✅ Hot reload: ${change.path}`);
          } else if (change.type === 'deleted') {
            sandpack.deleteFile(change.path);
            console.log(`🗑️ Fichier supprimé: ${change.path}`);
          }
        }
      } catch (error) {
        console.error('Erreur hot reload:', error);
      }

      // Animation de feedback
      setTimeout(() => {
        setIsUpdating(false);
        setUpdateType(null);
      }, 300);
    }

    previousFilesRef.current = { ...files };
  }, [files, sandpack]);

  return <HotReloadIndicator isUpdating={isUpdating} updateType={updateType} />;
}

export function SandpackHotReload({ files, isDark }: SandpackHotReloadProps) {
  return (
    <SandpackProvider
      template="react-ts"
      files={files}
      theme={isDark ? 'dark' : 'light'}
      options={{
        autoReload: false,
        recompileMode: 'delayed',
        recompileDelay: 300,
      }}
    >
      <div className="h-full w-full relative">
        <SandpackController files={files} />
        <SandpackLayout>
          <SandpackPreview 
            showNavigator={false}
            showOpenInCodeSandbox={false}
            showRefreshButton={false}
          />
        </SandpackLayout>
      </div>
    </SandpackProvider>
  );
}
