// Phase 2: Construction du contexte intelligent et graphe de dépendances avec patterns sémantiques

export interface FileNode {
  path: string;
  type: 'jsx' | 'js' | 'css' | 'html' | 'other';
  imports: string[];
  exports: string[];
  usedBy: string[];
  importanceScore: number;
}

export interface DependencyGraphResult {
  nodes: Map<string, FileNode>;
  relevantFiles: string[];
  totalFiles: number;
}

export interface OptimizedContext {
  files: Record<string, string>;
  truncatedFiles: string[];
  totalLines: number;
  optimizedLines: number;
}

// Fichiers critiques qui ont un bonus de score
const CRITICAL_FILES = ['index', 'main', 'app', 'root', 'layout', 'page'];

// 🆕 Patterns sémantiques pour mapper les mots-clés aux fichiers probables
const SEMANTIC_PATTERNS: Record<string, string[]> = {
  // Éléments UI
  'bouton|button|btn|cta': ['styles.css', 'index.css', 'Button.tsx', 'components/Button.tsx', 'App.tsx'],
  'titre|title|header|heading|h1|h2|h3': ['index.html', 'styles.css', 'index.css', 'App.tsx', 'Header.tsx'],
  'navigation|menu|nav|navbar': ['Header.tsx', 'Navbar.tsx', 'Navigation.tsx', 'index.html', 'App.tsx', 'styles.css'],
  'footer|pied|bas': ['Footer.tsx', 'index.html', 'App.tsx', 'styles.css'],
  'hero|banner|bannière': ['Hero.tsx', 'HeroSection.tsx', 'index.html', 'App.tsx', 'styles.css'],
  
  // Styles
  'couleur|color|background|fond|bg': ['styles.css', 'index.css', 'tailwind.config.ts', 'App.tsx'],
  'police|font|typography|texte|text': ['styles.css', 'index.css', 'tailwind.config.ts'],
  'taille|size|width|height|largeur|hauteur': ['styles.css', 'index.css'],
  'margin|marge|padding|espacement|spacing': ['styles.css', 'index.css'],
  'border|bordure|rounded|arrondi': ['styles.css', 'index.css'],
  'shadow|ombre': ['styles.css', 'index.css'],
  
  // Fonctionnalités
  'formulaire|form|contact|email': ['Contact.tsx', 'ContactForm.tsx', 'Form.tsx', 'index.html', 'App.tsx'],
  'image|photo|logo|icon|icône': ['index.html', 'App.tsx', 'styles.css', 'public/'],
  'carte|card|item|élément': ['Card.tsx', 'styles.css', 'index.css', 'App.tsx'],
  'liste|list|ul|ol': ['index.html', 'App.tsx', 'styles.css'],
  'modal|popup|dialog|dialogue': ['Modal.tsx', 'Dialog.tsx', 'App.tsx'],
  'slider|carousel|carrousel': ['Slider.tsx', 'Carousel.tsx', 'App.tsx'],
  
  // Sections
  'section|bloc|block': ['index.html', 'App.tsx', 'styles.css'],
  'about|apropos|qui': ['About.tsx', 'index.html', 'App.tsx'],
  'services|service': ['Services.tsx', 'index.html', 'App.tsx'],
  'portfolio|projets|works': ['Portfolio.tsx', 'Projects.tsx', 'index.html'],
  'testimonial|témoignage|avis': ['Testimonials.tsx', 'Reviews.tsx', 'index.html'],
  'pricing|tarif|prix': ['Pricing.tsx', 'index.html', 'App.tsx'],
  
  // Actions
  'ajouter|add|créer|create|nouveau|new': ['App.tsx', 'index.html'],
  'supprimer|delete|remove|enlever': ['App.tsx', 'index.html'],
  'modifier|change|update|changer|edit': ['styles.css', 'index.css', 'App.tsx', 'index.html'],
  'animation|animate|transition|mouvement': ['styles.css', 'index.css', 'App.tsx'],
};

export class DependencyGraph {
  private nodes: Map<string, FileNode> = new Map();
  private projectFiles: Record<string, string>;

  constructor(projectFiles: Record<string, string>) {
    this.projectFiles = projectFiles;
  }

  buildGraph(): Map<string, FileNode> {
    // Première passe: créer les noeuds et extraire imports/exports
    for (const [path, content] of Object.entries(this.projectFiles)) {
      const fileType = this.detectFileType(path);
      const node: FileNode = {
        path,
        type: fileType,
        imports: fileType === 'jsx' || fileType === 'js' ? this.extractImports(content) : [],
        exports: fileType === 'jsx' || fileType === 'js' ? this.extractExports(content) : [],
        usedBy: [],
        importanceScore: 0,
      };
      this.nodes.set(path, node);
    }

    // Deuxième passe: calculer les dépendances inverses (usedBy)
    for (const [path, node] of this.nodes) {
      for (const importPath of node.imports) {
        const resolvedPath = this.resolveImportPath(importPath, path);
        const targetNode = this.findNodeByImport(resolvedPath);
        if (targetNode && !targetNode.usedBy.includes(path)) {
          targetNode.usedBy.push(path);
        }
      }
    }

    // Troisième passe: calculer les scores d'importance
    for (const [path, node] of this.nodes) {
      node.importanceScore = this.calculateImportanceScore(node);
    }

    return this.nodes;
  }

  private detectFileType(path: string): FileNode['type'] {
    const ext = path.split('.').pop()?.toLowerCase();
    if (ext === 'tsx' || ext === 'jsx') return 'jsx';
    if (ext === 'ts' || ext === 'js') return 'js';
    if (ext === 'css' || ext === 'scss' || ext === 'sass') return 'css';
    if (ext === 'html' || ext === 'htm') return 'html';
    return 'other';
  }

  private extractImports(content: string): string[] {
    const imports: string[] = [];
    const importRegex = /import\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s*,?\s*)*from\s+['"]([^'"]+)['"]/g;
    const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }
    while ((match = requireRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }
    
    return imports;
  }

  private extractExports(content: string): string[] {
    const exports: string[] = [];
    const exportRegex = /export\s+(?:default\s+)?(?:function|class|const|let|var)\s+(\w+)/g;
    const namedExportRegex = /export\s*\{\s*([^}]+)\s*\}/g;
    
    let match;
    while ((match = exportRegex.exec(content)) !== null) {
      exports.push(match[1]);
    }
    while ((match = namedExportRegex.exec(content)) !== null) {
      const names = match[1].split(',').map(n => n.trim().split(/\s+as\s+/)[0]);
      exports.push(...names);
    }
    
    return exports;
  }

  private resolveImportPath(importPath: string, fromPath: string): string {
    // Ignorer les imports de packages externes
    if (!importPath.startsWith('.') && !importPath.startsWith('@/')) {
      return importPath;
    }
    
    // Résolution basique des chemins relatifs
    if (importPath.startsWith('@/')) {
      return importPath.replace('@/', 'src/');
    }
    
    return importPath;
  }

  private findNodeByImport(importPath: string): FileNode | undefined {
    // Chercher une correspondance exacte ou avec extensions
    const extensions = ['', '.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx', '/index.js'];
    
    for (const ext of extensions) {
      const fullPath = importPath + ext;
      for (const [path, node] of this.nodes) {
        if (path.endsWith(fullPath) || path === fullPath) {
          return node;
        }
      }
    }
    
    return undefined;
  }

  private calculateImportanceScore(node: FileNode): number {
    let score = 0;
    
    // Nombre de fichiers qui utilisent ce fichier (*10)
    score += node.usedBy.length * 10;
    
    // Nombre d'exports (*5)
    score += node.exports.length * 5;
    
    // Bonus pour fichiers critiques (+50)
    const fileName = node.path.split('/').pop()?.replace(/\.[^.]+$/, '').toLowerCase();
    if (fileName && CRITICAL_FILES.includes(fileName)) {
      score += 50;
    }
    
    return score;
  }

  getRelevantFiles(targetFiles: string[], maxFiles: number = 15): string[] {
    const relevantSet = new Set<string>(targetFiles);
    const scoredFiles: Array<{ path: string; score: number }> = [];

    // Ajouter les dépendances directes et les fichiers qui utilisent les cibles
    for (const targetPath of targetFiles) {
      const node = this.nodes.get(targetPath);
      if (!node) continue;

      // Ajouter les imports directs
      for (const importPath of node.imports) {
        const resolved = this.resolveImportPath(importPath, targetPath);
        const targetNode = this.findNodeByImport(resolved);
        if (targetNode) {
          relevantSet.add(targetNode.path);
        }
      }

      // Ajouter les fichiers qui utilisent ce fichier
      for (const usedByPath of node.usedBy) {
        relevantSet.add(usedByPath);
      }
    }

    // Scorer tous les fichiers pertinents
    for (const path of relevantSet) {
      const node = this.nodes.get(path);
      scoredFiles.push({
        path,
        score: node?.importanceScore || 0,
      });
    }

    // Trier par score décroissant et limiter
    return scoredFiles
      .sort((a, b) => b.score - a.score)
      .slice(0, maxFiles)
      .map(f => f.path);
  }
}

// Limites de TOKENS par complexité (au lieu de lignes) - P1
const TOKEN_BUDGETS: Record<string, number> = {
  trivial: 4000,   // ~3 fichiers moyens
  simple: 8000,    // ~6 fichiers
  moderate: 12000, // ~10 fichiers
  complex: 20000,  // ~15 fichiers
};

// Estimation simple des tokens (1 token ≈ 4 caractères)
function estimateTokens(content: string): number {
  return Math.ceil(content.length / 4);
}

// P1: Scoring hybride pour fichiers
export interface FileRelevanceScore {
  path: string;
  scores: {
    ast: number;        // Score basé sur imports/exports
    keyword: number;    // Fréquence termes du prompt dans le fichier
    recency: number;    // Fichiers récemment mentionnés
    critical: number;   // Fichiers critiques (index, main, etc.)
  };
  total: number;
}

// P1: TF-IDF complet avec poids inverse et normalisation
function calculateTFIDF(
  queryTerms: string[],
  document: string,
  documentFrequencies: Map<string, number>,
  totalDocs: number
): number {
  const docTerms = document.toLowerCase().split(/\s+/);
  const docLength = docTerms.length;
  
  if (docLength === 0) return 0;
  
  let score = 0;
  for (const term of queryTerms) {
    // TF: fréquence du terme dans le document (normalisée)
    const termCount = docTerms.filter(t => t.includes(term)).length;
    const tf = termCount / docLength;
    
    // IDF: log(N / df) où N = nombre total de docs, df = docs contenant le terme
    const df = documentFrequencies.get(term) || 1;
    const idf = Math.log((totalDocs + 1) / (df + 1)) + 1; // Lissage pour éviter log(0)
    
    score += tf * idf;
  }
  
  return score * 100; // Normaliser pour être comparable aux autres scores
}

// P1: Pré-calculer les fréquences de documents pour TF-IDF
function computeDocumentFrequencies(
  queryTerms: string[],
  projectFiles: Record<string, string>
): Map<string, number> {
  const frequencies = new Map<string, number>();
  
  for (const term of queryTerms) {
    let count = 0;
    for (const content of Object.values(projectFiles)) {
      if (content.toLowerCase().includes(term)) {
        count++;
      }
    }
    frequencies.set(term, count);
  }
  
  return frequencies;
}

// P1: Calculer le score de pertinence par mots-clés (wrapper pour compatibilité)
function calculateKeywordScore(prompt: string, content: string): number {
  const promptTerms = prompt.toLowerCase().split(/\s+/).filter(t => t.length > 2);
  const contentLower = content.toLowerCase();
  
  let matchCount = 0;
  for (const term of promptTerms) {
    if (contentLower.includes(term)) {
      matchCount++;
    }
  }
  
  return promptTerms.length > 0 ? (matchCount / promptTerms.length) * 50 : 0;
}

// P1: Scoring hybride des fichiers avec TF-IDF amélioré
export function scoreFilesByRelevance(
  prompt: string,
  projectFiles: Record<string, string>,
  graph: DependencyGraph,
  conversationHistory?: Array<{ metadata?: { files_modified?: string[] } }>
): FileRelevanceScore[] {
  const scores: FileRelevanceScore[] = [];
  const recentFiles = new Set<string>();
  const totalDocs = Object.keys(projectFiles).length;

  // P1: Pré-traitement du prompt pour TF-IDF
  const queryTerms = prompt.toLowerCase()
    .split(/\s+/)
    .filter(t => t.length > 2)
    .filter(t => !['les', 'des', 'une', 'pour', 'dans', 'avec', 'sur', 'the', 'and', 'for', 'with'].includes(t));

  // P1: Calculer les fréquences de documents
  const docFrequencies = computeDocumentFrequencies(queryTerms, projectFiles);

  // Extraire les fichiers récemment modifiés de l'historique
  if (conversationHistory) {
    for (const msg of conversationHistory.slice(-10)) {
      if (msg.metadata?.files_modified) {
        msg.metadata.files_modified.forEach(f => recentFiles.add(f));
      }
    }
  }

  for (const [path, content] of Object.entries(projectFiles)) {
    const node = graph['nodes']?.get?.(path);
    
    // Score AST (imports/exports)
    const astScore = node?.importanceScore || 0;
    
    // P1: Score TF-IDF amélioré
    const tfidfScore = calculateTFIDF(queryTerms, content, docFrequencies, totalDocs);
    
    // Score récence (augmenté pour fichiers récents)
    const recencyScore = recentFiles.has(path) ? 40 : 0;
    
    // Score critique
    const fileName = path.split('/').pop()?.replace(/\.[^.]+$/, '').toLowerCase() || '';
    const criticalScore = CRITICAL_FILES.includes(fileName) ? 50 : 0;
    
    // P1: Score d'extension (prioriser les fichiers modifiables)
    const ext = path.split('.').pop()?.toLowerCase();
    const extensionScore = ['tsx', 'jsx', 'css', 'html', 'ts', 'js'].includes(ext || '') ? 10 : 0;
    
    // Score total pondéré (ajusté pour TF-IDF)
    const total = 
      astScore * 0.25 + 
      tfidfScore * 0.35 +  // Poids augmenté pour TF-IDF
      recencyScore * 0.15 + 
      criticalScore * 0.15 +
      extensionScore * 0.10;
    
    scores.push({
      path,
      scores: { 
        ast: astScore, 
        keyword: tfidfScore,  // Renommé en interne mais gardé pour compatibilité
        recency: recencyScore, 
        critical: criticalScore 
      },
      total
    });
  }
  
  return scores.sort((a, b) => b.total - a.total);
}

// P1: Sélection avec budget de tokens
export function selectFilesWithBudget(
  rankedFiles: FileRelevanceScore[],
  projectFiles: Record<string, string>,
  complexity: string
): Record<string, string> {
  const budget = TOKEN_BUDGETS[complexity] || 8000;
  let currentTokens = 0;
  const selected: Record<string, string> = {};
  
  for (const file of rankedFiles) {
    const content = projectFiles[file.path];
    if (!content) continue;
    
    const fileTokens = estimateTokens(content);
    
    if (currentTokens + fileTokens <= budget) {
      selected[file.path] = content;
      currentTokens += fileTokens;
    } else if (Object.keys(selected).length < 3) {
      // Toujours inclure au moins 3 fichiers, même si ça dépasse
      selected[file.path] = content;
      currentTokens += fileTokens;
    } else {
      break;
    }
  }
  
  return selected;
}

export function optimizeContext(
  files: Record<string, string>,
  complexity: string
): OptimizedContext {
  const tokenBudget = TOKEN_BUDGETS[complexity] || 8000;
  const optimizedFiles: Record<string, string> = {};
  const truncatedFiles: string[] = [];
  let totalLines = 0;
  let optimizedLines = 0;
  let currentTokens = 0;

  // Trier les fichiers par taille (plus petits d'abord)
  const sortedFiles = Object.entries(files).sort(
    (a, b) => a[1].length - b[1].length
  );

  for (const [path, content] of sortedFiles) {
    const lines = content.split('\n');
    totalLines += lines.length;
    const fileTokens = estimateTokens(content);

    if (currentTokens + fileTokens <= tokenBudget) {
      // Le fichier entre dans le budget
      optimizedFiles[path] = content;
      optimizedLines += lines.length;
      currentTokens += fileTokens;
    } else if (Object.keys(optimizedFiles).length < 3) {
      // Fichier tronqué mais on doit inclure au minimum 3 fichiers
      const maxChars = (tokenBudget - currentTokens) * 4;
      const keepStart = Math.floor(lines.length * 0.5);
      const keepEnd = Math.floor(lines.length * 0.3);
      const omittedCount = lines.length - keepStart - keepEnd;

      const truncatedContent = [
        ...lines.slice(0, keepStart),
        `\n// ... ${omittedCount} lignes omises (budget tokens) ...\n`,
        ...lines.slice(-keepEnd),
      ].join('\n').substring(0, maxChars);

      optimizedFiles[path] = truncatedContent;
      optimizedLines += keepStart + keepEnd + 1;
      truncatedFiles.push(path);
      currentTokens += estimateTokens(truncatedContent);
    } else {
      // Fichier exclu du contexte
      truncatedFiles.push(path);
    }
  }

  return {
    files: optimizedFiles,
    truncatedFiles,
    totalLines,
    optimizedLines,
  };
}

// 🆕 Extraction de fichiers avec patterns sémantiques améliorés
export function extractExplicitFiles(
  prompt: string,
  projectFiles: Record<string, string>
): string[] {
  const fileNames = Object.keys(projectFiles);
  const promptLower = prompt.toLowerCase();
  const words = promptLower.split(/\s+/);
  const foundFiles = new Set<string>();

  // 1. Chercher les fichiers mentionnés explicitement
  for (const filePath of fileNames) {
    const fileName = filePath.split('/').pop()?.toLowerCase() || '';
    const fileNameWithoutExt = fileName.replace(/\.[^.]+$/, '');
    
    // Vérifier si le nom du fichier est mentionné dans le prompt
    if (words.some(word => 
      word.includes(fileNameWithoutExt) || 
      fileNameWithoutExt.includes(word) ||
      promptLower.includes(fileName)
    )) {
      foundFiles.add(filePath);
    }
  }

  // 2. Utiliser les patterns sémantiques pour trouver des fichiers pertinents
  for (const [patternStr, targetFiles] of Object.entries(SEMANTIC_PATTERNS)) {
    const patterns = patternStr.split('|');
    const matchesPattern = patterns.some(pattern => promptLower.includes(pattern));
    
    if (matchesPattern) {
      // Chercher les fichiers correspondants dans le projet
      for (const targetFile of targetFiles) {
        for (const projectFile of fileNames) {
          const projectFileName = projectFile.split('/').pop()?.toLowerCase() || '';
          const targetFileName = targetFile.toLowerCase();
          
          if (
            projectFile.toLowerCase().includes(targetFileName) ||
            projectFileName === targetFileName ||
            projectFileName.includes(targetFileName.replace(/\.[^.]+$/, ''))
          ) {
            foundFiles.add(projectFile);
          }
        }
      }
    }
  }

  // 3. Toujours inclure les fichiers critiques s'ils existent
  for (const criticalFile of ['App.tsx', 'index.html', 'styles.css', 'index.css', 'main.tsx']) {
    const found = fileNames.find(f => f.toLowerCase().endsWith(criticalFile.toLowerCase()));
    if (found) {
      foundFiles.add(found);
    }
  }

  // 4. Si aucun fichier n'est trouvé, retourner les 5 premiers fichiers
  if (foundFiles.size === 0) {
    return fileNames.slice(0, 5);
  }

  // Limiter à 10 fichiers maximum pour les patterns sémantiques
  return Array.from(foundFiles).slice(0, 10);
}

export function buildContextWithMemory(
  prompt: string,
  projectFiles: Record<string, string>,
  memory?: {
    architecture?: Record<string, unknown>;
    recent_changes?: Array<{ file: string; change: string; timestamp?: string }>;
    known_issues?: Array<{ issue: string; solution: string }>;
    user_preferences?: Record<string, unknown>;
  }
): string {
  const contextParts: string[] = [];

  // Ajouter le contexte mémoire si disponible
  if (memory) {
    if (memory.architecture) {
      contextParts.push(`Architecture du projet: ${JSON.stringify(memory.architecture)}`);
    }
    
    if (memory.recent_changes && memory.recent_changes.length > 0) {
      // Inclure les 10 derniers changements pour meilleur contexte
      const recentChanges = memory.recent_changes.slice(-10);
      contextParts.push(`Changements récents:\n${recentChanges.map(c => `- ${c.file}: ${c.change}`).join('\n')}`);
    }
    
    if (memory.known_issues && memory.known_issues.length > 0) {
      contextParts.push(`Problèmes connus et solutions:\n${memory.known_issues.map(i => `- ${i.issue}: ${i.solution}`).join('\n')}`);
    }
    
    if (memory.user_preferences) {
      contextParts.push(`Préférences utilisateur: ${JSON.stringify(memory.user_preferences)}`);
    }
  }

  // Ajouter le prompt enrichi
  if (contextParts.length > 0) {
    return `${contextParts.join('\n\n')}\n\nDemande utilisateur: ${prompt}`;
  }

  return prompt;
}
