import { useRef, useState, useEffect } from 'react';
import { SandpackProvider, SandpackLayout, SandpackPreview, useSandpack } from '@codesandbox/sandpack-react';
import { generate404Page } from '@/lib/generate404Page';
import { InspectOverlay, type ElementInfo } from './InspectOverlay';

interface SandpackInteractivePreviewProps {
  files: Record<string, string>;
  isDark: boolean;
  inspectMode?: boolean;
  onElementSelect?: (elementInfo: ElementInfo) => void;
}

function SandpackController({ inspectMode, onElementSelect }: { inspectMode: boolean; onElementSelect?: (elementInfo: ElementInfo) => void }) {
  const { sandpack } = useSandpack();
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  // Récupérer la référence de l'iframe Sandpack
  useEffect(() => {
    const iframe = sandpack.clients.main?.iframe;
    if (iframe) {
      iframeRef.current = iframe;
    }
  }, [sandpack.clients]);

  return (
    <InspectOverlay 
      isActive={inspectMode} 
      iframeRef={iframeRef} 
      onElementSelect={onElementSelect} 
    />
  );
}

export function SandpackInteractivePreview({ files, isDark, inspectMode = false, onElementSelect }: SandpackInteractivePreviewProps) {
  const [currentFile, setCurrentFile] = useState<string>('App.tsx');
  const [navigationHistory, setNavigationHistory] = useState<string[]>(['App.tsx']);
  const [navigationIndex, setNavigationIndex] = useState(0);

  // Handler pour les messages de navigation depuis l'iframe
  useEffect(() => {
    const handleNavigationMessage = (event: MessageEvent) => {
      if (event.data.type === 'navigate') {
        const targetFile = event.data.file;
        console.log('📨 Message navigate reçu:', targetFile);
        
        // Vérifier si le fichier existe
        const fileExists = files[targetFile] || files[`/${targetFile}`] || files[`./${targetFile}`];
        
        if (fileExists) {
          console.log('✅ Fichier trouvé, navigation vers:', targetFile);
          setCurrentFile(targetFile);
          
          // Mettre à jour l'historique
          const newHistory = navigationHistory.slice(0, navigationIndex + 1);
          newHistory.push(targetFile);
          setNavigationHistory(newHistory);
          setNavigationIndex(newHistory.length - 1);
        } else {
          console.log('❌ Fichier introuvable:', targetFile, '- Affichage page 404');
          setCurrentFile('__404__');
        }
      }
    };

    window.addEventListener('message', handleNavigationMessage);
    return () => window.removeEventListener('message', handleNavigationMessage);
  }, [files, navigationHistory, navigationIndex]);

  // Générer les fichiers avec page 404 si nécessaire
  const filesWithNotFound = {
    ...files,
    ...(currentFile === '__404__' && {
      '/404.html': generate404Page(isDark)
    })
  };

  return (
    <SandpackProvider
      template="react-ts"
      files={filesWithNotFound}
      theme={isDark ? 'dark' : 'light'}
      options={{
        autoReload: true,
        recompileMode: 'delayed',
        recompileDelay: 300,
      }}
    >
      <div className="h-full w-full relative">
        <SandpackLayout>
          <SandpackPreview 
            showNavigator={false}
            showOpenInCodeSandbox={false}
            showRefreshButton={false}
            style={{ height: '100%' }}
          />
        </SandpackLayout>
        <SandpackController inspectMode={inspectMode} onElementSelect={onElementSelect} />
      </div>
    </SandpackProvider>
  );
}
