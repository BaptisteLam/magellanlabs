import { Sandpack } from "@codesandbox/sandpack-react";
import { useMemo } from "react";

interface SandpackPreviewProps {
  projectFiles: Record<string, string>;
  isDark?: boolean;
}

export function SandpackPreview({ projectFiles, isDark = false }: SandpackPreviewProps) {
  // Préparer les fichiers pour Sandpack
  const sandpackFiles = useMemo(() => {
    const files: Record<string, string> = {};
    
    // Collecter tous les fichiers
    Object.entries(projectFiles).forEach(([path, content]) => {
      // Normaliser les chemins pour Sandpack (doit commencer par /)
      const normalizedPath = path.startsWith('/') ? path : `/${path}`;
      files[normalizedPath] = content;
    });

    // Si pas de fichier HTML, créer un template de base
    if (!Object.keys(files).some(path => path.endsWith('.html'))) {
      files['/index.html'] = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Site Web</title>
  <link rel="stylesheet" href="/styles.css">
</head>
<body>
  <div id="app">
    <h1>Bienvenue</h1>
  </div>
  <script src="/script.js"></script>
</body>
</html>`;
    }

    // Si pas de CSS, créer un fichier vide
    if (!Object.keys(files).some(path => path.endsWith('.css'))) {
      files['/styles.css'] = `* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: system-ui, -apple-system, sans-serif;
  line-height: 1.6;
}`;
    }

    // Si pas de JS, créer un fichier vide
    if (!Object.keys(files).some(path => path.endsWith('.js'))) {
      files['/script.js'] = `// Votre code JavaScript ici
console.log('Site web chargé');`;
    }

    return files;
  }, [projectFiles]);

  return (
    <div className="w-full h-full">
      <Sandpack
        template="static"
        files={sandpackFiles}
        theme={isDark ? "dark" : "light"}
        options={{
          showNavigator: false,
          showTabs: false,
          showLineNumbers: false,
          editorHeight: "100%",
          editorWidthPercentage: 0, // Cache l'éditeur, on veut juste la preview
          classes: {
            "sp-wrapper": "h-full",
            "sp-layout": "h-full",
            "sp-stack": "h-full"
          }
        }}
        customSetup={{
          entry: "/index.html"
        }}
      />
    </div>
  );
}
