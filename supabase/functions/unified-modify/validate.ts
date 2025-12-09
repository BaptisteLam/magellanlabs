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

// Application RÉELLE des modifications via parsers AST
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
      
      const ext = filePath.split('.').pop()?.toLowerCase();
      
      for (const mod of fileMods) {
        console.log(`[apply] Applying ${mod.type} to ${filePath}: target=${mod.target}`);
        
        switch (mod.type) {
          case 'css-change':
            content = applyCSSModification(content, mod);
            break;
          case 'html-change':
            content = applyHTMLModification(content, mod);
            break;
          case 'jsx-change':
            content = applyJSXModification(content, mod, ext || 'tsx');
            break;
          default:
            console.warn(`[apply] Unknown modification type: ${mod.type}`);
        }
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

// Parser CSS simplifié pour Deno (sans postcss)
function applyCSSModification(content: string, mod: ASTModification): string {
  const { target, property, value } = mod;
  
  if (!target || !property) {
    console.warn('[css] Missing target or property');
    return content;
  }
  
  // Regex pour trouver le sélecteur et son bloc
  const selectorRegex = new RegExp(
    `(${escapeRegex(target)}\\s*\\{[^}]*)\\b${escapeRegex(property)}\\s*:\\s*[^;]+;`,
    'g'
  );
  
  if (selectorRegex.test(content)) {
    // Propriété existe, la remplacer
    content = content.replace(selectorRegex, `$1${property}: ${value};`);
    console.log(`[css] Updated ${target} { ${property}: ${value} }`);
  } else {
    // Vérifier si le sélecteur existe
    const selectorOnlyRegex = new RegExp(`${escapeRegex(target)}\\s*\\{([^}]*)\\}`, 'g');
    const match = selectorOnlyRegex.exec(content);
    
    if (match) {
      // Ajouter la propriété au bloc existant
      const updatedBlock = `${target} {\n  ${property}: ${value};\n${match[1]}}`;
      content = content.replace(selectorOnlyRegex, updatedBlock);
      console.log(`[css] Added ${property}: ${value} to ${target}`);
    } else {
      // Créer un nouveau bloc
      content += `\n\n${target} {\n  ${property}: ${value};\n}`;
      console.log(`[css] Created new rule ${target} { ${property}: ${value} }`);
    }
  }
  
  return content;
}

// Parser HTML simplifié pour Deno (sans parse5)
function applyHTMLModification(content: string, mod: ASTModification): string {
  const { target, attribute, value } = mod;
  
  if (!target) {
    console.warn('[html] Missing target');
    return content;
  }
  
  // Construire regex pour trouver l'élément
  let elementRegex: RegExp;
  
  if (target.startsWith('.')) {
    // Sélecteur de classe
    const className = target.slice(1);
    elementRegex = new RegExp(`(<[^>]*class=["'][^"']*${escapeRegex(className)}[^"']*["'][^>]*)(>)`, 'gi');
  } else if (target.startsWith('#')) {
    // Sélecteur d'ID
    const id = target.slice(1);
    elementRegex = new RegExp(`(<[^>]*id=["']${escapeRegex(id)}["'][^>]*)(>)`, 'gi');
  } else {
    // Sélecteur de tag
    elementRegex = new RegExp(`(<${escapeRegex(target)}[^>]*)(>)`, 'gi');
  }
  
  if (attribute && value !== undefined) {
    // Modifier ou ajouter un attribut
    const attrRegex = new RegExp(`(${attribute}=["'])[^"']*(['"])`, 'gi');
    
    content = content.replace(elementRegex, (match, beforeClose, close) => {
      if (attrRegex.test(beforeClose)) {
        // Attribut existe, le remplacer
        return beforeClose.replace(attrRegex, `$1${value}$2`) + close;
      } else {
        // Ajouter l'attribut
        return `${beforeClose} ${attribute}="${value}"${close}`;
      }
    });
    console.log(`[html] Updated ${target} ${attribute}="${value}"`);
  } else if (value !== undefined) {
    // Modifier le contenu textuel
    const contentRegex = new RegExp(`(<${escapeRegex(target)}[^>]*>)[^<]*(</${escapeRegex(target)}>)`, 'gi');
    content = content.replace(contentRegex, `$1${value}$2`);
    console.log(`[html] Updated ${target} content to "${value.substring(0, 50)}..."`);
  }
  
  return content;
}

// Parser JSX/TSX simplifié pour Deno (sans babel)
function applyJSXModification(content: string, mod: ASTModification, _ext: string): string {
  const { target, changes, value } = mod;
  
  if (!target) {
    console.warn('[jsx] Missing target');
    return content;
  }
  
  // Si changes contient du code complet, essayer un remplacement intelligent
  if (changes) {
    // Chercher le composant ou la fonction ciblée
    const componentRegex = new RegExp(
      `(function\\s+${escapeRegex(target)}|const\\s+${escapeRegex(target)}\\s*=)`,
      'g'
    );
    
    if (componentRegex.test(content)) {
      // Pour les changements de props/attributs dans JSX
      if (typeof changes === 'object' && changes !== null && 'props' in (changes as Record<string, unknown>)) {
        const changesObj = changes as Record<string, unknown>;
        const propsChanges = changesObj.props as Record<string, string>;
        for (const [propName, propValue] of Object.entries(propsChanges)) {
          // Regex pour trouver et modifier les props
          const propRegex = new RegExp(
            `(<${escapeRegex(target)}[^>]*)(${escapeRegex(propName)}=\\{[^}]+\\}|${escapeRegex(propName)}=["'][^"']*["'])([^>]*>)`,
            'g'
          );
          
          if (propRegex.test(content)) {
            content = content.replace(propRegex, `$1${propName}="${propValue}"$3`);
          } else {
            // Ajouter la prop si elle n'existe pas
            const addPropRegex = new RegExp(`(<${escapeRegex(target)})([^>]*>)`, 'g');
            content = content.replace(addPropRegex, `$1 ${propName}="${propValue}"$2`);
          }
          console.log(`[jsx] Updated prop ${propName}="${propValue}" on ${target}`);
        }
      }
      
      // Pour les changements de className
      if (typeof changes === 'object' && changes !== null && 'className' in (changes as Record<string, unknown>)) {
        const changesObj = changes as Record<string, unknown>;
        const classNameRegex = new RegExp(
          `(<${escapeRegex(target)}[^>]*)(className=\\{[^}]+\\}|className=["'][^"']*["'])([^>]*>)`,
          'g'
        );
        
        if (classNameRegex.test(content)) {
          content = content.replace(classNameRegex, `$1className="${changesObj.className}"$3`);
        } else {
          const addClassRegex = new RegExp(`(<${escapeRegex(target)})([^>]*>)`, 'g');
          content = content.replace(addClassRegex, `$1 className="${changesObj.className}"$2`);
        }
        console.log(`[jsx] Updated className on ${target}`);
      }
      
      // Pour les changements de style inline
      if (typeof changes === 'object' && changes !== null && 'style' in (changes as Record<string, unknown>)) {
        const changesObj = changes as Record<string, unknown>;
        const styleStr = JSON.stringify(changesObj.style);
        const styleRegex = new RegExp(
          `(<${escapeRegex(target)}[^>]*)(style=\\{[^}]+\\})([^>]*>)`,
          'g'
        );
        
        if (styleRegex.test(content)) {
          content = content.replace(styleRegex, `$1style={${styleStr}}$3`);
        } else {
          const addStyleRegex = new RegExp(`(<${escapeRegex(target)})([^>]*>)`, 'g');
          content = content.replace(addStyleRegex, `$1 style={${styleStr}}$2`);
        }
        console.log(`[jsx] Updated style on ${target}`);
      }
    }
  }
  
  // Si value contient du code de remplacement direct
  if (value && typeof value === 'string') {
    // Remplacement simple basé sur la cible
    const simpleRegex = new RegExp(
      `(<${escapeRegex(target)}[^>]*>)[^<]*(</${escapeRegex(target)}>)`,
      'g'
    );
    content = content.replace(simpleRegex, `$1${value}$2`);
    console.log(`[jsx] Updated ${target} content`);
  }
  
  return content;
}

// Utilitaire pour échapper les caractères regex
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
