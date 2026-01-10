/**
 * Utilitaire pour parser et normaliser les fichiers de projet
 * Gère les 3 formats possibles de stockage dans la base de données
 */

interface FileEntry {
  path: string;
  content: string;
}

/**
 * Parse les fichiers de projet depuis n'importe quel format vers Record<string, string>
 * Gère 3 formats:
 * 1. Array: [{path: "...", content: "..."}, ...]
 * 2. Object direct: {path: content, ...}
 * 3. Object-array corrompu: {"0": {path, content}, "1": {...}}
 */
export function parseProjectFiles(projectFilesData: unknown): Record<string, string> {
  if (!projectFilesData) {
    return {};
  }

  let filesMap: Record<string, string> = {};

  // Format 1: Array [{path, content}, ...]
  if (Array.isArray(projectFilesData) && projectFilesData.length > 0) {
    console.log('📦 Parsing project files (array format):', projectFilesData.length, 'files');
    projectFilesData.forEach((file: FileEntry) => {
      if (file.path && file.content) {
        filesMap[file.path] = file.content;
      }
    });
    return validateFilesMap(filesMap);
  }

  // Format 2 & 3: Object
  if (typeof projectFilesData === 'object' && Object.keys(projectFilesData as object).length > 0) {
    const data = projectFilesData as Record<string, unknown>;
    const keys = Object.keys(data);
    const firstKey = keys[0];
    const firstValue = data[firstKey];

    // Format 3: Object-array corrompu {"0": {path, content}, ...}
    if (/^\d+$/.test(firstKey) && typeof firstValue === 'object' && firstValue !== null) {
      const fileEntry = firstValue as FileEntry;
      if (fileEntry.path && fileEntry.content) {
        console.log('📦 Parsing project files (corrupted array-as-object format):', keys.length, 'files');
        Object.values(data).forEach((file) => {
          const f = file as FileEntry;
          if (f.path && f.content) {
            filesMap[f.path] = f.content;
          }
        });
        return validateFilesMap(filesMap);
      }
    }

    // Format 2: Object standard {path: content, ...}
    console.log('📦 Parsing project files (object format):', keys.length, 'files');
    keys.forEach((key) => {
      const value = data[key];
      if (typeof value === 'string') {
        filesMap[key] = value;
      }
    });
    return validateFilesMap(filesMap);
  }

  return {};
}

/**
 * Valide et nettoie le filesMap
 * - Vérifie que les clés sont des noms de fichiers valides
 * - Vérifie que les valeurs sont des strings
 */
function validateFilesMap(filesMap: Record<string, string>): Record<string, string> {
  const validatedFilesMap: Record<string, string> = {};

  Object.entries(filesMap).forEach(([key, value]) => {
    // Clé doit être un nom de fichier valide (contient un point, pas numérique)
    // Valeur doit être une string
    if (
      typeof key === 'string' &&
      key.includes('.') &&
      !/^\d+$/.test(key) &&
      typeof value === 'string'
    ) {
      validatedFilesMap[key] = value;
    }
  });

  if (Object.keys(validatedFilesMap).length > 0) {
    console.log('✅ Project files parsed:', Object.keys(validatedFilesMap).length, 'valid files');
  }

  return validatedFilesMap;
}
