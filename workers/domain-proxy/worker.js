/**
 * Cloudflare Worker: Domain Proxy
 * Déployé sur: proxy.builtbymagellan.com
 *
 * Ce worker route les requêtes de domaines personnalisés vers les sites Cloudflare Pages correspondants.
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const hostname = url.hostname;

    // Si c'est le domaine proxy lui-même, retourner une page d'info
    if (hostname === 'proxy.builtbymagellan.com') {
      return new Response(
        'Built by Magellan - Domain Proxy Service',
        {
          status: 200,
          headers: { 'Content-Type': 'text/plain' }
        }
      );
    }

    // Lookup du domaine dans KV
    // Format de la clé: "domain:example.com" -> valeur: "project-name-abc123"
    const kvKey = `domain:${hostname}`;
    const projectName = await env.DOMAINS_KV.get(kvKey);

    if (!projectName) {
      return new Response(
        `Domain ${hostname} is not configured. Please configure your domain in Built by Magellan dashboard.`,
        {
          status: 404,
          headers: {
            'Content-Type': 'text/html',
            'Cache-Control': 'no-cache'
          }
        }
      );
    }

    // Construire l'URL du site Cloudflare Pages
    // Format: https://project-name.pages.dev
    const targetUrl = new URL(request.url);
    targetUrl.hostname = `${projectName}.pages.dev`;

    // Créer une nouvelle requête avec le nouveau hostname
    const modifiedRequest = new Request(targetUrl, {
      method: request.method,
      headers: request.headers,
      body: request.body,
      redirect: 'manual'
    });

    // Proxy la requête
    try {
      const response = await fetch(modifiedRequest);

      // Créer une nouvelle réponse avec les headers modifiés
      const modifiedResponse = new Response(response.body, response);

      // Optionnel: Ajouter des headers de sécurité
      modifiedResponse.headers.set('X-Powered-By', 'Built by Magellan');

      // Supprimer les headers qui pourraient causer des problèmes
      modifiedResponse.headers.delete('X-Robots-Tag');

      return modifiedResponse;
    } catch (error) {
      console.error('Proxy error:', error);

      return new Response(
        `Error proxying request: ${error.message}`,
        {
          status: 502,
          headers: { 'Content-Type': 'text/plain' }
        }
      );
    }
  }
};
