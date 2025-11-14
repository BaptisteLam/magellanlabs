import { Sandpack } from '@codesandbox/sandpack-react';
import { useMemo } from 'react';
import { GeneratingPreview } from './GeneratingPreview';
import './SandpackPreview.css';

interface SandpackPreviewProps {
  projectFiles: Record<string, string> | Record<string, { code: string }>;
  isDark?: boolean;
  showEditor?: boolean;
  onFilesChange?: (files: Record<string, string>) => void;
  inspectMode?: boolean;
  onElementSelect?: (elementInfo: any) => void;
}

export function SandpackPreview({ 
  projectFiles, 
  isDark = false,
  showEditor = false,
  onFilesChange
}: SandpackPreviewProps) {
  
  // Normaliser et transformer les fichiers pour Sandpack
  const sandpackFiles = useMemo(() => {
    if (!projectFiles || Object.keys(projectFiles).length === 0) {
      return {};
    }

    const files: Record<string, string> = {};
    
    // Convertir les fichiers au format Sandpack
    Object.entries(projectFiles).forEach(([path, content]) => {
      let normalizedPath = path.startsWith('/') ? path : `/${path}`;
      const fileContent = typeof content === 'string' ? content : content.code;
      files[normalizedPath] = fileContent;
    });

    // Ajouter tailwind.config.js si absent
    if (!files['/tailwind.config.js']) {
      files['/tailwind.config.js'] = `module.exports = {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {},
  },
  plugins: [],
};`;
    }

    // Ajouter postcss.config.js si absent
    if (!files['/postcss.config.js']) {
      files['/postcss.config.js'] = `module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};`;
    }

    // S'assurer que index.css contient les directives Tailwind
    const indexCssPath = files['/src/index.css'] ? '/src/index.css' : '/index.css';
    if (files[indexCssPath] && !files[indexCssPath].includes('@tailwind')) {
      files[indexCssPath] = `@tailwind base;
@tailwind components;
@tailwind utilities;

${files[indexCssPath]}`;
    } else if (!files['/src/index.css'] && !files['/index.css']) {
      files['/src/index.css'] = `@tailwind base;
@tailwind components;
@tailwind utilities;`;
    }

    // S'assurer qu'on a un index.html
    if (!files['/index.html'] && !files['/public/index.html']) {
      files['/index.html'] = `<!DOCTYPE html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Preview</title>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`;
    }

    return files;
  }, [projectFiles]);

  if (!projectFiles || Object.keys(projectFiles).length === 0) {
    return <GeneratingPreview />;
  }

  return (
    <div className="w-full h-full overflow-hidden sandpack-wrapper">
      <Sandpack
        template="vite-react-ts"
        theme={isDark ? "dark" : "light"}
        files={sandpackFiles}
        options={{
          showConsoleButton: false,
          showNavigator: false,
          showTabs: showEditor,
          showLineNumbers: showEditor,
          showInlineErrors: showEditor,
          editorHeight: "100%",
          editorWidthPercentage: showEditor ? 50 : 0,
          recompileMode: "delayed",
          autoReload: true,
          autorun: true,
        }}
        customSetup={{
          dependencies: {
            "react": "^18.2.0",
            "react-dom": "^18.2.0",
            "tailwindcss": "^3.3.3",
            "autoprefixer": "^10.4.14",
            "postcss": "^8.4.21",
            "lucide-react": "^0.263.0",
            "framer-motion": "^10.16.4",
          }
        }}
      />
    </div>
  );
}
