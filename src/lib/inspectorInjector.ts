/**
 * Inspector Injector - Injecte un script d'inspection dans les fichiers React
 * pour permettre la sélection d'éléments dans Sandpack (contourne les limitations cross-origin)
 */

export function injectInspectorScript(files: Record<string, string>): Record<string, string> {
  const inspectorCode = `
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
        const classes = current.className.split(' ').filter(c => c).join('.');
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
    label.style.cssText = \`
      position: fixed;
      left: \${rect.left}px;
      top: \${rect.top - 26}px;
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
    if (!selectableTags.includes(target.tagName)) return;

    const rect = target.getBoundingClientRect();
    const elementInfo = {
      tagName: target.tagName,
      textContent: target.textContent?.substring(0, 200) || '',
      classList: Array.from(target.classList),
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
  console.log('📡 Inspector ready, envoi du signal...');
  window.parent.postMessage({ type: 'inspect-ready' }, '*');
})();
`;

  const modifiedFiles = { ...files };

  // Trouver le fichier d'entrée (index.tsx, main.tsx, App.tsx, etc.)
  const entryFile = Object.keys(files).find(f => 
    f.includes('index.tsx') || 
    f.includes('main.tsx') || 
    f.includes('index.jsx') ||
    f.includes('App.tsx') ||
    f.includes('App.jsx')
  );

  if (entryFile && modifiedFiles[entryFile]) {
    console.log('🔧 Injection du script inspector dans:', entryFile);
    // Injecter le script au début du fichier, avant les imports
    modifiedFiles[entryFile] = inspectorCode + '\n' + modifiedFiles[entryFile];
  } else {
    console.warn('⚠️ Aucun fichier d\'entrée trouvé pour l\'injection');
  }

  return modifiedFiles;
}
