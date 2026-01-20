import { useState, useEffect, useRef, forwardRef, useImperativeHandle, useMemo, useCallback } from 'react';
import { useThemeStore } from '@/stores/themeStore';
import type { ElementInfo } from '@/types/elementInfo';

// Script d'inspection injecté dans l'iframe srcdoc
const INSPECTOR_SCRIPT = `
(function() {
  let inspectMode = false;
  let hoveredElement = null;
  let selectedElement = null;

  // Styles pour les overlays
  const overlayStyles = {
    hover: 'outline: 2px solid #03A5C0; outline-offset: -2px; background-color: rgba(3, 165, 192, 0.08);',
    selected: 'outline: 3px solid #03A5C0; outline-offset: -3px; background-color: rgba(3, 165, 192, 0.15);'
  };

  function getElementInfo(element) {
    if (!element || element === document.body || element === document.documentElement) return null;
    
    const rect = element.getBoundingClientRect();
    const computedStyle = window.getComputedStyle(element);
    
    // Construire l'arbre des parents
    const parentTree = [];
    let parent = element.parentElement;
    while (parent && parent !== document.body) {
      parentTree.push({
        tagName: parent.tagName.toLowerCase(),
        id: parent.id || undefined,
        classList: Array.from(parent.classList)
      });
      parent = parent.parentElement;
    }

    // Déterminer le type d'élément sémantique
    const tag = element.tagName.toLowerCase();
    const semanticTypes = {
      'header': 'Header', 'nav': 'Navigation', 'main': 'Main Content',
      'section': 'Section', 'article': 'Article', 'aside': 'Sidebar',
      'footer': 'Footer', 'h1': 'Heading 1', 'h2': 'Heading 2',
      'h3': 'Heading 3', 'p': 'Paragraph', 'a': 'Link',
      'button': 'Button', 'img': 'Image', 'form': 'Form',
      'input': 'Input', 'textarea': 'Text Area', 'ul': 'List',
      'ol': 'Numbered List', 'li': 'List Item', 'div': 'Container',
      'span': 'Text Span'
    };

    return {
      tagName: tag,
      textContent: element.textContent?.slice(0, 100) || '',
      classList: Array.from(element.classList),
      id: element.id || undefined,
      path: getElementPath(element),
      innerHTML: element.innerHTML?.slice(0, 500) || '',
      elementType: semanticTypes[tag] || tag.toUpperCase(),
      isInteractive: ['a', 'button', 'input', 'select', 'textarea'].includes(tag),
      parentTree,
      boundingRect: {
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
        bottom: rect.bottom,
        right: rect.right
      },
      computedStyles: {
        fontSize: computedStyle.fontSize,
        fontWeight: computedStyle.fontWeight,
        color: computedStyle.color,
        backgroundColor: computedStyle.backgroundColor,
        display: computedStyle.display,
        position: computedStyle.position,
        padding: {
          top: parseFloat(computedStyle.paddingTop) || 0,
          right: parseFloat(computedStyle.paddingRight) || 0,
          bottom: parseFloat(computedStyle.paddingBottom) || 0,
          left: parseFloat(computedStyle.paddingLeft) || 0
        },
        margin: {
          top: parseFloat(computedStyle.marginTop) || 0,
          right: parseFloat(computedStyle.marginRight) || 0,
          bottom: parseFloat(computedStyle.marginBottom) || 0,
          left: parseFloat(computedStyle.marginLeft) || 0
        }
      }
    };
  }

  function getElementPath(element) {
    const path = [];
    let el = element;
    while (el && el !== document.body) {
      let selector = el.tagName.toLowerCase();
      if (el.id) {
        selector += '#' + el.id;
      } else if (el.className && typeof el.className === 'string') {
        selector += '.' + el.className.trim().split(/\\s+/).join('.');
      }
      path.unshift(selector);
      el = el.parentElement;
    }
    return path.join(' > ');
  }

  function setElementHighlight(element, type) {
    if (!element) return;
    element.setAttribute('data-inspect-highlight', type);
    element.style.cssText += overlayStyles[type];
  }

  function removeElementHighlight(element) {
    if (!element) return;
    element.removeAttribute('data-inspect-highlight');
    // Restaurer le style original (simplifié)
    element.style.outline = '';
    element.style.outlineOffset = '';
    element.style.backgroundColor = '';
  }

  // Écouter les messages du parent
  window.addEventListener('message', function(event) {
    if (event.data.type === 'inspect-mode-on') {
      inspectMode = true;
      document.body.style.cursor = 'crosshair';
    } else if (event.data.type === 'inspect-mode-off') {
      inspectMode = false;
      document.body.style.cursor = '';
      if (hoveredElement) {
        removeElementHighlight(hoveredElement);
        hoveredElement = null;
      }
    } else if (event.data.type === 'select-parent' && selectedElement) {
      const parentIndex = event.data.parentIndex;
      let parent = selectedElement;
      for (let i = 0; i <= parentIndex && parent.parentElement; i++) {
        parent = parent.parentElement;
      }
      if (parent && parent !== document.body) {
        const info = getElementInfo(parent);
        if (info) {
          window.parent.postMessage({ type: 'inspect-element-selected', elementInfo: info }, '*');
        }
      }
    }
  });

  // Hover
  document.addEventListener('mousemove', function(e) {
    if (!inspectMode) return;
    
    const element = document.elementFromPoint(e.clientX, e.clientY);
    if (element && element !== hoveredElement) {
      if (hoveredElement) {
        removeElementHighlight(hoveredElement);
      }
      hoveredElement = element;
      setElementHighlight(element, 'hover');
      
      const info = getElementInfo(element);
      if (info) {
        window.parent.postMessage({ type: 'inspect-element-hover', elementInfo: info }, '*');
      }
    }
  });

  // Click pour sélectionner
  document.addEventListener('click', function(e) {
    if (!inspectMode) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    let element = document.elementFromPoint(e.clientX, e.clientY);
    
    // Shift+Click pour sélectionner le parent
    if (e.shiftKey && element && element.parentElement) {
      element = element.parentElement;
    }
    
    if (element) {
      if (hoveredElement) {
        removeElementHighlight(hoveredElement);
        hoveredElement = null;
      }
      
      selectedElement = element;
      const info = getElementInfo(element);
      if (info) {
        window.parent.postMessage({ type: 'inspect-element-selected', elementInfo: info }, '*');
      }
    }
  }, true);

  // Keyboard navigation
  document.addEventListener('keydown', function(e) {
    if (!inspectMode) return;
    
    if (e.key === 'Escape') {
      window.parent.postMessage({ type: 'inspect-escape' }, '*');
    }
  });

  // Signaler que l'inspector est prêt
  window.parent.postMessage({ type: 'inspector-ready' }, '*');
})();
`;

interface LocalInspectablePreviewProps {
  projectFiles: Record<string, string>;
  previewMode?: 'desktop' | 'mobile';
  onInspectorMessage?: (data: any) => void;
  onIframeReady?: (iframe: HTMLIFrameElement) => void;
}

export interface LocalInspectablePreviewHandle {
  setInspectMode: (enabled: boolean) => void;
  getIframe: () => HTMLIFrameElement | null;
  reload: () => void;
}

export const LocalInspectablePreview = forwardRef<LocalInspectablePreviewHandle, LocalInspectablePreviewProps>(({
  projectFiles,
  previewMode = 'desktop',
  onInspectorMessage,
  onIframeReady
}, ref) => {
  const { isDark } = useThemeStore();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isReady, setIsReady] = useState(false);

  // Combiner les fichiers du projet en un seul HTML
  const combinedHtml = useMemo(() => {
    // Récupérer les fichiers
    const html = projectFiles['/index.html'] || projectFiles['index.html'] || '';
    const css = projectFiles['/styles.css'] || projectFiles['styles.css'] || '';
    const js = projectFiles['/app.js'] || projectFiles['app.js'] || '';

    if (!html) {
      return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Preview</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>${css}</style>
</head>
<body>
  <div id="app"></div>
  <script>${js}</script>
  <script>${INSPECTOR_SCRIPT}</script>
</body>
</html>`;
    }

    let combined = html;

    // Injecter le CSS inline
    if (css) {
      // Remplacer le lien vers styles.css par le contenu inline
      combined = combined.replace(
        /<link[^>]*href=["']\.?\/?styles\.css["'][^>]*>/gi,
        `<style>${css}</style>`
      );
      // Si pas de lien trouvé, ajouter avant </head>
      if (!combined.includes(`<style>${css}</style>`)) {
        combined = combined.replace('</head>', `<style>${css}</style></head>`);
      }
    }

    // Injecter le JS inline
    if (js) {
      // Remplacer le script vers app.js par le contenu inline
      combined = combined.replace(
        /<script[^>]*src=["']\.?\/?app\.js["'][^>]*><\/script>/gi,
        `<script>${js}</script>`
      );
      // Si pas de script trouvé, ajouter avant </body>
      if (!combined.includes(`<script>${js}</script>`)) {
        combined = combined.replace('</body>', `<script>${js}</script></body>`);
      }
    }

    // Injecter le script d'inspection
    combined = combined.replace('</body>', `<script>${INSPECTOR_SCRIPT}</script></body>`);

    return combined;
  }, [projectFiles]);

  // Écouter les messages de l'iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type?.startsWith('inspect-') || event.data?.type === 'inspector-ready') {
        if (event.data.type === 'inspector-ready') {
          setIsReady(true);
        }
        onInspectorMessage?.(event.data);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onInspectorMessage]);

  // Notifier quand l'iframe est prête
  const handleIframeLoad = useCallback(() => {
    if (iframeRef.current) {
      onIframeReady?.(iframeRef.current);
    }
  }, [onIframeReady]);

  // Méthodes exposées
  const setInspectMode = useCallback((enabled: boolean) => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage({
        type: enabled ? 'inspect-mode-on' : 'inspect-mode-off'
      }, '*');
    }
  }, []);

  const reload = useCallback(() => {
    if (iframeRef.current) {
      iframeRef.current.srcdoc = combinedHtml;
    }
  }, [combinedHtml]);

  useImperativeHandle(ref, () => ({
    setInspectMode,
    getIframe: () => iframeRef.current,
    reload
  }));

  return (
    <div className={`w-full h-full ${previewMode === 'mobile' ? 'max-w-[375px] mx-auto border-x border-border' : ''}`}>
      <iframe
        ref={iframeRef}
        srcDoc={combinedHtml}
        title="Preview"
        className="w-full h-full border-0 bg-white"
        sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
        onLoad={handleIframeLoad}
      />
    </div>
  );
});

LocalInspectablePreview.displayName = 'LocalInspectablePreview';

export default LocalInspectablePreview;
