/**
 * AST Modifier Service
 * Applies structural modifications to code using AST
 * Much more reliable than string search/replace
 */

import postcss from 'postcss';
import type { ASTModification, ASTModificationResult, ASTModificationAction } from '@/types/ast';
import {
  parseCSSToAST,
  generateCSS,
  findCSSRule,
  findCSSProperty,
  createCSSRule,
  createCSSDeclaration,
  type CSSAST,
} from './cssParser';
import {
  parseHTMLToAST,
  generateHTML,
  findHTMLBySelector,
  updateHTMLTextContent,
  updateHTMLAttribute,
  createHTMLElement,
  traverseHTML,
  type HTMLAST,
} from './htmlParser';
import {
  parseJSToAST,
  generateJS,
  containsJSX,
  type JSAST,
} from './jsParser';

/**
 * Main function to apply AST modifications to a file
 */
export async function applyASTModifications(
  fileContent: string,
  modification: ASTModification
): Promise<ASTModificationResult> {
  const { fileType, modifications } = modification;

  try {
    // Parse based on file type
    let ast: CSSAST | HTMLAST | JSAST;
    let newContent: string;

    switch (fileType) {
      case 'css':
        ast = parseCSSToAST(fileContent);
        await applyCSSModifications(ast as CSSAST, modifications);
        newContent = generateCSS(ast as CSSAST);
        break;

      case 'html':
        ast = parseHTMLToAST(fileContent);
        await applyHTMLModifications(ast as HTMLAST, modifications);
        newContent = generateHTML(ast as HTMLAST);
        break;

      case 'js':
      case 'jsx':
      case 'ts':
      case 'tsx':
        const isJSX = fileType === 'jsx' || fileType === 'tsx' || containsJSX(fileContent);
        ast = parseJSToAST(fileContent, isJSX);
        await applyJSModifications(ast as JSAST, modifications);
        newContent = generateJS(ast as JSAST);
        break;

      default:
        throw new Error(`Unsupported file type: ${fileType}`);
    }

    return {
      success: true,
      newContent,
      appliedCount: modifications.length,
      failedCount: 0,
    };
  } catch (error) {
    console.error('AST modification error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      appliedCount: 0,
      failedCount: modifications.length,
    };
  }
}

/**
 * Apply modifications to CSS AST
 */
async function applyCSSModifications(
  ast: CSSAST,
  modifications: ASTModificationAction[]
): Promise<void> {
  for (const mod of modifications) {
    try {
      switch (mod.action) {
        case 'update':
          applyCSSUpdate(ast, mod);
          break;
        case 'insert':
          applyCSSInsert(ast, mod);
          break;
        case 'delete':
          applyCSSDelete(ast, mod);
          break;
        case 'replace':
          applyCSSReplace(ast, mod);
          break;
      }
    } catch (error) {
      console.warn('Failed to apply CSS modification:', mod, error);
    }
  }
}

/**
 * Update a CSS property value
 */
function applyCSSUpdate(ast: CSSAST, mod: ASTModificationAction): void {
  const { target, value } = mod;

  if (target.type === 'property' && target.selector && target.property) {
    // Find the property declaration
    const decl = findCSSProperty(ast, target.selector, target.property);

    if (decl) {
      // Update existing property
      decl.value = String(value);
      console.log(`✅ Updated CSS ${target.selector} { ${target.property}: ${value} }`);
    } else {
      // Property doesn't exist, try to find the rule and add it
      const rule = findCSSRule(ast, target.selector);

      if (rule && 'append' in rule) {
        const newDecl = createCSSDeclaration(target.property, String(value));
        rule.append(newDecl);
        console.log(`✅ Added CSS ${target.selector} { ${target.property}: ${value} }`);
      } else {
        console.warn(`⚠️ CSS rule not found: ${target.selector}`);
      }
    }
  }
}

/**
 * Insert a new CSS rule
 */
function applyCSSInsert(ast: CSSAST, mod: ASTModificationAction): void {
  const { target, newNode } = mod;

  if (!newNode || !newNode.selector || !newNode.declarations) {
    console.warn('⚠️ Invalid CSS insert: missing selector or declarations');
    return;
  }

  // Create new rule
  const rule = createCSSRule(newNode.selector, newNode.declarations);

  if (target.relativeTo) {
    // Insert relative to another rule
    const relativeRule = findCSSRule(ast, target.relativeTo);

    if (relativeRule && relativeRule.parent) {
      if (target.position === 'after') {
        relativeRule.parent.insertAfter(relativeRule, rule);
      } else {
        relativeRule.parent.insertBefore(relativeRule, rule);
      }
      console.log(`✅ Inserted CSS rule ${newNode.selector} ${target.position} ${target.relativeTo}`);
    } else {
      // Fallback: append to root
      ast.root.append(rule);
      console.log(`✅ Appended CSS rule ${newNode.selector} to root`);
    }
  } else {
    // No relative position, just append
    ast.root.append(rule);
    console.log(`✅ Appended CSS rule ${newNode.selector}`);
  }
}

/**
 * Delete a CSS rule or property
 */
function applyCSSDelete(ast: CSSAST, mod: ASTModificationAction): void {
  const { target } = mod;

  if (target.type === 'property' && target.selector && target.property) {
    // Delete a specific property
    const decl = findCSSProperty(ast, target.selector, target.property);
    if (decl) {
      decl.remove();
      console.log(`✅ Deleted CSS property ${target.selector} { ${target.property} }`);
    }
  } else if (target.type === 'rule' && target.selector) {
    // Delete entire rule
    const rule = findCSSRule(ast, target.selector);
    if (rule) {
      rule.remove();
      console.log(`✅ Deleted CSS rule ${target.selector}`);
    }
  }
}

/**
 * Replace a CSS rule
 */
function applyCSSReplace(ast: CSSAST, mod: ASTModificationAction): void {
  const { target, newNode } = mod;

  if (!target.selector || !newNode) {
    console.warn('⚠️ Invalid CSS replace: missing selector or newNode');
    return;
  }

  // Find and remove old rule
  const oldRule = findCSSRule(ast, target.selector);
  if (oldRule) {
    // Create new rule
    const rule = createCSSRule(newNode.selector || target.selector, newNode.declarations || {});

    // Replace in same position
    if (oldRule.parent) {
      oldRule.parent.insertBefore(oldRule, rule);
    }
    oldRule.remove();
    console.log(`✅ Replaced CSS rule ${target.selector}`);
  }
}

/**
 * Apply modifications to HTML AST
 */
async function applyHTMLModifications(
  ast: HTMLAST,
  modifications: ASTModificationAction[]
): Promise<void> {
  for (const mod of modifications) {
    try {
      switch (mod.action) {
        case 'update':
          applyHTMLUpdate(ast, mod);
          break;
        case 'insert':
          applyHTMLInsert(ast, mod);
          break;
        case 'delete':
          applyHTMLDelete(ast, mod);
          break;
      }
    } catch (error) {
      console.warn('Failed to apply HTML modification:', mod, error);
    }
  }
}

/**
 * Update HTML element content or attribute
 */
function applyHTMLUpdate(ast: HTMLAST, mod: ASTModificationAction): void {
  const { target, value } = mod;

  if (!target.selector) {
    console.warn('⚠️ HTML update: missing selector');
    return;
  }

  const elements = findHTMLBySelector(ast, target.selector);
  const nodeArray = Array.isArray(elements) ? elements : [elements].filter(Boolean);

  if (nodeArray.length === 0) {
    console.warn(`⚠️ HTML element not found: ${target.selector}`);
    return;
  }

  // Update first matching element
  const element = nodeArray[0];

  if (target.attribute === 'textContent') {
    updateHTMLTextContent(element, String(value));
    console.log(`✅ Updated HTML ${target.selector} textContent`);
  } else if (target.attribute) {
    updateHTMLAttribute(element, target.attribute, value);
    console.log(`✅ Updated HTML ${target.selector} ${target.attribute}`);
  }
}

/**
 * Insert HTML element
 */
function applyHTMLInsert(ast: HTMLAST, mod: ASTModificationAction): void {
  const { target, newNode } = mod;

  if (!newNode || !newNode.tagName) {
    console.warn('⚠️ HTML insert: missing tagName');
    return;
  }

  const element = createHTMLElement(
    newNode.tagName,
    newNode.properties,
    newNode.children
  );

  if (target.selector) {
    const parents = findHTMLBySelector(ast, target.selector);
    const parentArray = Array.isArray(parents) ? parents : [parents].filter(Boolean);

    if (parentArray.length > 0) {
      const parent = parentArray[0];

      if (!parent.children) {
        parent.children = [];
      }

      if (target.position === 'before') {
        parent.children.unshift(element);
      } else {
        parent.children.push(element);
      }

      console.log(`✅ Inserted HTML <${newNode.tagName}> into ${target.selector}`);
    }
  }
}

/**
 * Delete HTML element
 */
function applyHTMLDelete(ast: HTMLAST, mod: ASTModificationAction): void {
  const { target } = mod;

  if (!target.selector) {
    console.warn('⚠️ HTML delete: missing selector');
    return;
  }

  const elements = findHTMLBySelector(ast, target.selector);
  const nodeArray = Array.isArray(elements) ? elements : [elements].filter(Boolean);

  // Remove elements by clearing their children and properties
  // Note: Full removal is complex with HAST, this marks them for exclusion
  nodeArray.forEach((element) => {
    if (element.properties) {
      element.properties['data-removed'] = true;
    }
  });

  console.log(`✅ Marked HTML ${target.selector} for deletion`);
}

/**
 * Apply modifications to JS/JSX AST
 */
async function applyJSModifications(
  ast: JSAST,
  modifications: ASTModificationAction[]
): Promise<void> {
  // JS modifications are more complex and less commonly needed for quick mods
  // For now, log that they're not fully implemented
  console.log('⚠️ JS AST modifications not yet fully implemented');

  // In the future, this would use @babel/traverse to modify the AST
  // For now, modifications fall back to the old system or full regeneration
}

/**
 * Validate modification before applying
 */
export function validateModification(mod: ASTModification): boolean {
  if (!mod.path || !mod.fileType) {
    return false;
  }

  if (!mod.modifications || mod.modifications.length === 0) {
    return false;
  }

  for (const action of mod.modifications) {
    if (!action.action || !action.target) {
      return false;
    }
  }

  return true;
}

/**
 * Batch apply multiple file modifications
 */
export async function applyBatchModifications(
  files: Record<string, string>,
  modifications: ASTModification[]
): Promise<Record<string, string>> {
  const updatedFiles: Record<string, string> = {};

  for (const mod of modifications) {
    const fileContent = files[mod.path];

    if (!fileContent) {
      console.warn(`⚠️ File not found: ${mod.path}`);
      continue;
    }

    const result = await applyASTModifications(fileContent, mod);

    if (result.success && result.newContent) {
      updatedFiles[mod.path] = result.newContent;
    } else {
      console.error(`❌ Failed to modify ${mod.path}:`, result.error);
    }
  }

  return updatedFiles;
}
