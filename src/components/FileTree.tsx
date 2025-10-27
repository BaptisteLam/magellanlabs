import { useState } from 'react';
import { ChevronRight, ChevronDown, File, Folder } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'folder';
  children?: FileNode[];
  content?: string;
}

interface FileTreeProps {
  files: Record<string, string>;
  onFileSelect: (path: string, content: string) => void;
  selectedFile: string | null;
}

export function FileTree({ files, onFileSelect, selectedFile }: FileTreeProps) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['src', 'src/components', 'src/utils']));

  // Construire l'arborescence à partir des chemins de fichiers
  const buildTree = (): FileNode[] => {
    const tree: FileNode[] = [];
    const folderMap = new Map<string, FileNode>();

    Object.keys(files).forEach(filePath => {
      const parts = filePath.split('/');
      let currentPath = '';
      
      parts.forEach((part, index) => {
        const isLast = index === parts.length - 1;
        currentPath = currentPath ? `${currentPath}/${part}` : part;

        if (isLast) {
          // C'est un fichier
          const parentPath = parts.slice(0, -1).join('/');
          const parent = parentPath ? folderMap.get(parentPath) : null;
          
          const fileNode: FileNode = {
            name: part,
            path: currentPath,
            type: 'file',
            content: files[filePath]
          };

          if (parent) {
            parent.children = parent.children || [];
            parent.children.push(fileNode);
          } else {
            tree.push(fileNode);
          }
        } else {
          // C'est un dossier
          if (!folderMap.has(currentPath)) {
            const folderNode: FileNode = {
              name: part,
              path: currentPath,
              type: 'folder',
              children: []
            };

            const parentPath = parts.slice(0, index).join('/');
            const parent = parentPath ? folderMap.get(parentPath) : null;

            if (parent) {
              parent.children = parent.children || [];
              parent.children.push(folderNode);
            } else {
              tree.push(folderNode);
            }

            folderMap.set(currentPath, folderNode);
          }
        }
      });
    });

    return tree;
  };

  const toggleFolder = (path: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const renderNode = (node: FileNode, depth: number = 0) => {
    const isExpanded = expandedFolders.has(node.path);
    const isSelected = selectedFile === node.path;

    if (node.type === 'folder') {
      return (
        <div key={node.path}>
          <div
            className={cn(
              "flex items-center gap-1 px-2 py-1 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 text-sm",
              isSelected && "bg-blue-50 dark:bg-blue-900"
            )}
            style={{ paddingLeft: `${depth * 12 + 8}px` }}
            onClick={() => toggleFolder(node.path)}
          >
            {isExpanded ? (
              <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
            )}
            <Folder className="w-3.5 h-3.5 text-blue-500" />
            <span className="text-slate-700 dark:text-slate-200">{node.name}</span>
          </div>
          {isExpanded && node.children && (
            <div>
              {node.children.map(child => renderNode(child, depth + 1))}
            </div>
          )}
        </div>
      );
    }

    return (
      <div
        key={node.path}
        className={cn(
          "flex items-center gap-1 px-2 py-1 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 text-sm",
          isSelected && "bg-blue-50 dark:bg-blue-900"
        )}
        style={{ paddingLeft: `${depth * 12 + 24}px` }}
        onClick={() => node.content && onFileSelect(node.path, node.content)}
      >
        <File className="w-3.5 h-3.5 text-slate-400" />
        <span className="text-slate-700 dark:text-slate-200">{node.name}</span>
      </div>
    );
  };

  const tree = buildTree();

  return (
    <div className="h-full overflow-y-auto border-r border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
      {tree.map(node => renderNode(node))}
    </div>
  );
}
