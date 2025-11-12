import { Sandpack } from '@codesandbox/sandpack-react';
import { useMemo } from 'react';
import { GeneratingPreview } from './GeneratingPreview';

interface VitePreviewProps {
  projectFiles: Record<string, string> | Record<string, { code: string }>;
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
    
    // Convertir les chemins et contenus - Sandpack préfère les chemins SANS / au début
    Object.entries(projectFiles).forEach(([path, content]) => {
      // Retirer le / du début si présent pour Sandpack
      let normalizedPath = path.startsWith('/') ? path.slice(1) : path;
      
      // Extraire le code si c'est un objet { code: string }
      const fileContent = typeof content === 'string' ? content : content.code;
      
      files[normalizedPath] = fileContent;
      console.log(`📄 Ajout fichier: ${normalizedPath} (${fileContent.length} chars)`);
    });

    console.log('📦 VitePreview - Fichiers normalisés:', Object.keys(files));

    // Pour les projets React, s'assurer qu'on a un index.html si nécessaire
    if (isReactProject && !files['index.html'] && !files['public/index.html']) {
      console.log('⚠️ Projet React sans index.html, création');
      files['public/index.html'] = `<!DOCTYPE html>
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
    if (!isReactProject && !files['index.html']) {
      console.log('⚠️ Projet HTML statique sans index.html');
      const htmlFiles = Object.entries(projectFiles).filter(([path]) => path.endsWith('.html'));
      if (htmlFiles.length > 0) {
        files['index.html'] = htmlFiles[0][1];
      }
    }

    return files;
  }, [projectFiles, isReactProject]);

  // Déterminer le fichier d'entrée principal
  const entryFile = useMemo(() => {
    const fileKeys = Object.keys(sandpackFiles);
    console.log('🔍 Recherche du point d\'entrée parmi:', fileKeys);
    
    if (isReactProject) {
      // Pour React, chercher dans l'ordre : main.tsx est le standard
      const reactEntries = [
        'src/main.tsx',
        'src/index.tsx', 
        'main.tsx',
        'index.tsx',
        'src/App.tsx',
        'App.tsx'
      ];
      
      for (const entry of reactEntries) {
        if (fileKeys.includes(entry)) {
          console.log('🎯 Point d\'entrée React trouvé:', entry);
          return entry;
        }
      }
      
      // Si pas trouvé, chercher n'importe quel .tsx/.jsx dans src/
      const srcEntry = fileKeys.find(key => 
        key.startsWith('src/') && (key.endsWith('.tsx') || key.endsWith('.jsx'))
      );
      if (srcEntry) {
        console.log('🎯 Point d\'entrée React alternatif:', srcEntry);
        return srcEntry;
      }
    } else {
      // Pour HTML statique
      if (fileKeys.includes('index.html')) {
        console.log('🎯 Point d\'entrée HTML trouvé: index.html');
        return 'index.html';
      }
    }
    
    // Dernier fallback
    const fallbackFile = fileKeys[0] || 'index.html';
    console.log('⚠️ Fallback sur:', fallbackFile);
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

