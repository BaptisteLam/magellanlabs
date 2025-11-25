import { useMemo } from 'react';

/**
 * Hook pour détecter si on est sur un sous-domaine
 * Retourne le nom du sous-domaine ou null si on est sur le domaine principal
 */
export function useSubdomain(): string | null {
  return useMemo(() => {
    const hostname = window.location.hostname;
    
    // En développement (localhost ou lovableproject.com)
    if (
      hostname === 'localhost' || 
      hostname === '127.0.0.1' || 
      hostname.endsWith('.lovableproject.com') ||
      hostname === 'lovableproject.com'
    ) {
      return null;
    }
    
    const parts = hostname.split('.');
    
    // Si on a au moins 3 parties (ex: subdomain.builtbymagellan.com)
    if (parts.length >= 3) {
      const subdomain = parts[0];
      
      // Ignorer 'www' comme sous-domaine
      if (subdomain !== 'www' && hostname.includes('builtbymagellan.com')) {
        return subdomain;
      }
    }
    
    return null;
  }, []);
}
