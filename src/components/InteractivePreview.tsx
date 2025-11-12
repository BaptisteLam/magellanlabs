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
    console.log('=== PREVIEW DEBUG ===');
    console.log('📂 Files:', Object.keys(projectFiles));
    
    // Vérifier si HTML pur
    const isHtmlProject = projectFiles['index.html'] && 
      !Object.keys(projectFiles).some(p => p.endsWith('.tsx') || p.endsWith('.jsx'));
    
    console.log('🎯 isHtmlProject:', isHtmlProject);
    
    if (isHtmlProject) {
      const html = projectFiles['index.html'];
      console.log('✅ Returning HTML project, length:', html.length);
      console.log('📄 HTML preview (first 200 chars):', html.substring(0, 200));
      return html;
    }
    
    // Projet React
    const appTsx = projectFiles['src/App.tsx'] || projectFiles['App.tsx'];
    const indexCss = projectFiles['src/index.css'] || projectFiles['index.css'] || '';
    
    console.log('⚛️ App.tsx found:', !!appTsx);
    console.log('🎨 CSS found:', !!indexCss);
    
    if (!appTsx) {
      console.error('❌ NO APP.TSX FOUND!');
      return `<html><body style="padding: 20px; font-family: system-ui; background: white; color: black;">
        <h2>❌ Erreur : Aucun App.tsx</h2>
        <p><strong>Fichiers disponibles :</strong></p>
        <ul>${Object.keys(projectFiles).map(k => `<li>${k}</li>`).join('')}</ul>
      </body></html>`;
    }
    
    console.log('📝 App.tsx preview (first 300 chars):', appTsx.substring(0, 300));
    
    // Process App.tsx
    let processedApp = appTsx;
    
    // 1. Retirer imports React
    processedApp = processedApp.replace(/import\s+React[^;]*;?/g, '');
    processedApp = processedApp.replace(/import\s*{[^}]*}\s*from\s*['"]react['"];?/g, '');
    
    // 2. Remplacer lucide-react
    const lucideImportMatch = processedApp.match(/import\s*{([^}]+)}\s*from\s*['"]lucide-react['"];?/);
    if (lucideImportMatch) {
      const icons = lucideImportMatch[1].split(',').map(i => i.trim());
      console.log('🎨 Lucide icons:', icons);
      
      const iconDeclarations = icons.map(icon => `const ${icon} = window.lucide?.${icon} || (() => null);`).join('\n');
      processedApp = processedApp.replace(/import\s*{[^}]+}\s*from\s*['"]lucide-react['"];?/, iconDeclarations);
    }
    
    // 3. Retirer imports de composants
    processedApp = processedApp.replace(/import\s+[^;]*from\s*['"]\.\/components\/[^'"]*['"];?/g, '');
    
    console.log('✅ Processed App.tsx (first 300 chars):', processedApp.substring(0, 300));
    
    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Preview</title>
  
  <!-- Tailwind -->
  <script src="https://cdn.tailwindcss.com"></script>
  
  <!-- React -->
  <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
  <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
  
  <!-- Lucide -->
  <script src="https://unpkg.com/lucide@latest"></script>
  
  <!-- Babel -->
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: system-ui; }
    ${indexCss}
  </style>
</head>
<body>
  <div id="root"></div>
  
  <script>
    console.log('🔧 Iframe loaded');
    console.log('✅ React:', typeof React !== 'undefined');
    console.log('✅ ReactDOM:', typeof ReactDOM !== 'undefined');
    console.log('✅ Babel:', typeof Babel !== 'undefined');
    console.log('✅ Lucide:', typeof lucide !== 'undefined');
    
    // Initialiser Lucide
    if (window.lucide) {
      lucide.createIcons();
    }
  </script>
  
  <script type="text/babel">
    console.log('🎯 Babel script executing...');
    
    try {
      ${processedApp}
      
      console.log('✅ App component defined:', typeof App !== 'undefined');
      
      if (typeof App === 'undefined') {
        throw new Error('App component not found after transpilation');
      }
      
      const root = ReactDOM.createRoot(document.getElementById('root'));
      root.render(React.createElement(App));
      
      console.log('✅ App rendered successfully');
    } catch (error) {
      console.error('❌ Render error:', error);
      document.getElementById('root').innerHTML = 
        '<div style="padding: 20px; background: #fee; color: #c00; font-family: monospace;">' +
        '<h2>❌ Erreur de Rendu</h2>' +
        '<pre>' + error.toString() + '</pre>' +
        '<pre>' + (error.stack || '') + '</pre>' +
        '</div>';
    }
  </script>
</body>
</html>`;
    
    console.log('📦 Final HTML length:', html.length);
    return html;
    
  }, [projectFiles]);

  console.log('🔄 Rendering iframe with HTML length:', htmlContent.length);

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
