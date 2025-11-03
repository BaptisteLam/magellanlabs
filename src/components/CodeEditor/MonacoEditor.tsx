import Editor from '@monaco-editor/react';
import { useThemeStore } from '@/stores/themeStore';

interface MonacoEditorProps {
  value: string;
  language: string;
  onChange: (value: string | undefined) => void;
  readOnly?: boolean;
}

export function MonacoEditor({ value, language, onChange, readOnly = false }: MonacoEditorProps) {
  const { isDark } = useThemeStore();

  const getLanguage = (lang: string): string => {
    const langMap: Record<string, string> = {
      tsx: 'typescript',
      ts: 'typescript',
      jsx: 'javascript',
      js: 'javascript',
      css: 'css',
      scss: 'scss',
      sass: 'scss',
      less: 'less',
      html: 'html',
      htm: 'html',
      json: 'json',
      md: 'markdown',
      markdown: 'markdown',
      xml: 'xml',
      svg: 'xml',
      yaml: 'yaml',
      yml: 'yaml',
      toml: 'toml',
      sh: 'shell',
      bash: 'shell',
      txt: 'plaintext',
    };
    return langMap[lang] || 'plaintext';
  };

  return (
    <Editor
      height="100%"
      language={getLanguage(language)}
      value={value}
      onChange={onChange}
      theme={isDark ? 'vs-dark' : 'light'}
      options={{
        minimap: { enabled: false },
        fontSize: 13,
        lineNumbers: 'on',
        renderWhitespace: 'selection',
        scrollBeyondLastLine: false,
        automaticLayout: true,
        tabSize: 2,
        wordWrap: 'on',
        readOnly,
        padding: { top: 16, bottom: 16 },
      }}
      loading={
        <div className="flex items-center justify-center h-full">
          <div className="text-sm text-slate-500">Loading editor...</div>
        </div>
      }
    />
  );
}
