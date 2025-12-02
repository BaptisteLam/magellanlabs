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
    console.log(`🔍 Building dependency graph for ${Object.keys(files).length} files`);
    
    // Parse all files
    for (const [path, content] of Object.entries(files)) {
      const node = await this.parseFile(path, content);
      this.nodes.set(path, node);
    }
    
    // Calculate reverse edges (usedBy)
    this.calculateReverseEdges();
    
    // Score importance
    this.calculateImportance();
    
    console.log(`✅ Dependency graph built with ${this.nodes.size} nodes`);
  }
  
  getRelevantFiles(targetFiles: string[], maxFiles = 15): string[] {
    const relevant = new Set<string>(targetFiles);
    const visited = new Set<string>();
    
    // Add direct dependencies and users
    for (const file of targetFiles) {
      this.addRelatedFiles(file, relevant, visited, 2); // depth 2
    }
    
    // Sort by importance
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
    
    // Add direct imports
    node.imports.forEach(imp => {
      relevant.add(imp);
      this.addRelatedFiles(imp, relevant, visited, depth - 1);
    });
    
    // Add direct users
    node.usedBy.forEach(user => {
      relevant.add(user);
      this.addRelatedFiles(user, relevant, visited, depth - 1);
    });
  }
  
  private async parseFile(path: string, content: string): Promise<DependencyNode> {
    const imports = this.extractImports(content, path);
    const exports = this.extractExports(content);
    const type = this.detectFileType(path);
    
    return {
      path,
      imports,
      exports,
      usedBy: [],
      importance: 0,
      type
    };
  }
  
  private extractImports(content: string, fromPath: string): string[] {
    const imports: string[] = [];
    
    // Match: import ... from '...'
    const importRegex = /import\s+(?:[\w\s{},*]+\s+from\s+)?['"]([^'"]+)['"]/g;
    let match;
    
    while ((match = importRegex.exec(content)) !== null) {
      const importPath = match[1];
      const resolved = this.resolveImportPath(importPath, fromPath);
      if (resolved) {
        imports.push(resolved);
      }
    }
    
    // Match: require('...')
    const requireRegex = /require\(['"]([^'"]+)['"]\)/g;
    while ((match = requireRegex.exec(content)) !== null) {
      const importPath = match[1];
      const resolved = this.resolveImportPath(importPath, fromPath);
      if (resolved) {
        imports.push(resolved);
      }
    }
    
    return Array.from(new Set(imports)); // Remove duplicates
  }
  
  private extractExports(content: string): string[] {
    const exports: string[] = [];
    
    // Match: export function/const/class/interface/type Name
    const exportRegex = /export\s+(?:default\s+)?(?:function|const|class|interface|type|enum)\s+(\w+)/g;
    let match;
    
    while ((match = exportRegex.exec(content)) !== null) {
      exports.push(match[1]);
    }
    
    // Match: export { Name }
    const namedExportRegex = /export\s+\{([^}]+)\}/g;
    while ((match = namedExportRegex.exec(content)) !== null) {
      const names = match[1].split(',').map(n => n.trim().split(/\s+as\s+/)[0]);
      exports.push(...names);
    }
    
    // Match: export default
    if (/export\s+default/.test(content)) {
      exports.push('default');
    }
    
    return Array.from(new Set(exports));
  }
  
  private resolveImportPath(importPath: string, fromPath: string): string | null {
    // Skip external packages
    if (!importPath.startsWith('.') && !importPath.startsWith('@/')) {
      return null;
    }
    
    // Handle @ alias
    if (importPath.startsWith('@/')) {
      let resolved = importPath.replace('@/', 'src/');
      return this.addExtensionIfNeeded(resolved);
    }
    
    // Handle relative paths
    if (importPath.startsWith('./') || importPath.startsWith('../')) {
      const fromDir = fromPath.substring(0, fromPath.lastIndexOf('/'));
      const resolved = this.normalizePath(`${fromDir}/${importPath}`);
      return this.addExtensionIfNeeded(resolved);
    }
    
    return null;
  }
  
  private addExtensionIfNeeded(path: string): string {
    // If already has extension, return as is
    if (/\.(tsx?|jsx?)$/.test(path)) {
      return path;
    }
    
    // Try common extensions
    const extensions = ['.tsx', '.ts', '.jsx', '.js'];
    for (const ext of extensions) {
      if (this.nodes.has(path + ext)) {
        return path + ext;
      }
    }
    
    // Default to .tsx
    return path + '.tsx';
  }
  
  private normalizePath(path: string): string {
    const parts = path.split('/');
    const normalized: string[] = [];
    
    for (const part of parts) {
      if (part === '..') {
        normalized.pop();
      } else if (part !== '.' && part !== '') {
        normalized.push(part);
      }
    }
    
    return normalized.join('/');
  }
  
  private calculateReverseEdges(): void {
    // Clear existing usedBy
    for (const node of this.nodes.values()) {
      node.usedBy = [];
    }
    
    // Build reverse edges
    for (const [path, node] of this.nodes) {
      for (const importPath of node.imports) {
        const importedNode = this.nodes.get(importPath);
        if (importedNode) {
          importedNode.usedBy.push(path);
        }
      }
    }
  }
  
  private calculateImportance(): void {
    for (const [path, node] of this.nodes) {
      let score = 0;
      
      // Files used by many others are important
      score += node.usedBy.length * 10;
      
      // Files with many exports are important
      score += node.exports.length * 5;
      
      // Critical files get bonus
      if (this.isCriticalFile(path)) {
        score += 50;
      }
      
      // Type-specific bonuses
      switch (node.type) {
        case 'component':
          score += 5;
          break;
        case 'hook':
          score += 8;
          break;
        case 'page':
          score += 15;
          break;
        case 'config':
          score += 20;
          break;
      }
      
      // Files in src/components get slight bonus
      if (path.includes('src/components/')) {
        score += 3;
      }
      
      node.importance = score;
    }
  }
  
  private isCriticalFile(path: string): boolean {
    const criticalPatterns = [
      'App.tsx',
      'main.tsx',
      'index.tsx',
      'index.ts',
      'router',
      'routes',
      'config',
      'constants',
      'types',
      'supabase/client'
    ];
    
    return criticalPatterns.some(pattern => path.includes(pattern));
  }
  
  private detectFileType(path: string): DependencyNode['type'] {
    if (path.includes('/components/') && !path.includes('/ui/')) {
      return 'component';
    }
    if (path.includes('/hooks/')) {
      return 'hook';
    }
    if (path.includes('/pages/')) {
      return 'page';
    }
    if (path.includes('/utils/') || path.includes('/lib/') || path.includes('/services/')) {
      return 'util';
    }
    if (path.includes('config') || path.includes('constants') || path.includes('types')) {
      return 'config';
    }
    return 'other';
  }
  
  // Debug methods
  getNodeInfo(path: string): DependencyNode | undefined {
    return this.nodes.get(path);
  }
  
  getAllNodes(): DependencyNode[] {
    return Array.from(this.nodes.values());
  }
  
  getTopFiles(count = 10): DependencyNode[] {
    return Array.from(this.nodes.values())
      .sort((a, b) => b.importance - a.importance)
      .slice(0, count);
  }
  
  printGraph(): void {
    console.log('\n📊 Dependency Graph Summary:');
    console.log(`Total files: ${this.nodes.size}`);
    
    const topFiles = this.getTopFiles(5);
    console.log('\nTop 5 most important files:');
    topFiles.forEach((node, i) => {
      console.log(`${i + 1}. ${node.path} (score: ${node.importance})`);
      console.log(`   - Imports: ${node.imports.length}`);
      console.log(`   - Exports: ${node.exports.length}`);
      console.log(`   - Used by: ${node.usedBy.length} files`);
    });
  }
}