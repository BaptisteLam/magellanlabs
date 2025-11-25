import { useMemo } from 'react';

/**
 * Hook to detect if the current page is accessed via a subdomain
 * Returns the subdomain name if present, null otherwise
 * Example: "streamflix.builtbymagellan.com" returns "streamflix"
 */
export function useSubdomain(): string | null {
  return useMemo(() => {
    const hostname = window.location.hostname;
    
    // Development/localhost check
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return null;
    }
    
    // Split hostname into parts
    const parts = hostname.split('.');
    
    // Check if we have a subdomain
    // Format: subdomain.builtbymagellan.com (3 parts)
    // Or: subdomain.domain.tld (3+ parts)
    if (parts.length >= 3) {
      const subdomain = parts[0];
      
      // Exclude common non-project subdomains
      if (subdomain === 'www' || subdomain === 'app' || subdomain === 'api') {
        return null;
      }
      
      return subdomain;
    }
    
    return null;
  }, []);
}
