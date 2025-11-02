import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";
import JSZip from "https://esm.sh/jszip@3.10.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Fonction pour construire le projet Vite/React
async function buildReactProject(projectFiles: Record<string, string>): Promise<Record<string, Uint8Array>> {
  console.log('🏗️  Début de la construction du projet React...');
  
  const builtFiles: Record<string, Uint8Array> = {};
  const encoder = new TextEncoder();

  // 1. Générer index.html optimisé
  const indexHtml = projectFiles['index.html'] || projectFiles['/index.html'] || '';
  const appCss = projectFiles['src/App.css'] || projectFiles['/src/App.css'] || '';
  const indexCss = projectFiles['src/index.css'] || projectFiles['/src/index.css'] || '';

  // 2. Compiler tous les fichiers TSX/TS en JS (transpilation simplifiée)
  let compiledJS = '';
  const componentCode: string[] = [];

  Object.entries(projectFiles).forEach(([path, content]) => {
    if (path.endsWith('.tsx') || path.endsWith('.ts')) {
      // Conversion TSX → JS vanilla (simplifiée)
      let jsCode = content
        // Supprimer les imports
        .replace(/^import\s+.*?from\s+['"].*?['"];?\s*$/gm, '')
        // Supprimer les types TypeScript
        .replace(/:\s*\w+(\[\])?(\s*\|\s*\w+)?/g, '')
        .replace(/interface\s+\w+\s*\{[^}]*\}/gs, '')
        .replace(/type\s+\w+\s*=\s*[^;]+;/g, '')
        // Convertir JSX en createElement
        .replace(/<(\w+)([^>]*)>/g, (match, tag, attrs) => {
          const cleanAttrs = attrs.trim();
          if (cleanAttrs) {
            return `React.createElement('${tag}', ${cleanAttrs})`;
          }
          return `React.createElement('${tag}', null)`;
        })
        .replace(/<\/(\w+)>/g, ')')
        // Nettoyer
        .trim();

      componentCode.push(`// ${path}\n${jsCode}`);
    }
  });

  compiledJS = componentCode.join('\n\n');

  // 3. Générer le HTML de production avec tout inline
  const productionHtml = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="Application créée avec Trinity AI">
  <title>Trinity AI App</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            primary: '#3b82f6',
            secondary: '#8b5cf6',
            accent: '#f59e0b'
          }
        }
      }
    }
  </script>
  <style>
    * { font-family: 'Inter', sans-serif; }
    ${indexCss}
    ${appCss}
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="module">
    // React polyfill minimaliste
    const React = {
      createElement: (type, props, ...children) => {
        if (typeof type === 'function') return type({ ...props, children });
        const el = document.createElement(type);
        if (props) {
          Object.keys(props).forEach(key => {
            if (key === 'className') el.className = props[key];
            else if (key.startsWith('on')) {
              const event = key.toLowerCase().substring(2);
              el.addEventListener(event, props[key]);
            } else if (key !== 'children') {
              el.setAttribute(key, props[key]);
            }
          });
        }
        children.flat().forEach(child => {
          if (typeof child === 'string' || typeof child === 'number') {
            el.appendChild(document.createTextNode(child));
          } else if (child) {
            el.appendChild(child);
          }
        });
        return el;
      },
      useState: (init) => {
        const val = typeof init === 'function' ? init() : init;
        return [val, () => {}];
      },
      useEffect: (fn) => fn(),
      useRef: (init) => ({ current: init })
    };
    const ReactDOM = {
      createRoot: (container) => ({
        render: (element) => {
          container.innerHTML = '';
          if (element?.appendChild) container.appendChild(element);
        }
      })
    };

    // Code de l'application
    ${compiledJS}

    // Render
    try {
      const root = ReactDOM.createRoot(document.getElementById('root'));
      root.render(React.createElement(App));
    } catch (error) {
      console.error('Erreur de rendu:', error);
      document.getElementById('root').innerHTML = '<div style="padding:2rem;color:red;">Erreur: ' + error.message + '</div>';
    }
  </script>
</body>
</html>`.trim();

  builtFiles['index.html'] = encoder.encode(productionHtml);

  console.log('✅ Build terminé:', Object.keys(builtFiles));
  return builtFiles;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const contentType = req.headers.get('content-type') || '';
    let htmlContent: string;
    let title: string;
    let isReactProject = false;
    let reactProjectFiles: Record<string, string> = {};

    // Détecter le type de payload
    if (contentType.includes('application/json')) {
      // Format JSON classique
      const json = await req.json();
      htmlContent = json.htmlContent;
      title = json.title;
    } else {
      // C'est probablement un ZIP de projet React
      const zipBuffer = await req.arrayBuffer();
      const zip = await JSZip.loadAsync(zipBuffer);
      
      // Extraire tous les fichiers
      const filePromises = Object.keys(zip.files).map(async (filename) => {
        const file = zip.files[filename];
        if (!file.dir) {
          const content = await file.async('text');
          reactProjectFiles[filename] = content;
        }
      });
      await Promise.all(filePromises);

      // Vérifier si c'est un projet React
      if (reactProjectFiles['package.json'] && Object.keys(reactProjectFiles).some(f => f.startsWith('src/'))) {
        isReactProject = true;
        // Extraire le titre du package.json
        try {
          const pkg = JSON.parse(reactProjectFiles['package.json']);
          title = pkg.name || 'mon-site';
        } catch {
          title = 'mon-site';
        }
        htmlContent = JSON.stringify({ files: reactProjectFiles });
      } else {
        // HTML simple dans le ZIP
        htmlContent = reactProjectFiles['index.html'] || Object.values(reactProjectFiles)[0] || '';
        title = 'mon-site';
      }
    }
    
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const cloudflareToken = Deno.env.get('CLOUDFLARE_API_TOKEN');
    const cloudflareAccountId = Deno.env.get('CLOUDFLARE_ACCOUNT_ID');

    if (!cloudflareToken || !cloudflareAccountId) {
      throw new Error('Cloudflare credentials not configured');
    }

    // Parser le projet
    let projectFiles: Record<string, string> = {};
    let builtFiles: Record<string, Uint8Array> = {};
    const encoder = new TextEncoder();
    
    if (isReactProject) {
      // Projet React - utiliser le builder
      projectFiles = reactProjectFiles;
      console.log('📦 Fichiers du projet React:', Object.keys(projectFiles));
      builtFiles = await buildReactProject(projectFiles);
    } else {
      // HTML simple - publier directement sans transformation
      try {
        const parsed = JSON.parse(htmlContent);
        projectFiles = parsed.files || parsed;
      } catch {
        // Fallback si c'est du HTML brut
        projectFiles = { 'index.html': htmlContent };
      }
      
      console.log('📦 HTML simple détecté');
      
      // Publier le HTML tel quel, sans conversion React
      const html = projectFiles['index.html'] || htmlContent;
      builtFiles['index.html'] = encoder.encode(html);
    }

    // Créer un nom de projet unique
    const projectName = `trinity-${Date.now()}`;
    
    // Vérifier si le projet existe
    const listProjectsResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${cloudflareAccountId}/pages/projects`,
      {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${cloudflareToken}` },
      }
    );

    let projectExists = false;
    if (listProjectsResponse.ok) {
      const projectsList = await listProjectsResponse.json();
      projectExists = projectsList.result?.some((p: any) => p.name === projectName) || false;
    }

    // Créer le projet si nécessaire
    if (!projectExists) {
      console.log(`📝 Création du projet Cloudflare: ${projectName}`);
      const createProjectResponse = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${cloudflareAccountId}/pages/projects`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${cloudflareToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: projectName,
            production_branch: 'main',
            build_config: {
              build_command: '',
              destination_dir: '/',
              root_dir: '/'
            },
            deployment_configs: {
              production: {
                compatibility_date: '2024-01-01',
                compatibility_flags: ['streams_enable_constructors']
              }
            }
          }),
        }
      );

      if (!createProjectResponse.ok) {
        const errorText = await createProjectResponse.text();
        console.error('❌ Erreur création projet:', errorText);
        throw new Error('Failed to create Cloudflare project');
      }
    }

    // Créer le ZIP avec les fichiers construits
    const zip = new JSZip();
    
    for (const [filename, content] of Object.entries(builtFiles)) {
      zip.file(filename, content);
    }
    
    // Ajouter fichier _headers pour CDN
    const headersConfig = `/*
  Cache-Control: public, max-age=31536000, immutable
  X-Content-Type-Options: nosniff
  X-Frame-Options: SAMEORIGIN
  X-XSS-Protection: 1; mode=block
  Referrer-Policy: strict-origin-when-cross-origin
  Content-Security-Policy: default-src 'self' 'unsafe-inline' 'unsafe-eval' https: data: blob:

/*.html
  Content-Type: text/html; charset=utf-8
  Cache-Control: public, max-age=3600

/*.css
  Content-Type: text/css
  Cache-Control: public, max-age=31536000, immutable

/*.js
  Content-Type: application/javascript
  Cache-Control: public, max-age=31536000, immutable`;
    
    zip.file('_headers', headersConfig);

    // Générer le ZIP
    const zipArrayBuffer = await zip.generateAsync({ type: 'arraybuffer' });
    console.log(`📦 ZIP créé: ${zipArrayBuffer.byteLength} bytes`);

    // Créer le manifest
    const manifestEntries: Record<string, { path: string }> = {};
    for (const filename of Object.keys(builtFiles)) {
      manifestEntries[filename] = { path: filename };
    }
    manifestEntries['_headers'] = { path: '_headers' };

    // Créer le FormData
    const formData = new FormData();
    formData.append('manifest', JSON.stringify({ entries: manifestEntries }));
    const zipBlob = new Blob([zipArrayBuffer], { type: 'application/zip' });
    formData.append('file', zipBlob, 'build.zip');

    console.log(`🚀 Déploiement sur Cloudflare: ${projectName}`);
    const deployResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${cloudflareAccountId}/pages/projects/${projectName}/deployments`,
      {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${cloudflareToken}` },
        body: formData,
      }
    );

    if (!deployResponse.ok) {
      const errorText = await deployResponse.text();
      console.error('❌ Erreur déploiement:', errorText);
      throw new Error(`Failed to deploy: ${errorText}`);
    }

    const deployData = await deployResponse.json();
    const cloudflareUrl = deployData.result?.url || `https://${projectName}.pages.dev`;
    console.log(`✅ Déploiement réussi: ${cloudflareUrl}`);

    // Sauvegarder dans la DB
    const { data: website, error: insertError } = await supabase
      .from('websites')
      .insert({
        user_id: user.id,
        title: title || 'Mon application React',
        html_content: htmlContent,
        cloudflare_url: cloudflareUrl,
        cloudflare_project_name: projectName,
      })
      .select()
      .single();

    if (insertError) {
      console.error('❌ Erreur DB:', insertError);
      throw insertError;
    }

    // Générer le screenshot après le déploiement
    if (website?.id) {
      try {
        console.log('📸 Génération du screenshot...');
        await supabase.functions.invoke('generate-screenshot', {
          body: {
            projectId: website.id,
            htmlContent: htmlContent,
            table: 'websites'
          }
        });
        console.log('✅ Screenshot généré');
      } catch (screenshotError) {
        console.error('⚠️ Erreur screenshot:', screenshotError);
        // Ne pas bloquer le déploiement si le screenshot échoue
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        website,
        url: cloudflareUrl 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('❌ Erreur globale:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
