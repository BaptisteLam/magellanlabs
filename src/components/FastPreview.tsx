import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';

interface FastPreviewProps {
  projectFiles: Record<string, string> | Record<string, { code: string }>;
  isDark?: boolean;
  inspectMode?: boolean;
  onElementSelect?: (elementInfo: any) => void;
}

export function FastPreview({ 
  projectFiles, 
  isDark = false,
  inspectMode = false,
  onElementSelect 
}: FastPreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Detect framework and extract code
  const { code, framework, entry } = extractCodeFromFiles(projectFiles);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const { type, message, element } = event.data;

      if (type === 'ready') {
        setIsLoading(false);
      } else if (type === 'error') {
        setError(message);
        setIsLoading(false);
      } else if (type === 'compiled') {
        setIsLoading(false);
        setError(null);
      } else if (type === 'clickElement' && onElementSelect) {
        onElementSelect(element);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onElementSelect]);

  // Send code to iframe when it changes
  useEffect(() => {
    if (!iframeRef.current?.contentWindow || !code) return;

    setIsLoading(true);
    setError(null);

    // Wait a bit for iframe to be ready
    const timer = setTimeout(() => {
      iframeRef.current?.contentWindow?.postMessage({
        type: 'compile',
        data: { code, framework, entry }
      }, '*');
    }, 100);

    return () => clearTimeout(timer);
  }, [code, framework, entry]);

  // Send inspect mode changes
  useEffect(() => {
    if (!iframeRef.current?.contentWindow) return;

    iframeRef.current.contentWindow.postMessage({
      type: 'inspectMode',
      data: { enabled: inspectMode }
    }, '*');
  }, [inspectMode]);

  return (
    <div className="relative w-full h-full">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm z-10">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Building preview...</p>
          </div>
        </div>
      )}
      
      {error && (
        <div className="absolute top-4 left-4 right-4 p-4 bg-destructive/10 border border-destructive rounded-lg z-10">
          <p className="text-sm text-destructive font-mono">{error}</p>
        </div>
      )}

      <iframe
        ref={iframeRef}
        src="/preview-runtime.html"
        className="w-full h-full border-0"
        sandbox="allow-scripts allow-same-origin"
        title="Preview"
      />
    </div>
  );
}

function extractCodeFromFiles(
  projectFiles: Record<string, string> | Record<string, { code: string }>
): { code: string; framework: 'react' | 'vue' | 'svelte'; entry: string } {
  // Normalize files to string format
  const files: Record<string, string> = {};
  for (const [path, content] of Object.entries(projectFiles)) {
    files[path] = typeof content === 'string' ? content : content.code;
  }

  // Detect framework
  let framework: 'react' | 'vue' | 'svelte' = 'react';
  let entry = 'App.jsx';
  let code = '';

  // Find main component file - check both with and without leading slash
  const possibleEntries = [
    'src/App.tsx',
    '/src/App.tsx',
    'src/App.jsx',
    '/src/App.jsx',
    'App.tsx',
    '/App.tsx',
    'App.jsx',
    '/App.jsx',
    'src/App.vue',
    '/src/App.vue',
    'App.vue',
    '/App.vue',
    'src/App.svelte',
    '/src/App.svelte',
    'App.svelte',
    '/App.svelte',
  ];

  for (const path of possibleEntries) {
    if (files[path]) {
      entry = path.split('/').pop() || 'App.jsx';
      code = files[path];
      
      console.log('🎯 FastPreview: Found entry file:', path);
      
      if (path.endsWith('.vue')) {
        framework = 'vue';
      } else if (path.endsWith('.svelte')) {
        framework = 'svelte';
      }
      break;
    }
  }

  // Log available files for debugging
  if (!code) {
    console.log('⚠️ FastPreview: No entry file found. Available files:', Object.keys(files));
  }

  // If no component found, try to find any React file
  if (!code) {
    const reactFile = Object.entries(files).find(([path]) => 
      path.endsWith('.tsx') || path.endsWith('.jsx')
    );
    if (reactFile) {
      code = reactFile[1];
      entry = reactFile[0].split('/').pop() || 'App.jsx';
    }
  }

  // Fallback: create a simple component
  if (!code) {
    code = `
      function App() {
        return (
          <div style={{ padding: '20px', textAlign: 'center' }}>
            <h1>No preview available</h1>
            <p>No valid component files found</p>
          </div>
        );
      }
      export default App;
    `;
  }

  // Ensure code has a default export
  if (!code.includes('export default')) {
    code += '\nexport default App;';
  }

  return { code, framework, entry };
}
