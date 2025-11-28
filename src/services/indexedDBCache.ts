/**
 * Service de cache IndexedDB pour les fichiers de projet
 * Stockage local haute performance avec sync différentiel
 */

interface CachedProject {
  sessionId: string;
  projectFiles: Record<string, string>;
  lastModified: number;
  version: number;
  syncStatus: 'synced' | 'pending' | 'error';
}

interface FileChange {
  path: string;
  content: string;
  timestamp: number;
  action: 'created' | 'modified' | 'deleted';
}

export class IndexedDBCache {
  private static DB_NAME = 'MagellanCache';
  private static DB_VERSION = 1;
  private static PROJECTS_STORE = 'projects';
  private static CHANGES_STORE = 'file_changes';
  private static db: IDBDatabase | null = null;

  /**
   * Initialise la base IndexedDB
   */
  static async init(): Promise<void> {
    if (this.db) return;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Store pour les projets complets
        if (!db.objectStoreNames.contains(this.PROJECTS_STORE)) {
          const projectStore = db.createObjectStore(this.PROJECTS_STORE, { keyPath: 'sessionId' });
          projectStore.createIndex('lastModified', 'lastModified', { unique: false });
          projectStore.createIndex('syncStatus', 'syncStatus', { unique: false });
        }

        // Store pour les changements de fichiers (diff)
        if (!db.objectStoreNames.contains(this.CHANGES_STORE)) {
          const changesStore = db.createObjectStore(this.CHANGES_STORE, { 
            keyPath: ['sessionId', 'path', 'timestamp'] 
          });
          changesStore.createIndex('sessionId', 'sessionId', { unique: false });
          changesStore.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });
  }

  /**
   * Sauvegarde un projet complet dans le cache
   */
  static async saveProject(
    sessionId: string,
    projectFiles: Record<string, string>,
    syncStatus: 'synced' | 'pending' | 'error' = 'pending'
  ): Promise<void> {
    await this.init();

    const cached: CachedProject = {
      sessionId,
      projectFiles,
      lastModified: Date.now(),
      version: Date.now(),
      syncStatus
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.PROJECTS_STORE], 'readwrite');
      const store = transaction.objectStore(this.PROJECTS_STORE);
      const request = store.put(cached);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Récupère un projet du cache
   */
  static async getProject(sessionId: string): Promise<CachedProject | null> {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.PROJECTS_STORE], 'readonly');
      const store = transaction.objectStore(this.PROJECTS_STORE);
      const request = store.get(sessionId);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Sauvegarde un changement de fichier (diff)
   */
  static async saveFileChange(
    sessionId: string,
    path: string,
    content: string,
    action: 'created' | 'modified' | 'deleted' = 'modified'
  ): Promise<void> {
    await this.init();

    const change: FileChange = {
      path,
      content,
      timestamp: Date.now(),
      action
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.CHANGES_STORE], 'readwrite');
      const store = transaction.objectStore(this.CHANGES_STORE);
      const request = store.put({ sessionId, ...change });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Récupère tous les changements non-syncés pour une session
   */
  static async getPendingChanges(sessionId: string): Promise<FileChange[]> {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.CHANGES_STORE], 'readonly');
      const store = transaction.objectStore(this.CHANGES_STORE);
      const index = store.index('sessionId');
      const request = index.getAll(sessionId);

      request.onsuccess = () => {
        const changes = request.result.map((item: any) => ({
          path: item.path,
          content: item.content,
          timestamp: item.timestamp,
          action: item.action
        }));
        resolve(changes);
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Marque un projet comme syncé et nettoie les changements
   */
  static async markAsSynced(sessionId: string): Promise<void> {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(
        [this.PROJECTS_STORE, this.CHANGES_STORE], 
        'readwrite'
      );

      // Marquer le projet comme syncé
      const projectStore = transaction.objectStore(this.PROJECTS_STORE);
      const getRequest = projectStore.get(sessionId);

      getRequest.onsuccess = () => {
        const project = getRequest.result;
        if (project) {
          project.syncStatus = 'synced';
          projectStore.put(project);
        }

        // Nettoyer les changements
        const changesStore = transaction.objectStore(this.CHANGES_STORE);
        const index = changesStore.index('sessionId');
        const changesRequest = index.openCursor(IDBKeyRange.only(sessionId));

        changesRequest.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest).result;
          if (cursor) {
            cursor.delete();
            cursor.continue();
          }
        };
      };

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  /**
   * Récupère les N sessions les plus récentes (pour préchargement)
   */
  static async getRecentProjects(limit: number = 5): Promise<CachedProject[]> {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.PROJECTS_STORE], 'readonly');
      const store = transaction.objectStore(this.PROJECTS_STORE);
      const index = store.index('lastModified');
      const request = index.openCursor(null, 'prev'); // Descending order

      const results: CachedProject[] = [];
      let count = 0;

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor && count < limit) {
          results.push(cursor.value);
          count++;
          cursor.continue();
        } else {
          resolve(results);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Calcule le diff entre deux versions de projectFiles
   */
  static calculateDiff(
    oldFiles: Record<string, string>,
    newFiles: Record<string, string>
  ): FileChange[] {
    const changes: FileChange[] = [];
    const allPaths = new Set([...Object.keys(oldFiles), ...Object.keys(newFiles)]);

    allPaths.forEach(path => {
      const oldContent = oldFiles[path];
      const newContent = newFiles[path];

      if (!oldContent && newContent) {
        // Fichier créé
        changes.push({
          path,
          content: newContent,
          timestamp: Date.now(),
          action: 'created'
        });
      } else if (oldContent && !newContent) {
        // Fichier supprimé
        changes.push({
          path,
          content: '',
          timestamp: Date.now(),
          action: 'deleted'
        });
      } else if (oldContent !== newContent) {
        // Fichier modifié
        changes.push({
          path,
          content: newContent,
          timestamp: Date.now(),
          action: 'modified'
        });
      }
    });

    return changes;
  }

  /**
   * Nettoie les vieux projets (plus de 30 jours)
   */
  static async cleanOldProjects(daysOld: number = 30): Promise<number> {
    await this.init();
    const cutoffTime = Date.now() - (daysOld * 24 * 60 * 60 * 1000);
    let deletedCount = 0;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.PROJECTS_STORE], 'readwrite');
      const store = transaction.objectStore(this.PROJECTS_STORE);
      const index = store.index('lastModified');
      const request = index.openCursor(IDBKeyRange.upperBound(cutoffTime));

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          cursor.delete();
          deletedCount++;
          cursor.continue();
        } else {
          resolve(deletedCount);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Obtient la taille du cache (en MB)
   */
  static async getCacheSize(): Promise<number> {
    if (!navigator.storage || !navigator.storage.estimate) {
      return 0;
    }

    const estimate = await navigator.storage.estimate();
    return (estimate.usage || 0) / (1024 * 1024); // Convert to MB
  }

  /**
   * Vide complètement le cache
   */
  static async clearAll(): Promise<void> {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(
        [this.PROJECTS_STORE, this.CHANGES_STORE], 
        'readwrite'
      );

      transaction.objectStore(this.PROJECTS_STORE).clear();
      transaction.objectStore(this.CHANGES_STORE).clear();

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }
}
