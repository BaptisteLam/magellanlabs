import { useRef, useState, useEffect } from 'react';
import { SandpackProvider, SandpackLayout, SandpackPreview, useSandpack } from '@codesandbox/sandpack-react';
import { generate404Page } from '@/lib/generate404Page';
import { InspectOverlay, type ElementInfo } from './InspectOverlay';
import { usePreviewNavigation } from '@/hooks/usePreviewNavigation';

interface SandpackInteractivePreviewProps {
  files: Record<string, string>;
  isDark: boolean;
  inspectMode?: boolean;
  onElementSelect?: (elementInfo: ElementInfo) => void;
}

function SandpackController({ 
  inspectMode, 
  onElementSelect,
  files,
  onNavigationRequest
}: { 
  inspectMode: boolean; 
  onElementSelect?: (elementInfo: ElementInfo) => void;
  files: Record<string, string>;
  onNavigationRequest: (file: string) => void;
}) {
  const { sandpack } = useSandpack();
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    const iframe = sandpack.clients.main?.iframe;
    if (iframe) {
      iframeRef.current = iframe;
    }
  }, [sandpack.clients]);

  // Intercepter les tentatives de navigation depuis l'iframe
  useEffect(() => {
    const handleNavigationMessage = (event: MessageEvent) => {
      if (event.data.type === 'navigate') {
        const targetFile = event.data.file;
        console.log('📨 Navigation request:', targetFile);
        onNavigationRequest(targetFile);
      }
    };

    window.addEventListener('message', handleNavigationMessage);
    return () => window.removeEventListener('message', handleNavigationMessage);
  }, [onNavigationRequest]);

  return (
    <InspectOverlay 
      isActive={inspectMode} 
      iframeRef={iframeRef} 
      onElementSelect={onElementSelect} 
    />
  );
}

export function SandpackInteractivePreview({ files, isDark, inspectMode = false, onElementSelect }: SandpackInteractivePreviewProps) {
  const navigation = usePreviewNavigation('App.tsx');
  const [show404, setShow404] = useState(false);

  const handleNavigationRequest = (targetFile: string) => {
    console.log('🔍 Checking file existence:', targetFile);
    
    // Vérifier si le fichier existe (avec plusieurs formats possibles)
    const fileExists = files[targetFile] || 
                      files[`/${targetFile}`] || 
                      files[`./${targetFile}`] ||
                      Object.keys(files).some(path => path.endsWith(targetFile));
    
    if (fileExists) {
      console.log('✅ File found:', targetFile);
      setShow404(false);
      navigation.navigateTo(targetFile);
    } else {
      console.log('❌ File not found - showing 404');
      setShow404(true);
      navigation.show404();
    }
  };

  // Préparer les fichiers avec 404 si nécessaire
  const filesWithNotFound = show404 ? {
    ...files,
    '/App.tsx': `
import { generate404Page } from './lib/generate404Page';

export default function App() {
  return (
    <div dangerouslySetInnerHTML={{ __html: \`${generate404Page(isDark).replace(/`/g, '\\`')}\` }} />
  );
}
    `
  } : files;

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
        <SandpackController 
          inspectMode={inspectMode} 
          onElementSelect={onElementSelect}
          files={files}
          onNavigationRequest={handleNavigationRequest}
        />
      </div>
    </SandpackProvider>
  );
}
