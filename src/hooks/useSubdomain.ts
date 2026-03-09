import { useMemo } from 'react';

/**
 * Hook to detect if we are on a subdomain
 * Returns the subdomain name or null if on the main domain
 */
export function useSubdomain(): string | null {
  return useMemo(() => {
    const hostname = window.location.hostname;

    // In development (localhost)
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1'
    ) {
      return null;
    }

    // Platform domains to ignore (no subdomain)
    const platformDomains = [
      '.pages.dev',           // Cloudflare Pages
      '.netlify.app',         // Netlify
      '.vercel.app',          // Vercel
      '.github.io',           // GitHub Pages
      '.onrender.com',        // Render
      '.fly.dev',             // Fly.io
    ];

    // If it's a platform domain, no subdomain
    for (const domain of platformDomains) {
      if (hostname.endsWith(domain) || hostname === domain.substring(1)) {
        return null;
      }
    }

    const parts = hostname.split('.');

    // If we have at least 3 parts (e.g., subdomain.builtbymagellan.com)
    if (parts.length >= 3) {
      const subdomain = parts[0];

      // Ignore 'www' as a subdomain
      if (subdomain !== 'www' && hostname.includes('builtbymagellan.com')) {
        return subdomain;
      }
    }

    return null;
  }, []);
}
