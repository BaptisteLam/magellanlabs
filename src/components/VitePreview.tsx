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
      // Pour Sandpack, ne PAS ajouter / au début si le chemin commence déjà par src/
      // Sandpack s'attend à des chemins comme "App.tsx", "src/App.tsx", etc.
      let normalizedPath = path;
      
      // Si le chemin ne commence ni par / ni par src/, on ajoute /
      if (!path.startsWith('/') && !path.startsWith('src/')) {
        normalizedPath = `/${path}`;
      }
      
      files[normalizedPath] = content;
      console.log(`📄 Ajout fichier: ${normalizedPath} (${content.length} chars)`);
    });

    console.log('📦 VitePreview - Fichiers normalisés:', Object.keys(files));

    // NE PAS créer de fallback pour les projets React - laisser Sandpack gérer
    if (!isReactProject && !files['/index.html'] && !files['index.html']) {
      console.log('⚠️ Projet HTML statique sans index.html, création d\'un fallback');
      // Pour HTML statique, combiner tous les fichiers HTML trouvés
      const htmlFiles = Object.entries(projectFiles).filter(([path]) => path.endsWith('.html'));
      if (htmlFiles.length > 0) {
        files['/index.html'] = htmlFiles[0][1];
      }
    }

    return files;
  }, [projectFiles, isReactProject]);

  // Déterminer le fichier d'entrée principal
  const entryFile = useMemo(() => {
    const fileKeys = Object.keys(sandpackFiles);
    
    if (isReactProject) {
      // Pour React, chercher dans l'ordre avec et sans / au début
      const reactEntries = [
        'src/main.tsx', '/src/main.tsx',
        'src/index.tsx', '/src/index.tsx',
        'main.tsx', '/main.tsx',
        'index.tsx', '/index.tsx',
        'src/App.tsx', '/src/App.tsx',
        'App.tsx', '/App.tsx',
        'src/main.jsx', '/src/main.jsx',
        'src/index.jsx', '/src/index.jsx',
        'main.jsx', '/main.jsx',
        'index.jsx', '/index.jsx',
        'src/App.jsx', '/src/App.jsx',
        'App.jsx', '/App.jsx'
      ];
      
      for (const entry of reactEntries) {
        if (fileKeys.includes(entry)) {
          console.log('🎯 Point d\'entrée React trouvé:', entry);
          return entry;
        }
      }
    } else {
      // Pour HTML statique, chercher index.html avec ou sans /
      const htmlEntries = ['/index.html', 'index.html'];
      for (const entry of htmlEntries) {
        if (fileKeys.includes(entry)) {
          console.log('🎯 Point d\'entrée HTML trouvé:', entry);
          return entry;
        }
      }
    }
    
    // Fallback: chercher n'importe quel fichier .tsx, .jsx, .html
    const fallbackFile = fileKeys.find(key => 
      key.endsWith('.tsx') || key.endsWith('.jsx') || key.endsWith('.html')
    ) || fileKeys[0];
    
    console.log('⚠️ Aucun point d\'entrée standard, utilisation de:', fallbackFile);
    return fallbackFile;
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

