import {
  SandpackProvider,
  SandpackLayout,
  SandpackCodeEditor,
  SandpackPreview as SandpackPreviewComponent,
} from '@codesandbox/sandpack-react';
import { githubLight } from '@codesandbox/sandpack-themes';
import { useMemo } from 'react';
import { GeneratingPreview } from './GeneratingPreview';
import './SandpackPreview.css';

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

  // Transformer les fichiers pour Sandpack avec format { code: string }
  const sandpackFiles = useMemo(() => {
    if (!projectFiles || Object.keys(projectFiles).length === 0) {
      return {};
    }

    const files: Record<string, { code: string }> = {};
    
    // Convertir les chemins et contenus
    Object.entries(projectFiles).forEach(([path, content]) => {
      // Normaliser le chemin: ajouter / au début si absent
      let normalizedPath = path.startsWith('/') ? path : `/${path}`;
      
      // Extraire le code si c'est un objet { code: string }
      const fileContent = typeof content === 'string' ? content : content.code;
      
      files[normalizedPath] = { code: fileContent };
    });

    // Ajouter tailwind.config.js si absent
    if (!files['/tailwind.config.js'] && !files['tailwind.config.js']) {
      files['/tailwind.config.js'] = { code: `/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}` };
    }

    // Ajouter postcss.config.js si absent
    if (!files['/postcss.config.js'] && !files['postcss.config.js']) {
      files['/postcss.config.js'] = { code: `export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}` };
    }

    // S'assurer que index.css contient les directives Tailwind
    const indexCssPath = files['/src/index.css'] ? '/src/index.css' : 
                        files['/index.css'] ? '/index.css' : null;
    
    if (indexCssPath && !files[indexCssPath].code.includes('@tailwind')) {
      files[indexCssPath] = { code: `@tailwind base;
@tailwind components;
@tailwind utilities;

${files[indexCssPath].code}` };
    } else if (!indexCssPath) {
      files['/src/index.css'] = { code: `@tailwind base;
@tailwind components;
@tailwind utilities;` };
    }

    // Pour React, s'assurer qu'on a un index.html
    if (isReactProject && !files['/index.html'] && !files['/public/index.html']) {
      files['/index.html'] = { code: `<!DOCTYPE html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>React App</title>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>` };
    }

    // Pour HTML statique
    if (!isReactProject && !files['/index.html']) {
      const htmlFiles = Object.entries(projectFiles).filter(([path]) => path.endsWith('.html'));
      if (htmlFiles.length > 0) {
        const htmlContent = typeof htmlFiles[0][1] === 'string' ? htmlFiles[0][1] : htmlFiles[0][1].code;
        files['/index.html'] = { code: htmlContent };
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

  const template = isReactProject ? "vite-react-ts" : "static";
  const theme = isDark ? "dark" : githubLight;

  return (
    <div className="w-full h-full overflow-hidden sandpack-wrapper rounded-xl">
      <SandpackProvider
        template={template}
        theme={theme}
        files={sandpackFiles}
        customSetup={{
          dependencies: {
            "react": "18.2.0",
            "react-dom": "18.2.0",
            "vite": "5.0.0",
            "typescript": "5.2.0",
            "tailwindcss": "3.4.0",
            "autoprefixer": "10.4.0",
            "postcss": "8.4.0",
            "lucide-react": "0.460.0",
            "framer-motion": "11.0.0",
            "classnames": "2.3.2",
            "clsx": "2.1.0",
            "tailwind-merge": "2.2.0"
          }
        }}
        options={{
          autoReload: true,
          recompileMode: 'delayed',
          recompileDelay: 300,
        }}
      >
        <SandpackLayout style={{ height: '100%' }}>
          {showEditor && (
            <SandpackCodeEditor
              style={{ height: '100%' }}
              showTabs
              showLineNumbers
              showInlineErrors
              wrapContent
            />
          )}
          <SandpackPreviewComponent
            style={{ height: '100%' }}
            showNavigator={false}
            showOpenInCodeSandbox={false}
            showRefreshButton={false}
          />
        </SandpackLayout>
      </SandpackProvider>
    </div>
  );
}
