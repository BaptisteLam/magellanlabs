/**
 * PHASE 2: CONTEXTE INTELLIGENT
 * - Dependency Graph Building
 * - Smart File Selection
 * - Memory Context Enrichment
 * - Context Optimization
 */

interface DependencyNode {
  path: string;
  imports: string[];
  exports: string[];
  usedBy: string[];
  importance: number;
  type: 'component' | 'hook' | 'util' | 'page' | 'config' | 'other';
}

export class DependencyGraph {
  private nodes: Map<string, DependencyNode> = new Map();

  async buildGraph(files: Record<string, string>): Promise<void> {
    // Parse all files
    for (const [path, content] of Object.entries(files)) {
      const node = await this.parseFile(path, content);
      this.nodes.set(path, node);
    }

    // Calculate reverse edges
    this.calculateReverseEdges();

    // Score importance
    this.calculateImportance();
  }

  getRelevantFiles(targetFiles: string[], maxFiles = 15): string[] {
    const relevant = new Set<string>(targetFiles);
    const visited = new Set<string>();

    for (const file of targetFiles) {
      this.addRelatedFiles(file, relevant, visited, 2);
    }

    return Array.from(relevant)
      .sort((a, b) => {
        const scoreA = this.nodes.get(a)?.importance ?? 0;
        const scoreB = this.nodes.get(b)?.importance ?? 0;
        return scoreB - scoreA;
      })
      .slice(0, maxFiles);
  }

  private addRelatedFiles(
    filePath: string,
    relevant: Set<string>,
    visited: Set<string>,
    depth: number
  ): void {
    if (depth === 0 || visited.has(filePath)) return;
    visited.add(filePath);

    const node = this.nodes.get(filePath);
    if (!node) return;

    node.imports.forEach(imp => {
      relevant.add(imp);
      this.addRelatedFiles(imp, relevant, visited, depth - 1);
    });

    node.usedBy.forEach(user => {
      relevant.add(user);
      this.addRelatedFiles(user, relevant, visited, depth - 1);
    });
  }

  private async parseFile(path: string, content: string): Promise<DependencyNode> {
    const imports = this.extractImports(content, path);
    const exports = this.extractExports(content);
    const type = this.detectFileType(path);

    return { path, imports, exports, usedBy: [], importance: 0, type };
  }

  private extractImports(content: string, fromPath: string): string[] {
    const imports: string[] = [];
    const importRegex = /import\s+(?:[\w\s{},*]+\s+from\s+)?['"]([^'"]+)['"]/g;
    let match;

    while ((match = importRegex.exec(content)) !== null) {
      const resolved = this.resolveImportPath(match[1], fromPath);
      if (resolved) imports.push(resolved);
    }

    return Array.from(new Set(imports));
  }

  private extractExports(content: string): string[] {
    const exports: string[] = [];
    const exportRegex = /export\s+(?:default\s+)?(?:function|const|class|interface|type|enum)\s+(\w+)/g;
    let match;

    while ((match = exportRegex.exec(content)) !== null) {
      exports.push(match[1]);
    }

    if (/export\s+default/.test(content)) exports.push('default');

    return Array.from(new Set(exports));
  }

  private resolveImportPath(importPath: string, fromPath: string): string | null {
    if (!importPath.startsWith('.') && !importPath.startsWith('@/')) return null;

    if (importPath.startsWith('@/')) {
      return this.addExtensionIfNeeded(importPath.replace('@/', 'src/'));
    }

    if (importPath.startsWith('./') || importPath.startsWith('../')) {
      const fromDir = fromPath.substring(0, fromPath.lastIndexOf('/'));
      const resolved = this.normalizePath(`${fromDir}/${importPath}`);
      return this.addExtensionIfNeeded(resolved);
    }

    return null;
  }

  private addExtensionIfNeeded(path: string): string {
    if (/\.(tsx?|jsx?)$/.test(path)) return path;

    const extensions = ['.tsx', '.ts', '.jsx', '.js'];
    for (const ext of extensions) {
      if (this.nodes.has(path + ext)) return path + ext;
    }

    return path + '.tsx';
  }

  private normalizePath(path: string): string {
    const parts = path.split('/');
    const normalized: string[] = [];

    for (const part of parts) {
      if (part === '..') normalized.pop();
      else if (part !== '.' && part !== '') normalized.push(part);
    }

    return normalized.join('/');
  }

  private calculateReverseEdges(): void {
    for (const node of this.nodes.values()) {
      node.usedBy = [];
    }

    for (const [path, node] of this.nodes) {
      for (const importPath of node.imports) {
        const importedNode = this.nodes.get(importPath);
        if (importedNode) importedNode.usedBy.push(path);
      }
    }
  }

  private calculateImportance(): void {
    for (const [path, node] of this.nodes) {
      let score = 0;

      score += node.usedBy.length * 10;
      score += node.exports.length * 5;

      if (this.isCriticalFile(path)) score += 50;

      switch (node.type) {
        case 'component': score += 5; break;
        case 'hook': score += 8; break;
        case 'page': score += 15; break;
        case 'config': score += 20; break;
      }

      if (path.includes('src/components/')) score += 3;

      node.importance = score;
    }
  }

  private isCriticalFile(path: string): boolean {
    const patterns = ['App.tsx', 'main.tsx', 'index.tsx', 'router', 'routes', 'config', 'constants', 'types'];
    return patterns.some(p => path.includes(p));
  }

  private detectFileType(path: string): DependencyNode['type'] {
    if (path.includes('/components/') && !path.includes('/ui/')) return 'component';
    if (path.includes('/hooks/')) return 'hook';
    if (path.includes('/pages/')) return 'page';
    if (path.includes('/utils/') || path.includes('/lib/') || path.includes('/services/')) return 'util';
    if (path.includes('config') || path.includes('constants') || path.includes('types')) return 'config';
    return 'other';
  }
}

/**
 * Optimise le contexte en tronquant intelligemment les fichiers
 */
export function optimizeContext(
  files: Array<{ path: string; content: string }>,
  complexity: 'trivial' | 'simple' | 'moderate' | 'complex'
): string {
  const maxLines = complexity === 'trivial' ? 100
    : complexity === 'simple' ? 150
    : complexity === 'moderate' ? 250
    : 400;

  const optimizedFiles = files.map(f => {
    const lines = f.content.split('\n');

    if (lines.length > maxLines) {
      const headLines = Math.floor(maxLines * 0.4);
      const tailLines = Math.floor(maxLines * 0.4);

      const preview = [
        ...lines.slice(0, headLines),
        `... [${lines.length - headLines - tailLines} lignes omises] ...`,
        ...lines.slice(-tailLines)
      ].join('\n');

      return `${f.path}:\n${preview}`;
    }

    return `${f.path}:\n${f.content}`;
  });

  return optimizedFiles.join('\n\n---\n\n');
}

/**
 * Identifie les fichiers explicitement mentionnés dans le prompt
 */
export function extractExplicitFiles(
  prompt: string,
  projectFiles: Record<string, string>
): string[] {
  const lowerPrompt = prompt.toLowerCase();
  const explicitFiles: string[] = [];

  for (const path of Object.keys(projectFiles)) {
    const lowerPath = path.toLowerCase();
    const fileName = path.split('/').pop()?.toLowerCase() || '';

    if (lowerPrompt.includes(lowerPath) || lowerPrompt.includes(fileName)) {
      explicitFiles.push(path);
    }
  }

  return explicitFiles;
}

/**
 * Build memory context string
 */
export function buildMemoryContext(memory: any): string {
  if (!memory) return '';

  let context = '# PROJECT MEMORY\n\n';

  if (memory.architecture) {
    context += '## Architecture\n';
    context += `Framework: ${memory.architecture.framework || 'React'}\n`;
    context += `Patterns: ${memory.architecture.patterns?.join(', ') || 'Standard'}\n\n`;
  }

  if (memory.recentChanges && memory.recentChanges.length > 0) {
    context += '## Recent Changes\n';
    memory.recentChanges.slice(0, 3).forEach((change: any) => {
      context += `- ${change.description} (files: ${change.filesAffected?.join(', ')})\n`;
    });
    context += '\n';
  }

  if (memory.knownIssues && memory.knownIssues.length > 0) {
    context += '## Known Issues\n';
    memory.knownIssues.slice(0, 3).forEach((issue: any) => {
      context += `- ${issue.issue}: ${issue.solution}\n`;
    });
    context += '\n';
  }

  return context;
}
