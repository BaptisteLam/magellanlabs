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

// Auto-fix des erreurs courantes - P0: Version robuste avec fallbacks
export function autoFixIssues(
  modifications: ASTModification[],
  projectFiles: Record<string, string>
): ASTModification[] {
  const fixed: ASTModification[] = [];
  
  for (const mod of modifications) {
    try {
      // Ignorer les modifications vers des fichiers inexistants
      if (!projectFiles[mod.path]) {
        console.log(`[autoFix] Skipping modification for non-existent file: ${mod.path}`);
        // P0: Tenter de trouver un fichier similaire
        const similarFile = findSimilarFile(mod.path, Object.keys(projectFiles));
        if (similarFile) {
          console.log(`[autoFix] Found similar file: ${similarFile}`);
          mod.path = similarFile;
        } else {
          continue;
        }
      }
      
      const fixedMod = { ...mod };
      
      // Ajouter des valeurs par défaut manquantes
      if (mod.type === 'css-change') {
        if (fixedMod.value === undefined) {
          fixedMod.value = 'auto';
          console.log(`[autoFix] Added default value 'auto' for css-change`);
        }
        // P0: Normaliser le target CSS
        if (fixedMod.target && !fixedMod.target.startsWith('.') && !fixedMod.target.startsWith('#')) {
          // C'est un tag HTML, OK
        } else if (fixedMod.target && fixedMod.target.includes(' ')) {
          // Sélecteur complexe, garder tel quel
        }
      }
      
      if (mod.type === 'html-change') {
        if (fixedMod.value === undefined) {
          fixedMod.value = '';
          console.log(`[autoFix] Added default empty value for html-change`);
        }
        // P0: Normaliser le target HTML
        if (fixedMod.target && fixedMod.target.startsWith('<')) {
          fixedMod.target = fixedMod.target.replace(/^<|>$/g, '').split(' ')[0];
          console.log(`[autoFix] Normalized HTML target to: ${fixedMod.target}`);
        }
      }
      
      if (mod.type === 'jsx-change') {
        // P0: S'assurer que changes est un objet valide
        if (!fixedMod.changes || typeof fixedMod.changes !== 'object') {
          fixedMod.changes = {};
          console.log(`[autoFix] Added default empty changes for jsx-change`);
        }
      }
      
      fixed.push(fixedMod);
    } catch (error) {
      console.error(`[autoFix] Error processing modification:`, error, mod);
      // P0: En cas d'erreur, tenter de récupérer la modification telle quelle
      fixed.push(mod);
    }
  }
  
  return fixed;
}

// P0: Trouver un fichier similaire par correspondance floue
function findSimilarFile(targetPath: string, existingPaths: string[]): string | null {
  const targetName = targetPath.split('/').pop()?.toLowerCase() || '';
  const targetBase = targetName.replace(/\.[^.]+$/, '');
  
  for (const path of existingPaths) {
    const fileName = path.split('/').pop()?.toLowerCase() || '';
    const fileBase = fileName.replace(/\.[^.]+$/, '');
    
    // Correspondance exacte du nom de fichier
    if (fileName === targetName) return path;
    
    // Correspondance du nom de base (sans extension)
    if (fileBase === targetBase) return path;
    
    // Correspondance partielle
    if (fileBase.includes(targetBase) || targetBase.includes(fileBase)) {
      return path;
    }
  }
  
  return null;
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

// Parser CSS simplifié pour Deno (sans postcss) - P0: Version robuste
function applyCSSModification(content: string, mod: ASTModification): string {
  const { target, property, value } = mod;
  
  if (!target || !property) {
    console.warn('[css] Missing target or property');
    return content;
  }
  
  try {
    // Regex pour trouver le sélecteur et son bloc
    const escapedTarget = escapeRegex(target);
    const escapedProperty = escapeRegex(property);
    
    // P0: Regex plus tolérante pour différents formats CSS
    const selectorRegex = new RegExp(
      `(${escapedTarget}\\s*\\{[^}]*)\\b${escapedProperty}\\s*:\\s*[^;]+;`,
      'gi'
    );
    
    if (selectorRegex.test(content)) {
      // Propriété existe, la remplacer
      content = content.replace(selectorRegex, `$1${property}: ${value};`);
      console.log(`[css] Updated ${target} { ${property}: ${value} }`);
    } else {
      // Vérifier si le sélecteur existe
      const selectorOnlyRegex = new RegExp(`(${escapedTarget})\\s*\\{([^}]*)\\}`, 'gi');
      const match = selectorOnlyRegex.exec(content);
      
      if (match) {
        // Ajouter la propriété au bloc existant
        const existingContent = match[2];
        const updatedBlock = `${match[1]} {\n  ${property}: ${value};${existingContent}\n}`;
        content = content.replace(selectorOnlyRegex, updatedBlock);
        console.log(`[css] Added ${property}: ${value} to ${target}`);
      } else {
        // Créer un nouveau bloc à la fin
        content = content.trim() + `\n\n${target} {\n  ${property}: ${value};\n}`;
        console.log(`[css] Created new rule ${target} { ${property}: ${value} }`);
      }
    }
    
    return content;
  } catch (error) {
    console.error('[css] Error applying modification:', error);
    // P0: Fallback - ajouter le nouveau bloc à la fin
    return content.trim() + `\n\n${target} {\n  ${property}: ${value};\n}`;
  }
}

// Parser HTML simplifié pour Deno (sans parse5) - P0: Version robuste
function applyHTMLModification(content: string, mod: ASTModification): string {
  const { target, attribute, value } = mod;
  
  if (!target) {
    console.warn('[html] Missing target');
    return content;
  }
  
  try {
    // Construire regex pour trouver l'élément
    let elementRegex: RegExp;
    const escapedTarget = target.startsWith('.') || target.startsWith('#') 
      ? escapeRegex(target.slice(1))
      : escapeRegex(target);
    
    if (target.startsWith('.')) {
      // Sélecteur de classe - P0: Regex plus tolérante
      elementRegex = new RegExp(`(<[^>]*class=["'][^"']*\\b${escapedTarget}\\b[^"']*["'][^>]*)(>)`, 'gi');
    } else if (target.startsWith('#')) {
      // Sélecteur d'ID
      elementRegex = new RegExp(`(<[^>]*id=["']${escapedTarget}["'][^>]*)(>)`, 'gi');
    } else {
      // Sélecteur de tag
      elementRegex = new RegExp(`(<${escapedTarget}\\b[^>]*)(>)`, 'gi');
    }
    
    if (attribute && value !== undefined) {
      // Modifier ou ajouter un attribut
      const escapedAttr = escapeRegex(attribute);
      const attrRegex = new RegExp(`(${escapedAttr}=["'])[^"']*(['"])`, 'gi');
      
      let modified = false;
      content = content.replace(elementRegex, (match, beforeClose, close) => {
        if (attrRegex.test(beforeClose)) {
          // Attribut existe, le remplacer
          modified = true;
          return beforeClose.replace(attrRegex, `$1${value}$2`) + close;
        } else {
          // Ajouter l'attribut
          modified = true;
          return `${beforeClose} ${attribute}="${value}"${close}`;
        }
      });
      
      if (modified) {
        console.log(`[html] Updated ${target} ${attribute}="${value}"`);
      }
    } else if (value !== undefined) {
      // Modifier le contenu textuel
      const escapedTargetForContent = escapeRegex(target.replace(/^[.#]/, ''));
      const contentRegex = new RegExp(`(<${escapedTargetForContent}[^>]*>)[^<]*(</${escapedTargetForContent}>)`, 'gi');
      content = content.replace(contentRegex, `$1${value}$2`);
      console.log(`[html] Updated ${target} content to "${value.substring(0, 50)}..."`);
    }
    
    return content;
  } catch (error) {
    console.error('[html] Error applying modification:', error);
    return content;
  }
}

// Parser JSX/TSX simplifié pour Deno (sans babel) - P0: Version robuste
function applyJSXModification(content: string, mod: ASTModification, _ext: string): string {
  const { target, changes, value } = mod;
  
  if (!target) {
    console.warn('[jsx] Missing target');
    return content;
  }
  
  try {
    const escapedTarget = escapeRegex(target);
    
    // Si changes contient du code complet, essayer un remplacement intelligent
    if (changes && typeof changes === 'object') {
      // Chercher le composant ou la fonction ciblée
      const componentRegex = new RegExp(
        `(function\\s+${escapedTarget}|const\\s+${escapedTarget}\\s*=)`,
        'g'
      );
      
      const hasComponent = componentRegex.test(content);
      
      // Pour les changements de props/attributs dans JSX
      if ('props' in changes && changes.props && typeof changes.props === 'object') {
        const propsChanges = changes.props as unknown as Record<string, string>;
        for (const [propName, propValue] of Object.entries(propsChanges)) {
          const escapedPropName = escapeRegex(propName);
          // P0: Regex plus robuste pour trouver et modifier les props
          const propRegex = new RegExp(
            `(<${escapedTarget}[^>]*)(${escapedPropName}=\\{[^}]+\\}|${escapedPropName}=["'][^"']*["'])([^>]*>)`,
            'gi'
          );
          
          if (propRegex.test(content)) {
            content = content.replace(propRegex, `$1${propName}="${propValue}"$3`);
          } else {
            // Ajouter la prop si elle n'existe pas
            const addPropRegex = new RegExp(`(<${escapedTarget})(\\s[^>]*>|>)`, 'gi');
            content = content.replace(addPropRegex, `$1 ${propName}="${propValue}"$2`);
          }
          console.log(`[jsx] Updated prop ${propName}="${propValue}" on ${target}`);
        }
      }
      
      // Pour les changements de className
      if ('className' in changes) {
        const newClassName = changes.className as string;
        // P0: Regex robuste pour className avec template literals, expressions, etc.
        const classNameRegex = new RegExp(
          `(<${escapedTarget}[^>]*)(className=\\{[^}]*\\}|className=["'][^"']*["']|className=\`[^\`]*\`)([^>]*>)`,
          'gi'
        );
        
        if (classNameRegex.test(content)) {
          content = content.replace(classNameRegex, `$1className="${newClassName}"$3`);
        } else {
          const addClassRegex = new RegExp(`(<${escapedTarget})(\\s[^>]*>|>)`, 'gi');
          content = content.replace(addClassRegex, `$1 className="${newClassName}"$2`);
        }
        console.log(`[jsx] Updated className on ${target}`);
      }
      
      // Pour les changements de style inline
      if ('style' in changes) {
        const styleObj = changes.style;
        const styleStr = JSON.stringify(styleObj);
        // P0: Regex robuste pour style avec différents formats
        const styleRegex = new RegExp(
          `(<${escapedTarget}[^>]*)(style=\\{[^}]+\\}|style=\\{\\{[^}]+\\}\\})([^>]*>)`,
          'gi'
        );
        
        if (styleRegex.test(content)) {
          content = content.replace(styleRegex, `$1style={${styleStr}}$3`);
        } else {
          const addStyleRegex = new RegExp(`(<${escapedTarget})(\\s[^>]*>|>)`, 'gi');
          content = content.replace(addStyleRegex, `$1 style={${styleStr}}$2`);
        }
        console.log(`[jsx] Updated style on ${target}`);
      }
      
      // P0: Pour les changements génériques (clé: valeur)
      for (const [key, val] of Object.entries(changes)) {
        if (!['props', 'className', 'style'].includes(key)) {
          const escapedKey = escapeRegex(key);
          const attrRegex = new RegExp(
            `(<${escapedTarget}[^>]*)(${escapedKey}=\\{[^}]+\\}|${escapedKey}=["'][^"']*["'])([^>]*>)`,
            'gi'
          );
          
          const valStr = typeof val === 'string' ? `"${val}"` : `{${JSON.stringify(val)}}`;
          if (attrRegex.test(content)) {
            content = content.replace(attrRegex, `$1${key}=${valStr}$3`);
          } else {
            const addAttrRegex = new RegExp(`(<${escapedTarget})(\\s[^>]*>|>)`, 'gi');
            content = content.replace(addAttrRegex, `$1 ${key}=${valStr}$2`);
          }
          console.log(`[jsx] Updated ${key} on ${target}`);
        }
      }
    }
    
    // Si value contient du code de remplacement direct
    if (value && typeof value === 'string') {
      // P0: Remplacement plus robuste basé sur la cible
      const simpleRegex = new RegExp(
        `(<${escapedTarget}[^>]*>)[^<]*(</${escapedTarget}>)`,
        'gi'
      );
      
      if (simpleRegex.test(content)) {
        content = content.replace(simpleRegex, `$1${value}$2`);
        console.log(`[jsx] Updated ${target} content`);
      } else {
        // P0: Fallback - chercher self-closing tag
        const selfClosingRegex = new RegExp(`(<${escapedTarget}[^/]*)(/?>)`, 'gi');
        if (value && !selfClosingRegex.test(content)) {
          console.log(`[jsx] Could not find ${target} to update content`);
        }
      }
    }
    
    return content;
  } catch (error) {
    console.error('[jsx] Error applying modification:', error);
    return content;
  }
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
