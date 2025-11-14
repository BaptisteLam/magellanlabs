import { WebContainer } from '@webcontainer/api';

/**
 * Instance unique de WebContainer partagée pendant toute la durée de vie du navigateur
 * Évite l'erreur "Unable to create more instances"
 */
let webcontainerInstance: WebContainer | null = null;
let bootPromise: Promise<WebContainer> | null = null;

export async function getWebContainer(): Promise<WebContainer> {
  // Si l'instance existe déjà, la retourner immédiatement
  if (webcontainerInstance) {
    return webcontainerInstance;
  }

  // Si un boot est en cours, attendre qu'il se termine
  if (bootPromise) {
    return bootPromise;
  }

  // Démarrer le boot une seule fois
  console.log('🚀 Boot WebContainer (instance unique)...');
  bootPromise = WebContainer.boot()
    .then(instance => {
      webcontainerInstance = instance;
      bootPromise = null;
      console.log('✅ WebContainer prêt');
      return instance;
    })
    .catch(error => {
      console.error('❌ Erreur boot WebContainer:', error);
      bootPromise = null;
      throw error;
    });

  return bootPromise;
}
