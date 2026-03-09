/**
 * Inspector Injector - Injects an inspection script into React files
 * to allow element selection in Sandpack (bypasses cross-origin limitations)
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
      h1: 'Heading H1', h2: 'Heading H2', h3: 'Heading H3',
      h4: 'Heading H4', h5: 'Heading H5', h6: 'Heading H6',
      button: 'Button', a: 'Link', p: 'Paragraph',
      img: 'Image', svg: 'Icon', div: 'Container',
      section: 'Section', article: 'Article', header: 'Header',
      footer: 'Footer', nav: 'Navigation', ul: 'List',
      li: 'List item', span: 'Text', input: 'Field'
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

  // Listen for messages from the parent
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

  // Handle hover
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

  // Handle click
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

    console.log('✅ Element selected:', elementInfo);
    window.parent.postMessage({
      type: 'element-selected',
      data: elementInfo
    }, '*');
  }, true);

  // Signal that the inspector is ready
  console.log('📡 Inspector ready, sending signal...');
  window.parent.postMessage({ type: 'inspect-ready' }, '*');
})();
`;

  const modifiedFiles = { ...files };

  // Find the entry file (index.tsx, main.tsx, App.tsx, etc.)
  const entryFile = Object.keys(files).find(f => 
    f.includes('index.tsx') || 
    f.includes('main.tsx') || 
    f.includes('index.jsx') ||
    f.includes('App.tsx') ||
    f.includes('App.jsx')
  );

  if (entryFile && modifiedFiles[entryFile]) {
    console.log('🔧 Injecting inspector script into:', entryFile);
    // Inject the script at the beginning of the file, before imports
    modifiedFiles[entryFile] = inspectorCode + '\n' + modifiedFiles[entryFile];
  } else {
    console.warn('⚠️ No entry file found for injection');
  }

  return modifiedFiles;
}
