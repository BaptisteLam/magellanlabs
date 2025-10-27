import { X } from 'lucide-react';

interface FileTabsProps {
  openFiles: string[];
  activeFile: string | null;
  onTabClick: (path: string) => void;
  onTabClose: (path: string) => void;
}

export function FileTabs({ openFiles, activeFile, onTabClick, onTabClose }: FileTabsProps) {
  const getFileName = (path: string) => {
    const parts = path.split('/');
    return parts[parts.length - 1];
  };

  const getFileExtension = (path: string) => {
    return path.split('.').pop() || '';
  };

  const getTabColor = (extension: string) => {
    switch (extension) {
      case 'tsx':
      case 'ts':
        return 'bg-blue-500';
      case 'css':
      case 'scss':
        return 'bg-pink-500';
      case 'json':
        return 'bg-yellow-500';
      case 'html':
        return 'bg-orange-500';
      default:
        return 'bg-slate-500';
    }
  };

  if (openFiles.length === 0) {
    return (
      <div className="h-10 border-b border-slate-200 bg-slate-50 flex items-center px-4">
        <span className="text-xs text-slate-400">No files open</span>
      </div>
    );
  }

  return (
    <div className="h-10 border-b border-slate-200 bg-slate-50 flex items-center overflow-x-auto">
      {openFiles.map((path) => {
        const isActive = activeFile === path;
        const fileName = getFileName(path);
        const extension = getFileExtension(path);

        return (
          <div
            key={path}
            className={`flex items-center gap-2 px-3 py-2 border-r border-slate-200 cursor-pointer transition-colors ${
              isActive
                ? 'bg-white text-slate-900 shadow-sm'
                : 'bg-transparent text-slate-600 hover:bg-slate-100'
            }`}
            onClick={() => onTabClick(path)}
          >
            <div className={`w-2 h-2 rounded-full ${getTabColor(extension)}`} />
            <span className="text-xs font-medium whitespace-nowrap">{fileName}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onTabClose(path);
              }}
              className="ml-1 hover:bg-slate-200 rounded p-0.5 transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
