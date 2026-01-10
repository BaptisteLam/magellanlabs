// Script d'inspection injecté dans les projets Sandpack
// Ce script s'exécute DANS l'iframe et communique avec le parent via postMessage

export const INSPECTOR_SCRIPT = `
(function() {
  let inspectMode = false;
  let currentHighlight = null;
  let highlightOverlay = null;
  
  // Créer l'overlay de highlight
  function createOverlay() {
    if (highlightOverlay) return highlightOverlay;
    highlightOverlay = document.createElement('div');
    highlightOverlay.id = '__inspector-overlay__';
    highlightOverlay.style.cssText = \`
      position: fixed;
      pointer-events: none;
      border: 2px solid #03A5C0;
      background: rgba(3, 165, 192, 0.1);
      z-index: 999999;
      transition: all 0.1s ease;
      border-radius: 4px;
    \`;
    document.body.appendChild(highlightOverlay);
    return highlightOverlay;
  }
  
  // Supprimer l'overlay
  function removeOverlay() {
    if (highlightOverlay) {
      highlightOverlay.style.display = 'none';
    }
    currentHighlight = null;
  }
  
  // Highlight un élément
  function highlightElement(el) {
    if (!el || el === currentHighlight) return;
    if (el.id === '__inspector-overlay__') return;
    
    currentHighlight = el;
    const overlay = createOverlay();
    const rect = el.getBoundingClientRect();
    
    overlay.style.display = 'block';
    overlay.style.left = rect.left + 'px';
    overlay.style.top = rect.top + 'px';
    overlay.style.width = rect.width + 'px';
    overlay.style.height = rect.height + 'px';
  }
  
  // Générer le path CSS d'un élément
  function getCssPath(el) {
    if (!el) return '';
    const path = [];
    let current = el;
    
    while (current && current !== document.body && current !== document.documentElement) {
      let selector = current.tagName.toLowerCase();
      
      if (current.id) {
        selector += '#' + current.id;
        path.unshift(selector);
        break;
      } else if (current.className && typeof current.className === 'string') {
        const classes = current.className.trim().split(/\\s+/).filter(c => c && !c.startsWith('__'));
        if (classes.length > 0) {
          selector += '.' + classes.slice(0, 2).join('.');
        }
      }
      
      // Ajouter l'index si nécessaire
      const parent = current.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter(c => c.tagName === current.tagName);
        if (siblings.length > 1) {
          const index = siblings.indexOf(current) + 1;
          selector += ':nth-of-type(' + index + ')';
        }
      }
      
      path.unshift(selector);
      current = current.parentElement;
    }
    
    return path.join(' > ');
  }
  
  // Récupérer les infos d'un élément
  function getElementInfo(el) {
    const rect = el.getBoundingClientRect();
    return {
      tagName: el.tagName.toLowerCase(),
      id: el.id || undefined,
      classList: Array.from(el.classList).filter(c => !c.startsWith('__')),
      textContent: (el.textContent || '').trim().substring(0, 200),
      innerHTML: el.innerHTML.substring(0, 500),
      path: getCssPath(el),
      boundingRect: {
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
        bottom: rect.bottom,
        right: rect.right
      }
    };
  }
  
  // Écouter les messages du parent
  window.addEventListener('message', function(e) {
    if (e.data.type === 'inspect-mode-on') {
      inspectMode = true;
      document.body.style.cursor = 'crosshair';
      // Signaler que l'inspecteur est prêt
      window.parent.postMessage({ type: 'inspector-ready' }, '*');
    }
    if (e.data.type === 'inspect-mode-off') {
      inspectMode = false;
      document.body.style.cursor = 'default';
      removeOverlay();
    }
  });
  
  // Détecter le survol
  document.addEventListener('mousemove', function(e) {
    if (!inspectMode) return;
    
    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (el && el.id !== '__inspector-overlay__') {
      highlightElement(el);
      
      // Envoyer les infos au parent pour le hover
      window.parent.postMessage({
        type: 'inspect-element-hover',
        elementInfo: getElementInfo(el)
      }, '*');
    }
  }, { passive: true });
  
  // Détecter le clic
  document.addEventListener('click', function(e) {
    if (!inspectMode) return;
    
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    
    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (el && el.id !== '__inspector-overlay__') {
      const info = getElementInfo(el);
      
      // Envoyer les infos au parent
      window.parent.postMessage({
        type: 'inspect-element-selected',
        elementInfo: info
      }, '*');
    }
    
    return false;
  }, true);
  
  // Signaler que le script est chargé
  window.parent.postMessage({ type: 'inspector-loaded' }, '*');
})();
`;

// Fonction pour injecter le script dans les fichiers du projet
export function injectInspectorIntoFiles(
  files: Record<string, { code: string; active?: boolean }>,
  enableInspector: boolean
): Record<string, { code: string; active?: boolean }> {
  if (!enableInspector) return files;
  
  const result = { ...files };
  
  // Chercher index.html pour injecter le script
  const indexPath = Object.keys(result).find(p => p.endsWith('index.html'));
  
  if (indexPath && result[indexPath]) {
    let htmlContent = result[indexPath].code;
    
    // Injecter le script avant </body>
    if (htmlContent.includes('</body>')) {
      htmlContent = htmlContent.replace(
        '</body>',
        `<script>${INSPECTOR_SCRIPT}</script></body>`
      );
      result[indexPath] = { ...result[indexPath], code: htmlContent };
    }
  }
  
  return result;
}
