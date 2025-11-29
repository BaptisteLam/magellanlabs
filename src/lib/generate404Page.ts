/**
 * Génère une page 404 stylisée pour l'affichage dans la preview
 * Utilisée quand un utilisateur navigue vers une page inexistante
 * Complètement isolée du SaaS Magellan - navigation uniquement dans la preview
 */
export function generate404Page(isDark: boolean = false): string {
  const logoUrl = isDark 
    ? '/lovable-uploads/magellan-logo-dark.png'
    : '/lovable-uploads/magellan-logo-light.png';
    
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Page non trouvée - Magellan</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      background: ${isDark ? '#0a0a0a' : '#ffffff'};
      color: ${isDark ? '#e5e5e5' : '#1a1a1a'};
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2rem;
    }
    
    .container {
      max-width: 500px;
      width: 100%;
      text-align: center;
    }
    
    .logo {
      width: 180px;
      height: auto;
      margin-bottom: 2rem;
      animation: fadeInUp 0.6s ease-out;
    }
    
    .error-code {
      font-size: 8rem;
      font-weight: 800;
      line-height: 1;
      background: linear-gradient(135deg, #03A5C0 0%, #0284a8 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      margin-bottom: 1rem;
      animation: fadeInUp 0.6s ease-out 0.1s both;
    }
    
    h1 {
      font-size: 2rem;
      font-weight: 700;
      margin-bottom: 1rem;
      color: ${isDark ? '#ffffff' : '#000000'};
      animation: fadeInUp 0.6s ease-out 0.2s both;
    }
    
    p {
      font-size: 1.125rem;
      color: ${isDark ? '#a3a3a3' : '#666666'};
      margin-bottom: 2rem;
      line-height: 1.6;
      animation: fadeInUp 0.6s ease-out 0.3s both;
    }
    
    .button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      padding: 0.75rem 2rem;
      background: rgba(3, 165, 192, 0.1);
      border: 1px solid rgb(3, 165, 192);
      color: rgb(3, 165, 192);
      border-radius: 9999px;
      font-size: 1rem;
      font-weight: 500;
      text-decoration: none;
      transition: all 0.2s ease;
      cursor: pointer;
      animation: fadeInUp 0.6s ease-out 0.4s both;
    }
    
    .button:hover {
      background: rgba(3, 165, 192, 0.2);
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(3, 165, 192, 0.3);
    }
    
    @keyframes fadeInUp {
      from {
        opacity: 0;
        transform: translateY(20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <img src="${logoUrl}" alt="Magellan" class="logo" />
    <div class="error-code">404</div>
    <h1>Page non trouvée</h1>
    <p>La page que vous recherchez n'existe pas ou n'a pas encore été créée dans ce projet.</p>
    <button class="button" onclick="navigateToHome()">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
        <polyline points="9 22 9 12 15 12 15 22"></polyline>
      </svg>
      Retour à l'accueil
    </button>
  </div>
  
  <script>
    (function() {
      console.log('🏠 404 Page - Script de navigation chargé');
      
      // Navigation isolée dans la preview uniquement - retour à index.html
      window.navigateToHome = function() {
        if (event) {
          event.preventDefault();
          event.stopPropagation();
        }
        
        console.log('🏠 Retour à l\'accueil de la preview (index.html)');
        
        // Envoyer message au parent pour charger index.html dans la preview
        window.parent.postMessage({
          type: 'navigate',
          file: 'index.html'
        }, '*');
        
        return false;
      };
      
      // Bloquer TOUS les liens et tentatives de navigation
      function blockNavigation(e) {
        const target = e.target;
        
        // Vérifier si c'est un lien
        const link = target.closest('a');
        if (link) {
          const href = link.getAttribute('href') || '';
          
          // Bloquer liens externes (http, https, mailto, tel, //)
          if (href.startsWith('http') || href.startsWith('//') || href.startsWith('mailto:') || href.startsWith('tel:')) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            console.log('🚫 Lien externe bloqué:', href);
            
            const errorDiv = document.createElement('div');
            errorDiv.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);background:#dc2626;color:#fff;padding:1rem 2rem;border-radius:9999px;box-shadow:0 4px 12px rgba(0,0,0,0.3);z-index:999999;font-family:system-ui;font-size:14px;font-weight:500;';
            errorDiv.textContent = '🚫 Liens externes bloqués dans la preview';
            document.body.appendChild(errorDiv);
            setTimeout(() => errorDiv.remove(), 2000);
            return false;
          }
          
          // Bloquer navigation interne (autre que #anchors)
          if (href && !href.startsWith('#') && href !== '') {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            console.log('🚫 Navigation interne bloquée depuis 404:', href);
            
            // Envoyer au parent pour vérifier si le fichier existe
            window.parent.postMessage({
              type: 'navigate',
              file: href.replace(/^\//, '')
            }, '*');
            return false;
          }
        }
      }
      
      // Attacher les listeners avec capture pour intercepter avant tout
      document.addEventListener('click', blockNavigation, true);
      
      // Bloquer window.location et autres tentatives programmatiques
      const originalLocation = window.location;
      Object.defineProperty(window, 'location', {
        get: () => originalLocation,
        set: (value) => {
          console.log('🚫 Tentative de modification de window.location bloquée:', value);
          return false;
        }
      });
      
      // Bloquer history.pushState et replaceState
      const originalPushState = history.pushState;
      const originalReplaceState = history.replaceState;
      
      history.pushState = function() {
        console.log('🚫 history.pushState bloqué dans 404');
        return false;
      };
      
      history.replaceState = function() {
        console.log('🚫 history.replaceState bloqué dans 404');
        return false;
      };
      
      console.log('✅ 404 - Protection de navigation activée');
    })();
  </script>
</body>
</html>`;
}
