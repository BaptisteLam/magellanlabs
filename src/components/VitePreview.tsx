import { useEffect, useRef, useState } from 'react';

interface VitePreviewProps {
  projectFiles: Record<string, string>;
  isDark?: boolean;
}

export function VitePreview({ projectFiles, isDark = false }: VitePreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [compiledHtml, setCompiledHtml] = useState('');

  useEffect(() => {
    if (!projectFiles || Object.keys(projectFiles).length === 0) {
      return;
    }

    compileProject();
  }, [projectFiles]);

  const compileProject = () => {
    try {
      // Extraire les fichiers principaux
      const indexHtml = projectFiles['index.html'] || '';
      const appTsx = projectFiles['src/App.tsx'] || '';
      const appCss = projectFiles['src/App.css'] || projectFiles['src/App.css'] || '';
      const indexCss = projectFiles['src/index.css'] || '';

      // Compiler tous les composants TypeScript en JavaScript
      const jsComponents: Record<string, string> = {};
      
      Object.keys(projectFiles).forEach(filePath => {
        if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
          // Conversion simplifiée TSX → JSX (suppression des types)
          let jsCode = projectFiles[filePath]
            .replace(/import\s+\{[^}]+\}\s+from\s+['"]lucide-react['"]/g, '') // Remplacer imports Lucide
            .replace(/import\s+type\s+\{[^}]+\}\s+from\s+['"]\.[^'"]+['"]/g, '') // Supprimer type imports
            .replace(/:\s*React\.FC<[^>]+>/g, '') // Supprimer types FC
            .replace(/:\s*\{[^}]+\}/g, '') // Supprimer types props inline
            .replace(/interface\s+\w+\s*\{[^}]+\}/gs, '') // Supprimer interfaces
            .replace(/type\s+\w+\s*=\s*[^;]+;/g, '') // Supprimer type aliases
            .replace(/<(\w+)\s+className=/g, '<$1 class='); // className → class

          // Remplacer les imports Lucide par des SVG inline
          jsCode = replaceLucideIcons(jsCode);

          jsComponents[filePath] = jsCode;
        }
      });

      // Construire le HTML compilé avec tout inline
      const compiledDocument = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Preview</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <style>
    ${indexCss}
    ${appCss}
    * { font-family: 'Inter', sans-serif; }
  </style>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            primary: '#3b82f6',
            secondary: '#8b5cf6',
            accent: '#f59e0b'
          }
        }
      }
    }
  </script>
</head>
<body>
  <div id="root"></div>

  <script type="module">
    // Polyfill React pour le navigateur
    const React = {
      createElement: (type, props, ...children) => {
        if (typeof type === 'function') {
          return type({ ...props, children });
        }
        const element = document.createElement(type);
        if (props) {
          Object.keys(props).forEach(key => {
            if (key === 'className') {
              element.className = props[key];
            } else if (key.startsWith('on') && typeof props[key] === 'function') {
              const event = key.toLowerCase().substring(2);
              element.addEventListener(event, props[key]);
            } else if (key !== 'children') {
              element.setAttribute(key, props[key]);
            }
          });
        }
        children.flat().forEach(child => {
          if (typeof child === 'string' || typeof child === 'number') {
            element.appendChild(document.createTextNode(child));
          } else if (child) {
            element.appendChild(child);
          }
        });
        return element;
      },
      StrictMode: ({ children }) => children,
      useState: (initial) => {
        const value = typeof initial === 'function' ? initial() : initial;
        const setState = (newValue) => {
          console.log('State update:', newValue);
        };
        return [value, setState];
      },
      useEffect: (fn) => fn(),
      useRef: (initial) => ({ current: initial })
    };

    const ReactDOM = {
      createRoot: (container) => ({
        render: (element) => {
          container.innerHTML = '';
          if (element && typeof element === 'object' && element.appendChild) {
            container.appendChild(element);
          }
        }
      })
    };

    // Injecter les composants
    ${Object.entries(jsComponents).map(([path, code]) => {
      const componentName = path.split('/').pop()?.replace('.tsx', '').replace('.ts', '');
      return `
        // ${path}
        ${code.replace(/^export\s+(default\s+)?/gm, '')}
      `;
    }).join('\n\n')}

    // Render App
    try {
      const root = ReactDOM.createRoot(document.getElementById('root'));
      root.render(React.createElement(React.StrictMode, null, React.createElement(App)));
    } catch (error) {
      console.error('Erreur de rendu:', error);
      document.getElementById('root').innerHTML = '<div style="padding: 2rem; color: red;">Erreur de compilation: ' + error.message + '</div>';
    }
  </script>

  <script>
    // Bloquer navigation interne
    document.addEventListener('click', function(e) {
      const target = e.target.closest('a');
      if (target) {
        const href = target.getAttribute('href');
        if (href && (href.startsWith('http://') || href.startsWith('https://'))) {
          target.setAttribute('target', '_blank');
          target.setAttribute('rel', 'noopener noreferrer');
          return;
        }
        e.preventDefault();
        e.stopPropagation();
      }
    }, true);

    document.addEventListener('submit', function(e) {
      e.preventDefault();
    }, true);
  </script>
</body>
</html>
      `.trim();

      setCompiledHtml(compiledDocument);
    } catch (error) {
      console.error('Erreur compilation:', error);
      setCompiledHtml(`
        <html>
          <body style="padding: 2rem; font-family: system-ui;">
            <h2 style="color: red;">Erreur de compilation</h2>
            <p>${error instanceof Error ? error.message : 'Erreur inconnue'}</p>
          </body>
        </html>
      `);
    }
  };

  const replaceLucideIcons = (code: string): string => {
    const iconMap: Record<string, string> = {
      Home: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
      Menu: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/></svg>',
      X: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>',
      Mail: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>',
      User: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
      Check: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
      Star: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
      Phone: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>',
      ArrowRight: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>'
    };

    let result = code;
    Object.keys(iconMap).forEach(iconName => {
      const regex = new RegExp(`<${iconName}\\s+([^/>]*)/>`, 'g');
      result = result.replace(regex, (match, attrs) => {
        const svg = iconMap[iconName].replace('<svg ', `<svg ${attrs} `);
        return `React.createElement('span', { dangerouslySetInnerHTML: { __html: \`${svg}\` } })`;
      });
    });

    return result;
  };

  return (
    <iframe
      ref={iframeRef}
      srcDoc={compiledHtml}
      className="w-full h-full border-0"
      sandbox="allow-scripts allow-same-origin"
      title="Vite Preview"
    />
  );
}
