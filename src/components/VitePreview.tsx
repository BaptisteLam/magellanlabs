import { Sandpack } from '@codesandbox/sandpack-react';
import { useMemo } from 'react';

interface VitePreviewProps {
  projectFiles: Record<string, string>;
  isDark?: boolean;
}

export function VitePreview({ projectFiles, isDark = false }: VitePreviewProps) {
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
      // Normaliser les chemins pour Sandpack
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
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body>
  ${content}
</body>
</html>`;
    }

    return files;
  }, [projectFiles, isReactProject]);

  if (!projectFiles || Object.keys(projectFiles).length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-muted">
        <p className="text-muted-foreground">En attente de génération...</p>
      </div>
    );
  }

  console.log('🎨 VitePreview - Rendu Sandpack avec', Object.keys(sandpackFiles).length, 'fichiers');
  console.log('🎨 VitePreview - Type de projet:', isReactProject ? 'React' : 'HTML');

  return (
    <div className="w-full h-full overflow-hidden sandpack-wrapper rounded-xl">
      <Sandpack
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
          activeFile: Object.keys(sandpackFiles)[0],
          visibleFiles: [],
          showRefreshButton: false,
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

