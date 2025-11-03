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
      
      // ✅ VALIDATION COMPLÈTE DU HTML
      console.log(`📏 HTML size: ${html?.length || 0} caractères`);
      
      // Vérifier que le HTML n'est pas vide (minimum 50 caractères)
      if (!html || html.trim().length === 0) {
        throw new Error('❌ HTML vide — génération échouée');
      }
      
      if (html.length < 50) {
        throw new Error(`❌ HTML trop court (${html.length} caractères) — génération échouée`);
      }
      
      // Valider les balises essentielles
      const hasHtmlTag = html.includes('<html');
      const hasHeadTag = html.includes('<head');
      const hasBodyTag = html.includes('<body');
      
      console.log(`🔍 Validation HTML: <html>=${hasHtmlTag}, <head>=${hasHeadTag}, <body>=${hasBodyTag}`);
      
      if (!hasHtmlTag || !hasHeadTag || !hasBodyTag) {
        throw new Error(
          `❌ HTML invalide — balises manquantes: ${!hasHtmlTag ? '<html> ' : ''}${!hasHeadTag ? '<head> ' : ''}${!hasBodyTag ? '<body>' : ''}`
        );
      }
      
      const htmlBytes = encoder.encode(html);
      
      // Vérifier que l'encodage a réussi
      if (htmlBytes.byteLength === 0) {
        throw new Error('❌ Erreur d\'encodage HTML — fichier vide après encodage');
      }
      
      builtFiles['index.html'] = htmlBytes;
      console.log(`✅ index.html validé (${(htmlBytes.byteLength / 1024).toFixed(2)} Ko, ${html.length} caractères)`);
    }

    // 📌 Vérifier si un projet Cloudflare existe déjà pour cette session ou ce titre
    let projectName = '';
    let isNewProject = false;

    // Si on a un titre, chercher si un projet Cloudflare existe déjà pour ce titre
    if (title) {
      const { data: existingWebsite } = await supabase
        .from('websites')
        .select('cloudflare_project_name, cloudflare_url')
        .eq('user_id', user.id)
        .eq('title', title)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (existingWebsite?.cloudflare_project_name) {
        projectName = existingWebsite.cloudflare_project_name;
        console.log(`♻️ Réutilisation du projet Cloudflare existant: ${projectName}`);
        console.log(`🔗 URL existante: ${existingWebsite.cloudflare_url}`);
      }
    }

    // Si pas de projet existant, créer un nouveau nom
    if (!projectName) {
      projectName = `trinity-${Date.now()}`;
      isNewProject = true;
      console.log(`🆕 Création d'un nouveau projet Cloudflare: ${projectName}`);
    }
    
    // Vérifier si le projet existe sur Cloudflare
    const checkProjectResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${cloudflareAccountId}/pages/projects/${projectName}`,
      {
        method: 'GET',
        headers: { 
          'Authorization': `Bearer ${cloudflareToken}`,
          'Content-Type': 'application/json'
        },
      }
    );

    let projectExists = false;
    if (checkProjectResponse.ok) {
      projectExists = true;
      console.log(`✅ Le projet Cloudflare ${projectName} existe déjà`);
    } else if (checkProjectResponse.status === 404) {
      console.log(`📝 Le projet ${projectName} n'existe pas encore sur Cloudflare`);
    } else {
      const errorText = await checkProjectResponse.text();
      console.log(`⚠️ Erreur lors de la vérification du projet: ${checkProjectResponse.status}`, errorText);
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
        // Si le projet existe déjà (409), on continue
        if (createProjectResponse.status === 409) {
          console.log('⚠️ Projet déjà existant (409), on continue...');
        } else {
          console.error('❌ Erreur création projet:', errorText);
          throw new Error('Failed to create Cloudflare project');
        }
      } else {
        console.log(`✅ Projet Cloudflare créé: ${projectName}`);
      }
    }

    // Préparer les fichiers pour Cloudflare Pages Direct Upload
    // IMPORTANT: Cloudflare attend les fichiers INDIVIDUELS, pas un ZIP
    const manifestEntries: Record<string, string> = {};
    
    console.log(`📦 Préparation des fichiers pour Cloudflare...`);
    
    for (const [filename, content] of Object.entries(builtFiles)) {
      console.log(`📄 Fichier ${filename}:`);
      console.log(`   └─ Taille: ${content.byteLength} bytes (${(content.byteLength / 1024).toFixed(2)} Ko)`);
      
      // IMPORTANT: Vérifier que le contenu n'est pas vide
      if (content.byteLength === 0) {
        console.error(`❌ ERREUR: Le fichier ${filename} est VIDE!`);
        throw new Error(`Le fichier ${filename} est vide - impossible de déployer`);
      }
      
      // Afficher un extrait du contenu pour debug (premiers 100 caractères)
      const decoder = new TextDecoder();
      const contentPreview = decoder.decode(content.slice(0, 100));
      console.log(`   └─ Extrait: ${contentPreview.substring(0, 80)}...`);
      
      // Calculer le hash SHA-256 du contenu
      const hashBuffer = await crypto.subtle.digest('SHA-256', content);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      
      // Le manifest Cloudflare utilise "/" + filename comme clé
      const manifestKey = `/${filename}`;
      manifestEntries[manifestKey] = hashHex;
      
      console.log(`   ✓ Hash SHA-256: ${hashHex.substring(0, 16)}...`);
      console.log(`   ✓ Manifest key: ${manifestKey}`);
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
    
    const headersBytes = new TextEncoder().encode(headersConfig);
    
    // Hash pour _headers
    const headersHash = await crypto.subtle.digest('SHA-256', headersBytes);
    const headersHashArray = Array.from(new Uint8Array(headersHash));
    const headersHashHex = headersHashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    manifestEntries['/_headers'] = headersHashHex;
    
    console.log(`📋 Manifest avec ${Object.keys(manifestEntries).length} fichiers:`, Object.keys(manifestEntries));
    console.log(`📋 Manifest complet:`, JSON.stringify(manifestEntries, null, 2));

    // ✅ CRÉER LE FORMDATA AVEC LES FICHIERS INDIVIDUELS (pas de ZIP!)
    // Cloudflare Pages Direct Upload attend chaque fichier séparément
    const formData = new FormData();
    formData.append('manifest', JSON.stringify(manifestEntries));
    
    // Ajouter chaque fichier individuellement au FormData
    for (const [filename, content] of Object.entries(builtFiles)) {
      const blob = new Blob([content], { type: 'application/octet-stream' });
      const manifestKey = `/${filename}`;
      formData.append(manifestKey, blob, filename);
      console.log(`✅ Ajouté au FormData: ${manifestKey} (${filename})`);
    }
    
    // Ajouter le fichier _headers
    const headersBlob = new Blob([headersBytes], { type: 'text/plain' });
    formData.append('/_headers', headersBlob, '_headers');
    console.log(`✅ Ajouté au FormData: /_headers`);

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
    console.log(`✅ Déploiement Cloudflare Pages créé: ${cloudflareUrl}`);

    // Sauvegarder dans la DB ou mettre à jour si le projet existe déjà
    let website;
    if (isNewProject) {
      // Nouveau projet - INSERT
      const { data, error: insertError } = await supabase
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
        console.error('❌ Erreur DB INSERT:', insertError);
        throw insertError;
      }
      website = data;
      console.log(`✅ Nouveau site créé en DB: ${website.id}`);
    } else {
      // Projet existant - UPDATE
      const { data, error: updateError } = await supabase
        .from('websites')
        .update({
          html_content: htmlContent,
          cloudflare_url: cloudflareUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id)
        .eq('cloudflare_project_name', projectName)
        .select()
        .single();

      if (updateError) {
        console.error('❌ Erreur DB UPDATE:', updateError);
        throw updateError;
      }
      website = data;
      console.log(`✅ Site existant mis à jour en DB: ${website.id}`);
    }

    // Générer le screenshot après le déploiement
    if (website?.id && cloudflareUrl) {
      try {
        console.log('📸 Génération du screenshot (avec délai de 5s pour propagation DNS)...');
        
        // Attendre 5 secondes pour que l'URL soit propagée sur le CDN Cloudflare
        await new Promise(resolve => setTimeout(resolve, 5000));
        
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
