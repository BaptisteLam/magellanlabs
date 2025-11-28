/**
 * Service de chargement lazy des fichiers
 * Charge uniquement les fichiers visibles/nécessaires pour optimiser les performances
 */

export interface LazyLoadConfig {
  priority: 'high' | 'medium' | 'low';
  loadImmediately: boolean;
}

export class LazyFileLoader {
  private static loadedFiles = new Set<string>();
  private static loadingQueue: Array<{ path: string; priority: number }> = [];
  private static isProcessing = false;

  /**
   * Détermine la priorité de chargement d'un fichier
   */
  static getFilePriority(path: string, visibleFiles: string[]): LazyLoadConfig {
    const ext = path.split('.').pop()?.toLowerCase();
    const fileName = path.split('/').pop()?.toLowerCase() || '';

    // Priorité haute : fichiers critiques et visibles
    if (visibleFiles.includes(path)) {
      return { priority: 'high', loadImmediately: true };
    }

    // Fichiers critiques
    const criticalFiles = ['index.html', 'app.tsx', 'main.tsx', 'index.tsx', 'styles.css'];
    if (criticalFiles.some(cf => fileName === cf.toLowerCase())) {
      return { priority: 'high', loadImmediately: true };
    }

    // Priorité moyenne : fichiers sources
    const sourceExts = ['tsx', 'ts', 'jsx', 'js', 'css', 'scss'];
    if (ext && sourceExts.includes(ext)) {
      return { priority: 'medium', loadImmediately: false };
    }

    // Priorité basse : assets, configs, etc.
    return { priority: 'low', loadImmediately: false };
  }

  /**
   * Charge les fichiers selon leur priorité
   */
  static async loadFiles(
    projectFiles: Record<string, string>,
    visibleFiles: string[]
  ): Promise<Record<string, string>> {
    const loadedFiles: Record<string, string> = {};
    const filePaths = Object.keys(projectFiles);

    // Classifier les fichiers par priorité
    const highPriority: string[] = [];
    const mediumPriority: string[] = [];
    const lowPriority: string[] = [];

    filePaths.forEach(path => {
      const config = this.getFilePriority(path, visibleFiles);
      
      if (config.priority === 'high') {
        highPriority.push(path);
      } else if (config.priority === 'medium') {
        mediumPriority.push(path);
      } else {
        lowPriority.push(path);
      }
    });

    console.log('📂 File loading priorities:', {
      high: highPriority.length,
      medium: mediumPriority.length,
      low: lowPriority.length
    });

    // Charger immédiatement les fichiers haute priorité
    highPriority.forEach(path => {
      loadedFiles[path] = projectFiles[path];
      this.loadedFiles.add(path);
    });

    // Charger les fichiers moyenne priorité avec un léger délai
    setTimeout(() => {
      mediumPriority.forEach(path => {
        if (!this.loadedFiles.has(path)) {
          loadedFiles[path] = projectFiles[path];
          this.loadedFiles.add(path);
        }
      });
    }, 100);

    // Charger les fichiers basse priorité en arrière-plan
    setTimeout(() => {
      lowPriority.forEach(path => {
        if (!this.loadedFiles.has(path)) {
          loadedFiles[path] = projectFiles[path];
          this.loadedFiles.add(path);
        }
      });
    }, 500);

    return loadedFiles;
  }

  /**
   * Charge un fichier spécifique à la demande
   */
  static async loadFileOnDemand(
    path: string,
    projectFiles: Record<string, string>
  ): Promise<string | null> {
    if (this.loadedFiles.has(path)) {
      console.log(`📄 File ${path} already loaded`);
      return projectFiles[path] || null;
    }

    console.log(`📥 Loading file on demand: ${path}`);
    this.loadedFiles.add(path);
    return projectFiles[path] || null;
  }

  /**
   * Précharge les dépendances d'un fichier
   */
  static async preloadDependencies(
    filePath: string,
    fileContent: string,
    projectFiles: Record<string, string>
  ): Promise<string[]> {
    const dependencies: string[] = [];

    // Extraire les imports du fichier
    const importRegex = /import\s+.*?from\s+['"](.+?)['"]/g;
    let match;

    while ((match = importRegex.exec(fileContent)) !== null) {
      const importPath = match[1];
      
      // Résoudre le chemin relatif
      const resolvedPath = this.resolveImportPath(filePath, importPath);
      
      if (resolvedPath && projectFiles[resolvedPath]) {
        dependencies.push(resolvedPath);
        
        // Charger la dépendance si pas encore chargée
        if (!this.loadedFiles.has(resolvedPath)) {
          await this.loadFileOnDemand(resolvedPath, projectFiles);
        }
      }
    }

    return dependencies;
  }

  /**
   * Résout un chemin d'import relatif
   */
  private static resolveImportPath(currentFile: string, importPath: string): string | null {
    // Ignorer les imports de modules npm
    if (!importPath.startsWith('.') && !importPath.startsWith('/')) {
      return null;
    }

    const currentDir = currentFile.split('/').slice(0, -1).join('/');
    
    // Import absolu
    if (importPath.startsWith('/')) {
      return importPath.slice(1);
    }

    // Import relatif
    const parts = importPath.split('/');
    const dirParts = currentDir.split('/');

    parts.forEach(part => {
      if (part === '..') {
        dirParts.pop();
      } else if (part !== '.') {
        dirParts.push(part);
      }
    });

    let resolved = dirParts.join('/');

    // Ajouter l'extension si manquante
    if (!resolved.match(/\.(tsx?|jsx?|css|scss)$/)) {
      // Essayer différentes extensions
      const extensions = ['.tsx', '.ts', '.jsx', '.js', '.css'];
      for (const ext of extensions) {
        const withExt = resolved + ext;
        if (withExt) return withExt;
      }
      // Essayer index
      for (const ext of extensions) {
        const withIndex = `${resolved}/index${ext}`;
        if (withIndex) return withIndex;
      }
    }

    return resolved;
  }

  /**
   * Nettoie les fichiers chargés
   */
  static clearLoadedFiles() {
    this.loadedFiles.clear();
    this.loadingQueue = [];
  }

  /**
   * Obtient les statistiques de chargement
   */
  static getStats() {
    return {
      loadedCount: this.loadedFiles.size,
      queuedCount: this.loadingQueue.length,
      isProcessing: this.isProcessing
    };
  }
}
