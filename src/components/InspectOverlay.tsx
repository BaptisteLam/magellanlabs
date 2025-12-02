import { useEffect, useRef, useState } from 'react';

export interface ElementInfo {
  tagName: string;
  textContent: string;
  classList: string[];
  path: string;
  innerHTML: string;
  id?: string;
  boundingRect: {
    left: number;
    top: number;
    width: number;
    height: number;
    bottom: number;
    right: number;
  };
}

interface InspectOverlayProps {
  isActive: boolean;
  iframeRef: React.RefObject<HTMLIFrameElement>;
  onElementSelect: (elementInfo: ElementInfo) => void;
}

export function InspectOverlay({ isActive, iframeRef, onElementSelect }: InspectOverlayProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [hoveredRect, setHoveredRect] = useState<DOMRect | null>(null);
  const [hoveredLabel, setHoveredLabel] = useState<string>('');

  useEffect(() => {
    if (!isActive || !iframeRef.current || !overlayRef.current) {
      setHoveredRect(null);
      return;
    }

    const iframe = iframeRef.current;
    const overlay = overlayRef.current;

    const getElementDescription = (tag: string): string => {
      const tagLower = tag.toLowerCase();
      const labels: Record<string, string> = {
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

    const getElementPath = (element: Element): string => {
      const path: string[] = [];
      let current: Element | null = element;

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

    const selectableTags = ['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'P', 'SPAN', 'A', 'BUTTON', 'INPUT', 'IMG', 'SVG', 'DIV', 'SECTION', 'ARTICLE', 'HEADER', 'FOOTER', 'NAV', 'UL', 'LI'];

    const handleMouseMove = (e: MouseEvent) => {
      try {
        const iframeDoc = iframe.contentWindow?.document;
        if (!iframeDoc) return;

        const iframeRect = iframe.getBoundingClientRect();
        const x = e.clientX - iframeRect.left;
        const y = e.clientY - iframeRect.top;

        const element = iframeDoc.elementFromPoint(x, y);
        if (!element || element === iframeDoc.body || element === iframeDoc.documentElement) {
          setHoveredRect(null);
          return;
        }

        if (!selectableTags.includes(element.tagName)) {
          setHoveredRect(null);
          return;
        }

        const rect = element.getBoundingClientRect();
        const adjustedRect = new DOMRect(
          rect.left + iframeRect.left,
          rect.top + iframeRect.top,
          rect.width,
          rect.height
        );

        setHoveredRect(adjustedRect);
        setHoveredLabel(getElementDescription(element.tagName));
      } catch (error) {
        console.error('❌ Erreur hover:', error);
        setHoveredRect(null);
      }
    };

    const handleClick = (e: MouseEvent) => {
      try {
        e.preventDefault();
        e.stopPropagation();

        const iframeDoc = iframe.contentWindow?.document;
        if (!iframeDoc) return;

        const iframeRect = iframe.getBoundingClientRect();
        const x = e.clientX - iframeRect.left;
        const y = e.clientY - iframeRect.top;

        const element = iframeDoc.elementFromPoint(x, y);
        if (!element || element === iframeDoc.body || element === iframeDoc.documentElement) {
          return;
        }

        if (!selectableTags.includes(element.tagName)) {
          return;
        }

        const rect = element.getBoundingClientRect();
        const elementInfo: ElementInfo = {
          tagName: element.tagName,
          textContent: element.textContent?.substring(0, 200) || '',
          classList: Array.from(element.classList),
          path: getElementPath(element),
          innerHTML: element.innerHTML,
          id: element.id || undefined,
          boundingRect: {
            left: rect.left + iframeRect.left,
            top: rect.top + iframeRect.top,
            width: rect.width,
            height: rect.height,
            bottom: rect.bottom + iframeRect.top,
            right: rect.right + iframeRect.left
          }
        };

        console.log('✅ Élément sélectionné:', elementInfo);
        onElementSelect(elementInfo);
      } catch (error) {
        console.error('❌ Erreur click:', error);
      }
    };

    overlay.addEventListener('mousemove', handleMouseMove);
    overlay.addEventListener('click', handleClick);

    return () => {
      overlay.removeEventListener('mousemove', handleMouseMove);
      overlay.removeEventListener('click', handleClick);
      setHoveredRect(null);
    };
  }, [isActive, iframeRef, onElementSelect]);

  if (!isActive) return null;

  return (
    <>
      {/* Overlay transparent pour capturer les événements - z-index très élevé */}
      <div
        ref={overlayRef}
        className="absolute inset-0 cursor-crosshair"
        style={{ pointerEvents: 'auto', zIndex: 9999 }}
      />

      {/* Outline visuel de l'élément survolé */}
      {hoveredRect && (
        <>
          <div
            className="absolute pointer-events-none"
            style={{
              left: `${hoveredRect.left}px`,
              top: `${hoveredRect.top}px`,
              width: `${hoveredRect.width}px`,
              height: `${hoveredRect.height}px`,
              outline: '2px solid #03A5C0',
              outlineOffset: '2px',
              transition: 'all 0.1s ease',
              zIndex: 10000
            }}
          />
          <div
            className="absolute pointer-events-none px-2 py-1 text-xs font-semibold text-white bg-[#03A5C0] rounded shadow-lg"
            style={{
              left: `${hoveredRect.left}px`,
              top: `${hoveredRect.top - 24}px`,
              fontFamily: 'monospace',
              zIndex: 10001
            }}
          >
            {hoveredLabel}
          </div>
        </>
      )}

      {/* Message d'aide */}
      <div 
        className="absolute top-4 right-4 bg-background/95 backdrop-blur-sm border border-border rounded-lg p-3 shadow-lg max-w-xs pointer-events-none"
        style={{ zIndex: 10002 }}
      >
        <p className="text-sm text-muted-foreground">
          Survolez et cliquez sur un élément pour le modifier
        </p>
      </div>
    </>
  );
}
