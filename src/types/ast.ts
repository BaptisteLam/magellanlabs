/**
 * Types for AST-based code modifications
 * Replaces the old search/replace patch system with structural modifications
 */

export interface ASTSelector {
  type: 'property' | 'rule' | 'element' | 'attribute' | 'node';
  selector?: string; // CSS selector or HTML selector
  property?: string; // For CSS properties
  attribute?: string; // For HTML attributes
  position?: 'after' | 'before' | 'inside' | 'replace';
  relativeTo?: string; // For insert operations
}

export interface ASTModificationAction {
  action: 'update' | 'insert' | 'delete' | 'replace';
  target: ASTSelector;
  value?: any;
  newNode?: any;
}

export interface ASTModification {
  path: string;
  fileType: 'css' | 'html' | 'js' | 'jsx' | 'ts' | 'tsx';
  modifications: ASTModificationAction[];
}

export interface ASTModificationResult {
  success: boolean;
  newContent?: string;
  error?: string;
  appliedCount?: number;
  failedCount?: number;
}

// Response format from Claude API
export interface ASTModificationResponse {
  message: string;
  modifications: ASTModification[];
}

// CSS AST types
export interface CSSNode {
  type: string;
  selector?: string;
  property?: string;
  value?: string;
  children?: CSSNode[];
}

export interface CSSASTIndex {
  rules: Map<string, any>; // selector → rule node
  properties: Map<string, any>; // selector.property → declaration node
}

export interface CSSAST {
  root: any; // PostCSS Root
  index: CSSASTIndex;
}

// HTML AST types
export interface HTMLNode {
  type: string;
  tagName?: string;
  properties?: Record<string, any>;
  children?: HTMLNode[];
}

export interface HTMLASTIndex {
  byId: Map<string, any>; // id → element node
  byClass: Map<string, any[]>; // class → element nodes
  byTag: Map<string, any[]>; // tag → element nodes
}

export interface HTMLAST {
  root: any; // HAST Root
  index: HTMLASTIndex;
}

// JS/JSX AST types (using Babel)
export interface JSAST {
  root: any; // Babel AST
  code: string;
}
