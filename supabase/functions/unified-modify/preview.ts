// P2: Système de preview avec diff avant application des modifications

import { ASTModification } from "./generate.ts";

// Types pour le système de preview
export interface DiffLine {
  type: 'add' | 'remove' | 'unchanged' | 'context';
  content: string;
  lineNumber: number;
  originalLineNumber?: number;
}

export interface FileDiff {
  before: string;
  after: string;
  lines: DiffLine[];
  addedLines: number;
  removedLines: number;
}

export interface ModificationPreview {
  file: string;
  diff: FileDiff;
  autoApproved: boolean;
  modificationType: string;
  summary: string;
}

// Générer un diff ligne par ligne entre deux versions
export function generateDiff(before: string, after: string, contextLines: number = 3): DiffLine[] {
  const beforeLines = before.split('\n');
  const afterLines = after.split('\n');
  const result: DiffLine[] = [];
  
  // Algorithme LCS simplifié pour détecter les changements
  const lcs = computeLCS(beforeLines, afterLines);
  
  let beforeIdx = 0;
  let afterIdx = 0;
  let lcsIdx = 0;
  
  while (beforeIdx < beforeLines.length || afterIdx < afterLines.length) {
    const lcsLine = lcs[lcsIdx];
    const beforeLine = beforeLines[beforeIdx];
    const afterLine = afterLines[afterIdx];
    
    if (lcsIdx < lcs.length && beforeLine === lcsLine && afterLine === lcsLine) {
      // Ligne inchangée
      result.push({
        type: 'unchanged',
        content: beforeLine,
        lineNumber: afterIdx + 1,
        originalLineNumber: beforeIdx + 1
      });
      beforeIdx++;
      afterIdx++;
      lcsIdx++;
    } else if (beforeIdx < beforeLines.length && 
               (lcsIdx >= lcs.length || beforeLine !== lcsLine)) {
      // Ligne supprimée
      result.push({
        type: 'remove',
        content: beforeLine,
        lineNumber: beforeIdx + 1,
        originalLineNumber: beforeIdx + 1
      });
      beforeIdx++;
    } else if (afterIdx < afterLines.length) {
      // Ligne ajoutée
      result.push({
        type: 'add',
        content: afterLine,
        lineNumber: afterIdx + 1
      });
      afterIdx++;
    }
  }
  
  // Filtrer pour ne garder que les lignes modifiées et leur contexte
  return filterWithContext(result, contextLines);
}

// Calculer la plus longue sous-séquence commune (LCS)
function computeLCS(a: string[], b: string[]): string[] {
  const m = a.length;
  const n = b.length;
  
  // Matrice de programmation dynamique
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }
  
  // Reconstruire la LCS
  const lcs: string[] = [];
  let i = m;
  let j = n;
  
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      lcs.unshift(a[i - 1]);
      i--;
      j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }
  
  return lcs;
}

// Filtrer les lignes pour ne garder que les changements avec contexte
function filterWithContext(lines: DiffLine[], contextLines: number): DiffLine[] {
  const hasChange = lines.some(l => l.type === 'add' || l.type === 'remove');
  if (!hasChange) return [];
  
  const result: DiffLine[] = [];
  const changeIndices = new Set<number>();
  
  // Marquer les indices des changements
  lines.forEach((line, idx) => {
    if (line.type === 'add' || line.type === 'remove') {
      changeIndices.add(idx);
      // Ajouter le contexte autour
      for (let i = Math.max(0, idx - contextLines); i <= Math.min(lines.length - 1, idx + contextLines); i++) {
        changeIndices.add(i);
      }
    }
  });
  
  // Collecter les lignes avec contexte
  const sortedIndices = Array.from(changeIndices).sort((a, b) => a - b);
  let lastIdx = -2;
  
  for (const idx of sortedIndices) {
    // Ajouter un séparateur si on saute des lignes
    if (idx > lastIdx + 1 && result.length > 0) {
      result.push({
        type: 'context',
        content: '...',
        lineNumber: -1
      });
    }
    
    const line = lines[idx];
    if (line.type === 'unchanged') {
      result.push({ ...line, type: 'context' });
    } else {
      result.push(line);
    }
    
    lastIdx = idx;
  }
  
  return result;
}

// Déterminer si une modification est triviale (auto-approuvable)
export function isTrivialModification(mod: ASTModification): boolean {
  // Les changements de couleur, taille, espacement sont triviaux
  const trivialProperties = [
    'color', 'background-color', 'background', 'font-size', 'font-weight',
    'padding', 'margin', 'border', 'border-radius', 'opacity', 'width', 'height'
  ];
  
  if (mod.type === 'css-change' && mod.property) {
    return trivialProperties.includes(mod.property);
  }
  
  // Les changements de className simples sont triviaux
  if (mod.type === 'jsx-change' && mod.changes) {
    const keys = Object.keys(mod.changes);
    if (keys.length === 1 && keys[0] === 'className') {
      return true;
    }
  }
  
  return false;
}

// Générer un résumé de la modification
function generateModificationSummary(mod: ASTModification): string {
  switch (mod.type) {
    case 'css-change':
      return `${mod.property}: ${mod.value}`;
    case 'jsx-change':
      const changes = mod.changes as Record<string, unknown>;
      const keys = Object.keys(changes);
      if (keys.length === 1) {
        return `${keys[0]} modifié`;
      }
      return `${keys.length} attributs modifiés`;
    case 'html-change':
      if (mod.attribute) {
        return `${mod.attribute} = "${mod.value}"`;
      }
      return 'Contenu modifié';
    default:
      return 'Modification';
  }
}

// Appliquer une modification et retourner le résultat (sans modifier l'original)
function applyModificationPreview(
  content: string,
  mod: ASTModification,
  applyFn: (content: string, mod: ASTModification) => string
): string {
  return applyFn(content, mod);
}

// Générer les previews pour toutes les modifications
export async function generatePreviewForModifications(
  modifications: ASTModification[],
  projectFiles: Record<string, string>,
  applyModificationFn: (content: string, mod: ASTModification, ext: string) => string
): Promise<ModificationPreview[]> {
  const previews: ModificationPreview[] = [];
  
  // Grouper les modifications par fichier
  const byFile = new Map<string, ASTModification[]>();
  for (const mod of modifications) {
    const existing = byFile.get(mod.path) || [];
    existing.push(mod);
    byFile.set(mod.path, existing);
  }
  
  // Générer un preview par fichier
  for (const [filePath, fileMods] of byFile) {
    const originalContent = projectFiles[filePath];
    if (!originalContent) continue;
    
    const ext = filePath.split('.').pop()?.toLowerCase() || '';
    let modifiedContent = originalContent;
    
    // Appliquer toutes les modifications du fichier
    for (const mod of fileMods) {
      modifiedContent = applyModificationFn(modifiedContent, mod, ext);
    }
    
    // Générer le diff
    const diff = generateDiff(originalContent, modifiedContent);
    
    // Déterminer si c'est auto-approuvable
    const allTrivial = fileMods.every(isTrivialModification);
    
    previews.push({
      file: filePath,
      diff: {
        before: originalContent.substring(0, 500),
        after: modifiedContent.substring(0, 500),
        lines: diff,
        addedLines: diff.filter(l => l.type === 'add').length,
        removedLines: diff.filter(l => l.type === 'remove').length
      },
      autoApproved: allTrivial,
      modificationType: fileMods[0].type,
      summary: fileMods.map(generateModificationSummary).join(', ')
    });
  }
  
  return previews;
}

// Formater le diff pour affichage texte
export function formatDiffForDisplay(preview: ModificationPreview): string {
  const lines: string[] = [
    `📄 ${preview.file}`,
    `   ${preview.summary}`,
    ''
  ];
  
  for (const line of preview.diff.lines) {
    const prefix = line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' ';
    const lineNum = line.lineNumber > 0 ? `${line.lineNumber}:` : '  ';
    lines.push(`${prefix} ${lineNum} ${line.content}`);
  }
  
  return lines.join('\n');
}
