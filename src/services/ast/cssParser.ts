import postcss from 'postcss';
import safeParser from 'postcss-safe-parser';
import { ASTModification, ASTModificationResult } from '@/types/ast';

export async function applyCSSModifications(
  content: string,
  modifications: ASTModification[]
): Promise<ASTModificationResult> {
  try {
    const root = safeParser(content);
    let modificationsApplied = 0;

    for (const mod of modifications) {
      const { target, type, value, position } = mod;

      if (type === 'update' && target.selector && target.property) {
        // Update CSS property value
        root.walkRules(target.selector, (rule) => {
          rule.walkDecls(target.property!, (decl) => {
            decl.value = value || '';
            modificationsApplied++;
          });
        });
      } else if (type === 'insert' && target.selector) {
        // Insert new CSS rule or property
        if (target.property && value) {
          // Insert property into existing rule
          root.walkRules(target.selector, (rule) => {
            const newDecl = postcss.decl({ prop: target.property!, value });
            if (position === 'prepend') {
              rule.prepend(newDecl);
            } else {
              rule.append(newDecl);
            }
            modificationsApplied++;
          });
        } else if (value) {
          // Insert new rule
          const newRule = postcss.parse(value).first;
          if (newRule) {
            root.append(newRule);
            modificationsApplied++;
          }
        }
      } else if (type === 'delete' && target.selector) {
        // Delete CSS rule or property
        if (target.property) {
          root.walkRules(target.selector, (rule) => {
            rule.walkDecls(target.property!, (decl) => {
              decl.remove();
              modificationsApplied++;
            });
          });
        } else {
          root.walkRules(target.selector, (rule) => {
            rule.remove();
            modificationsApplied++;
          });
        }
      } else if (type === 'replace' && target.selector) {
        // Replace entire rule
        let replaced = false;
        root.walkRules(target.selector, (rule) => {
          if (!replaced && value) {
            const newRule = postcss.parse(value).first;
            if (newRule) {
              rule.replaceWith(newRule);
              replaced = true;
              modificationsApplied++;
            }
          }
        });
      }
    }

    if (modificationsApplied === 0) {
      return {
        success: false,
        error: 'No modifications were applied',
      };
    }

    const modifiedContent = root.toString();
    return {
      success: true,
      modifiedContent,
      modificationsApplied,
    };
  } catch (error) {
    console.error('CSS AST modification error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown CSS parsing error',
    };
  }
}
