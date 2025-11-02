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
      setHtmlContent(htmlFile[1]);
    } else {
      // Si pas de HTML, créer un HTML de base avec le contenu
      const content = Object.values(projectFiles).join('\n');
      setHtmlContent(`<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Aperçu</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body>
  ${content}
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
    <div className="w-full h-full relative">
      <iframe
        ref={iframeRef}
        className="w-full h-full border-0"
        title="Preview"
        sandbox="allow-scripts allow-same-origin allow-forms allow-modals"
      />
    </div>
  );
}

