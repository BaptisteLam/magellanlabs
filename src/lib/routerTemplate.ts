// Template du router.js injecté dans les projets statiques générés
// Système de routing vanilla JS avec hash routing et communication postMessage

export const ROUTER_JS_TEMPLATE = `/**
 * SimpleRouter - Système de routing vanilla JS avec hash routing
 * Communication bidirectionnelle avec la barre d'URL parent via postMessage
 */
class SimpleRouter {
  constructor() {
    this.routes = {};
    this.currentPath = this.getPathFromHash();
    this.history = [this.currentPath];
    this.historyIndex = 0;
    this.container = null;
    this.initialized = false;
    
    // Écouter les changements de hash
    window.addEventListener('hashchange', () => this.handleHashChange());
    
    // Écouter les messages du parent (navigation depuis la barre d'URL)
    window.addEventListener('message', (e) => this.handleParentMessage(e));
    
    console.log('[Router] Initialized with path:', this.currentPath);
  }
  
  getPathFromHash() {
    const hash = window.location.hash.slice(1);
    return hash || '/';
  }
  
  /**
   * Enregistrer une route avec son handler
   * @param {string} path - Chemin de la route (ex: '/', '/about')
   * @param {Function} handler - Fonction retournant le HTML de la page
   */
  register(path, handler) {
    this.routes[path] = handler;
  }
  
  /**
   * Naviguer vers un chemin ou delta historique
   * @param {string|number} pathOrDelta - Chemin ('/about') ou delta (-1, +1)
   */
  navigate(pathOrDelta) {
    if (typeof pathOrDelta === 'number') {
      // Delta historique (-1 = back, +1 = forward)
      const newIndex = this.historyIndex + pathOrDelta;
      if (newIndex >= 0 && newIndex < this.history.length) {
        this.historyIndex = newIndex;
        this.currentPath = this.history[this.historyIndex];
        window.location.hash = this.currentPath;
        this.render();
        this.notifyParent();
      }
    } else {
      // Nouveau chemin
      const path = pathOrDelta.startsWith('/') ? pathOrDelta : '/' + pathOrDelta;
      
      if (path === this.currentPath) return;
      
      // Tronquer l'historique si on est pas à la fin
      if (this.historyIndex < this.history.length - 1) {
        this.history = this.history.slice(0, this.historyIndex + 1);
      }
      
      // Ajouter au historique
      this.history.push(path);
      this.historyIndex = this.history.length - 1;
      this.currentPath = path;
      
      window.location.hash = path;
      this.render();
      this.notifyParent();
    }
  }
  
  handleHashChange() {
    const newPath = this.getPathFromHash();
    if (newPath !== this.currentPath) {
      // Navigation externe (clic sur lien avec href="#/path")
      if (this.historyIndex < this.history.length - 1) {
        this.history = this.history.slice(0, this.historyIndex + 1);
      }
      this.history.push(newPath);
      this.historyIndex = this.history.length - 1;
      this.currentPath = newPath;
      this.render();
      this.notifyParent();
    }
  }
  
  handleParentMessage(event) {
    const { type, path, action } = event.data || {};
    
    switch (type) {
      case 'NAVIGATE':
        if (path) {
          this.navigate(path);
        }
        break;
      case 'NAVIGATE_BACK':
        this.navigate(-1);
        break;
      case 'NAVIGATE_FORWARD':
        this.navigate(1);
        break;
      case 'RELOAD':
        this.render();
        this.notifyParent();
        break;
      case 'GET_STATE':
        this.notifyParent();
        break;
    }
  }
  
  notifyParent() {
    try {
      window.parent.postMessage({
        type: 'ROUTE_CHANGE',
        path: this.currentPath,
        canGoBack: this.historyIndex > 0,
        canGoForward: this.historyIndex < this.history.length - 1,
        historyLength: this.history.length,
        historyIndex: this.historyIndex
      }, '*');
    } catch (e) {
      console.error('[Router] Failed to notify parent:', e);
    }
  }
  
  render() {
    if (!this.container) {
      this.container = document.getElementById('app') || document.body;
    }
    
    let handler = this.routes[this.currentPath];
    
    // Fallback vers 404 si route non trouvée
    if (!handler) {
      handler = this.routes['/404'] || this.routes['*'] || (() => this.get404Page());
    }
    
    try {
      const content = typeof handler === 'function' ? handler() : handler;
      
      // Si le container est body et qu'on a du contenu complet, remplacer seulement le main
      const mainEl = document.querySelector('main#app') || document.getElementById('app');
      if (mainEl) {
        mainEl.innerHTML = content;
      } else {
        this.container.innerHTML = content;
      }
      
      // Réattacher les événements sur les liens internes
      this.attachLinkHandlers();
      
      // Scroll to top
      window.scrollTo(0, 0);
      
      console.log('[Router] Rendered:', this.currentPath);
    } catch (e) {
      console.error('[Router] Render error:', e);
    }
  }
  
  attachLinkHandlers() {
    // Intercepter les clics sur les liens avec data-route ou href commençant par #/
    document.querySelectorAll('a[data-route], a[href^="#/"]').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const route = link.dataset.route || link.getAttribute('href')?.replace('#', '');
        if (route) {
          this.navigate(route);
        }
      });
    });
  }
  
  get404Page() {
    return \`
      <div class="min-h-[80vh] flex items-center justify-center">
        <div class="text-center p-8">
          <h1 class="text-6xl font-bold text-gray-300 mb-4">404</h1>
          <h2 class="text-2xl font-semibold text-gray-800 mb-4">Page non trouvée</h2>
          <p class="text-gray-600 mb-8">La page que vous recherchez n'existe pas.</p>
          <a href="#/" data-route="/" class="btn-primary inline-flex items-center gap-2">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
            </svg>
            Retour à l'accueil
          </a>
        </div>
      </div>
    \`;
  }
  
  start() {
    if (this.initialized) return;
    this.initialized = true;
    
    // Attendre le DOM
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        this.render();
        this.notifyParent();
      });
    } else {
      this.render();
      this.notifyParent();
    }
  }
}

// Instance globale du router
window.router = new SimpleRouter();
`;

// Template CSS additionnel pour le routing
export const ROUTER_CSS_ADDITIONS = `
/* Page transitions */
.page-enter {
  animation: pageEnter 0.3s ease forwards;
}

@keyframes pageEnter {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Active nav link */
.nav-link.active {
  color: var(--primary);
}
.nav-link.active::after {
  width: 100%;
}
`;

// Fonction pour générer le router.js avec les pages du projet
export function generateRouterWithPages(pages: { path: string; content: string }[]): string {
  let routeRegistrations = '';
  
  for (const page of pages) {
    const escapedContent = page.content
      .replace(/\\/g, '\\\\')
      .replace(/`/g, '\\`')
      .replace(/\$/g, '\\$');
    
    routeRegistrations += `
router.register('${page.path}', () => \`${escapedContent}\`);
`;
  }
  
  return ROUTER_JS_TEMPLATE + `

// ========== ROUTES ENREGISTRÉES ==========
${routeRegistrations}

// Démarrer le router
router.start();
`;
}
