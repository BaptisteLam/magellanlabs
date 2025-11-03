import { useState } from 'react';
import { FileCode, Palette, FileText, Braces, ChevronRight, ChevronDown, Folder, FolderOpen } from 'lucide-react';

interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'folder';
  children?: FileNode[];
  extension?: string;
}

interface CodeTreeViewProps {
  files: string[];
  activeFile: string | null;
  onFileClick: (path: string) => void;
}

export function CodeTreeView({ files, activeFile, onFileClick }: CodeTreeViewProps) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['src', 'components', 'styles', 'utils', 'supabase']));

  // Build tree structure from flat file list
  const buildTree = (): FileNode[] => {
    const root: FileNode[] = [];
    const folders = new Map<string, FileNode>();

    files.forEach((path) => {
      const parts = path.split('/');
      
      // Handle root files
      if (parts.length === 1) {
        root.push({
          name: parts[0],
          path,
          type: 'file',
          extension: parts[0].split('.').pop(),
        });
        return;
      }

      // Build folder structure
      let currentPath = '';
      parts.forEach((part, index) => {
        const isLast = index === parts.length - 1;
        currentPath = currentPath ? `${currentPath}/${part}` : part;

        if (isLast) {
          // It's a file
          const parentPath = parts.slice(0, -1).join('/');
          const parent = folders.get(parentPath);
          
          if (parent) {
            if (!parent.children) parent.children = [];
            parent.children.push({
              name: part,
              path,
              type: 'file',
              extension: part.split('.').pop(),
            });
          }
        } else {
          // It's a folder
          if (!folders.has(currentPath)) {
            const newFolder: FileNode = {
              name: part,
              path: currentPath,
              type: 'folder',
              children: [],
            };
            folders.set(currentPath, newFolder);

            // Add to parent or root
            const parentPath = parts.slice(0, index).join('/');
            if (parentPath && folders.has(parentPath)) {
              const parent = folders.get(parentPath)!;
              if (!parent.children) parent.children = [];
              parent.children.push(newFolder);
            } else if (!parentPath) {
              root.push(newFolder);
            }
          }
        }
      });
    });

    return root;
  };

  const getFileIcon = (extension?: string) => {
    switch (extension) {
      case 'tsx':
      case 'ts':
      case 'jsx':
      case 'js':
        return <FileCode className="w-4 h-4 text-blue-500" />;
      case 'css':
      case 'scss':
        return <Palette className="w-4 h-4 text-pink-500" />;
      case 'json':
        return <Braces className="w-4 h-4 text-yellow-500" />;
      case 'html':
        return <FileCode className="w-4 h-4 text-orange-500" />;
      default:
        return <FileText className="w-4 h-4 text-slate-400" />;
    }
  };

  const toggleFolder = (path: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const renderNode = (node: FileNode, depth = 0): JSX.Element => {
    const isExpanded = expandedFolders.has(node.path);
    const isSelected = activeFile === node.path;

    if (node.type === 'folder') {
      return (
        <div key={node.path}>
          <div
            className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-100 cursor-pointer select-none"
            style={{ paddingLeft: `${depth * 12 + 8}px` }}
            onClick={() => toggleFolder(node.path)}
          >
            {isExpanded ? (
              <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
            )}
            {isExpanded ? (
              <FolderOpen className="w-4 h-4 text-blue-400" />
            ) : (
              <Folder className="w-4 h-4 text-blue-400" />
            )}
            <span className="text-sm text-slate-700 font-medium">{node.name}</span>
          </div>
          {isExpanded && node.children && (
            <div>
              {node.children.map((child) => renderNode(child, depth + 1))}
            </div>
          )}
        </div>
      );
    }

    return (
      <div
        key={node.path}
        className={`flex items-center gap-2 px-2 py-1.5 hover:bg-slate-100 cursor-pointer select-none border-l-2 transition-colors ${
          isSelected ? 'bg-blue-50 border-l-blue-500' : 'border-l-transparent'
        }`}
        style={{ paddingLeft: `${depth * 12 + 24}px` }}
        onClick={() => onFileClick(node.path)}
      >
        {getFileIcon(node.extension)}
        <span className={`text-sm ${isSelected ? 'text-blue-700 font-medium' : 'text-slate-600'}`}>
          {node.name}
        </span>
      </div>
    );
  };

  const tree = buildTree();

  return (
    <div className="h-full overflow-y-auto bg-white border-r border-slate-200">
      <div className="px-3 py-2 border-b border-slate-200 bg-slate-50">
        <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Files</h3>
      </div>
      <div className="py-1">
        {tree.map((node) => renderNode(node))}
      </div>
    </div>
  );
}
