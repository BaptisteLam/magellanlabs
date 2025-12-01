/**
 * HTML AST Parser using parse5 and hast utilities
 * Provides structural parsing and modification of HTML code
 */

import { parse } from 'parse5';
import { fromParse5 } from 'hast-util-from-parse5';
import { toHtml } from 'hast-util-to-html';
import type { HTMLAST, HTMLASTIndex } from '@/types/ast';

interface HASTNode {
  type: string;
  tagName?: string;
  properties?: Record<string, any>;
  children?: HASTNode[];
  value?: string;
}

/**
 * Parse HTML code into AST with indexed lookup
 */
export function parseHTMLToAST(htmlCode: string): HTMLAST {
  // Parse HTML using parse5 (spec-compliant parser)
  const p5ast = parse(htmlCode, { sourceCodeLocationInfo: true });

  // Convert to HAST (HTML Abstract Syntax Tree)
  const hast = fromParse5(p5ast) as HASTNode;

  // Create index for fast lookups
  const index: HTMLASTIndex = {
    byId: new Map(),
    byClass: new Map(),
    byTag: new Map(),
  };

  // Traverse and index all elements
  traverseHTML(hast, (node) => {
    if (node.type === 'element' && node.tagName) {
      // Index by ID
      if (node.properties?.id) {
        index.byId.set(node.properties.id, node);
      }

      // Index by class
      if (node.properties?.className) {
        const classes = Array.isArray(node.properties.className)
          ? node.properties.className
          : [node.properties.className];

        classes.forEach((cls: string) => {
          if (!index.byClass.has(cls)) {
            index.byClass.set(cls, []);
          }
          index.byClass.get(cls)!.push(node);
        });
      }

      // Index by tag name
      if (!index.byTag.has(node.tagName)) {
        index.byTag.set(node.tagName, []);
      }
      index.byTag.get(node.tagName)!.push(node);
    }
  });

  return { root: hast, index };
}

/**
 * Traverse HTML AST and execute callback on each node
 */
export function traverseHTML(node: HASTNode, callback: (node: HASTNode) => void): void {
  callback(node);

  if (node.children) {
    for (const child of node.children) {
      traverseHTML(child, callback);
    }
  }
}

/**
 * Find HTML element by ID
 */
export function findHTMLById(ast: HTMLAST, id: string): HASTNode | undefined {
  return ast.index.byId.get(id);
}

/**
 * Find HTML elements by class name
 */
export function findHTMLByClass(ast: HTMLAST, className: string): HASTNode[] {
  return ast.index.byClass.get(className) || [];
}

/**
 * Find HTML elements by tag name
 */
export function findHTMLByTag(ast: HTMLAST, tagName: string): HASTNode[] {
  return ast.index.byTag.get(tagName.toLowerCase()) || [];
}

/**
 * Find HTML element by CSS-like selector
 * Supports: #id, .class, tag, [attr="value"]
 */
export function findHTMLBySelector(ast: HTMLAST, selector: string): HASTNode | HASTNode[] | undefined {
  // ID selector
  if (selector.startsWith('#')) {
    const id = selector.slice(1);
    return findHTMLById(ast, id);
  }

  // Class selector
  if (selector.startsWith('.')) {
    const className = selector.slice(1);
    return findHTMLByClass(ast, className);
  }

  // Attribute selector
  if (selector.includes('[')) {
    const match = selector.match(/\[([^=]+)="([^"]+)"\]/);
    if (match) {
      const [, attr, value] = match;
      return findHTMLByAttribute(ast, attr, value);
    }
  }

  // Tag selector
  return findHTMLByTag(ast, selector);
}

/**
 * Find HTML elements by attribute
 */
export function findHTMLByAttribute(ast: HTMLAST, attr: string, value?: string): HASTNode[] {
  const results: HASTNode[] = [];

  traverseHTML(ast.root, (node) => {
    if (node.type === 'element' && node.properties) {
      if (value !== undefined) {
        if (node.properties[attr] === value) {
          results.push(node);
        }
      } else if (attr in node.properties) {
        results.push(node);
      }
    }
  });

  return results;
}

/**
 * Generate HTML code from AST
 */
export function generateHTML(ast: HTMLAST): string {
  return toHtml(ast.root);
}

/**
 * Create a new HTML element node
 */
export function createHTMLElement(
  tagName: string,
  properties?: Record<string, any>,
  children?: HASTNode[]
): HASTNode {
  return {
    type: 'element',
    tagName,
    properties: properties || {},
    children: children || [],
  };
}

/**
 * Create a text node
 */
export function createHTMLText(value: string): HASTNode {
  return {
    type: 'text',
    value,
  };
}

/**
 * Update element text content
 */
export function updateHTMLTextContent(node: HASTNode, text: string): void {
  node.children = [createHTMLText(text)];
}

/**
 * Update element attribute
 */
export function updateHTMLAttribute(node: HASTNode, attr: string, value: any): void {
  if (!node.properties) {
    node.properties = {};
  }
  node.properties[attr] = value;
}

/**
 * Get element text content
 */
export function getHTMLTextContent(node: HASTNode): string {
  if (node.type === 'text') {
    return node.value || '';
  }

  if (node.children) {
    return node.children.map(getHTMLTextContent).join('');
  }

  return '';
}
