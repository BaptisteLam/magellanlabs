import { useEffect, useState, useRef } from 'react';

interface VitePreviewProps {
  projectFiles: Record<string, string>;
  isDark?: boolean;
}

export function VitePreview({ projectFiles, isDark = false }: VitePreviewProps) {
  const [htmlContent, setHtmlContent] = useState<string>('');
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (!projectFiles || Object.keys(projectFiles).length === 0) {
      return;
    }

    // Chercher le fichier HTML principal
    const htmlFile = Object.entries(projectFiles).find(([path]) => 
      path.endsWith('.html') || path === 'index.html'
    );

    if (htmlFile) {
      // HTML pur - affichage direct
      setHtmlContent(htmlFile[1]);
    } else if (projectFiles['src/App.tsx'] || projectFiles['src/App.jsx']) {
      // Projet React/Vite - générer un HTML avec bundle inline
      const appFile = projectFiles['src/App.tsx'] || projectFiles['src/App.jsx'];
      const cssFile = projectFiles['src/index.css'] || '';
      
      // Convertir le JSX/TSX en HTML simple pour preview
      const simplifiedHtml = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Aperçu React</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://unpkg.com/lucide@latest"></script>
  <style>${cssFile}</style>
</head>
<body>
  <div id="root">
    <div class="min-h-screen bg-gray-50 flex items-center justify-center p-8">
      <div class="max-w-2xl text-center">
        <h1 class="text-3xl font-bold text-gray-900 mb-4">⚡ Projet React/Vite détecté</h1>
        <p class="text-gray-600 mb-6">
          Ce projet nécessite un bundler pour être exécuté. Preview simplifiée en cours de développement.
        </p>
        <div class="bg-white rounded-lg shadow-sm p-6 text-left">
          <h3 class="font-semibold text-sm text-gray-700 mb-2">Fichiers générés :</h3>
          <ul class="text-sm text-gray-600 space-y-1">
            ${Object.keys(projectFiles).map(path => `<li>📄 ${path}</li>`).join('')}
          </ul>
        </div>
        <p class="text-xs text-gray-500 mt-4">
          💡 Pour l'instant, privilégie les projets HTML simples pour voir le rendu instantané
        </p>
      </div>
    </div>
  </div>
  <script>lucide.createIcons();</script>
</body>
</html>`;
      
      setHtmlContent(simplifiedHtml);
    } else {
      // Fallback : HTML de base
      setHtmlContent(`<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Aperçu</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="p-8 bg-gray-50">
  <div class="max-w-4xl mx-auto bg-white rounded-lg shadow-sm p-6">
    <h1 class="text-2xl font-bold mb-4">Fichiers générés</h1>
    <div class="space-y-2">
      ${Object.entries(projectFiles).map(([path, content]) => `
        <details class="border rounded p-3">
          <summary class="cursor-pointer font-medium text-sm">${path}</summary>
          <pre class="mt-2 text-xs bg-gray-50 p-2 rounded overflow-auto">${content.substring(0, 500)}...</pre>
        </details>
      `).join('')}
    </div>
  </div>
</body>
</html>`);
    }
  }, [projectFiles]);

  useEffect(() => {
    if (htmlContent && iframeRef.current) {
      const iframe = iframeRef.current;
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      
      if (doc) {
        doc.open();
        doc.write(htmlContent);
        doc.close();
      }
    }
  }, [htmlContent]);

  if (!htmlContent) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">En attente de génération...</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative overflow-hidden">
      <iframe
        ref={iframeRef}
        className="w-full h-full border-0"
        title="Preview"
        sandbox="allow-scripts allow-same-origin allow-forms allow-modals"
      />
    </div>
  );
}

