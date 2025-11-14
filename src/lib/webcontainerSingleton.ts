import { WebContainer } from '@webcontainer/api';

/**
 * Singleton pour WebContainer pour éviter l'erreur "Unable to create more instances"
 * WebContainer a une limite stricte d'instances par navigateur
 */
class WebContainerSingleton {
  private static instance: WebContainer | null = null;
  private static bootPromise: Promise<WebContainer> | null = null;

  static async getInstance(): Promise<WebContainer> {
    // Si on a déjà une instance, la retourner
    if (this.instance) {
      console.log('♻️ Réutilisation de l\'instance WebContainer existante');
      return this.instance;
    }

    // Si un boot est en cours, attendre qu'il se termine
    if (this.bootPromise) {
      console.log('⏳ Boot WebContainer en cours, attente...');
      return this.bootPromise;
    }

    // Sinon, démarrer un nouveau boot
    console.log('🚀 Création de la première instance WebContainer');
    this.bootPromise = WebContainer.boot()
      .then(instance => {
        this.instance = instance;
        this.bootPromise = null;
        console.log('✅ WebContainer singleton prêt');
        return instance;
      })
      .catch(error => {
        console.error('❌ Erreur boot WebContainer:', error);
        this.bootPromise = null;
        throw error;
      });

    return this.bootPromise;
  }

  static reset() {
    console.log('🔄 Reset du singleton WebContainer');
    this.instance = null;
    this.bootPromise = null;
  }
}

export default WebContainerSingleton;
