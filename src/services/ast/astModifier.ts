import { ASTModification, ASTModificationResult, FileType } from '@/types/ast';
import { applyCSSModifications } from './cssParser';
import { applyHTMLModifications } from './htmlParser';
import { applyJSModifications } from './jsParser';

export async function applyASTModifications(
  fileContent: string,
  modifications: ASTModification[],
  fileType: FileType
): Promise<ASTModificationResult> {
  try {
    console.log(`[AST] Applying ${modifications.length} modifications to ${fileType} file`);

    switch (fileType) {
      case 'css':
        return await applyCSSModifications(fileContent, modifications);
      
      case 'html':
        return await applyHTMLModifications(fileContent, modifications);
      
      case 'js':
      case 'jsx':
        return await applyJSModifications(fileContent, modifications);
      
      default:
        return {
          success: false,
          error: `Unsupported file type: ${fileType}`,
        };
    }
  } catch (error) {
    console.error('[AST] Modification error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown AST modification error',
    };
  }
}

export function detectFileType(filePath: string): FileType | null {
  const ext = filePath.split('.').pop()?.toLowerCase();
  
  switch (ext) {
    case 'css':
      return 'css';
    case 'html':
    case 'htm':
      return 'html';
    case 'js':
      return 'js';
    case 'jsx':
      return 'jsx';
    default:
      return null;
  }
}

export async function applyModificationsToFiles(
  projectFiles: Record<string, string>,
  modifications: ASTModification[]
): Promise<{ success: boolean; updatedFiles: Record<string, string>; errors: string[] }> {
  const updatedFiles = { ...projectFiles };
  const errors: string[] = [];
  let totalSuccess = true;

  // Group modifications by file path
  const modsByFile = modifications.reduce((acc, mod) => {
    if (!acc[mod.path]) {
      acc[mod.path] = [];
    }
    acc[mod.path].push(mod);
    return acc;
  }, {} as Record<string, ASTModification[]>);

  // Apply modifications to each file
  for (const [filePath, mods] of Object.entries(modsByFile)) {
    const fileContent = projectFiles[filePath];
    
    if (!fileContent) {
      errors.push(`File not found: ${filePath}`);
      totalSuccess = false;
      continue;
    }

    const fileType = mods[0]?.fileType || detectFileType(filePath);
    
    if (!fileType) {
      errors.push(`Could not determine file type for: ${filePath}`);
      totalSuccess = false;
      continue;
    }

    const result = await applyASTModifications(fileContent, mods, fileType);

    if (result.success && result.modifiedContent) {
      updatedFiles[filePath] = result.modifiedContent;
      console.log(`[AST] Successfully modified ${filePath} (${result.modificationsApplied} changes)`);
    } else {
      errors.push(`Failed to modify ${filePath}: ${result.error}`);
      totalSuccess = false;
    }
  }

  return {
    success: totalSuccess && errors.length === 0,
    updatedFiles,
    errors,
  };
}
