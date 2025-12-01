/**
 * JavaScript/JSX AST Parser using Babel
 * Provides structural parsing and modification of JS/JSX code
 */

import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import generate from '@babel/generator';
import * as t from '@babel/types';
import type { JSAST } from '@/types/ast';

/**
 * Parse JavaScript/JSX code into AST
 */
export function parseJSToAST(jsCode: string, isJSX: boolean = false): JSAST {
  const plugins: any[] = ['typescript'];

  if (isJSX) {
    plugins.push('jsx');
  }

  const ast = parse(jsCode, {
    sourceType: 'module',
    plugins,
  });

  return {
    root: ast,
    code: jsCode,
  };
}

/**
 * Generate JavaScript code from AST
 */
export function generateJS(ast: JSAST): string {
  const result = generate(ast.root, {
    retainLines: false,
    compact: false,
  });

  return result.code;
}

/**
 * Find a variable declaration by name
 */
export function findJSVariable(ast: JSAST, name: string): any {
  let found: any = null;

  traverse(ast.root, {
    VariableDeclarator(path) {
      if (t.isIdentifier(path.node.id) && path.node.id.name === name) {
        found = path.node;
      }
    },
  });

  return found;
}

/**
 * Find a function declaration by name
 */
export function findJSFunction(ast: JSAST, name: string): any {
  let found: any = null;

  traverse(ast.root, {
    FunctionDeclaration(path) {
      if (t.isIdentifier(path.node.id) && path.node.id.name === name) {
        found = path.node;
      }
    },
  });

  return found;
}

/**
 * Find all import statements
 */
export function findJSImports(ast: JSAST): any[] {
  const imports: any[] = [];

  traverse(ast.root, {
    ImportDeclaration(path) {
      imports.push(path.node);
    },
  });

  return imports;
}

/**
 * Find all export statements
 */
export function findJSExports(ast: JSAST): any[] {
  const exports: any[] = [];

  traverse(ast.root, {
    ExportNamedDeclaration(path) {
      exports.push(path.node);
    },
    ExportDefaultDeclaration(path) {
      exports.push(path.node);
    },
  });

  return exports;
}

/**
 * Check if code contains JSX
 */
export function containsJSX(jsCode: string): boolean {
  return jsCode.includes('<') && jsCode.includes('>') && /[<][A-Z]/.test(jsCode);
}

/**
 * Update a variable's value
 */
export function updateJSVariableValue(ast: JSAST, name: string, newValue: any): boolean {
  let updated = false;

  traverse(ast.root, {
    VariableDeclarator(path) {
      if (t.isIdentifier(path.node.id) && path.node.id.name === name) {
        path.node.init = newValue;
        updated = true;
      }
    },
  });

  return updated;
}
