import { ReactNode, useMemo } from 'react';
import { SandpackProvider } from '@codesandbox/sandpack-react';
import { githubLight } from '@codesandbox/sandpack-themes';

interface SandpackContextProps {
  children: ReactNode;
  files: Record<string, { code: string }>;
  isDark?: boolean;
  isReactProject?: boolean;
}

export function SandpackContext({ 
  children, 
  files, 
  isDark = false,
  isReactProject = true 
}: SandpackContextProps) {
  const template = isReactProject ? "vite-react-ts" : "static";
  const theme = isDark ? "dark" : githubLight;

  // Mémoriser les dépendances pour éviter les re-renders inutiles
  const dependencies = useMemo(() => ({
    "react": "18.2.0",
    "react-dom": "18.2.0",
    "vite": "4.3.9",
    "typescript": "4.9.5",
    "tailwindcss": "3.3.3",
    "autoprefixer": "10.4.14",
    "postcss": "8.4.21",
    "lucide-react": "0.263.0",
    "framer-motion": "10.16.4",
    "classnames": "2.3.2"
  }), []);

  return (
    <SandpackProvider
      template={template}
      theme={theme}
      files={files}
      customSetup={{
        environment: "node",
        dependencies
      }}
      options={{
        autoReload: true,
        recompileMode: 'immediate',
      }}
    >
      {children}
    </SandpackProvider>
  );
}
