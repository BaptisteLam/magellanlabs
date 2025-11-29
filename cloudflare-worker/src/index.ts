/**
 * Cloudflare Worker pour servir les sites Magellan depuis KV
 * Route: *.builtbymagellan.com
 */

interface Env {
  SITES_KV: KVNamespace;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const hostname = url.hostname;
    
    // Extraire le nom du projet depuis le sous-domaine
    const subdomain = hostname.split('.')[0];
    
    // Si c'est le domaine racine, rediriger vers la page principale
    if (hostname === 'builtbymagellan.com' || subdomain === 'www') {
      return Response.redirect('https://magellan-ai.com', 301);
    }
    
    const projectName = subdomain;
    let path = url.pathname;
    
    // Gestion des routes SPA: si pas d'extension, essayer d'abord le chemin exact, puis index.html
    if (!path.includes('.')) {
      // Essayer d'abord le chemin exact (ex: /about)
      let kvKey = `${projectName}:${path}`;
      let content = await env.SITES_KV.get(kvKey);
      
      // Si pas trouvé, essayer avec .html
      if (!content) {
        kvKey = `${projectName}:${path}.html`;
        content = await env.SITES_KV.get(kvKey);
      }
      
      // Si toujours pas trouvé et c'est la racine, essayer index.html
      if (!content && (path === '/' || path === '')) {
        kvKey = `${projectName}:/index.html`;
        content = await env.SITES_KV.get(kvKey);
      }
      
      // Si toujours rien, essayer le fichier 404 custom du projet
      if (!content) {
        kvKey = `${projectName}:/404.html`;
        content = await env.SITES_KV.get(kvKey);
        
        if (content) {
          return new Response(content, {
            status: 404,
            headers: {
              'Content-Type': 'text/html; charset=utf-8',
              'Cache-Control': 'public, max-age=3600',
            },
          });
        }
        
        // Dernière option: 404 générique Magellan
        return new Response(generate404Page(projectName), {
          status: 404,
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'public, max-age=3600',
          },
        });
      }
      
      return new Response(content, {
        headers: {
          'Content-Type': getMimeType(path),
          'Cache-Control': 'public, max-age=3600',
        },
      });
    }
    
    // Pour les fichiers avec extension, récupérer directement
    const kvKey = `${projectName}:${path}`;
    const content = await env.SITES_KV.get(kvKey, 'text');
    
    if (!content) {
      // Essayer le 404 custom du projet
      const custom404 = await env.SITES_KV.get(`${projectName}:/404.html`);
      if (custom404) {
        return new Response(custom404, {
          status: 404,
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'public, max-age=3600',
          },
        });
      }
      
      return new Response(generate404Page(projectName), {
        status: 404,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'public, max-age=3600',
        },
      });
    }
    
    return new Response(content, {
      headers: {
        'Content-Type': getMimeType(path),
        'Cache-Control': 'public, max-age=3600',
      },
    });
  },
};

/**
 * Détermine le Content-Type basé sur l'extension du fichier
 */
function getMimeType(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase();
  
  const mimeTypes: Record<string, string> = {
    'html': 'text/html; charset=utf-8',
    'css': 'text/css; charset=utf-8',
    'js': 'application/javascript; charset=utf-8',
    'json': 'application/json',
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'gif': 'image/gif',
    'svg': 'image/svg+xml',
    'ico': 'image/x-icon',
    'woff': 'font/woff',
    'woff2': 'font/woff2',
    'ttf': 'font/ttf',
    'eot': 'application/vnd.ms-fontobject',
    'otf': 'font/otf',
    'webp': 'image/webp',
    'pdf': 'application/pdf',
    'txt': 'text/plain; charset=utf-8',
    'xml': 'application/xml',
    'zip': 'application/zip',
  };
  
  return mimeTypes[ext || ''] || 'application/octet-stream';
}

/**
 * Génère une page 404 avec le branding Magellan
 */
function generate404Page(projectName: string): string {
  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>404 - Page non trouvée</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%);
      color: #ffffff;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      text-align: center;
      max-width: 600px;
    }
    .logo {
      width: 80px;
      height: 80px;
      margin: 0 auto 30px;
      background: #03A5C0;
      border-radius: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 40px;
      font-weight: bold;
      color: white;
    }
    h1 {
      font-size: 72px;
      font-weight: 700;
      margin-bottom: 20px;
      background: linear-gradient(135deg, #03A5C0, #0288a3);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    p {
      font-size: 20px;
      color: #888;
      margin-bottom: 40px;
      line-height: 1.6;
    }
    .btn {
      display: inline-block;
      padding: 14px 32px;
      background: #03A5C0;
      color: white;
      text-decoration: none;
      border-radius: 100px;
      font-weight: 600;
      transition: all 0.3s ease;
      border: 2px solid #03A5C0;
    }
    .btn:hover {
      background: transparent;
      color: #03A5C0;
      transform: translateY(-2px);
    }
    .project-name {
      margin-top: 40px;
      font-size: 14px;
      color: #666;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">M</div>
    <h1>404</h1>
    <p>
      Désolé, cette page n'existe pas sur ce projet.<br>
      La ressource que vous recherchez est introuvable.
    </p>
    <a href="/" class="btn">Retour à l'accueil</a>
    <p class="project-name">Projet: ${projectName}</p>
  </div>
</body>
</html>
  `.trim();
}
