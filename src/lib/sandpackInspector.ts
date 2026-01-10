// Script d'inspection injecté dans les projets Sandpack
// Injecté via main.tsx pour fonctionner dans l'iframe Sandpack

export const INSPECTOR_SCRIPT = `
(function() {
  let inspectMode = false;
  let highlightOverlay = null;
  let currentHighlight = null;
  
  function createOverlay() {
    if (highlightOverlay) return highlightOverlay;
    highlightOverlay = document.createElement('div');
    highlightOverlay.id = '__inspector-overlay__';
    highlightOverlay.style.cssText = 
      'position: fixed; pointer-events: none; border: 2px solid #03A5C0; ' +
      'background: rgba(3, 165, 192, 0.1); z-index: 999999; ' +
      'transition: all 0.1s ease; border-radius: 4px; display: none;';
    document.body.appendChild(highlightOverlay);
    return highlightOverlay;
  }
  
  function removeOverlay() {
    if (highlightOverlay) {
      highlightOverlay.style.display = 'none';
    }
    currentHighlight = null;
  }
  
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
  
  document.addEventListener('mousemove', function(e) {
    if (!inspectMode) return;
    
    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (el && el.id !== '__inspector-overlay__') {
      highlightElement(el);
      window.parent.postMessage({
        type: 'inspect-element-hover',
        elementInfo: getElementInfo(el)
      }, '*');
    }
  }, { passive: true });
  
  document.addEventListener('click', function(e) {
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
  }, true);
  
  window.parent.postMessage({ type: 'inspector-loaded' }, '*');
})();
`;

// Injecter l'inspector dans main.tsx (plus fiable que App.tsx)
export function injectInspectorIntoFiles(
  files: Record<string, { code: string; active?: boolean }>,
  enableInspector: boolean
): Record<string, { code: string; active?: boolean }> {
  if (!enableInspector) return files;
  
  const result = { ...files };
  
  // Créer le fichier inspector standalone
  result['/__inspector__.ts'] = {
    code: INSPECTOR_SCRIPT
  };
  
  // Trouver main.tsx et ajouter l'import de l'inspector
  const mainPaths = ['/src/main.tsx', '/main.tsx', '/src/index.tsx', '/index.tsx'];
  let mainPath: string | null = null;
  
  for (const path of mainPaths) {
    if (result[path]) {
      mainPath = path;
      break;
    }
  }
  
  if (mainPath && result[mainPath]) {
    let mainCode = result[mainPath].code;
    
    // Vérifier si l'import n'existe pas déjà
    if (!mainCode.includes('__inspector__')) {
      // Ajouter l'import au tout début du fichier
      const inspectorImport = `import './__inspector__';\n`;
      mainCode = inspectorImport + mainCode;
      
      result[mainPath] = { ...result[mainPath], code: mainCode };
      console.log('[sandpackInspector] Inspector injected into', mainPath);
    }
  } else {
    console.warn('[sandpackInspector] No main.tsx found, inspector not injected');
  }
  
  return result;
}
