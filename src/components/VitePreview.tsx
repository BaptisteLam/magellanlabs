import { useEffect, useState } from 'react';
import { 
  SandpackProvider, 
  SandpackPreview,
  SandpackConsole,
  SandpackCodeEditor
} from '@codesandbox/sandpack-react';

interface VitePreviewProps {
  projectFiles: Record<string, string>;
  isDark?: boolean;
}

export function VitePreview({ projectFiles, isDark = false }: VitePreviewProps) {
  const [sandpackFiles, setSandpackFiles] = useState<Record<string, string>>({});
  const [showConsole, setShowConsole] = useState(false);

  useEffect(() => {
    if (!projectFiles || Object.keys(projectFiles).length === 0) {
      return;
    }

    // Convertir les fichiers du projet en format Sandpack
    const convertedFiles: Record<string, string> = {};

    Object.entries(projectFiles).forEach(([path, content]) => {
      // Sandpack utilise des chemins relatifs sans le préfixe "/"
      const sandpackPath = path.startsWith('/') ? path : `/${path}`;
      convertedFiles[sandpackPath] = content;
    });

    // Ajouter un fichier package.json si absent
    if (!convertedFiles['/package.json']) {
      convertedFiles['/package.json'] = JSON.stringify({
        name: 'trinity-ai-project',
        version: '1.0.0',
        main: '/src/main.tsx',
        dependencies: {
          'react': '^18.3.1',
          'react-dom': '^18.3.1',
          'lucide-react': '^0.462.0'
        },
        devDependencies: {
          '@types/react': '^18.3.1',
          '@types/react-dom': '^18.3.0',
          'typescript': '^5.7.3'
        }
      }, null, 2);
    }

    // Ajouter tsconfig.json si absent
    if (!convertedFiles['/tsconfig.json']) {
      convertedFiles['/tsconfig.json'] = JSON.stringify({
        compilerOptions: {
          target: 'ES2020',
          useDefineForClassFields: true,
          lib: ['ES2020', 'DOM', 'DOM.Iterable'],
          module: 'ESNext',
          skipLibCheck: true,
          moduleResolution: 'bundler',
          allowImportingTsExtensions: true,
          resolveJsonModule: true,
          isolatedModules: true,
          noEmit: true,
          jsx: 'react-jsx',
          strict: true,
          noUnusedLocals: false,
          noUnusedParameters: false,
          noFallthroughCasesInSwitch: true
        },
        include: ['src']
      }, null, 2);
    }

    // Ajouter index.html si absent ou invalide
    if (!convertedFiles['/index.html'] || !convertedFiles['/index.html'].includes('<div id="root">')) {
      convertedFiles['/index.html'] = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Trinity AI Preview</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.tsx"></script>
</body>
</html>`;
    }

    // Vérifier et créer src/main.tsx si absent
    if (!convertedFiles['/src/main.tsx']) {
      convertedFiles['/src/main.tsx'] = `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './App.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);`;
    }

    // Vérifier App.tsx
    if (!convertedFiles['/src/App.tsx']) {
      convertedFiles['/src/App.tsx'] = `import './App.css';

function App() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Bienvenue sur Trinity AI
        </h1>
        <p className="text-gray-600">
          Votre projet React est prêt !
        </p>
      </div>
    </div>
  );
}

export default App;`;
    }

    // Vérifier App.css avec Tailwind
    if (!convertedFiles['/src/App.css']) {
      convertedFiles['/src/App.css'] = `@tailwind base;
@tailwind components;
@tailwind utilities;

* {
  font-family: 'Inter', sans-serif;
}`;
    }

    setSandpackFiles(convertedFiles);
  }, [projectFiles]);

  if (Object.keys(sandpackFiles).length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">En attente de génération...</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative">
      <SandpackProvider
        template="react-ts"
        files={sandpackFiles}
        theme={isDark ? 'dark' : 'light'}
        options={{
          externalResources: [
            'https://cdn.tailwindcss.com',
            'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap'
          ],
          bundlerURL: 'https://sandpack-bundler.codesandbox.io',
          autoReload: true,
          autorun: true,
          recompileMode: 'immediate',
          recompileDelay: 300
        }}
        customSetup={{
          dependencies: {
            'react': '^18.3.1',
            'react-dom': '^18.3.1',
            'lucide-react': '^0.462.0'
          }
        }}
      >
        <div className="h-full flex flex-col">
          {/* Preview principale */}
          <div className="flex-1 relative">
            <SandpackPreview
              showNavigator={false}
              showRefreshButton={true}
              showOpenInCodeSandbox={false}
              actionsChildren={
                <button
                  onClick={() => setShowConsole(!showConsole)}
                  className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                >
                  {showConsole ? 'Masquer Console' : 'Console'}
                </button>
              }
              style={{
                height: showConsole ? '70%' : '100%',
                border: 'none'
              }}
            />
          </div>

          {/* Console développeur (affichage conditionnel) */}
          {showConsole && (
            <div className="h-[30%] border-t border-gray-200">
              <SandpackConsole 
                showHeader={true}
                showSyntaxError={true}
                resetOnPreviewRestart={false}
                style={{
                  height: '100%'
                }}
              />
            </div>
          )}
        </div>
      </SandpackProvider>

      {/* Indicateur de compilation */}
      <div className="absolute top-2 left-2 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full shadow-sm text-xs text-gray-600">
        ⚡ Compilation en temps réel
      </div>
    </div>
  );
}

