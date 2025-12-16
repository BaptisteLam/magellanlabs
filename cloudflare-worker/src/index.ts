/**
 * Cloudflare Worker pour servir les sites Magellan depuis KV
 * Route: *.builtbymagellan.com
 * 
 * Supporte:
 * - Preview en temps réel (sessionId.builtbymagellan.com)
 * - Publication finale (projectName.builtbymagellan.com)
 * - Injection automatique du script d'inspection
 */

interface Env {
  SITES_KV: KVNamespace;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const hostname = url.hostname;
    
    // Extraire le nom du projet depuis le sous-domaine
    const subdomain = hostname.split('.')[0];
    
    // Si c'est le domaine racine, rediriger vers la page principale
    if (hostname === 'builtbymagellan.com' || subdomain === 'www') {
      return Response.redirect('https://magellan-ai.com', 301);
    }
    
    const projectName = subdomain;
    let path = url.pathname;
    
    // CORS headers pour permettre postMessage
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': '*',
    };

    // Handle preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }
    
    // Gestion des routes SPA: si pas d'extension, essayer d'abord le chemin exact, puis index.html
    if (!path.includes('.')) {
      // Essayer d'abord le chemin exact (ex: /about)
      let kvKey = `${projectName}:${path}`;
      let content = await env.SITES_KV.get(kvKey);
      
      // Si pas trouvé, essayer avec .html
      if (!content) {
        kvKey = `${projectName}:${path}.html`;
        content = await env.SITES_KV.get(kvKey);
      }
      
      // Si toujours pas trouvé et c'est la racine, essayer index.html
      if (!content && (path === '/' || path === '')) {
        kvKey = `${projectName}:/index.html`;
        content = await env.SITES_KV.get(kvKey);
      }
      
      // Si toujours rien, essayer le fichier 404 custom du projet
      if (!content) {
        kvKey = `${projectName}:/404.html`;
        content = await env.SITES_KV.get(kvKey);
        
        if (content) {
          return new Response(injectInspectorScript(content), {
            status: 404,
            headers: {
              ...corsHeaders,
              'Content-Type': 'text/html; charset=utf-8',
              'Cache-Control': 'no-cache',
            },
          });
        }
        
        // Dernière option: 404 générique Magellan
        return new Response(generate404Page(projectName), {
          status: 404,
          headers: {
            ...corsHeaders,
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-cache',
          },
        });
      }
      
      // Injecter le script d'inspection dans le HTML
      const processedContent = getMimeType(path).includes('html') 
        ? injectInspectorScript(content)
        : content;
      
      return new Response(processedContent, {
        headers: {
          ...corsHeaders,
          'Content-Type': getMimeType(path),
          'Cache-Control': 'no-cache', // Pas de cache pour preview temps réel
        },
      });
    }
    
    // Pour les fichiers avec extension, récupérer directement
    const kvKey = `${projectName}:${path}`;
    const content = await env.SITES_KV.get(kvKey, 'text');
    
    if (!content) {
      // Essayer le 404 custom du projet
      const custom404 = await env.SITES_KV.get(`${projectName}:/404.html`);
      if (custom404) {
        return new Response(injectInspectorScript(custom404), {
          status: 404,
          headers: {
            ...corsHeaders,
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-cache',
          },
        });
      }
      
      return new Response(generate404Page(projectName), {
        status: 404,
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-cache',
        },
      });
    }
    
    // Injecter le script d'inspection si c'est du HTML
    const mimeType = getMimeType(path);
    const processedContent = mimeType.includes('html') 
      ? injectInspectorScript(content)
      : content;
    
    return new Response(processedContent, {
      headers: {
        ...corsHeaders,
        'Content-Type': mimeType,
        'Cache-Control': 'no-cache', // Pas de cache pour preview temps réel
      },
    });
  },
};

/**
 * Injecte le script d'inspection Magellan dans le HTML
 */
function injectInspectorScript(html: string): string {
  const inspectorScript = `
<script>
// === MAGELLAN VISUAL INSPECTOR ===
(function() {
  if (window.__MAGELLAN_INSPECTOR_INJECTED__) return;
  window.__MAGELLAN_INSPECTOR_INJECTED__ = true;

  let inspectMode = false;
  let hoveredElement = null;
  let lastHoveredElement = null;
  const selectableTags = ['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'P', 'SPAN', 'A', 'BUTTON', 'INPUT', 'IMG', 'SVG', 'DIV', 'SECTION', 'ARTICLE', 'HEADER', 'FOOTER', 'NAV', 'UL', 'LI'];

  const getElementDescription = (tag) => {
    const tagLower = tag.toLowerCase();
    const labels = {
      h1: 'Titre H1', h2: 'Titre H2', h3: 'Titre H3',
      h4: 'Titre H4', h5: 'Titre H5', h6: 'Titre H6',
      button: 'Bouton', a: 'Lien', p: 'Paragraphe',
      img: 'Image', svg: 'Icône', div: 'Conteneur',
      section: 'Section', article: 'Article', header: 'Header',
      footer: 'Footer', nav: 'Navigation', ul: 'Liste',
      li: 'Élément de liste', span: 'Texte', input: 'Champ'
    };
    return labels[tagLower] || tagLower.toUpperCase();
  };

  const getElementPath = (element) => {
    const path = [];
    let current = element;
    while (current && current !== document.body && current !== document.documentElement) {
      let selector = current.tagName.toLowerCase();
      if (current.id) {
        selector += '#' + current.id;
      } else if (current.className && typeof current.className === 'string') {
        const classes = current.className.split(' ').filter(c => c && !c.startsWith('magellan-')).join('.');
        if (classes) selector += '.' + classes;
      }
      path.unshift(selector);
      current = current.parentElement;
    }
    return path.join(' > ');
  };

  const createHighlight = (element) => {
    const existing = document.querySelector('[data-magellan-highlight]');
    if (existing) existing.remove();
    const existingLabel = document.querySelector('[data-magellan-label]');
    if (existingLabel) existingLabel.remove();

    const rect = element.getBoundingClientRect();
    const highlight = document.createElement('div');
    highlight.setAttribute('data-magellan-highlight', 'true');
    highlight.style.cssText = \`
      position: fixed;
      left: \${rect.left}px;
      top: \${rect.top}px;
      width: \${rect.width}px;
      height: \${rect.height}px;
      outline: 2px solid #03A5C0;
      outline-offset: 2px;
      pointer-events: none;
      z-index: 999999;
      transition: all 0.1s ease;
    \`;

    const label = document.createElement('div');
    label.setAttribute('data-magellan-label', 'true');
    label.style.cssText = \`
      position: fixed;
      left: \${rect.left}px;
      top: \${Math.max(0, rect.top - 26)}px;
      background: #03A5C0;
      color: white;
      padding: 4px 8px;
      font-size: 11px;
      font-family: monospace;
      font-weight: 600;
      border-radius: 4px;
      pointer-events: none;
      z-index: 999999;
      white-space: nowrap;
    \`;
    label.textContent = getElementDescription(element.tagName);

    document.body.appendChild(highlight);
    document.body.appendChild(label);
  };

  const removeHighlight = () => {
    const highlights = document.querySelectorAll('[data-magellan-highlight]');
    highlights.forEach(h => h.remove());
    const labels = document.querySelectorAll('[data-magellan-label]');
    labels.forEach(l => l.remove());
  };

  // Écouter les messages du parent
  window.addEventListener('message', (e) => {
    if (e.data.type === 'toggle-inspect') {
      inspectMode = e.data.enabled;
      console.log('🔍 Inspect mode:', inspectMode);
      if (!inspectMode) {
        removeHighlight();
        hoveredElement = null;
        lastHoveredElement = null;
        document.body.style.cursor = '';
      } else {
        document.body.style.cursor = 'crosshair';
      }
    }
  });

  // Gérer le survol
  document.addEventListener('mousemove', (e) => {
    if (!inspectMode) return;
    
    const target = e.target;
    if (!target || target === document.body || target === document.documentElement) {
      removeHighlight();
      return;
    }

    // Ignorer les éléments d'overlay Magellan
    if (target.hasAttribute('data-magellan-highlight') || target.hasAttribute('data-magellan-label')) {
      return;
    }

    if (!selectableTags.includes(target.tagName)) {
      removeHighlight();
      return;
    }

    if (target !== lastHoveredElement) {
      lastHoveredElement = target;
      createHighlight(target);
      hoveredElement = target;
    }
  }, true);

  // Gérer le clic
  document.addEventListener('click', (e) => {
    if (!inspectMode) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    const target = e.target;
    if (!target || target === document.body || target === document.documentElement) return;
    
    // Ignorer les éléments d'overlay Magellan
    if (target.hasAttribute('data-magellan-highlight') || target.hasAttribute('data-magellan-label')) {
      return;
    }
    
    if (!selectableTags.includes(target.tagName)) return;

    const rect = target.getBoundingClientRect();
    const elementInfo = {
      tagName: target.tagName,
      textContent: target.textContent?.substring(0, 200) || '',
      classList: Array.from(target.classList).filter(c => !c.startsWith('magellan-')),
      path: getElementPath(target),
      innerHTML: target.innerHTML,
      id: target.id || undefined,
      boundingRect: {
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
        bottom: rect.bottom,
        right: rect.right
      }
    };

    console.log('✅ Élément sélectionné:', elementInfo);
    window.parent.postMessage({
      type: 'element-selected',
      data: elementInfo
    }, '*');
  }, true);

  // Signaler que l'inspector est prêt
  console.log('📡 Magellan Inspector ready');
  window.parent.postMessage({ type: 'inspect-ready' }, '*');
})();
</script>
`;

  // Injecter avant </body> ou à la fin si pas de </body>
  if (html.includes('</body>')) {
    return html.replace('</body>', `${inspectorScript}</body>`);
  } else if (html.includes('</html>')) {
    return html.replace('</html>', `${inspectorScript}</html>`);
  } else {
    return html + inspectorScript;
  }
}

/**
 * Détermine le Content-Type basé sur l'extension du fichier
 */
function getMimeType(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase();
  
  const mimeTypes: Record<string, string> = {
    'html': 'text/html; charset=utf-8',
    'css': 'text/css; charset=utf-8',
    'js': 'application/javascript; charset=utf-8',
    'json': 'application/json',
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'gif': 'image/gif',
    'svg': 'image/svg+xml',
    'ico': 'image/x-icon',
    'woff': 'font/woff',
    'woff2': 'font/woff2',
    'ttf': 'font/ttf',
    'eot': 'application/vnd.ms-fontobject',
    'otf': 'font/otf',
    'webp': 'image/webp',
    'pdf': 'application/pdf',
    'txt': 'text/plain; charset=utf-8',
    'xml': 'application/xml',
    'zip': 'application/zip',
  };
  
  return mimeTypes[ext || ''] || 'text/html; charset=utf-8';
}

/**
 * Génère une page 404 avec le branding Magellan
 */
function generate404Page(projectName: string): string {
  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>404 - Page non trouvée</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%);
      color: #ffffff;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      text-align: center;
      max-width: 600px;
    }
    h1 {
      font-size: 72px;
      font-weight: 400;
      margin-bottom: 20px;
      background: linear-gradient(135deg, #03A5C0, #0288a3);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    p {
      font-size: 12px;
      color: #888;
      margin-bottom: 40px;
      line-height: 1.6;
    }
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0 24px;
      height: auto;
      background: rgba(3, 165, 192, 0.1);
      color: rgb(3, 165, 192);
      text-decoration: none;
      border-radius: 9999px;
      font-weight: 500;
      font-size: 12px;
      transition: all 0.2s ease;
      border: 1px solid rgb(3, 165, 192);
    }
    .btn:hover {
      background: rgba(3, 165, 192, 0.15);
    }
    .project-name {
      margin-top: 40px;
      font-size: 12px;
      color: #666;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>404</h1>
    <p>
      Désolé, cette page n'existe pas sur ce projet.<br>
      La ressource que vous recherchez est introuvable.
    </p>
    <a href="/" class="btn">Retour à l'accueil</a>
    <p class="project-name">Projet: ${projectName}</p>
  </div>
</body>
</html>
  `.trim();
}
