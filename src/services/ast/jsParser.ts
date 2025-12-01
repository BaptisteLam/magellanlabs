import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import generate from '@babel/generator';
import * as t from '@babel/types';
import { ASTModification, ASTModificationResult } from '@/types/ast';

export async function applyJSModifications(
  content: string,
  modifications: ASTModification[]
): Promise<ASTModificationResult> {
  try {
    const ast = parse(content, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript'],
    });

    let modificationsApplied = 0;

    for (const mod of modifications) {
      const { target, type, value } = mod;

      if (!target.identifier) continue;

      traverse(ast, {
        // Handle function declarations
        FunctionDeclaration(path) {
          if (path.node.id?.name === target.identifier) {
            if (type === 'delete') {
              path.remove();
              modificationsApplied++;
            } else if (type === 'replace' && value) {
              const newAst = parse(value, { sourceType: 'module' });
              if (newAst.program.body[0]) {
                path.replaceWith(newAst.program.body[0]);
                modificationsApplied++;
              }
            }
          }
        },

        // Handle variable declarations
        VariableDeclarator(path) {
          if (t.isIdentifier(path.node.id) && path.node.id.name === target.identifier) {
            if (type === 'update' && value) {
              const newAst = parse(value, { sourceType: 'module' });
              const firstStatement = newAst.program.body[0];
              if (t.isExpressionStatement(firstStatement)) {
                path.node.init = firstStatement.expression;
                modificationsApplied++;
              }
            } else if (type === 'delete') {
              path.remove();
              modificationsApplied++;
            }
          }
        },

        // Handle imports
        ImportDeclaration(path) {
          if (target.identifier === 'import' && type === 'insert' && value) {
            const newAst = parse(value, { sourceType: 'module' });
            if (newAst.program.body[0]) {
              path.insertAfter(newAst.program.body[0]);
              modificationsApplied++;
            }
          }
        },

        // Handle JSX elements
        JSXElement(path) {
          if (t.isJSXIdentifier(path.node.openingElement.name) &&
              path.node.openingElement.name.name === target.identifier) {
            if (type === 'update' && target.attribute && value) {
              // Update JSX attribute
              const attrs = path.node.openingElement.attributes;
              let found = false;
              
              for (const attr of attrs) {
                if (t.isJSXAttribute(attr) &&
                    t.isJSXIdentifier(attr.name) &&
                    attr.name.name === target.attribute) {
                  attr.value = t.stringLiteral(value);
                  found = true;
                  modificationsApplied++;
                  break;
                }
              }
              
              if (!found) {
                attrs.push(
                  t.jsxAttribute(
                    t.jsxIdentifier(target.attribute),
                    t.stringLiteral(value)
                  )
                );
                modificationsApplied++;
              }
            } else if (type === 'delete') {
              path.remove();
              modificationsApplied++;
            }
          }
        },
      });
    }

    if (modificationsApplied === 0) {
      return {
        success: false,
        error: 'No modifications were applied',
      };
    }

    const output = generate(ast, {
      retainLines: false,
      compact: false,
    });

    return {
      success: true,
      modifiedContent: output.code,
      modificationsApplied,
    };
  } catch (error) {
    console.error('JS AST modification error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown JS parsing error',
    };
  }
}
