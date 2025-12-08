// Phase 4: Validation complète et auto-fix intelligent

import { ASTModification } from "./generate.ts";

export interface ValidationError {
  modification: ASTModification;
  message: string;
}

export interface ValidationResult {
  allValid: boolean;
  errors: ValidationError[];
  warnings: string[];
}

export interface ApplyResult {
  success: boolean;
  updatedFiles: Record<string, string>;
  errors: string[];
}

// Validation en trois niveaux
export function validateModifications(
  modifications: ASTModification[],
  projectFiles: Record<string, string>
): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: string[] = [];
  
  for (const mod of modifications) {
    // Niveau 1: Vérification d'existence des fichiers
    if (!projectFiles[mod.path]) {
      errors.push({
        modification: mod,
        message: `File does not exist: ${mod.path}`,
      });
      continue;
    }
    
    // Niveau 2: Validation de structure AST
    if (!mod.type || !mod.path) {
      errors.push({
        modification: mod,
        message: 'Missing required fields: type and path are required',
      });
      continue;
    }
    
    switch (mod.type) {
      case 'css-change':
        if (!mod.target || !mod.property) {
          errors.push({
            modification: mod,
            message: 'css-change requires target and property fields',
          });
        }
        break;
        
      case 'html-change':
        if (!mod.target) {
          errors.push({
            modification: mod,
            message: 'html-change requires target field',
          });
        }
        break;
        
      case 'jsx-change':
        if (!mod.target || !mod.changes) {
          errors.push({
            modification: mod,
            message: 'jsx-change requires target and changes fields',
          });
        }
        break;
        
      default:
        errors.push({
          modification: mod,
          message: `Unknown modification type: ${mod.type}`,
        });
    }
    
    // Niveau 3: Validation des imports (pour jsx-change)
    if (mod.type === 'jsx-change' && mod.changes) {
      const changesStr = JSON.stringify(mod.changes);
      const importMatches = changesStr.match(/import\s+.*?\s+from\s+['"]([^'"]+)['"]/g);
      
      if (importMatches) {
        for (const importMatch of importMatches) {
          const pathMatch = importMatch.match(/from\s+['"]([^'"]+)['"]/);
          if (pathMatch) {
            const importPath = pathMatch[1];
            
            // Vérifier les imports relatifs
            if (importPath.startsWith('.')) {
              const resolvedPath = resolveImportPath(mod.path, importPath);
              const possibleExtensions = ['', '.ts', '.tsx', '.js', '.jsx'];
              const exists = possibleExtensions.some(ext => 
                projectFiles[resolvedPath + ext] !== undefined
              );
              
              if (!exists) {
                warnings.push(`Potentially invalid import in ${mod.path}: ${importPath}`);
              }
            }
          }
        }
      }
    }
  }
  
  return {
    allValid: errors.length === 0,
    errors,
    warnings,
  };
}

// Résolution des chemins d'import relatifs
function resolveImportPath(fromFile: string, importPath: string): string {
  const fromDir = fromFile.split('/').slice(0, -1).join('/');
  const parts = importPath.split('/');
  const result: string[] = fromDir ? fromDir.split('/') : [];
  
  for (const part of parts) {
    if (part === '..') {
      result.pop();
    } else if (part !== '.') {
      result.push(part);
    }
  }
  
  return result.join('/');
}

// Auto-fix des erreurs courantes
export function autoFixIssues(
  modifications: ASTModification[],
  projectFiles: Record<string, string>
): ASTModification[] {
  const fixed: ASTModification[] = [];
  
  for (const mod of modifications) {
    // Ignorer les modifications vers des fichiers inexistants
    if (!projectFiles[mod.path]) {
      console.log(`[autoFix] Skipping modification for non-existent file: ${mod.path}`);
      continue;
    }
    
    const fixedMod = { ...mod };
    
    // Ajouter des valeurs par défaut manquantes
    if (mod.type === 'css-change' && fixedMod.value === undefined) {
      fixedMod.value = 'auto';
      console.log(`[autoFix] Added default value 'auto' for css-change`);
    }
    
    if (mod.type === 'html-change' && fixedMod.value === undefined) {
      fixedMod.value = '';
      console.log(`[autoFix] Added default empty value for html-change`);
    }
    
    fixed.push(fixedMod);
  }
  
  return fixed;
}

// Application des modifications (simulation)
export function applyModifications(
  modifications: ASTModification[],
  projectFiles: Record<string, string>
): ApplyResult {
  const updatedFiles = { ...projectFiles };
  const errors: string[] = [];
  
  // Grouper par fichier
  const byFile = new Map<string, ASTModification[]>();
  for (const mod of modifications) {
    const existing = byFile.get(mod.path) || [];
    existing.push(mod);
    byFile.set(mod.path, existing);
  }
  
  // Appliquer les modifications par fichier
  for (const [filePath, fileMods] of byFile) {
    try {
      let content = updatedFiles[filePath];
      
      if (!content) {
        errors.push(`File not found: ${filePath}`);
        continue;
      }
      
      for (const mod of fileMods) {
        console.log(`[apply] Applying ${mod.type} to ${filePath}: target=${mod.target}`);
        
        // Simulation: ajouter un commentaire indiquant la modification
        const comment = getModificationComment(mod, filePath);
        content = addModificationMarker(content, comment, filePath);
      }
      
      updatedFiles[filePath] = content;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      errors.push(`Error applying modifications to ${filePath}: ${errorMsg}`);
    }
  }
  
  return {
    success: errors.length === 0,
    updatedFiles,
    errors,
  };
}

// Génération du commentaire de modification
function getModificationComment(mod: ASTModification, _filePath: string): string {
  switch (mod.type) {
    case 'css-change':
      return `/* unified-modify: ${mod.type} - ${mod.target} { ${mod.property}: ${mod.value} } */`;
    case 'html-change':
      return `<!-- unified-modify: ${mod.type} - ${mod.target} ${mod.attribute}="${mod.value}" -->`;
    case 'jsx-change':
      return `{/* unified-modify: ${mod.type} - ${mod.target} */}`;
    default:
      return `/* unified-modify: unknown modification type */`;
  }
}

// Ajouter le marqueur de modification au fichier
function addModificationMarker(content: string, comment: string, filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase();
  
  switch (ext) {
    case 'css':
      return content + '\n' + comment;
    case 'html':
      return content + '\n' + comment;
    case 'tsx':
    case 'jsx':
    case 'ts':
    case 'js':
      return content + '\n' + comment;
    default:
      return content + '\n// ' + comment;
  }
}

// Message de complétion
export function markAsCompleted(modificationCount: number, durationMs: number): string {
  const seconds = (durationMs / 1000).toFixed(1);
  return `✓ Completed ${modificationCount} modification${modificationCount !== 1 ? 's' : ''} in ${seconds}s`;
}

// Validation et correction combinées
export function validateAndFix(
  modifications: ASTModification[],
  projectFiles: Record<string, string>
): {
  validatedMods: ASTModification[];
  validation: ValidationResult;
} {
  // Première validation
  const initialValidation = validateModifications(modifications, projectFiles);
  
  // Auto-fix si des erreurs
  let validatedMods = modifications;
  if (!initialValidation.allValid) {
    console.log(`[validateAndFix] Found ${initialValidation.errors.length} errors, attempting auto-fix`);
    validatedMods = autoFixIssues(modifications, projectFiles);
  }
  
  // Re-validation après fix
  const finalValidation = validateModifications(validatedMods, projectFiles);
  
  return {
    validatedMods,
    validation: finalValidation,
  };
}
