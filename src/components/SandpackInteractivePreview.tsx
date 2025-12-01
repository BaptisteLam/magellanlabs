import { useRef, useState, useEffect, useMemo } from 'react';
import { SandpackProvider, SandpackLayout, SandpackPreview, useSandpack } from '@codesandbox/sandpack-react';
import { generate404Page } from '@/lib/generate404Page';
import { type ElementInfo } from './InspectOverlay';
import { usePreviewNavigation } from '@/hooks/usePreviewNavigation';
import { injectInspectorScript } from '@/lib/inspectorInjector';

interface SandpackInteractivePreviewProps {
  files: Record<string, string>;
  isDark: boolean;
  inspectMode?: boolean;
  onElementSelect?: (elementInfo: ElementInfo) => void;
}

function SandpackController({ 
  inspectMode, 
  onElementSelect,
  onNavigationRequest
}: { 
  inspectMode: boolean; 
  onElementSelect?: (elementInfo: ElementInfo) => void;
  onNavigationRequest: (file: string) => void;
}) {
  const { sandpack } = useSandpack();
  const [iframeReady, setIframeReady] = useState(false);

  // Écouter les messages de l'iframe (inspect-ready, element-selected, navigate)
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'inspect-ready') {
        console.log('📡 Iframe inspector ready');
        setIframeReady(true);
      }
      
      if (event.data.type === 'element-selected' && onElementSelect) {
        console.log('✅ Element selected:', event.data.data);
        onElementSelect(event.data.data);
      }

      if (event.data.type === 'navigate') {
        const targetFile = event.data.file;
        console.log('📨 Navigation request:', targetFile);
        onNavigationRequest(targetFile);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onElementSelect, onNavigationRequest]);

  // Envoyer le toggle-inspect à l'iframe quand le mode change
  useEffect(() => {
    if (!iframeReady) return;

    const client = Object.values(sandpack.clients)[0];
    const iframe = client?.iframe;

    if (iframe?.contentWindow) {
      console.log('🔄 Sending toggle-inspect:', inspectMode);
      iframe.contentWindow.postMessage(
        { type: 'toggle-inspect', enabled: inspectMode },
        '*'
      );
    }
  }, [inspectMode, iframeReady, sandpack.clients]);

  return null;
}

export function SandpackInteractivePreview({ files, isDark, inspectMode = false, onElementSelect }: SandpackInteractivePreviewProps) {
  const navigation = usePreviewNavigation('App.tsx');
  const [show404, setShow404] = useState(false);

  // Injecter le script d'inspection dans les fichiers avant de les passer à Sandpack
  const filesWithInspector = useMemo(() => {
    console.log('🔧 Injecting inspector script into files...');
    return injectInspectorScript(files);
  }, [files]);

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
    ...filesWithInspector,
    '/App.tsx': `
import { generate404Page } from './lib/generate404Page';

export default function App() {
  return (
    <div dangerouslySetInnerHTML={{ __html: \`${generate404Page(isDark).replace(/`/g, '\\`')}\` }} />
  );
}
    `
  } : filesWithInspector;

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
          onNavigationRequest={handleNavigationRequest}
        />
      </div>
    </SandpackProvider>
  );
}
