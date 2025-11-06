interface FileDiff {
  path: string;
  hunks: DiffHunk[];
}

interface DiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  oldContent: string[];
  newContent: string[];
}

export class AiDiffService {
  /**
   * Parse un diff au format unifié et l'applique au fichier
   */
  static applyDiff(originalContent: string, diffText: string): string {
    const lines = originalContent.split('\n');
    const hunks = this.parseDiff(diffText);
    
    // Appliquer les hunks en ordre inverse pour préserver les numéros de ligne
    for (let i = hunks.length - 1; i >= 0; i--) {
      const hunk = hunks[i];
      
      // Vérifier que le contexte correspond
      if (!this.validateHunk(lines, hunk)) {
        console.warn(`Hunk at line ${hunk.oldStart} doesn't match, skipping`);
        continue;
      }
      
      // Remplacer les lignes
      lines.splice(
        hunk.oldStart - 1,
        hunk.oldLines,
        ...hunk.newContent
      );
    }
    
    return lines.join('\n');
  }

  /**
   * Parse un diff au format unifié
   */
  private static parseDiff(diffText: string): DiffHunk[] {
    const hunks: DiffHunk[] = [];
    const lines = diffText.split('\n');
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];
      
      // Chercher l'en-tête du hunk: @@ -10,5 +10,7 @@
      const hunkMatch = line.match(/^@@ -(\d+),?(\d*) \+(\d+),?(\d*) @@/);
      if (!hunkMatch) {
        i++;
        continue;
      }

      const oldStart = parseInt(hunkMatch[1]);
      const oldLines = hunkMatch[2] ? parseInt(hunkMatch[2]) : 1;
      const newStart = parseInt(hunkMatch[3]);
      const newLines = hunkMatch[4] ? parseInt(hunkMatch[4]) : 1;

      const oldContent: string[] = [];
      const newContent: string[] = [];
      i++;

      // Lire le contenu du hunk
      while (i < lines.length && !lines[i].startsWith('@@')) {
        const contentLine = lines[i];
        
        if (contentLine.startsWith('-')) {
          oldContent.push(contentLine.slice(1));
        } else if (contentLine.startsWith('+')) {
          newContent.push(contentLine.slice(1));
        } else if (contentLine.startsWith(' ')) {
          // Ligne de contexte (inchangée)
          oldContent.push(contentLine.slice(1));
          newContent.push(contentLine.slice(1));
        }
        
        i++;
      }

      hunks.push({
        oldStart,
        oldLines,
        newStart,
        newLines,
        oldContent,
        newContent,
      });
    }

    return hunks;
  }

  /**
   * Vérifie que le hunk correspond au fichier
   */
  private static validateHunk(lines: string[], hunk: DiffHunk): boolean {
    const startIdx = hunk.oldStart - 1;
    
    if (startIdx < 0 || startIdx + hunk.oldLines > lines.length) {
      return false;
    }

    // Vérifier que les lignes correspondent
    for (let i = 0; i < hunk.oldContent.length; i++) {
      if (lines[startIdx + i]?.trim() !== hunk.oldContent[i]?.trim()) {
        return false;
      }
    }

    return true;
  }

  /**
   * Extrait le contexte minimal autour d'une zone (contexte de 10 lignes)
   */
  static extractContext(
    content: string,
    searchTerm: string,
    contextLines: number = 10
  ): { excerpt: string; startLine: number; endLine: number } | null {
    const lines = content.split('\n');
    
    // Trouver la ligne contenant le terme de recherche
    let targetLine = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(searchTerm)) {
        targetLine = i;
        break;
      }
    }

    if (targetLine === -1) {
      return null;
    }

    // Extraire contexte
    const startLine = Math.max(0, targetLine - contextLines);
    const endLine = Math.min(lines.length - 1, targetLine + contextLines);
    const excerpt = lines.slice(startLine, endLine + 1).join('\n');

    return {
      excerpt,
      startLine: startLine + 1, // 1-indexed
      endLine: endLine + 1,
    };
  }

  /**
   * Identifie le fichier concerné par un prompt
   */
  static identifyTargetFile(
    prompt: string,
    projectFiles: Record<string, string>
  ): string[] {
    const candidates: Array<{ path: string; score: number }> = [];
    const lowerPrompt = prompt.toLowerCase();

    // Mots-clés de composants/fichiers
    const keywords = this.extractKeywords(lowerPrompt);

    for (const [path, content] of Object.entries(projectFiles)) {
      let score = 0;

      // Score basé sur mention du nom de fichier
      const fileName = path.split('/').pop() || '';
      if (keywords.some(k => fileName.toLowerCase().includes(k))) {
        score += 10;
      }

      // Score basé sur contenu du fichier
      const lowerContent = content.toLowerCase();
      keywords.forEach(keyword => {
        if (lowerContent.includes(keyword)) {
          score += 1;
        }
      });

      if (score > 0) {
        candidates.push({ path, score });
      }
    }

    // Trier par score décroissant
    candidates.sort((a, b) => b.score - a.score);
    
    // Retourner top 3
    return candidates.slice(0, 3).map(c => c.path);
  }

  /**
   * Extrait les mots-clés importants d'un prompt
   */
  private static extractKeywords(prompt: string): string[] {
    // Retirer les mots communs
    const stopWords = new Set([
      'le', 'la', 'les', 'un', 'une', 'des', 'du', 'de', 'et', 'ou',
      'dans', 'sur', 'pour', 'par', 'avec', 'sans', 'change', 'modifie',
      'ajoute', 'supprime', 'crée', 'fais', 'fait', 'faire'
    ]);

    return prompt
      .toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word))
      .filter(word => /^[a-z0-9_-]+$/i.test(word));
  }
}

/**
 * Filtre les fichiers selon les règles .boltignore
 */
export function shouldIgnoreFile(path: string, ignoreRules: string[]): boolean {
  for (const rule of ignoreRules) {
    if (rule.startsWith('#') || rule.trim() === '') continue;
    
    // Pattern simple: * pour wildcard
    const regex = new RegExp(
      '^' + rule.replace(/\*/g, '.*').replace(/\?/g, '.') + '$'
    );
    
    if (regex.test(path)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Règles par défaut à ignorer (comme .boltignore)
 */
export const DEFAULT_IGNORE_RULES = [
  'node_modules/*',
  '.git/*',
  'dist/*',
  'build/*',
  '*.log',
  '.env*',
  'package-lock.json',
  'bun.lockb',
  'yarn.lock',
  '.DS_Store',
];
