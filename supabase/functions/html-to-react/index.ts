import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import JSZip from "https://esm.sh/jszip@3.10.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { htmlContent, title } = await req.json();

    if (!htmlContent) {
      return new Response(
        JSON.stringify({ error: "htmlContent est requis" }), 
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('Conversion HTML vers React pour:', title || 'Site sans titre');

    // Extraire le contenu du body HTML
    const bodyMatch = htmlContent.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    const body = bodyMatch ? bodyMatch[1] : htmlContent;

    // Extraire les styles du head si présents
    const styleMatch = htmlContent.match(/<style[^>]*>([\s\S]*?)<\/style>/gi);
    const styles = styleMatch ? styleMatch.join('\n') : '';

    // Création du projet React avec JSZip
    const zip = new JSZip();

    // index.html
    zip.file("index.html", `<!DOCTYPE html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title || 'Mon Site React'}</title>
    <script src="https://cdn.tailwindcss.com"></script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`);

    // package.json
    zip.file("package.json", JSON.stringify({
      name: (title || 'mon-site').toLowerCase().replace(/\s+/g, '-'),
      private: true,
      version: "0.0.0",
      type: "module",
      scripts: {
        dev: "vite",
        build: "tsc && vite build",
        preview: "vite preview"
      },
      dependencies: {
        react: "^18.3.1",
        "react-dom": "^18.3.1"
      },
      devDependencies: {
        "@types/react": "^18.3.3",
        "@types/react-dom": "^18.3.0",
        "@vitejs/plugin-react": "^4.3.1",
        autoprefixer: "^10.4.19",
        postcss: "^8.4.38",
        tailwindcss: "^3.4.4",
        typescript: "^5.5.3",
        vite: "^5.3.1"
      }
    }, null, 2));

    // vite.config.ts
    zip.file("vite.config.ts", `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
})`);

    // tsconfig.json
    zip.file("tsconfig.json", JSON.stringify({
      compilerOptions: {
        target: "ES2020",
        useDefineForClassFields: true,
        lib: ["ES2020", "DOM", "DOM.Iterable"],
        module: "ESNext",
        skipLibCheck: true,
        moduleResolution: "bundler",
        allowImportingTsExtensions: true,
        resolveJsonModule: true,
        isolatedModules: true,
        noEmit: true,
        jsx: "react-jsx",
        strict: true,
        noUnusedLocals: true,
        noUnusedParameters: true,
        noFallthroughCasesInSwitch: true
      },
      include: ["src"],
      references: [{ path: "./tsconfig.node.json" }]
    }, null, 2));

    // tsconfig.node.json
    zip.file("tsconfig.node.json", JSON.stringify({
      compilerOptions: {
        composite: true,
        skipLibCheck: true,
        module: "ESNext",
        moduleResolution: "bundler",
        allowSyntheticDefaultImports: true
      },
      include: ["vite.config.ts"]
    }, null, 2));

    // tailwind.config.js
    zip.file("tailwind.config.js", `/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}`);

    // postcss.config.js
    zip.file("postcss.config.js", `export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}`);

    // src/main.tsx
    zip.file("src/main.tsx", `import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)`);

    // src/App.tsx - Injecter le HTML directement
    const escapedBody = body.replace(/`/g, '\\`').replace(/\$/g, '\\$');
    zip.file("src/App.tsx", `import './App.css'

export default function App() {
  return (
    <div dangerouslySetInnerHTML={{__html: \`${escapedBody}\`}} />
  )
}`);

    // src/App.css - Inclure les styles extraits
    zip.file("src/App.css", styles);

    // src/index.css
    zip.file("src/index.css", `@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  margin: 0;
  padding: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
    sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

#root {
  min-height: 100vh;
}`);

    // .gitignore
    zip.file(".gitignore", `# Logs
logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*
lerna-debug.log*

node_modules
dist
dist-ssr
*.local

# Editor directories and files
.vscode/*
!.vscode/extensions.json
.idea
.DS_Store
*.suo
*.ntvs*
*.njsproj
*.sln
*.sw?`);

    // Générer le ZIP
    const zipBuffer = await zip.generateAsync({ type: "arraybuffer" });

    console.log('ZIP généré avec succès');

    return new Response(zipBuffer, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${(title || 'mon-site').replace(/\s+/g, '-')}.zip"`,
      },
    });
  } catch (error) {
    console.error('Erreur conversion HTML vers React:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erreur inconnue" }), 
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
