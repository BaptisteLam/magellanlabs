import { Sandpack } from '@codesandbox/sandpack-react';
import { useMemo } from 'react';
import { GeneratingPreview } from './GeneratingPreview';

interface SandpackPreviewProps {
  projectFiles: Record<string, string> | Record<string, { code: string }>;
  isDark?: boolean;
  showEditor?: boolean;
}

export function SandpackPreview({ 
  projectFiles, 
  isDark = false,
  showEditor = false 
}: SandpackPreviewProps) {
  
  // Détecter le type de projet
  const isReactProject = useMemo(() => {
    return Object.keys(projectFiles).some(path => 
      path.includes('App.tsx') || 
      path.includes('App.jsx') || 
      path.includes('main.tsx') || 
      path.includes('main.jsx') ||
      path.includes('package.json')
    );
  }, [projectFiles]);

  // Transformer les fichiers pour Sandpack
  const sandpackFiles = useMemo(() => {
    if (!projectFiles || Object.keys(projectFiles).length === 0) {
      return {};
    }

    const files: Record<string, string> = {};
    
    // Convertir les chemins et contenus
    Object.entries(projectFiles).forEach(([path, content]) => {
      // Normaliser le chemin: ajouter / au début si absent
      let normalizedPath = path.startsWith('/') ? path : `/${path}`;
      
      // Extraire le code si c'est un objet { code: string }
      const fileContent = typeof content === 'string' ? content : content.code;
      
      files[normalizedPath] = fileContent;
    });

    // Ajouter tailwind.config.js si absent
    if (!files['/tailwind.config.js'] && !files['tailwind.config.js']) {
      files['/tailwind.config.js'] = `/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}`;
    }

    // Ajouter postcss.config.js si absent
    if (!files['/postcss.config.js'] && !files['postcss.config.js']) {
      files['/postcss.config.js'] = `export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}`;
    }

    // S'assurer que index.css contient les directives Tailwind
    const indexCssPath = files['/src/index.css'] ? '/src/index.css' : 
                        files['/index.css'] ? '/index.css' : null;
    
    if (indexCssPath && !files[indexCssPath].includes('@tailwind')) {
      files[indexCssPath] = `@tailwind base;
@tailwind components;
@tailwind utilities;

${files[indexCssPath]}`;
    } else if (!indexCssPath) {
      files['/src/index.css'] = `@tailwind base;
@tailwind components;
@tailwind utilities;`;
    }

    // Pour React, s'assurer qu'on a un index.html
    if (isReactProject && !files['/index.html'] && !files['/public/index.html']) {
      files['/index.html'] = `<!DOCTYPE html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>React App</title>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`;
    }

    // Pour HTML statique
    if (!isReactProject && !files['/index.html']) {
      const htmlFiles = Object.entries(projectFiles).filter(([path]) => path.endsWith('.html'));
      if (htmlFiles.length > 0) {
        const htmlContent = typeof htmlFiles[0][1] === 'string' ? htmlFiles[0][1] : htmlFiles[0][1].code;
        files['/index.html'] = htmlContent;
      }
    }

    return files;
  }, [projectFiles, isReactProject]);

  // Déterminer le fichier d'entrée
  const entryFile = useMemo(() => {
    const fileKeys = Object.keys(sandpackFiles);
    
    if (isReactProject) {
      const reactEntries = [
        '/src/main.tsx',
        '/src/index.tsx', 
        '/main.tsx',
        '/index.tsx',
        '/src/App.tsx',
        '/App.tsx'
      ];
      
      for (const entry of reactEntries) {
        if (fileKeys.includes(entry)) {
          return entry;
        }
      }
      
      const srcEntry = fileKeys.find(key => 
        key.startsWith('/src/') && (key.endsWith('.tsx') || key.endsWith('.jsx'))
      );
      if (srcEntry) return srcEntry;
    } else {
      if (fileKeys.includes('/index.html')) {
        return '/index.html';
      }
    }
    
    return fileKeys[0] || '/index.html';
  }, [sandpackFiles, isReactProject]);

  if (!projectFiles || Object.keys(projectFiles).length === 0) {
    return <GeneratingPreview />;
  }

  return (
    <div className="w-full h-full overflow-hidden sandpack-wrapper rounded-xl">
      <Sandpack
        key={JSON.stringify(sandpackFiles)}
        files={sandpackFiles}
        template={isReactProject ? "react-ts" : "static"}
        theme={isDark ? "dark" : "light"}
        options={{
          showNavigator: false,
          showTabs: showEditor,
          showLineNumbers: showEditor,
          editorHeight: "100%",
          editorWidthPercentage: showEditor ? 50 : 0,
          showConsole: false,
          showConsoleButton: false,
          closableTabs: false,
          activeFile: entryFile,
          visibleFiles: showEditor ? Object.keys(sandpackFiles) : [],
          showRefreshButton: false,
          autoReload: true,
          recompileMode: 'immediate',
        }}
        customSetup={isReactProject ? {
          dependencies: {
            "react": "^18.3.1",
            "react-dom": "^18.3.1",
            "tailwindcss": "^3.4.0",
            "autoprefixer": "^10.4.16",
            "postcss": "^8.4.32"
          }
        } : undefined}
      />
    </div>
  );
}
