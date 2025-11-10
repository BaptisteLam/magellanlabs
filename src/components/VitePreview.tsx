import { Sandpack } from '@codesandbox/sandpack-react';
import { useMemo } from 'react';
import { GeneratingPreview } from './GeneratingPreview';

interface VitePreviewProps {
  projectFiles: Record<string, string>;
  isDark?: boolean;
  onConsoleLog?: (log: { level: 'log' | 'error' | 'warn'; message: string }) => void;
}

export function VitePreview({ projectFiles, isDark = false, onConsoleLog }: VitePreviewProps) {
  // Vérifier si c'est un projet HTML pur ou React
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
      console.log('📦 VitePreview - Aucun fichier');
      return {};
    }

    console.log('📦 VitePreview - Fichiers reçus:', Object.keys(projectFiles));
    console.log('📦 VitePreview - Total:', Object.keys(projectFiles).length, 'fichiers');

    const files: Record<string, string> = {};
    
    // Convertir les chemins et contenus
    Object.entries(projectFiles).forEach(([path, content]) => {
      // Normaliser les chemins pour Sandpack (toujours commencer par /)
      let normalizedPath = path.startsWith('/') ? path : `/${path}`;
      files[normalizedPath] = content;
      console.log(`📄 Ajout fichier: ${normalizedPath} (${content.length} chars)`);
    });

    console.log('📦 VitePreview - Fichiers normalisés:', Object.keys(files));

    // Si pas de fichier d'entrée ET pas de projet React, créer un index.html basique
    if (!files['/index.html'] && !isReactProject) {
      console.log('⚠️ Aucun index.html trouvé, création d\'un fallback');
      const content = Object.values(projectFiles).join('\n');
      files['/index.html'] = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Preview</title>
  <style>
    @import url('https://cdn.jsdelivr.net/npm/tailwindcss@3.4.1/dist/tailwind.min.css');
  </style>
</head>
<body>
  ${content}
</body>
</html>`;
    }

    return files;
  }, [projectFiles, isReactProject]);

  // Déterminer le fichier d'entrée principal
  const entryFile = useMemo(() => {
    const fileKeys = Object.keys(sandpackFiles);
    
    if (isReactProject) {
      // Pour React, chercher dans l'ordre : index.tsx, main.tsx, App.tsx, index.jsx, main.jsx, App.jsx
      const reactEntries = [
        '/index.tsx', '/src/index.tsx',
        '/main.tsx', '/src/main.tsx',
        '/App.tsx', '/src/App.tsx',
        '/index.jsx', '/src/index.jsx',
        '/main.jsx', '/src/main.jsx',
        '/App.jsx', '/src/App.jsx'
      ];
      
      for (const entry of reactEntries) {
        if (fileKeys.includes(entry)) {
          console.log('🎯 Point d\'entrée React trouvé:', entry);
          return entry;
        }
      }
    } else {
      // Pour HTML statique, chercher index.html
      if (fileKeys.includes('/index.html')) {
        console.log('🎯 Point d\'entrée HTML trouvé: /index.html');
        return '/index.html';
      }
    }
    
    // Fallback sur le premier fichier
    const fallback = fileKeys[0] || '/index.html';
    console.log('⚠️ Aucun point d\'entrée standard, utilisation de:', fallback);
    return fallback;
  }, [sandpackFiles, isReactProject]);

  if (!projectFiles || Object.keys(projectFiles).length === 0) {
    return <GeneratingPreview />;
  }

  console.log('🎨 VitePreview - Rendu Sandpack avec', Object.keys(sandpackFiles).length, 'fichiers');
  console.log('🎨 VitePreview - Type de projet:', isReactProject ? 'React' : 'HTML');
  console.log('🎨 VitePreview - Point d\'entrée:', entryFile);

  return (
    <div className="w-full h-full overflow-hidden sandpack-wrapper rounded-xl">
      <Sandpack
        key={JSON.stringify(sandpackFiles)} // Force reload on file changes
        files={sandpackFiles}
        template={isReactProject ? "react-ts" : "static"}
        theme={isDark ? "dark" : "light"}
        options={{
          showNavigator: false,
          showTabs: false,
          showLineNumbers: false,
          editorHeight: "100%",
          editorWidthPercentage: 0,
          showConsole: false,
          showConsoleButton: false,
          closableTabs: false,
          activeFile: entryFile,
          visibleFiles: [],
          showRefreshButton: false,
          autoReload: true,
          recompileMode: 'immediate',
        }}
        customSetup={isReactProject ? {
          dependencies: {
            "react": "^18.3.1",
            "react-dom": "^18.3.1",
          }
        } : undefined}
      />
    </div>
  );
}

