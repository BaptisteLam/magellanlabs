import { useMemo, useEffect, useRef, useState } from 'react';

interface CustomIframePreviewProps {
  projectFiles: Record<string, string>;
  isDark?: boolean;
  inspectMode?: boolean;
  onElementSelect?: (elementInfo: any) => void;
}

export function CustomIframePreview({ 
  projectFiles, 
  isDark = false,
  inspectMode = false,
  onElementSelect 
}: CustomIframePreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [currentFile, setCurrentFile] = useState<string>('index.html');

  // Générer le HTML complet avec script d'inspection intégré
  const generatedHTML = useMemo(() => {
    console.log('📦 CustomIframePreview - currentFile:', currentFile);
    console.log('📦 CustomIframePreview - projectFiles:', Object.keys(projectFiles));
    
    if (!projectFiles || Object.keys(projectFiles).length === 0) {
      console.log('⚠️ Aucun fichier de projet');
      return '<html><body><div style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:system-ui">Generating preview...</div></body></html>';
    }

    // Collecter tous les CSS
    const cssFiles = Object.entries(projectFiles)
      .filter(([path]) => path.endsWith('.css'))
      .map(([_, content]) => content)
      .join('\n');

    console.log('📦 CSS collecté:', cssFiles.length, 'caractères');
    
    // Collecter tous les JS
    const jsFiles = Object.entries(projectFiles)
      .filter(([path]) => path.endsWith('.js'))
      .map(([_, content]) => content)
      .join('\n');

    console.log('📦 JS collecté:', jsFiles.length, 'caractères');

    // Vérifier si c'est un projet React/TypeScript
    const isReactProject = Object.keys(projectFiles).some(path => 
      path.endsWith('.tsx') || path.endsWith('.jsx') || path.includes('App.tsx') || path.includes('main.tsx')
    );
    
    console.log('📦 Type de projet:', isReactProject ? 'React/TypeScript' : 'HTML statique');
    
    // Trouver le fichier HTML demandé
    let htmlContent = '';
    const htmlFile = Object.entries(projectFiles).find(([path]) => 
      path === currentFile || path.endsWith('/' + currentFile)
    );
    
    if (htmlFile) {
      console.log('✅ Fichier HTML trouvé:', htmlFile[0]);
      htmlContent = htmlFile[1];
    } else if (isReactProject) {
      console.error('❌ PROBLÈME: Projet React détecté mais CustomIframePreview ne peut pas compiler React!');
      return '<html><body><div style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:system-ui;color:red">❌ Erreur: Ce composant ne peut pas afficher des projets React. Utilisez VitePreview ou BabelPreview.</div></body></html>';
    } else {
      console.log('⚠️ Aucun fichier HTML, création d\'un template de base');
      // Créer un HTML de base
      htmlContent = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Preview</title>
</head>
<body>
  <div id="root"></div>
</body>
</html>`;
    }

    // Injecter les CSS et le script d'inspection DIRECTEMENT dans le HTML
    // ✅ AMÉLIORATION : Script isolé dans une IIFE pour éviter les conflits avec le code utilisateur
    const inspectionScript = `
    <script>
      // 🛡️ ISOLATION COMPLÈTE : IIFE pour éviter les conflits de variables
      (function() {
        'use strict';

        try {
          // Variables privées dans le scope de l'IIFE
          let inspectMode = false;
          let currentHighlight = null;

          console.log('🔧 [Magellan Inspect] Script d\'inspection chargé et isolé');

          // Intercepter TOUS les clics sur liens pour isoler la preview
          try {
            document.addEventListener('click', function(e) {
              try {
                const target = e.target.closest('a');
                if (target && target.href) {
                  const href = target.getAttribute('href') || '';

                  // Bloquer TOUS les liens externes et magellan
                  if (href.startsWith('http') || href.startsWith('//') || href.includes('magellan') || href.startsWith('mailto:') || href.startsWith('tel:')) {
                    e.preventDefault();
                    e.stopPropagation();

                    // Afficher message d'erreur
                    const errorDiv = document.createElement('div');
                    errorDiv.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#fff;color:#000;padding:2rem;border-radius:8px;box-shadow:0 4px 20px rgba(0,0,0,0.3);z-index:999999;max-width:400px;text-align:center;font-family:system-ui;';
                    errorDiv.innerHTML = \`
                      <h3 style="margin:0 0 1rem 0;font-size:1.25rem;color:#dc2626;">🚫 Lien externe bloqué</h3>
                      <p style="margin:0 0 1rem 0;color:#666;">Les liens externes sont désactivés dans la preview.</p>
                      <button onclick="this.parentElement.remove()" style="background:rgb(3,165,192);color:#fff;border:none;padding:0.5rem 1.5rem;border-radius:9999px;cursor:pointer;font-size:1rem;font-weight:500;">Fermer</button>
                    \`;
                    document.body.appendChild(errorDiv);
                    setTimeout(() => errorDiv.remove(), 3000);
                    return false;
                  }

                  // Pour les ancres (#section)
                  if (href.startsWith('#')) {
                    // Laisser l'ancre fonctionner
                    return true;
                  }

                  // Pour les autres liens internes (navigation multi-pages)
                  const pathname = href.replace(/^\//, '');
                  if (pathname && pathname !== '' && pathname !== '/') {
                    e.preventDefault();
                    e.stopPropagation();

                    // Envoyer un message au parent pour charger le fichier
                    window.parent.postMessage({
                      type: 'navigate',
                      file: pathname
                    }, '*');
                    return false;
                  }
                }
              } catch (err) {
                console.error('🔴 [Magellan Inspect] Erreur dans link blocker:', err);
              }
            }, true);
          } catch (err) {
            console.error('🔴 [Magellan Inspect] Erreur lors de l\'ajout du link blocker:', err);
          }

          // Écouter les messages du parent
          window.addEventListener('message', (e) => {
            try {
              console.log('📨 [Magellan Inspect] Message reçu dans iframe:', e.data);
              if (e.data.type === 'toggle-inspect') {
                console.log('🔍 [Magellan Inspect] Toggle inspect mode:', e.data.enabled);
                inspectMode = e.data.enabled;
                if (inspectMode) {
                  console.log('✅ [Magellan Inspect] Activation du mode inspection');
                  activateInspection();
                } else {
                  console.log('❌ [Magellan Inspect] Désactivation du mode inspection');
                  deactivateInspection();
                }
              }
            } catch (err) {
              console.error('🔴 [Magellan Inspect] Erreur dans message handler:', err);
            }
          });

          function activateInspection() {
            try {
              console.log('🎯 [Magellan Inspect] activateInspection appelée');
              if (document.body) {
                document.body.style.cursor = 'crosshair';
              }
              document.addEventListener('click', handleElementClick, true);
              document.addEventListener('mouseover', highlightElement, true);
              document.addEventListener('mouseout', removeHighlight, true);
              console.log('✅ [Magellan Inspect] Event listeners ajoutés avec succès');
            } catch (err) {
              console.error('🔴 [Magellan Inspect] Erreur dans activateInspection:', err);
            }
          }

          function deactivateInspection() {
            try {
              if (document.body) {
                document.body.style.cursor = 'default';
              }
              document.removeEventListener('click', handleElementClick, true);
              document.removeEventListener('mouseover', highlightElement, true);
              document.removeEventListener('mouseout', removeHighlight, true);
              removeHighlight();
            } catch (err) {
              console.error('🔴 [Magellan Inspect] Erreur dans deactivateInspection:', err);
            }
          }

          function highlightElement(e) {
            try {
              if (!inspectMode) return;

              const target = e.target;
              if (!target || target === document.body || target === document.documentElement) return;

              // Filtrer les éléments non pertinents
              const selectableTags = ['H1','H2','H3','H4','H5','H6','P','SPAN','A','BUTTON','INPUT','IMG','SVG','DIV','SECTION','ARTICLE','HEADER','FOOTER','NAV'];
              if (!target.tagName || !selectableTags.includes(target.tagName)) return;

              removeHighlight();

              // Créer un overlay au lieu d'un outline
              const rect = target.getBoundingClientRect();
              const overlay = document.createElement('div');
              overlay.id = '__inspect_overlay__';
              overlay.style.cssText = \`
                position: fixed;
                left: \${rect.left}px;
                top: \${rect.top}px;
                width: \${rect.width}px;
                height: \${rect.height}px;
                border: 2px solid #03A5C0;
                border-radius: 4px;
                box-shadow: 0 0 0 4px rgba(3, 165, 192, 0.2);
                pointer-events: none;
                z-index: 999999;
                transition: all 150ms ease-in-out;
              \`;
              if (document.body) {
                document.body.appendChild(overlay);
              }
              currentHighlight = target;
            } catch (err) {
              console.error('🔴 [Magellan Inspect] Erreur dans highlightElement:', err);
            }
          }

          function removeHighlight() {
            try {
              const overlay = document.getElementById('__inspect_overlay__');
              if (overlay) {
                overlay.remove();
              }
              if (currentHighlight) {
                currentHighlight = null;
              }
            } catch (err) {
              console.error('🔴 [Magellan Inspect] Erreur dans removeHighlight:', err);
            }
          }

          function handleElementClick(e) {
            try {
              if (!inspectMode) return;

              e.preventDefault();
              e.stopPropagation();

              const target = e.target;
              const rect = target.getBoundingClientRect();

              window.parent.postMessage({
                type: 'element-selected',
                data: {
                  tagName: target.tagName,
                  textContent: target.textContent?.substring(0, 200) || '',
                  classList: Array.from(target.classList || []),
                  path: getElementPath(target),
                  innerHTML: target.innerHTML || '',
                  id: target.id || undefined,
                  boundingRect: {
                    left: rect.left,
                    top: rect.top,
                    width: rect.width,
                    height: rect.height,
                    bottom: rect.bottom,
                    right: rect.right
                  }
                }
              }, '*');
            } catch (err) {
              console.error('🔴 [Magellan Inspect] Erreur dans handleElementClick:', err);
            }
          }

          function getElementPath(element) {
            try {
              const path = [];
              let current = element;

              while (current && current !== document.body) {
                let selector = current.tagName.toLowerCase();

                if (current.id) {
                  selector += '#' + current.id;
                } else if (current.className && typeof current.className === 'string') {
                  const classes = Array.from(current.classList || []).join('.');
                  if (classes) selector += '.' + classes;
                }

                path.unshift(selector);
                current = current.parentElement;
              }

              return path.join(' > ');
            } catch (err) {
              console.error('🔴 [Magellan Inspect] Erreur dans getElementPath:', err);
              return 'unknown';
            }
          }

          // 🏥 Health check : Confirmer que le système est opérationnel
          console.log('✅ [Magellan Inspect] Système d\'inspection initialisé avec succès');

          // Notifier le parent que le script est prêt
          window.parent.postMessage({
            type: 'inspect-system-ready',
            ready: true
          }, '*');

        } catch (err) {
          console.error('🔴 [Magellan Inspect] ERREUR CRITIQUE lors de l\'initialisation:', err);
          // Même en cas d'erreur, notifier le parent
          try {
            window.parent.postMessage({
              type: 'inspect-system-error',
              error: err.message
            }, '*');
          } catch (e) {
            console.error('🔴 [Magellan Inspect] Impossible de notifier le parent:', e);
          }
        }
      })();
    </script>
    `;

    // Injecter CSS et JS dans le HTML
    let finalHTML = htmlContent;

    // ✅ AJOUTER LE CSS DANS LE <HEAD>
    if (cssFiles) {
      console.log('✅ Injection CSS dans <head>');
      const styleTag = `<style>${cssFiles}</style>`;
      if (finalHTML.includes('</head>')) {
        finalHTML = finalHTML.replace('</head>', `${styleTag}</head>`);
      } else {
        finalHTML = finalHTML.replace('<head>', `<head>${styleTag}`);
      }
    } else {
      console.warn('⚠️ Aucun CSS à injecter');
    }

    // ✅ AMÉLIORATION : Injecter le script d'inspection EN PREMIER pour garantir son exécution
    // Même si le code utilisateur a des erreurs, le système d'inspection fonctionnera
    if (jsFiles) {
      console.log('✅ Injection du script d\'inspection PUIS du JS utilisateur');
      const scriptTag = `<script>${jsFiles}</script>`;
      if (finalHTML.includes('</body>')) {
        // Script d'inspection EN PREMIER, code utilisateur APRÈS
        finalHTML = finalHTML.replace('</body>', `${inspectionScript}${scriptTag}</body>`);
      } else {
        finalHTML += inspectionScript + scriptTag;
      }
    } else {
      console.warn('⚠️ Aucun JS à injecter, ajout du script d\'inspection seul');
      // Ajouter quand même le script d'inspection
      if (finalHTML.includes('</body>')) {
        finalHTML = finalHTML.replace('</body>', `${inspectionScript}</body>`);
      } else {
        finalHTML += inspectionScript;
      }
    }

    return finalHTML;
  }, [projectFiles, currentFile]);

  // Écouter les messages de l'iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'element-selected' && onElementSelect) {
        onElementSelect(event.data.data);
      }
      
      // Gérer la navigation multi-pages
      if (event.data.type === 'navigate') {
        const filename = event.data.file;
        console.log('🔄 Navigation vers:', filename);
        
        // Vérifier si le fichier existe
        const fileExists = Object.keys(projectFiles).some(path => 
          path === filename || path.endsWith('/' + filename)
        );
        
        if (fileExists) {
          setCurrentFile(filename);
        } else {
          console.error('❌ Fichier non trouvé:', filename);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onElementSelect, projectFiles]);

  // Envoyer l'état d'inspection à l'iframe
  useEffect(() => {
    console.log('📤 Envoi du mode inspection:', inspectMode);
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage({
        type: 'toggle-inspect',
        enabled: inspectMode
      }, '*');
      console.log('✅ Message envoyé');
    } else {
      console.log('❌ Iframe contentWindow non disponible');
    }
  }, [inspectMode]);

  // Mettre à jour l'iframe quand le HTML change
  useEffect(() => {
    if (iframeRef.current) {
      const doc = iframeRef.current.contentDocument;
      if (doc) {
        doc.open();
        doc.write(generatedHTML);
        doc.close();

        // Attendre que l'iframe soit chargée puis réappliquer le mode inspect
        const sendInspectMode = () => {
          if (iframeRef.current?.contentWindow) {
            iframeRef.current.contentWindow.postMessage({
              type: 'toggle-inspect',
              enabled: inspectMode
            }, '*');
          }
        };

        // Envoyer le message après un délai pour s'assurer que le script est chargé
        setTimeout(sendInspectMode, 200);
      }
    }
  }, [generatedHTML]); // ✅ CORRECTION : Supprimé inspectMode pour éviter le rechargement de l'iframe

  return (
    <iframe
      ref={iframeRef}
      className="w-full h-full border-0"
      sandbox="allow-scripts allow-same-origin allow-forms allow-modals"
      title="Preview"
    />
  );
}
