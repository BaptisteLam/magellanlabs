/**
 * Singleton initialisation d'esbuild-wasm
 * Permet de charger esbuild une seule fois pour toute l'application
 */
import * as esbuild from 'esbuild-wasm';

let initialized = false;
let initPromise: Promise<void> | null = null;

/**
 * Initialise esbuild-wasm de manière singleton
 * Appeler cette fonction plusieurs fois est safe, elle ne fera l'init qu'une fois
 */
export async function initEsbuild(): Promise<void> {
  if (initialized) return;
  
  if (initPromise) {
    await initPromise;
    return;
  }
  
  initPromise = (async () => {
    try {
      console.log('⚡ [esbuild] Initializing esbuild-wasm...');
      await esbuild.initialize({
        wasmURL: 'https://unpkg.com/esbuild-wasm@0.27.0/esbuild.wasm'
      });
      initialized = true;
      console.log('✅ [esbuild] Initialization complete');
    } catch (error: any) {
      // Si déjà initialisé, ignorer l'erreur
      if (error.message?.includes('initialized')) {
        initialized = true;
        console.log('✅ [esbuild] Already initialized');
      } else {
        console.error('❌ [esbuild] Initialization failed:', error);
        throw error;
      }
    }
  })();
  
  await initPromise;
}

/**
 * Vérifie si esbuild est initialisé
 */
export function isEsbuildReady(): boolean {
  return initialized;
}

/**
 * Référence au module esbuild pour usage externe
 */
export { esbuild };
