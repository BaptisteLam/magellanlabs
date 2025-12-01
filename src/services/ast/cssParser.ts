/**
 * CSS AST Parser using PostCSS
 * Provides structural parsing and modification of CSS code
 */

import postcss, { Root, Rule, Declaration, AtRule } from 'postcss';
import safeParser from 'postcss-safe-parser';
import type { CSSAST, CSSASTIndex } from '@/types/ast';

/**
 * Parse CSS code into AST with indexed lookup
 */
export function parseCSSToAST(cssCode: string): CSSAST {
  // Parse CSS with safe parser (tolerant to errors)
  const root = postcss.parse(cssCode, { parser: safeParser });

  // Create index for O(1) lookups
  const index: CSSASTIndex = {
    rules: new Map(),
    properties: new Map(),
  };

  // Walk through all rules and index them
  root.walkRules((rule: Rule) => {
    // Index by selector
    index.rules.set(rule.selector, rule);

    // Index all declarations by selector.property
    rule.walkDecls((decl: Declaration) => {
      const key = `${rule.selector}||${decl.prop}`;
      index.properties.set(key, decl);
    });
  });

  // Also index @media and other at-rules
  root.walkAtRules((atRule: AtRule) => {
    const key = `@${atRule.name}${atRule.params ? ` ${atRule.params}` : ''}`;
    index.rules.set(key, atRule);
  });

  return { root, index };
}

/**
 * Find a CSS rule by selector
 */
export function findCSSRule(ast: CSSAST, selector: string): Rule | AtRule | undefined {
  return ast.index.rules.get(selector);
}

/**
 * Find a CSS property declaration
 */
export function findCSSProperty(
  ast: CSSAST,
  selector: string,
  property: string
): Declaration | undefined {
  const key = `${selector}||${property}`;
  return ast.index.properties.get(key);
}

/**
 * Find multiple rules matching a pattern
 */
export function findCSSRulesMatching(ast: CSSAST, pattern: RegExp): Rule[] {
  const matches: Rule[] = [];
  ast.root.walkRules((rule: Rule) => {
    if (pattern.test(rule.selector)) {
      matches.push(rule);
    }
  });
  return matches;
}

/**
 * Generate CSS code from AST
 */
export function generateCSS(ast: CSSAST): string {
  return ast.root.toString();
}

/**
 * Create a new CSS rule
 */
export function createCSSRule(selector: string, declarations: Record<string, string>): Rule {
  const rule = postcss.rule({ selector });

  for (const [prop, value] of Object.entries(declarations)) {
    rule.append(postcss.decl({ prop, value }));
  }

  return rule;
}

/**
 * Create a new CSS declaration
 */
export function createCSSDeclaration(prop: string, value: string): Declaration {
  return postcss.decl({ prop, value });
}

/**
 * Check if a selector exists in the AST
 */
export function hasCSSSelector(ast: CSSAST, selector: string): boolean {
  return ast.index.rules.has(selector);
}

/**
 * Get all selectors in the CSS
 */
export function getAllCSSSelectors(ast: CSSAST): string[] {
  return Array.from(ast.index.rules.keys());
}

/**
 * Normalize a CSS selector for comparison
 */
export function normalizeCSSSelector(selector: string): string {
  return selector
    .replace(/\s+/g, ' ') // Normalize whitespace
    .replace(/\s*([>+~,])\s*/g, '$1') // Remove spaces around combinators
    .trim();
}
