// Phase 2: Construction du contexte intelligent et graphe de dépendances

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

// Limites de lignes par complexité
const LINE_LIMITS: Record<string, number> = {
  trivial: 100,
  simple: 150,
  moderate: 250,
  complex: 400,
};

export function optimizeContext(
  files: Record<string, string>,
  complexity: string
): OptimizedContext {
  const limit = LINE_LIMITS[complexity] || 250;
  const optimizedFiles: Record<string, string> = {};
  const truncatedFiles: string[] = [];
  let totalLines = 0;
  let optimizedLines = 0;

  for (const [path, content] of Object.entries(files)) {
    const lines = content.split('\n');
    totalLines += lines.length;

    if (lines.length <= limit) {
      optimizedFiles[path] = content;
      optimizedLines += lines.length;
    } else {
      // Garder 40% du début, 40% de la fin
      const keepStart = Math.floor(limit * 0.4);
      const keepEnd = Math.floor(limit * 0.4);
      const omittedCount = lines.length - keepStart - keepEnd;

      const truncatedContent = [
        ...lines.slice(0, keepStart),
        `\n// ... ${omittedCount} lignes omises ...\n`,
        ...lines.slice(-keepEnd),
      ].join('\n');

      optimizedFiles[path] = truncatedContent;
      optimizedLines += keepStart + keepEnd + 1;
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

export function extractExplicitFiles(
  prompt: string,
  projectFiles: Record<string, string>
): string[] {
  const fileNames = Object.keys(projectFiles);
  const promptLower = prompt.toLowerCase();
  const words = promptLower.split(/\s+/);

  const explicitFiles = fileNames.filter(filePath => {
    const fileName = filePath.split('/').pop()?.toLowerCase() || '';
    const fileNameWithoutExt = fileName.replace(/\.[^.]+$/, '');
    
    // Vérifier si le nom du fichier est mentionné dans le prompt
    return words.some(word => 
      word.includes(fileNameWithoutExt) || 
      fileNameWithoutExt.includes(word) ||
      promptLower.includes(fileName)
    );
  });

  // Si aucun fichier n'est mentionné, retourner les 5 premiers fichiers
  if (explicitFiles.length === 0) {
    return fileNames.slice(0, 5);
  }

  return explicitFiles;
}

export function buildContextWithMemory(
  prompt: string,
  projectFiles: Record<string, string>,
  memory?: {
    architecture?: Record<string, unknown>;
    recent_changes?: Array<{ file: string; change: string }>;
    known_issues?: Array<{ issue: string; solution: string }>;
  }
): string {
  let contextParts: string[] = [];

  // Ajouter le contexte mémoire si disponible
  if (memory) {
    if (memory.architecture) {
      contextParts.push(`Architecture du projet: ${JSON.stringify(memory.architecture)}`);
    }
    if (memory.recent_changes && memory.recent_changes.length > 0) {
      const recentChanges = memory.recent_changes.slice(-5);
      contextParts.push(`Changements récents:\n${recentChanges.map(c => `- ${c.file}: ${c.change}`).join('\n')}`);
    }
    if (memory.known_issues && memory.known_issues.length > 0) {
      contextParts.push(`Problèmes connus:\n${memory.known_issues.map(i => `- ${i.issue}: ${i.solution}`).join('\n')}`);
    }
  }

  // Ajouter le prompt enrichi
  if (contextParts.length > 0) {
    return `${contextParts.join('\n\n')}\n\nDemande utilisateur: ${prompt}`;
  }

  return prompt;
}
