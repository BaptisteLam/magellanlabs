import { useState, useEffect } from 'react';
import { FileTree } from './FileTree';
import { cn } from '@/lib/utils';

interface CodePreviewProps {
  files: Record<string, string>;
  isDark?: boolean;
}

export function CodePreview({ files, isDark = false }: CodePreviewProps) {
  const [selectedFile, setSelectedFile] = useState<string>(
    files['index.html'] ? 'index.html' : Object.keys(files)[0] || null
  );
  const [selectedFileContent, setSelectedFileContent] = useState<string>(
    files[selectedFile] || ''
  );

  const handleFileSelect = (path: string, content: string) => {
    setSelectedFile(path);
    setSelectedFileContent(content);
  };

  // Écouter les messages de navigation depuis l'iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'navigate' && event.data?.path) {
        const targetPath = event.data.path.startsWith('/') 
          ? event.data.path.slice(1) 
          : event.data.path;
        
        if (files[targetPath]) {
          setSelectedFile(targetPath);
          setSelectedFileContent(files[targetPath]);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [files]);

  // Générer le HTML pour preview avec inline CSS/JS et navigation entre pages
  const getPreviewHtml = () => {
    // Utiliser le fichier sélectionné s'il se termine par .html
    const htmlFile = selectedFile?.endsWith('.html') ? files[selectedFile] : files['index.html'];
    if (!htmlFile) return '';

    let processedHtml = htmlFile;

    // Injecter le CSS inline
    if (files['style.css']) {
      processedHtml = processedHtml.replace(
        /<link[^>]*href=["'][./]*style\.css["'][^>]*>/gi,
        `<style>${files['style.css']}</style>`
      );
    }

    // Injecter le JS inline (à la fin du body)
    if (files['script.js']) {
      processedHtml = processedHtml.replace(
        /<script[^>]*src=["'][./]*script\.js["'][^>]*><\/script>/gi,
        `<script>${files['script.js']}</script>`
      );
    }

    // Ajouter un script pour gérer la navigation interne
    const navigationScript = `
      <script>
        document.addEventListener('click', function(e) {
          const link = e.target.closest('a');
          if (link) {
            const href = link.getAttribute('href');
            if (href && href.endsWith('.html')) {
              e.preventDefault();
              // Envoyer un message au parent pour changer de page
              window.parent.postMessage({ type: 'navigate', path: href }, '*');
            }
          }
        }, true);
      </script>
    `;
    
    processedHtml = processedHtml.replace('</body>', navigationScript + '</body>');

    return processedHtml;
  };

  if (Object.keys(files).length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-slate-500">
        Aucun fichier généré
      </div>
    );
  }

  return (
    <div className="h-full flex">
      {/* File tree sidebar */}
      <div className="w-64 border-r border-slate-200 dark:border-slate-700">
        <div className={cn(
          "h-10 flex items-center px-3 border-b font-semibold text-sm",
          isDark ? "bg-slate-800 border-slate-700 text-slate-200" : "bg-slate-50 border-slate-200 text-slate-700"
        )}>
          Fichiers
        </div>
        <FileTree
          files={files}
          onFileSelect={handleFileSelect}
          selectedFile={selectedFile}
        />
      </div>

      {/* Content viewer */}
      <div className="flex-1 flex flex-col">
        {selectedFile && (
          <>
            <div className={cn(
              "h-10 flex items-center px-4 border-b text-sm font-mono",
              isDark ? "bg-slate-800 border-slate-700 text-slate-300" : "bg-slate-50 border-slate-200 text-slate-600"
            )}>
              {selectedFile}
            </div>
            
            {/* Preview iframe pour fichiers HTML, sinon code */}
            {selectedFile?.endsWith('.html') ? (
              <iframe
                key={selectedFile}
                srcDoc={getPreviewHtml()}
                className="flex-1 w-full h-full border-0 bg-white"
                title="Website Preview"
                sandbox="allow-scripts allow-same-origin"
              />
            ) : (
              <pre className={cn(
                "flex-1 overflow-auto p-4 text-xs font-mono",
                isDark ? "bg-slate-900 text-slate-200" : "bg-white text-slate-800"
              )}>
                <code>{selectedFileContent}</code>
              </pre>
            )}
          </>
        )}
      </div>
    </div>
  );
}
