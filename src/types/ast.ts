// AST-based modification types for structural code changes

export type FileType = 'css' | 'html' | 'js' | 'jsx';

export interface ASTSelector {
  // CSS: selector string (e.g., "h1", ".button", "#header")
  // HTML: element type or querySelector (e.g., "h1", "div.container")
  // JS: identifier name or pattern (e.g., "myFunction", "useState")
  selector?: string;
  
  // CSS property name (e.g., "color", "font-size")
  property?: string;
  
  // HTML attribute name (e.g., "class", "id", "href")
  attribute?: string;
  
  // JS: function name, variable name, etc.
  identifier?: string;
  
  // Additional context for disambiguation
  context?: {
    parent?: string;
    index?: number;
    contains?: string;
  };
}

export interface ASTModification {
  // Target file path
  path: string;
  
  // File type for parser selection
  fileType: FileType;
  
  // Modification type
  type: 'update' | 'insert' | 'delete' | 'replace';
  
  // Target selector
  target: ASTSelector;
  
  // New value/content
  value?: string;
  
  // For insertions: position relative to target
  position?: 'before' | 'after' | 'inside' | 'prepend' | 'append';
  
  // Optional: description for logging
  description?: string;
}

export interface ASTModificationResult {
  success: boolean;
  modifiedContent?: string;
  error?: string;
  modificationsApplied?: number;
}

export interface ASTResponse {
  message: string;
  modifications: ASTModification[];
}
