import * as esbuild from 'esbuild-wasm';

let initialized = false;

async function ensureInitialized() {
  if (!initialized) {
    await esbuild.initialize({
      wasmURL: 'https://unpkg.com/esbuild-wasm@0.20.0/esbuild.wasm',
    });
    initialized = true;
  }
}

interface BuildRequest {
  id: string;
  files: Record<string, string>;
  entryPoint: string;
}

interface BuildResponse {
  id: string;
  success: boolean;
  code?: string;
  error?: string;
}

self.onmessage = async (event: MessageEvent<BuildRequest>) => {
  const { id, files, entryPoint } = event.data;

  try {
    await ensureInitialized();

    // Plugin pour résoudre les imports depuis nos fichiers en mémoire
    const memoryPlugin: esbuild.Plugin = {
      name: 'memory',
      setup(build) {
        // Résoudre les chemins
        build.onResolve({ filter: /.*/ }, (args) => {
          // Imports externes (npm)
          if (!args.path.startsWith('.') && !args.path.startsWith('/')) {
            return { path: args.path, external: true };
          }

          // Normaliser le chemin
          let resolvedPath = args.path;
          if (resolvedPath.startsWith('./')) {
            resolvedPath = resolvedPath.slice(2);
          }
          if (resolvedPath.startsWith('/')) {
            resolvedPath = resolvedPath.slice(1);
          }

          // Essayer avec et sans extensions
          const extensions = ['', '.tsx', '.ts', '.jsx', '.js'];
          for (const ext of extensions) {
            const testPath = resolvedPath + ext;
            if (files[testPath] || files['/' + testPath] || files['src/' + testPath]) {
              return { path: testPath, namespace: 'memory' };
            }
          }

          return { path: resolvedPath, namespace: 'memory' };
        });

        // Charger le contenu depuis notre objet files
        build.onLoad({ filter: /.*/, namespace: 'memory' }, (args) => {
          const content = files[args.path] || 
                         files['/' + args.path] || 
                         files['src/' + args.path];

          if (!content) {
            return {
              errors: [{
                text: `File not found: ${args.path}`,
                location: null,
              }],
            };
          }

          return {
            contents: content,
            loader: args.path.endsWith('.tsx') ? 'tsx' :
                   args.path.endsWith('.ts') ? 'ts' :
                   args.path.endsWith('.jsx') ? 'jsx' :
                   args.path.endsWith('.css') ? 'css' : 'js',
          };
        });
      },
    };

    const result = await esbuild.build({
      entryPoints: [entryPoint],
      bundle: true,
      write: false,
      format: 'esm',
      jsx: 'automatic',
      jsxImportSource: 'react',
      plugins: [memoryPlugin],
      external: ['react', 'react-dom', 'lucide-react'],
      loader: {
        '.png': 'dataurl',
        '.jpg': 'dataurl',
        '.jpeg': 'dataurl',
        '.svg': 'dataurl',
        '.gif': 'dataurl',
        '.webp': 'dataurl',
      },
    });

    if (result.outputFiles && result.outputFiles.length > 0) {
      const code = result.outputFiles[0].text;
      
      const response: BuildResponse = {
        id,
        success: true,
        code,
      };
      
      self.postMessage(response);
    } else {
      throw new Error('No output generated');
    }
  } catch (error) {
    const response: BuildResponse = {
      id,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown build error',
    };
    
    self.postMessage(response);
  }
};
