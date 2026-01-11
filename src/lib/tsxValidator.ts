/**
 * Service de validation TSX/JSX avec esbuild-wasm
 * Parse le code avant Sandpack pour détecter et corriger les erreurs
 */
import { initEsbuild as initEsbuildBase, esbuild, isEsbuildReady } from './esbuildInit';

// Re-export initEsbuild
export const initEsbuild = initEsbuildBase;

export interface ValidationError {
  message: string;
  line: number;
  column: number;
  file?: string;
  suggestion?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  fixedCode?: string;
  wasFixed?: boolean;
}

// Patterns de corrections automatiques basées sur les messages d'erreur
const ERROR_FIXES: Array<{
  pattern: RegExp;
  fix: (code: string, error: ValidationError) => string | null;
  description: string;
}> = [
  {
    // Unterminated string constant
    pattern: /Unterminated string/i,
    description: 'Chaîne non terminée',
    fix: (code, error) => {
      const lines = code.split('\n');
      if (error.line > 0 && error.line <= lines.length) {
        let line = lines[error.line - 1];
        
        // Trouver la position du guillemet non fermé
        const beforeCol = line.substring(0, error.column);
        const lastQuoteIndex = Math.max(
          beforeCol.lastIndexOf('"'),
          beforeCol.lastIndexOf("'"),
          beforeCol.lastIndexOf('`')
        );
        
        if (lastQuoteIndex >= 0) {
          const quoteChar = beforeCol[lastQuoteIndex];
          // Tronquer la ligne au niveau de l'erreur et fermer la chaîne
          const fixedContent = line.substring(lastQuoteIndex + 1, error.column).trim();
          
          // Si c'est dans un className, compléter intelligemment
          if (beforeCol.includes('className=')) {
            // Fermer les crochets ouverts
            const openBrackets = (fixedContent.match(/\[/g) || []).length;
            const closeBrackets = (fixedContent.match(/\]/g) || []).length;
            const missingBrackets = ']'.repeat(Math.max(0, openBrackets - closeBrackets));
            line = line.substring(0, error.column) + missingBrackets + quoteChar + line.substring(error.column);
          } else {
            // Simplement fermer la chaîne
            line = line.substring(0, error.column) + quoteChar + line.substring(error.column);
          }
          
          lines[error.line - 1] = line;
          return lines.join('\n');
        }
      }
      return null;
    }
  },
  {
    // Unexpected end of file
    pattern: /Unexpected end of file/i,
    description: 'Fin de fichier inattendue',
    fix: (code, error) => {
      // Ajouter les fermetures manquantes
      let fixed = code;
      
      // Compter les accolades, parenthèses, crochets
      const opens = { '{': 0, '(': 0, '[': 0, '<': 0 };
      const closes: Record<string, string> = { '{': '}', '(': ')', '[': ']', '<': '>' };
      
      // Parser simplement (ignorer les chaînes)
      let inString = false;
      let stringChar = '';
      
      for (let i = 0; i < fixed.length; i++) {
        const char = fixed[i];
        
        if (!inString && (char === '"' || char === "'" || char === '`')) {
          inString = true;
          stringChar = char;
        } else if (inString && char === stringChar && fixed[i-1] !== '\\') {
          inString = false;
        } else if (!inString) {
          if (char === '{' || char === '(' || char === '[') {
            opens[char]++;
          } else if (char === '}') {
            opens['{']--;
          } else if (char === ')') {
            opens['(']--;
          } else if (char === ']') {
            opens['[']--;
          }
        }
      }
      
      // Ajouter les fermetures manquantes
      let suffix = '';
      for (const [open, count] of Object.entries(opens)) {
        if (count > 0) {
          suffix += closes[open].repeat(count);
        }
      }
      
      if (suffix) {
        return fixed + '\n' + suffix;
      }
      return null;
    }
  },
  {
    // Expected ">" but found (unclosed JSX element)
    pattern: /Expected ">" but found|Expected "\/>" but found/i,
    description: 'Élément JSX non fermé',
    fix: (code, error) => {
      const lines = code.split('\n');
      if (error.line > 0 && error.line <= lines.length) {
        let line = lines[error.line - 1];
        
        // Chercher le tag ouvert avant l'erreur
        const beforeError = line.substring(0, error.column);
        const tagMatch = beforeError.match(/<(\w+)[^>]*$/);
        
        if (tagMatch) {
          // Fermer le tag
          const selfClosingTags = ['img', 'br', 'hr', 'input', 'meta', 'link', 'area', 'base', 'col', 'embed', 'param', 'source', 'track', 'wbr'];
          const tagName = tagMatch[1].toLowerCase();
          
          if (selfClosingTags.includes(tagName)) {
            line = beforeError + ' />' + line.substring(error.column);
          } else {
            line = beforeError + '>' + line.substring(error.column);
          }
          
          lines[error.line - 1] = line;
          return lines.join('\n');
        }
      }
      return null;
    }
  },
  {
    // Unexpected token
    pattern: /Unexpected "([^"]+)"/i,
    description: 'Token inattendu',
    fix: (code, error) => {
      const lines = code.split('\n');
      if (error.line > 0 && error.line <= lines.length) {
        // Essayer de supprimer le caractère problématique
        let line = lines[error.line - 1];
        
        // Si c'est une accolade/parenthèse en trop, la supprimer
        if (error.column > 0 && error.column <= line.length) {
          const char = line[error.column - 1];
          if (['}', ')', ']', '>'].includes(char)) {
            line = line.substring(0, error.column - 1) + line.substring(error.column);
            lines[error.line - 1] = line;
            return lines.join('\n');
          }
        }
      }
      return null;
    }
  }
];

/**
 * Valide un fichier TSX/JSX avec esbuild
 */
export async function validateTSX(
  code: string, 
  filePath: string = 'component.tsx'
): Promise<ValidationResult> {
  // S'assurer qu'esbuild est initialisé
  if (!isEsbuildReady()) {
    try {
      await initEsbuild();
    } catch (e) {
      console.error('❌ [tsxValidator] Failed to init esbuild:', e);
      // Si esbuild ne s'initialise pas, retourner comme valide pour ne pas bloquer
      return { valid: true, errors: [] };
    }
  }
  
  const loader = filePath.endsWith('.tsx') ? 'tsx' 
               : filePath.endsWith('.jsx') ? 'jsx'
               : filePath.endsWith('.ts') ? 'ts'
               : 'js';
  
  try {
    // Essayer de transformer le code
    await esbuild.transform(code, {
      loader,
      jsx: 'preserve',
      logLevel: 'silent'
    });
    
    return { valid: true, errors: [] };
  } catch (error: any) {
    // Parser l'erreur esbuild
    const errors: ValidationError[] = [];
    
    if (error.errors && Array.isArray(error.errors)) {
      for (const e of error.errors) {
        errors.push({
          message: e.text || error.message,
          line: e.location?.line || 1,
          column: e.location?.column || 0,
          file: filePath,
          suggestion: e.notes?.[0]?.text
        });
      }
    } else {
      // Parser le message d'erreur
      const lineMatch = error.message?.match(/\((\d+):(\d+)\)/);
      errors.push({
        message: error.message || 'Erreur de syntaxe inconnue',
        line: lineMatch ? parseInt(lineMatch[1]) : 1,
        column: lineMatch ? parseInt(lineMatch[2]) : 0,
        file: filePath
      });
    }
    
    return { valid: false, errors };
  }
}

/**
 * Valide et tente de corriger un fichier TSX/JSX
 */
export async function validateAndFixTSX(
  code: string,
  filePath: string = 'component.tsx',
  maxAttempts: number = 3
): Promise<ValidationResult> {
  let currentCode = code;
  let attempts = 0;
  
  while (attempts < maxAttempts) {
    const result = await validateTSX(currentCode, filePath);
    
    if (result.valid) {
      return {
        valid: true,
        errors: [],
        fixedCode: attempts > 0 ? currentCode : undefined,
        wasFixed: attempts > 0
      };
    }
    
    // Tenter de corriger l'erreur
    let fixed = false;
    for (const error of result.errors) {
      for (const fixer of ERROR_FIXES) {
        if (fixer.pattern.test(error.message)) {
          const fixedCode = fixer.fix(currentCode, error);
          if (fixedCode && fixedCode !== currentCode) {
            console.log(`🔧 [tsxValidator] Applied fix: ${fixer.description} at line ${error.line}`);
            currentCode = fixedCode;
            fixed = true;
            break;
          }
        }
      }
      if (fixed) break;
    }
    
    if (!fixed) {
      // Aucune correction possible
      return {
        valid: false,
        errors: result.errors,
        fixedCode: attempts > 0 ? currentCode : undefined,
        wasFixed: false
      };
    }
    
    attempts++;
  }
  
  // Dernière validation
  const finalResult = await validateTSX(currentCode, filePath);
  return {
    valid: finalResult.valid,
    errors: finalResult.errors,
    fixedCode: currentCode !== code ? currentCode : undefined,
    wasFixed: currentCode !== code && finalResult.valid
  };
}

/**
 * Valide tous les fichiers TSX/JSX d'un projet
 */
export async function validateProject(
  files: Record<string, string>
): Promise<{
  valid: boolean;
  fileErrors: Map<string, ValidationError[]>;
  fixedFiles: Map<string, string>;
}> {
  const fileErrors = new Map<string, ValidationError[]>();
  const fixedFiles = new Map<string, string>();
  let allValid = true;
  
  const tsxFiles = Object.entries(files).filter(([path]) => 
    path.match(/\.(tsx|jsx)$/)
  );
  
  // Initialiser esbuild une fois avant de valider
  try {
    await initEsbuild();
  } catch (e) {
    console.error('❌ [tsxValidator] Failed to init esbuild for project validation');
    return { valid: true, fileErrors, fixedFiles };
  }
  
  for (const [path, code] of tsxFiles) {
    const result = await validateAndFixTSX(code, path);
    
    if (!result.valid) {
      allValid = false;
      fileErrors.set(path, result.errors);
    }
    
    if (result.fixedCode) {
      fixedFiles.set(path, result.fixedCode);
    }
  }
  
  return { valid: allValid, fileErrors, fixedFiles };
}
