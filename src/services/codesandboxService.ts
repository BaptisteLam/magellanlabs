/**
 * Service pour interagir avec la CodeSandbox Define API
 * Crée des sandboxes distants et retourne des URLs embed
 */

interface CodeSandboxFile {
  content: string;
  isBinary: boolean;
}

interface CreateSandboxResponse {
  sandbox_id: string;
}

// Cache des sandbox_id par hash de fichiers
const sandboxCache = new Map<string, string>();

/**
 * Génère un hash simple pour les fichiers
 */
function hashFiles(files: Record<string, string>): string {
  const content = JSON.stringify(files);
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    hash = ((hash << 5) - hash) + content.charCodeAt(i);
    hash |= 0;
  }
  return hash.toString(36);
}

/**
 * Crée un sandbox CodeSandbox avec les fichiers fournis
 * @returns sandbox_id
 */
export async function createSandbox(files: Record<string, string>): Promise<string> {
  const hash = hashFiles(files);
  
  // Vérifier le cache
  if (sandboxCache.has(hash)) {
    console.log('[CodeSandbox] Cache hit for hash:', hash);
    return sandboxCache.get(hash)!;
  }

  console.log('[CodeSandbox] Creating sandbox with files:', Object.keys(files));

  // Convertir les fichiers au format CodeSandbox
  const csFiles: Record<string, CodeSandboxFile> = {};
  
  for (const [path, content] of Object.entries(files)) {
    // Normaliser les chemins (retirer le / initial)
    const normalizedPath = path.startsWith('/') ? path.slice(1) : path;
    
    // Ignorer les fichiers vides ou invalides
    if (!content || typeof content !== 'string') continue;
    
    csFiles[normalizedPath] = {
      content,
      isBinary: false
    };
  }

  // S'assurer qu'on a au moins un index.html
  if (!csFiles['index.html']) {
    console.warn('[CodeSandbox] No index.html found, creating fallback');
    csFiles['index.html'] = {
      content: `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Preview</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <div id="app"></div>
  <script src="app.js"></script>
</body>
</html>`,
      isBinary: false
    };
  }

  // S'assurer qu'on a un styles.css
  if (!csFiles['styles.css']) {
    csFiles['styles.css'] = {
      content: `* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'Inter', system-ui, sans-serif; }`,
      isBinary: false
    };
  }

  // S'assurer qu'on a un app.js
  if (!csFiles['app.js']) {
    csFiles['app.js'] = {
      content: `console.log('Site loaded');`,
      isBinary: false
    };
  }

  // Ajouter package.json pour que CodeSandbox reconnaisse le type de projet
  csFiles['package.json'] = {
    content: JSON.stringify({
      name: 'magellan-preview',
      version: '1.0.0',
      main: 'index.html',
      scripts: {
        start: 'serve'
      },
      devDependencies: {
        serve: '^14.0.0'
      }
    }, null, 2),
    isBinary: false
  };

  try {
    // Appeler la Define API
    const response = await fetch(
      'https://codesandbox.io/api/v1/sandboxes/define?json=1',
      {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ files: csFiles })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[CodeSandbox] API error:', response.status, errorText);
      throw new Error(`CodeSandbox API error: ${response.status}`);
    }

    const data: CreateSandboxResponse = await response.json();
    console.log('[CodeSandbox] Sandbox created:', data.sandbox_id);
    
    // Mettre en cache
    sandboxCache.set(hash, data.sandbox_id);
    
    return data.sandbox_id;
  } catch (error) {
    console.error('[CodeSandbox] Failed to create sandbox:', error);
    throw error;
  }
}

/**
 * Génère l'URL embed pour un sandbox
 */
export function getEmbedUrl(sandboxId: string, options?: {
  hideNavigation?: boolean;
  view?: 'preview' | 'editor' | 'split';
  theme?: 'light' | 'dark';
  hideDevTools?: boolean;
}): string {
  const {
    hideNavigation = true,
    view = 'preview',
    theme = 'light',
    hideDevTools = true
  } = options || {};

  const params = new URLSearchParams({
    view,
    hidenavigation: hideNavigation ? '1' : '0',
    theme,
    hidedevtools: hideDevTools ? '1' : '0',
    codemirror: '0',
    fontsize: '14',
    editorsize: '0'
  });

  return `https://codesandbox.io/embed/${sandboxId}?${params.toString()}`;
}

/**
 * Vide le cache des sandboxes
 */
export function clearSandboxCache(): void {
  sandboxCache.clear();
  console.log('[CodeSandbox] Cache cleared');
}

/**
 * Retourne la taille du cache
 */
export function getCacheSize(): number {
  return sandboxCache.size;
}
