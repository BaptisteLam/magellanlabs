/**
 * Service de chunking intelligent du code
 * Divise les fichiers en chunks sémantiques basés sur la structure du code
 */

export interface CodeChunk {
  id: string;
  filePath: string;
  content: string;
  startLine: number;
  endLine: number;
  type: 'function' | 'class' | 'component' | 'block' | 'full';
  importance: number; // 0-100 score d'importance
  imports?: string[];
  exports?: string[];
}

export class CodeChunker {
  private static readonly MAX_CHUNK_SIZE = 1500; // caractères max par chunk
  private static readonly MIN_CHUNK_SIZE = 200;  // caractères min par chunk
  private static readonly OVERLAP = 100;         // overlap entre chunks

  /**
   * Chunker intelligent qui divise un fichier en chunks sémantiques
   */
  static chunkFile(filePath: string, content: string): CodeChunk[] {
    const ext = filePath.split('.').pop()?.toLowerCase();
    
    // Fichiers petits : pas de chunking
    if (content.length <= this.MAX_CHUNK_SIZE) {
      return [{
        id: `${filePath}:full`,
        filePath,
        content,
        startLine: 1,
        endLine: content.split('\n').length,
        type: 'full',
        importance: 100,
        imports: this.extractImports(content),
        exports: this.extractExports(content)
      }];
    }

    // Chunking selon le type de fichier
    switch (ext) {
      case 'tsx':
      case 'jsx':
        return this.chunkReactFile(filePath, content);
      case 'ts':
      case 'js':
        return this.chunkJavaScriptFile(filePath, content);
      case 'css':
      case 'scss':
        return this.chunkStyleFile(filePath, content);
      case 'html':
        return this.chunkHTMLFile(filePath, content);
      default:
        return this.chunkGeneric(filePath, content);
    }
  }

  /**
   * Chunker pour fichiers React/TypeScript
   */
  private static chunkReactFile(filePath: string, content: string): CodeChunk[] {
    const chunks: CodeChunk[] = [];
    const lines = content.split('\n');
    
    // Extraire imports/exports globaux
    const imports = this.extractImports(content);
    const exports = this.extractExports(content);

    // Pattern: function/const ComponentName = 
    const componentRegex = /(?:export\s+)?(?:function|const)\s+([A-Z]\w+)/g;
    const matches = [...content.matchAll(componentRegex)];

    if (matches.length === 0) {
      return this.chunkGeneric(filePath, content);
    }

    matches.forEach((match, idx) => {
      const startIdx = match.index!;
      const endIdx = idx < matches.length - 1 ? matches[idx + 1].index! : content.length;
      
      const chunkContent = content.slice(startIdx, endIdx);
      const startLine = content.slice(0, startIdx).split('\n').length;
      const endLine = startLine + chunkContent.split('\n').length;

      chunks.push({
        id: `${filePath}:${match[1]}`,
        filePath,
        content: chunkContent,
        startLine,
        endLine,
        type: 'component',
        importance: this.calculateImportance(chunkContent, match[1]),
        imports,
        exports
      });
    });

    return chunks;
  }

  /**
   * Chunker pour fichiers JavaScript/TypeScript
   */
  private static chunkJavaScriptFile(filePath: string, content: string): CodeChunk[] {
    const chunks: CodeChunk[] = [];
    const imports = this.extractImports(content);
    const exports = this.extractExports(content);

    // Pattern: function name() ou const name = 
    const functionRegex = /(?:export\s+)?(?:function|const|class)\s+(\w+)/g;
    const matches = [...content.matchAll(functionRegex)];

    if (matches.length === 0) {
      return this.chunkGeneric(filePath, content);
    }

    matches.forEach((match, idx) => {
      const startIdx = match.index!;
      const endIdx = idx < matches.length - 1 ? matches[idx + 1].index! : content.length;
      
      const chunkContent = content.slice(startIdx, endIdx);
      const startLine = content.slice(0, startIdx).split('\n').length;
      const endLine = startLine + chunkContent.split('\n').length;

      chunks.push({
        id: `${filePath}:${match[1]}`,
        filePath,
        content: chunkContent,
        startLine,
        endLine,
        type: match[0].includes('class') ? 'class' : 'function',
        importance: this.calculateImportance(chunkContent, match[1]),
        imports,
        exports
      });
    });

    return chunks;
  }

  /**
   * Chunker pour fichiers CSS
   */
  private static chunkStyleFile(filePath: string, content: string): CodeChunk[] {
    const chunks: CodeChunk[] = [];
    
    // Diviser par sélecteurs de haut niveau
    const selectorRegex = /^([.#][\w-]+|\w+)\s*\{/gm;
    const matches = [...content.matchAll(selectorRegex)];

    if (matches.length < 3) {
      return this.chunkGeneric(filePath, content);
    }

    matches.forEach((match, idx) => {
      const startIdx = match.index!;
      const endIdx = idx < matches.length - 1 ? matches[idx + 1].index! : content.length;
      
      const chunkContent = content.slice(startIdx, endIdx);
      const startLine = content.slice(0, startIdx).split('\n').length;

      chunks.push({
        id: `${filePath}:${match[1]}`,
        filePath,
        content: chunkContent,
        startLine,
        endLine: startLine + chunkContent.split('\n').length,
        type: 'block',
        importance: 50
      });
    });

    return chunks;
  }

  /**
   * Chunker pour HTML
   */
  private static chunkHTMLFile(filePath: string, content: string): CodeChunk[] {
    // Pour HTML, garder en entier si < MAX_CHUNK_SIZE
    if (content.length <= this.MAX_CHUNK_SIZE * 2) {
      return [{
        id: `${filePath}:full`,
        filePath,
        content,
        startLine: 1,
        endLine: content.split('\n').length,
        type: 'full',
        importance: 90
      }];
    }

    // Sinon diviser par sections principales (header, main, footer, etc.)
    const sectionRegex = /<(header|nav|main|section|footer)[^>]*>/gi;
    const matches = [...content.matchAll(sectionRegex)];

    if (matches.length === 0) {
      return this.chunkGeneric(filePath, content);
    }

    const chunks: CodeChunk[] = [];
    matches.forEach((match, idx) => {
      const startIdx = match.index!;
      const endIdx = idx < matches.length - 1 ? matches[idx + 1].index! : content.length;
      
      const chunkContent = content.slice(startIdx, endIdx);
      const startLine = content.slice(0, startIdx).split('\n').length;

      chunks.push({
        id: `${filePath}:${match[1]}`,
        filePath,
        content: chunkContent,
        startLine,
        endLine: startLine + chunkContent.split('\n').length,
        type: 'block',
        importance: 70
      });
    });

    return chunks;
  }

  /**
   * Chunker générique par taille fixe avec overlap
   */
  private static chunkGeneric(filePath: string, content: string): CodeChunk[] {
    const chunks: CodeChunk[] = [];
    let start = 0;

    while (start < content.length) {
      const end = Math.min(start + this.MAX_CHUNK_SIZE, content.length);
      const chunkContent = content.slice(start, end);
      const startLine = content.slice(0, start).split('\n').length;

      chunks.push({
        id: `${filePath}:${start}`,
        filePath,
        content: chunkContent,
        startLine,
        endLine: startLine + chunkContent.split('\n').length,
        type: 'block',
        importance: 50
      });

      start = end - this.OVERLAP;
      if (start >= content.length) break;
    }

    return chunks;
  }

  /**
   * Calcule l'importance d'un chunk basé sur son contenu
   */
  private static calculateImportance(content: string, name: string): number {
    let score = 50; // Base score

    // Nom important (export, main, index, App, etc.)
    const importantNames = ['App', 'Main', 'Index', 'Layout', 'Route', 'Provider'];
    if (importantNames.some(n => name.includes(n))) score += 20;

    // Contient export
    if (content.includes('export default') || content.includes('export {')) score += 15;

    // Gros chunk = potentiellement important
    if (content.length > 800) score += 10;

    // Beaucoup de dépendances
    const importCount = (content.match(/import\s+/g) || []).length;
    score += Math.min(importCount * 3, 15);

    return Math.min(score, 100);
  }

  /**
   * Extrait les imports d'un fichier
   */
  private static extractImports(content: string): string[] {
    const importRegex = /import\s+.*?from\s+['"](.+?)['"]/g;
    const matches = [...content.matchAll(importRegex)];
    return matches.map(m => m[1]);
  }

  /**
   * Extrait les exports d'un fichier
   */
  private static extractExports(content: string): string[] {
    const exportRegex = /export\s+(?:default\s+)?(?:function|const|class)\s+(\w+)/g;
    const matches = [...content.matchAll(exportRegex)];
    return matches.map(m => m[1]);
  }

  /**
   * Reconstruit un fichier à partir de chunks sélectionnés
   */
  static reconstructFromChunks(chunks: CodeChunk[]): string {
    if (chunks.length === 0) return '';
    if (chunks.length === 1) return chunks[0].content;

    // Trier par ligne de début
    const sorted = [...chunks].sort((a, b) => a.startLine - b.startLine);
    
    // Détecter les overlaps et fusionner
    let result = sorted[0].content;
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const curr = sorted[i];
      
      // Si overlap, fusionner intelligemment
      if (curr.startLine <= prev.endLine) {
        const overlapSize = prev.endLine - curr.startLine;
        result += '\n' + curr.content.slice(overlapSize);
      } else {
        result += '\n' + curr.content;
      }
    }

    return result;
  }
}
