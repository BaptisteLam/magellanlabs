import { useMemo, useRef } from 'react';

export interface ElementInfo {
  tagName: string;
  textContent: string;
  classList: string[];
  path: string;
  innerHTML: string;
  id?: string;
}

interface InteractivePreviewProps {
  projectFiles: Record<string, string>;
  isDark?: boolean;
  inspectMode?: boolean;
  onInspectModeChange?: (mode: boolean) => void;
  onElementModify?: (prompt: string, elementInfo: any) => void;
}

export function InteractivePreview({ 
  projectFiles,
  isDark = false,
  inspectMode = false
}: InteractivePreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const htmlContent = useMemo(() => {
    console.log('🔄 Building preview from files:', Object.keys(projectFiles));
    
    // Vérifier si c'est un projet HTML pur
    const isHtmlProject = projectFiles['index.html'] && 
      !Object.keys(projectFiles).some(p => p.endsWith('.tsx') || p.endsWith('.jsx'));
    
    if (isHtmlProject) {
      console.log('📄 HTML Project detected');
      return projectFiles['index.html'];
    }
    
    // Projet React - construire le HTML
    const appTsx = projectFiles['src/App.tsx'] || projectFiles['App.tsx'];
    const mainTsx = projectFiles['src/main.tsx'] || projectFiles['main.tsx'];
    const indexCss = projectFiles['src/index.css'] || projectFiles['index.css'] || '';
    
    // Collecter tous les composants
    const components: Record<string, string> = {};
    for (const [path, content] of Object.entries(projectFiles)) {
      if (path.includes('components/') && (path.endsWith('.tsx') || path.endsWith('.jsx'))) {
        const componentName = path.split('/').pop()?.replace(/\.(tsx|jsx)$/, '') || '';
        components[componentName] = content;
      }
    }
    
    if (!appTsx) {
      console.error('❌ No App.tsx found');
      return `<html><body style="padding: 20px; font-family: system-ui;">
        <h2>❌ Aucun fichier App.tsx trouvé</h2>
        <p>Fichiers disponibles :</p>
        <ul>${Object.keys(projectFiles).map(k => `<li>${k}</li>`).join('')}</ul>
      </body></html>`;
    }
    
    console.log('⚛️ React Project detected, building HTML...');
    
    // Nettoyer les imports pour les composants
    let processedApp = appTsx;
    
    // Remplacer les imports de composants par le code inline
    for (const [name, code] of Object.entries(components)) {
      const importRegex = new RegExp(
        `import\\s+(?:{[^}]+}|\\w+)\\s+from\\s+['"]\\.\\/components\\/${name}['"];?`,
        'g'
      );
      processedApp = processedApp.replace(importRegex, '');
      
      // Injecter le code du composant avant App
      const componentCode = code
        .replace(/import.*from.*;/g, '') // Retirer les imports
        .replace(/export\s+default\s+/g, '') // Retirer export default
        .replace(/export\s+/g, ''); // Retirer export
      
      processedApp = componentCode + '\n\n' + processedApp;
    }
    
    // Retirer les imports React (déjà disponibles globalement)
    processedApp = processedApp.replace(/import\s+React.*from\s+['"]react['"];?/g, '');
    processedApp = processedApp.replace(/import\s+{[^}]+}\s+from\s+['"]react['"];?/g, '');
    
    // Remplacer lucide-react par lucide global
    processedApp = processedApp.replace(/import\s*{([^}]+)}\s*from\s*['"]lucide-react['"];?/g, (match, icons) => {
      const iconList = icons.split(',').map((i: string) => i.trim());
      return iconList.map((icon: string) => `const ${icon} = window.lucide.${icon};`).join('\n');
    });
    
    return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Preview</title>
  
  <!-- Tailwind CSS -->
  <script src="https://cdn.tailwindcss.com"></script>
  
  <!-- React -->
  <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
  <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
  
  <!-- Lucide Icons -->
  <script src="https://unpkg.com/lucide@latest"></script>
  
  <!-- Babel Standalone -->
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    ${indexCss}
  </style>
</head>
<body>
  <div id="root"></div>
  
  <script>
    // Initialiser Lucide
    if (window.lucide) {
      window.lucide.createIcons();
    }
  </script>
  
  <script type="text/babel">
    ${processedApp}
    
    // Rendre l'app
    const root = ReactDOM.createRoot(document.getElementById('root'));
    root.render(React.createElement(App));
  </script>
</body>
</html>`;
  }, [projectFiles]);

  return (
    <div className="w-full h-full relative">
      <iframe
        ref={iframeRef}
        srcDoc={htmlContent}
        className="w-full h-full border-0"
        sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
        title="Preview"
        style={{ backgroundColor: isDark ? '#1a1a1a' : '#ffffff' }}
      />
    </div>
  );
}
