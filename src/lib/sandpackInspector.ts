// Script d'inspection amélioré injecté dans les projets Sandpack
// Avec overlay intelligent style Lovable : dimensions, labels, navigation clavier

export const INSPECTOR_SCRIPT = `
(function() {
  let inspectMode = false;
  let highlightOverlay = null;
  let labelElement = null;
  let dimensionElement = null;
  let marginOverlay = null;
  let paddingOverlay = null;
  let currentHighlight = null;
  let selectedElement = null;
  
  // Configuration
  const ACCENT_COLOR = '#03A5C0';
  const ACCENT_BG = 'rgba(3, 165, 192, 0.1)';
  const MARGIN_COLOR = 'rgba(255, 166, 0, 0.3)';
  const PADDING_COLOR = 'rgba(0, 255, 0, 0.2)';
  
  // Éléments sémantiques à prioriser
  const SEMANTIC_TAGS = ['section', 'article', 'nav', 'header', 'footer', 'main', 'aside', 'form', 'button', 'a', 'img'];
  const INTERACTIVE_TAGS = ['button', 'a', 'input', 'select', 'textarea', 'label'];
  
  function createOverlay() {
    if (highlightOverlay) return highlightOverlay;
    
    // Overlay principal
    highlightOverlay = document.createElement('div');
    highlightOverlay.id = '__inspector-overlay__';
    highlightOverlay.style.cssText = 
      'position: fixed; pointer-events: none; z-index: 999999; ' +
      'border: 2px solid ' + ACCENT_COLOR + '; ' +
      'background: ' + ACCENT_BG + '; ' +
      'transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1); ' +
      'border-radius: 4px; display: none; ' +
      'box-shadow: 0 0 0 1px rgba(3, 165, 192, 0.3), 0 4px 12px rgba(0, 0, 0, 0.15);';
    document.body.appendChild(highlightOverlay);
    
    // Label avec infos de l'élément
    labelElement = document.createElement('div');
    labelElement.id = '__inspector-label__';
    labelElement.style.cssText = 
      'position: fixed; pointer-events: none; z-index: 1000000; ' +
      'display: none; font-family: ui-monospace, monospace; font-size: 11px; ' +
      'background: ' + ACCENT_COLOR + '; color: white; ' +
      'padding: 4px 8px; border-radius: 4px; ' +
      'box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2); ' +
      'white-space: nowrap; max-width: 300px; overflow: hidden; text-overflow: ellipsis;';
    document.body.appendChild(labelElement);
    
    // Affichage des dimensions
    dimensionElement = document.createElement('div');
    dimensionElement.id = '__inspector-dimensions__';
    dimensionElement.style.cssText = 
      'position: fixed; pointer-events: none; z-index: 1000000; ' +
      'display: none; font-family: ui-monospace, monospace; font-size: 10px; ' +
      'background: rgba(0, 0, 0, 0.75); color: white; ' +
      'padding: 2px 6px; border-radius: 3px;';
    document.body.appendChild(dimensionElement);
    
    // Overlay pour les marges
    marginOverlay = document.createElement('div');
    marginOverlay.id = '__inspector-margin__';
    marginOverlay.style.cssText = 
      'position: fixed; pointer-events: none; z-index: 999998; ' +
      'display: none; background: ' + MARGIN_COLOR + '; border: 1px dashed orange;';
    document.body.appendChild(marginOverlay);
    
    // Overlay pour le padding
    paddingOverlay = document.createElement('div');
    paddingOverlay.id = '__inspector-padding__';
    paddingOverlay.style.cssText = 
      'position: fixed; pointer-events: none; z-index: 999997; ' +
      'display: none; background: ' + PADDING_COLOR + ';';
    document.body.appendChild(paddingOverlay);
    
    return highlightOverlay;
  }
  
  function removeOverlay() {
    if (highlightOverlay) highlightOverlay.style.display = 'none';
    if (labelElement) labelElement.style.display = 'none';
    if (dimensionElement) dimensionElement.style.display = 'none';
    if (marginOverlay) marginOverlay.style.display = 'none';
    if (paddingOverlay) paddingOverlay.style.display = 'none';
    currentHighlight = null;
  }
  
  function getComputedStyles(el) {
    const styles = window.getComputedStyle(el);
    return {
      margin: {
        top: parseFloat(styles.marginTop) || 0,
        right: parseFloat(styles.marginRight) || 0,
        bottom: parseFloat(styles.marginBottom) || 0,
        left: parseFloat(styles.marginLeft) || 0
      },
      padding: {
        top: parseFloat(styles.paddingTop) || 0,
        right: parseFloat(styles.paddingRight) || 0,
        bottom: parseFloat(styles.paddingBottom) || 0,
        left: parseFloat(styles.paddingLeft) || 0
      },
      fontSize: styles.fontSize,
      fontWeight: styles.fontWeight,
      color: styles.color,
      backgroundColor: styles.backgroundColor,
      display: styles.display,
      position: styles.position
    };
  }
  
  function getElementType(el) {
    const tag = el.tagName.toLowerCase();
    
    // Types spécifiques
    if (tag === 'img') return '🖼️ Image';
    if (tag === 'video') return '🎬 Vidéo';
    if (tag === 'audio') return '🔊 Audio';
    if (tag === 'svg') return '📐 SVG';
    if (tag === 'button') return '🔘 Bouton';
    if (tag === 'a') return '🔗 Lien';
    if (tag === 'input') return '📝 Input';
    if (tag === 'textarea') return '📝 Textarea';
    if (tag === 'select') return '📋 Select';
    if (tag === 'form') return '📄 Formulaire';
    if (tag === 'nav') return '🧭 Navigation';
    if (tag === 'header') return '📌 Header';
    if (tag === 'footer') return '📍 Footer';
    if (tag === 'section') return '📦 Section';
    if (tag === 'article') return '📰 Article';
    if (tag === 'aside') return '📎 Aside';
    if (tag === 'main') return '📄 Main';
    if (tag === 'ul' || tag === 'ol') return '📋 Liste';
    if (tag === 'table') return '📊 Table';
    if (tag === 'h1' || tag === 'h2' || tag === 'h3' || tag === 'h4' || tag === 'h5' || tag === 'h6') return '📝 Titre';
    if (tag === 'p') return '📝 Paragraphe';
    if (tag === 'span') return 'Span';
    if (tag === 'div') {
      // Essayer de détecter le rôle du div
      const classes = el.className.toLowerCase();
      if (classes.includes('card')) return '🃏 Card';
      if (classes.includes('container')) return '📦 Container';
      if (classes.includes('grid')) return '⊞ Grid';
      if (classes.includes('flex')) return '⬌ Flex';
      if (classes.includes('hero')) return '🦸 Hero';
      if (classes.includes('modal') || classes.includes('dialog')) return '🗨️ Modal';
      if (classes.includes('menu')) return '☰ Menu';
      if (classes.includes('sidebar')) return '◧ Sidebar';
      return 'Div';
    }
    
    return tag;
  }
  
  function findSemanticParent(el) {
    let current = el.parentElement;
    let depth = 0;
    const maxDepth = 5;
    
    while (current && depth < maxDepth && current !== document.body) {
      const tag = current.tagName.toLowerCase();
      const hasId = !!current.id;
      const hasSignificantClasses = current.className && 
        typeof current.className === 'string' && 
        current.className.split(' ').some(c => c.length > 3 && !c.startsWith('__'));
      
      if (SEMANTIC_TAGS.includes(tag) || hasId || hasSignificantClasses) {
        return current;
      }
      current = current.parentElement;
      depth++;
    }
    return null;
  }
  
  function highlightElement(el, showBoxModel) {
    if (!el || el === currentHighlight) return;
    if (el.id && el.id.startsWith('__inspector')) return;
    
    currentHighlight = el;
    const overlay = createOverlay();
    const rect = el.getBoundingClientRect();
    const styles = getComputedStyles(el);
    
    // Overlay principal
    overlay.style.display = 'block';
    overlay.style.left = rect.left + 'px';
    overlay.style.top = rect.top + 'px';
    overlay.style.width = rect.width + 'px';
    overlay.style.height = rect.height + 'px';
    
    // Label avec type et classes
    const elementType = getElementType(el);
    const classes = Array.from(el.classList).filter(c => !c.startsWith('__')).slice(0, 2);
    let labelText = elementType;
    if (el.id) labelText += ' #' + el.id;
    if (classes.length > 0) labelText += ' .' + classes.join('.');
    
    labelElement.textContent = labelText;
    labelElement.style.display = 'block';
    
    // Positionner le label au-dessus de l'élément
    const labelTop = rect.top - 28;
    labelElement.style.left = Math.max(4, rect.left) + 'px';
    labelElement.style.top = (labelTop < 4 ? rect.bottom + 4 : labelTop) + 'px';
    
    // Dimensions
    const width = Math.round(rect.width);
    const height = Math.round(rect.height);
    dimensionElement.textContent = width + ' × ' + height;
    dimensionElement.style.display = 'block';
    dimensionElement.style.left = (rect.right - 60) + 'px';
    dimensionElement.style.top = (rect.bottom + 4) + 'px';
    
    // Box model (optionnel, activé sur Shift)
    if (showBoxModel && (styles.margin.top > 0 || styles.margin.bottom > 0 || styles.margin.left > 0 || styles.margin.right > 0)) {
      marginOverlay.style.display = 'block';
      marginOverlay.style.left = (rect.left - styles.margin.left) + 'px';
      marginOverlay.style.top = (rect.top - styles.margin.top) + 'px';
      marginOverlay.style.width = (rect.width + styles.margin.left + styles.margin.right) + 'px';
      marginOverlay.style.height = (rect.height + styles.margin.top + styles.margin.bottom) + 'px';
    } else {
      marginOverlay.style.display = 'none';
    }
    
    if (showBoxModel && (styles.padding.top > 0 || styles.padding.bottom > 0 || styles.padding.left > 0 || styles.padding.right > 0)) {
      paddingOverlay.style.display = 'block';
      paddingOverlay.style.left = (rect.left + styles.padding.left) + 'px';
      paddingOverlay.style.top = (rect.top + styles.padding.top) + 'px';
      paddingOverlay.style.width = (rect.width - styles.padding.left - styles.padding.right) + 'px';
      paddingOverlay.style.height = (rect.height - styles.padding.top - styles.padding.bottom) + 'px';
    } else {
      paddingOverlay.style.display = 'none';
    }
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
  
  function getParentTree(el) {
    const tree = [];
    let current = el;
    let depth = 0;
    const maxDepth = 8;
    
    while (current && current !== document.body && depth < maxDepth) {
      tree.push({
        tagName: current.tagName.toLowerCase(),
        id: current.id || undefined,
        classList: Array.from(current.classList || []).filter(c => !c.startsWith('__')).slice(0, 3),
        isSemanticParent: SEMANTIC_TAGS.includes(current.tagName.toLowerCase())
      });
      current = current.parentElement;
      depth++;
    }
    
    return tree;
  }
  
  function getElementInfo(el) {
    const rect = el.getBoundingClientRect();
    const styles = getComputedStyles(el);
    const semanticParent = findSemanticParent(el);
    
    return {
      tagName: el.tagName.toLowerCase(),
      id: el.id || undefined,
      classList: Array.from(el.classList).filter(c => !c.startsWith('__')),
      textContent: (el.textContent || '').trim().substring(0, 200),
      innerHTML: el.innerHTML.substring(0, 500),
      path: getCssPath(el),
      elementType: getElementType(el),
      isInteractive: INTERACTIVE_TAGS.includes(el.tagName.toLowerCase()),
      parentTree: getParentTree(el),
      semanticParent: semanticParent ? {
        tagName: semanticParent.tagName.toLowerCase(),
        id: semanticParent.id,
        classList: Array.from(semanticParent.classList || []).filter(c => !c.startsWith('__')).slice(0, 3)
      } : null,
      computedStyles: {
        fontSize: styles.fontSize,
        fontWeight: styles.fontWeight,
        color: styles.color,
        backgroundColor: styles.backgroundColor,
        display: styles.display,
        position: styles.position,
        padding: styles.padding,
        margin: styles.margin
      },
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
  
  // Navigation clavier
  function handleKeyDown(e) {
    if (!inspectMode) return;
    
    // Escape pour quitter
    if (e.key === 'Escape') {
      e.preventDefault();
      window.parent.postMessage({ type: 'inspect-escape' }, '*');
      return;
    }
    
    // Tab pour naviguer au prochain élément interactif
    if (e.key === 'Tab' && currentHighlight) {
      e.preventDefault();
      const interactiveElements = document.querySelectorAll('button, a, input, select, textarea, [tabindex]');
      const arr = Array.from(interactiveElements);
      let currentIndex = arr.indexOf(currentHighlight);
      let nextIndex = e.shiftKey ? currentIndex - 1 : currentIndex + 1;
      
      if (nextIndex >= arr.length) nextIndex = 0;
      if (nextIndex < 0) nextIndex = arr.length - 1;
      
      const nextEl = arr[nextIndex];
      if (nextEl) {
        highlightElement(nextEl, e.shiftKey);
        window.parent.postMessage({
          type: 'inspect-element-hover',
          elementInfo: getElementInfo(nextEl)
        }, '*');
      }
    }
    
    // Arrow Up pour sélectionner le parent
    if (e.key === 'ArrowUp' && currentHighlight) {
      e.preventDefault();
      const parent = currentHighlight.parentElement;
      if (parent && parent !== document.body) {
        highlightElement(parent, e.shiftKey);
        window.parent.postMessage({
          type: 'inspect-element-hover',
          elementInfo: getElementInfo(parent)
        }, '*');
      }
    }
    
    // Arrow Down pour sélectionner le premier enfant
    if (e.key === 'ArrowDown' && currentHighlight) {
      e.preventDefault();
      const firstChild = currentHighlight.firstElementChild;
      if (firstChild) {
        highlightElement(firstChild, e.shiftKey);
        window.parent.postMessage({
          type: 'inspect-element-hover',
          elementInfo: getElementInfo(firstChild)
        }, '*');
      }
    }
    
    // Enter pour sélectionner l'élément actuel
    if (e.key === 'Enter' && currentHighlight) {
      e.preventDefault();
      selectedElement = currentHighlight;
      window.parent.postMessage({
        type: 'inspect-element-selected',
        elementInfo: getElementInfo(currentHighlight)
      }, '*');
    }
  }
  
  window.addEventListener('message', function(e) {
    if (e.data.type === 'inspect-mode-on') {
      inspectMode = true;
      document.body.style.cursor = 'crosshair';
      createOverlay();
      document.addEventListener('keydown', handleKeyDown);
      window.parent.postMessage({ type: 'inspector-ready' }, '*');
    }
    if (e.data.type === 'inspect-mode-off') {
      inspectMode = false;
      document.body.style.cursor = 'default';
      removeOverlay();
      selectedElement = null;
      document.removeEventListener('keydown', handleKeyDown);
    }
  });
  
  document.addEventListener('mousemove', function(e) {
    if (!inspectMode) return;
    
    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (el && !el.id?.startsWith('__inspector')) {
      highlightElement(el, e.shiftKey);
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
    if (el && !el.id?.startsWith('__inspector')) {
      selectedElement = el;
      
      // Si Shift est appuyé, sélectionner le parent sémantique
      let targetEl = el;
      if (e.shiftKey) {
        const semanticParent = findSemanticParent(el);
        if (semanticParent) targetEl = semanticParent;
      }
      
      window.parent.postMessage({
        type: 'inspect-element-selected',
        elementInfo: getElementInfo(targetEl)
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
