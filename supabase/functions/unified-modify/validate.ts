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

// P2: Parser CSS robuste pour Deno - Gère media queries, pseudo-classes, variables
function applyCSSModification(content: string, mod: ASTModification): string {
  const { target, property, value } = mod;
  
  if (!target || !property) {
    console.warn('[css] Missing target or property');
    return content;
  }
  
  try {
    const escapedTarget = escapeRegex(target);
    const escapedProperty = escapeRegex(property);
    
    // P2: Détecter si c'est une pseudo-classe ou media query
    const hasPseudo = target.includes(':');
    const isMediaQuery = target.startsWith('@media');
    
    // P2: Parser basé sur les blocs CSS pour plus de robustesse
    const blocks = parseCSSBlocks(content);
    let modified = false;
    
    for (const block of blocks) {
      // Vérifier si le sélecteur correspond (avec support pseudo-classes)
      const selectorMatch = hasPseudo 
        ? block.selector === target || block.selector.includes(target)
        : block.selector === target || block.selector.startsWith(target + ' ') || block.selector.endsWith(' ' + target);
      
      if (selectorMatch) {
        // Chercher et remplacer la propriété dans le bloc
        const propRegex = new RegExp(`\\b${escapedProperty}\\s*:\\s*[^;]+;`, 'gi');
        
        if (propRegex.test(block.content)) {
          // Remplacer la propriété existante
          const newContent = block.content.replace(propRegex, `${property}: ${value};`);
          content = content.replace(block.full, block.full.replace(block.content, newContent));
          modified = true;
          console.log(`[css] Updated ${target} { ${property}: ${value} }`);
        } else {
          // Ajouter la propriété au bloc existant
          const insertPos = block.content.lastIndexOf('}');
          if (insertPos === -1) {
            const newContent = block.content.trimEnd() + `\n  ${property}: ${value};\n`;
            content = content.replace(block.full, block.full.replace(block.content, newContent));
          } else {
            const newContent = `  ${property}: ${value};\n` + block.content;
            content = content.replace(block.content, newContent);
          }
          modified = true;
          console.log(`[css] Added ${property}: ${value} to ${target}`);
        }
        break;
      }
    }
    
    // Si pas de bloc trouvé, en créer un nouveau
    if (!modified) {
      // P2: Gérer les pseudo-classes - créer le bloc avec la pseudo-classe
      const newBlock = `\n${target} {\n  ${property}: ${value};\n}`;
      content = content.trim() + '\n' + newBlock;
      console.log(`[css] Created new rule ${target} { ${property}: ${value} }`);
    }
    
    return content;
  } catch (error) {
    console.error('[css] Error applying modification:', error);
    return content.trim() + `\n\n${target} {\n  ${property}: ${value};\n}`;
  }
}

// P2: Parser les blocs CSS pour manipulation plus précise
interface CSSBlock {
  selector: string;
  content: string;
  full: string;
  startIndex: number;
  endIndex: number;
}

function parseCSSBlocks(content: string): CSSBlock[] {
  const blocks: CSSBlock[] = [];
  // Regex améliorée pour capturer sélecteurs complexes incluant pseudo-classes et media queries
  const blockRegex = /([^{}]+)\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g;
  
  let match;
  while ((match = blockRegex.exec(content)) !== null) {
    const selector = match[1].trim();
    const blockContent = match[2];
    
    // Ignorer les commentaires
    if (selector.startsWith('/*') || selector.startsWith('//')) continue;
    
    blocks.push({
      selector,
      content: blockContent,
      full: match[0],
      startIndex: match.index,
      endIndex: match.index + match[0].length
    });
  }
  
  return blocks;
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

// P2: Parser JSX/TSX robuste pour Deno - Gère template literals, expressions conditionnelles
function applyJSXModification(content: string, mod: ASTModification, _ext: string): string {
  const { target, changes, value } = mod;
  
  if (!target) {
    console.warn('[jsx] Missing target');
    return content;
  }
  
  try {
    const escapedTarget = escapeRegex(target);
    
    if (changes && typeof changes === 'object') {
      // P2: Pour les changements de props/attributs dans JSX
      if ('props' in changes && changes.props && typeof changes.props === 'object') {
        const propsChanges = changes.props as unknown as Record<string, string>;
        for (const [propName, propValue] of Object.entries(propsChanges)) {
          content = updateJSXAttribute(content, target, propName, propValue);
          console.log(`[jsx] Updated prop ${propName}="${propValue}" on ${target}`);
        }
      }
      
      // P2: Pour les changements de className - supporte template literals et expressions
      if ('className' in changes) {
        const newClassName = changes.className as string;
        content = updateJSXClassName(content, target, newClassName);
        console.log(`[jsx] Updated className on ${target}`);
      }
      
      // P2: Pour les changements de style inline - gère objets imbriqués
      if ('style' in changes) {
        const styleValue = changes.style;
        if (styleValue && typeof styleValue === 'object') {
          content = updateJSXStyle(content, target, styleValue as Record<string, unknown>);
          console.log(`[jsx] Updated style on ${target}`);
        }
      }
      
      // P2: Pour les changements de contenu textuel (children)
      if ('children' in changes || 'content' in changes || 'text' in changes) {
        const textContent = (changes.children || changes.content || changes.text) as string;
        content = updateJSXChildren(content, target, textContent);
        console.log(`[jsx] Updated content on ${target}`);
      }
      
      // P2: Pour les changements génériques (clé: valeur)
      for (const [key, val] of Object.entries(changes)) {
        if (!['props', 'className', 'style', 'children', 'content', 'text'].includes(key)) {
          const valStr = typeof val === 'string' ? `"${val}"` : `{${JSON.stringify(val)}}`;
          content = updateJSXAttribute(content, target, key, val);
          console.log(`[jsx] Updated ${key} on ${target}`);
        }
      }
    }
    
    // Si value contient du code de remplacement direct
    if (value && typeof value === 'string') {
      content = updateJSXChildren(content, target, value);
      console.log(`[jsx] Updated ${target} content`);
    }
    
    return content;
  } catch (error) {
    console.error('[jsx] Error applying modification:', error);
    return content;
  }
}

// P2: Mise à jour robuste d'attribut JSX
function updateJSXAttribute(content: string, target: string, attrName: string, attrValue: unknown): string {
  const escapedTarget = escapeRegex(target);
  const escapedAttr = escapeRegex(attrName);
  
  // P2: Patterns pour différents formats d'attributs
  const patterns = [
    // Attribut avec expression: prop={value}
    new RegExp(`(<${escapedTarget}[^>]*)(\\s${escapedAttr}=\\{[^}]*\\})([^>]*>)`, 'gi'),
    // Attribut avec template literal: prop={\`value\`}
    new RegExp(`(<${escapedTarget}[^>]*)(\\s${escapedAttr}=\\{\`[^\`]*\`\\})([^>]*>)`, 'gi'),
    // Attribut avec string double: prop="value"
    new RegExp(`(<${escapedTarget}[^>]*)(\\s${escapedAttr}="[^"]*")([^>]*>)`, 'gi'),
    // Attribut avec string simple: prop='value'
    new RegExp(`(<${escapedTarget}[^>]*)(\\s${escapedAttr}='[^']*')([^>]*>)`, 'gi'),
    // Attribut booléen: prop
    new RegExp(`(<${escapedTarget}[^>]*)(\\s${escapedAttr})(?=[\\s/>])([^>]*>)`, 'gi'),
  ];
  
  // Déterminer le format de la nouvelle valeur
  const newValue = formatJSXAttributeValue(attrName, attrValue);
  
  for (const pattern of patterns) {
    if (pattern.test(content)) {
      return content.replace(pattern, `$1 ${attrName}=${newValue}$3`);
    }
  }
  
  // Attribut n'existe pas, l'ajouter
  const addAttrRegex = new RegExp(`(<${escapedTarget})(\\s[^>]*>|>)`, 'gi');
  return content.replace(addAttrRegex, `$1 ${attrName}=${newValue}$2`);
}

// P2: Mise à jour robuste de className JSX
function updateJSXClassName(content: string, target: string, newClassName: string): string {
  const escapedTarget = escapeRegex(target);
  
  // P2: Patterns pour className avec différents formats
  const classPatterns = [
    // className={`template ${dynamic}`}
    new RegExp(`(<${escapedTarget}[^>]*)(className=\\{\`[^\`]*\`\\})([^>]*>)`, 'gi'),
    // className={condition ? 'a' : 'b'}
    new RegExp(`(<${escapedTarget}[^>]*)(className=\\{[^}]+\\?[^}]+\\})([^>]*>)`, 'gi'),
    // className={cn(...)}
    new RegExp(`(<${escapedTarget}[^>]*)(className=\\{cn\\([^)]+\\)\\})([^>]*>)`, 'gi'),
    // className={variable}
    new RegExp(`(<${escapedTarget}[^>]*)(className=\\{[^}]+\\})([^>]*>)`, 'gi'),
    // className="static"
    new RegExp(`(<${escapedTarget}[^>]*)(className="[^"]*")([^>]*>)`, 'gi'),
  ];
  
  for (const pattern of classPatterns) {
    if (pattern.test(content)) {
      return content.replace(pattern, `$1className="${newClassName}"$3`);
    }
  }
  
  // className n'existe pas, l'ajouter
  const addClassRegex = new RegExp(`(<${escapedTarget})(\\s[^>]*>|>)`, 'gi');
  return content.replace(addClassRegex, `$1 className="${newClassName}"$2`);
}

// P2: Mise à jour robuste du style inline JSX
function updateJSXStyle(content: string, target: string, styleObj: Record<string, unknown>): string {
  const escapedTarget = escapeRegex(target);
  const styleStr = JSON.stringify(styleObj);
  
  // P2: Patterns pour style avec différents formats
  const stylePatterns = [
    // style={{ key: value }}
    new RegExp(`(<${escapedTarget}[^>]*)(style=\\{\\{[^}]*\\}\\})([^>]*>)`, 'gi'),
    // style={styleVariable}
    new RegExp(`(<${escapedTarget}[^>]*)(style=\\{[^}]+\\})([^>]*>)`, 'gi'),
  ];
  
  for (const pattern of stylePatterns) {
    if (pattern.test(content)) {
      return content.replace(pattern, `$1style={${styleStr}}$3`);
    }
  }
  
  // style n'existe pas, l'ajouter
  const addStyleRegex = new RegExp(`(<${escapedTarget})(\\s[^>]*>|>)`, 'gi');
  return content.replace(addStyleRegex, `$1 style={${styleStr}}$2`);
}

// P2: Mise à jour robuste des enfants JSX
function updateJSXChildren(content: string, target: string, newChildren: string): string {
  const escapedTarget = escapeRegex(target);
  
  // Pattern pour élément avec enfants
  const childrenRegex = new RegExp(
    `(<${escapedTarget}[^>]*>)[\\s\\S]*?(<\\/${escapedTarget}>)`,
    'gi'
  );
  
  if (childrenRegex.test(content)) {
    return content.replace(childrenRegex, `$1${newChildren}$2`);
  }
  
  // Fallback: self-closing tag - le convertir en élément avec enfants
  const selfClosingRegex = new RegExp(`<${escapedTarget}([^>]*)/\\s*>`, 'gi');
  if (selfClosingRegex.test(content)) {
    return content.replace(selfClosingRegex, `<${target}$1>${newChildren}</${target}>`);
  }
  
  console.log(`[jsx] Could not find ${target} to update children`);
  return content;
}

// P2: Formater la valeur d'attribut selon son type
function formatJSXAttributeValue(name: string, value: unknown): string {
  if (typeof value === 'string') {
    // Éviter les doubles quotes dans les strings
    if (value.includes('"')) {
      return `'${value}'`;
    }
    return `"${value}"`;
  }
  if (typeof value === 'boolean') {
    return value ? '' : '{false}'; // Pour les booléens, on retourne juste le nom ou {false}
  }
  if (typeof value === 'number') {
    return `{${value}}`;
  }
  // Objet ou array
  return `{${JSON.stringify(value)}}`;
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
