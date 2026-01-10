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
      display: none;
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
      createOverlay();
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

// Créer un composant React qui injecte l'inspector
export const INSPECTOR_COMPONENT = `
import { useEffect } from 'react';

export function InspectorBridge() {
  useEffect(() => {
    ${INSPECTOR_SCRIPT}
  }, []);
  
  return null;
}
`;

// Fonction pour injecter le script dans les fichiers du projet Sandpack
export function injectInspectorIntoFiles(
  files: Record<string, { code: string; active?: boolean }>,
  enableInspector: boolean
): Record<string, { code: string; active?: boolean }> {
  if (!enableInspector) return files;
  
  const result = { ...files };
  
  // Ajouter le fichier InspectorBridge.tsx
  result['/__inspector__.tsx'] = {
    code: `import { useEffect } from 'react';

export function InspectorBridge() {
  useEffect(() => {
    // Script d'inspection
    let inspectMode = false;
    let highlightOverlay: HTMLDivElement | null = null;
    let currentHighlight: Element | null = null;
    
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
        display: none;
      \`;
      document.body.appendChild(highlightOverlay);
      return highlightOverlay;
    }
    
    function removeOverlay() {
      if (highlightOverlay) {
        highlightOverlay.style.display = 'none';
      }
      currentHighlight = null;
    }
    
    function highlightElement(el: Element) {
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
    
    function getCssPath(el: Element | null): string {
      if (!el) return '';
      const path: string[] = [];
      let current: Element | null = el;
      
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
        
        const parent = current.parentElement;
        if (parent) {
          const siblings = Array.from(parent.children).filter(c => c.tagName === current!.tagName);
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
    
    function getElementInfo(el: Element) {
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
    
    const handleMessage = (e: MessageEvent) => {
      if (e.data.type === 'inspect-mode-on') {
        inspectMode = true;
        document.body.style.cursor = 'crosshair';
        createOverlay();
        window.parent.postMessage({ type: 'inspector-ready' }, '*');
      }
      if (e.data.type === 'inspect-mode-off') {
        inspectMode = false;
        document.body.style.cursor = 'default';
        removeOverlay();
      }
    };
    
    const handleMouseMove = (e: MouseEvent) => {
      if (!inspectMode) return;
      
      const el = document.elementFromPoint(e.clientX, e.clientY);
      if (el && el.id !== '__inspector-overlay__') {
        highlightElement(el);
        window.parent.postMessage({
          type: 'inspect-element-hover',
          elementInfo: getElementInfo(el)
        }, '*');
      }
    };
    
    const handleClick = (e: MouseEvent) => {
      if (!inspectMode) return;
      
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      
      const el = document.elementFromPoint(e.clientX, e.clientY);
      if (el && el.id !== '__inspector-overlay__') {
        window.parent.postMessage({
          type: 'inspect-element-selected',
          elementInfo: getElementInfo(el)
        }, '*');
      }
      
      return false;
    };
    
    window.addEventListener('message', handleMessage);
    document.addEventListener('mousemove', handleMouseMove, { passive: true });
    document.addEventListener('click', handleClick, true);
    
    window.parent.postMessage({ type: 'inspector-loaded' }, '*');
    
    return () => {
      window.removeEventListener('message', handleMessage);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('click', handleClick, true);
      if (highlightOverlay) {
        highlightOverlay.remove();
      }
    };
  }, []);
  
  return null;
}

export default InspectorBridge;
`
  };
  
  // Modifier App.tsx pour inclure l'InspectorBridge
  const appPath = result['/src/App.tsx'] ? '/src/App.tsx' : result['/App.tsx'] ? '/App.tsx' : null;
  
  if (appPath && result[appPath]) {
    let appCode = result[appPath].code;
    
    // Vérifier si l'import n'existe pas déjà
    if (!appCode.includes('InspectorBridge')) {
      // Ajouter l'import
      const importPath = appPath.includes('src/') ? '../__inspector__' : './__inspector__';
      const importStatement = `import { InspectorBridge } from '${importPath}';\n`;
      
      // Trouver le premier import et ajouter après
      const firstImportMatch = appCode.match(/^import .+;?\n/m);
      if (firstImportMatch) {
        appCode = appCode.replace(firstImportMatch[0], firstImportMatch[0] + importStatement);
      } else {
        appCode = importStatement + appCode;
      }
      
      // Ajouter <InspectorBridge /> au début du return JSX
      // Pattern pour trouver le return avec JSX
      const returnPatterns = [
        /return\s*\(\s*(<[A-Za-z])/g,
        /return\s*(<[A-Za-z])/g
      ];
      
      for (const pattern of returnPatterns) {
        if (pattern.test(appCode)) {
          appCode = appCode.replace(pattern, (match, jsx) => {
            return match.replace(jsx, `<><InspectorBridge />${jsx}`);
          });
          // Ajouter </> à la fin du JSX
          const lastParenIndex = appCode.lastIndexOf(');');
          if (lastParenIndex !== -1) {
            appCode = appCode.slice(0, lastParenIndex) + '</>' + appCode.slice(lastParenIndex);
          }
          break;
        }
      }
      
      result[appPath] = { ...result[appPath], code: appCode };
    }
  }
  
  return result;
}
