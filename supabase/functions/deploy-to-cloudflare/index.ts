import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";
import JSZip from "https://esm.sh/jszip@3.10.1";

// Minification CSS basique
function minifyCSS(css: string): string {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, '') // Remove comments
    .replace(/\s+/g, ' ') // Collapse whitespace
    .replace(/\s*([{}:;,])\s*/g, '$1') // Remove spaces around {}:;,
    .replace(/;}/g, '}') // Remove last semicolon
    .trim();
}

// Minification JS basique
function minifyJS(js: string): string {
  return js
    .replace(/\/\*[\s\S]*?\*\//g, '') // Remove multi-line comments
    .replace(/\/\/.*/g, '') // Remove single-line comments
    .replace(/\s+/g, ' ') // Collapse whitespace
    .replace(/\s*([{}();,=:+\-*/<>!&|])\s*/g, '$1') // Remove spaces around operators
    .trim();
}

// Optimisation HTML
function optimizeHTML(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, '') // Remove HTML comments
    .replace(/>\s+</g, '><') // Remove whitespace between tags
    .replace(/\s{2,}/g, ' ') // Collapse multiple spaces
    .trim();
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Template HTML par défaut
const DEFAULT_HTML = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <title>Site créé avec Trinity 🚀</title>
    <link rel="stylesheet" href="./style.css">
  </head>
  <body>
    <h1>Bienvenue sur votre site Trinity 🚀</h1>
    <script src="./script.js"></script>
  </body>
</html>`;

// Fonction pour extraire CSS et JS du HTML et garantir un HTML complet et valide
function extractContent(htmlContent: string) {
  // Si le HTML est vide ou quasi vide, utiliser le template par défaut
  if (!htmlContent || htmlContent.trim().length < 20) {
    console.log('HTML vide ou trop court, utilisation du template par défaut');
    return { html: DEFAULT_HTML, css: '', js: '' };
  }
  
  // Nettoyer les balises [EXPLANATION] ou tout texte avant <!DOCTYPE ou <html
  let cleanedContent = htmlContent;
  const doctypeIndex = cleanedContent.search(/<!DOCTYPE/i);
  const htmlIndex = cleanedContent.search(/<html/i);
  
  if (doctypeIndex > 0) {
    cleanedContent = cleanedContent.substring(doctypeIndex);
    console.log('Texte supprimé avant <!DOCTYPE');
  } else if (htmlIndex > 0) {
    cleanedContent = cleanedContent.substring(htmlIndex);
    console.log('Texte supprimé avant <html>');
  }

  const styleMatch = cleanedContent.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
  const scriptMatch = cleanedContent.match(/<script[^>]*>([\s\S]*?)<\/script>/i);
  
  const css = styleMatch ? styleMatch[1].trim() : '';
  let js = scriptMatch ? scriptMatch[1].trim() : '';
  
  // Nettoyer le HTML en enlevant les balises style et script inline
  // SAUF si le script contient du code qui écrit dans le DOM
  let cleanHtml = cleanedContent;
  if (styleMatch) {
    cleanHtml = cleanHtml.replace(styleMatch[0], '');
  }
  
  // Ne supprimer le script que s'il n'écrit pas dans le DOM
  if (scriptMatch) {
    const scriptContent = scriptMatch[1];
    const writesDom = /document\.(body|getElementById|querySelector|write|innerHTML|createElement)/i.test(scriptContent);
    
    if (!writesDom) {
      // Le script n'écrit pas dans le DOM, on peut le déplacer vers script.js
      cleanHtml = cleanHtml.replace(scriptMatch[0], '');
    } else {
      // Le script écrit dans le DOM, on le garde inline et on vide js externe
      console.log('Script inline conservé car il écrit dans le DOM');
      js = '';
    }
  }
  
  // Vérifier si le HTML a une structure complète
  const hasDoctype = cleanHtml.includes('<!DOCTYPE') || cleanHtml.includes('<!doctype');
  const hasHtml = cleanHtml.includes('<html');
  const hasHead = cleanHtml.includes('<head');
  const hasBody = cleanHtml.includes('<body');
  
  console.log('Structure HTML détectée:', { hasDoctype, hasHtml, hasHead, hasBody });
  
  // Si le HTML n'a pas de structure complète, le wrapper
  if (!hasHtml || !hasHead || !hasBody) {
    console.log('HTML incomplet détecté, création d\'une structure complète');
    cleanHtml = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <title>Site créé avec Trinity 🚀</title>
    <link rel="stylesheet" href="./style.css">
  </head>
  <body>
    ${cleanHtml}
    <script src="./script.js"></script>
  </body>
</html>`;
  } else {
    // S'assurer que les liens vers CSS et JS sont présents
    if (!cleanHtml.includes('style.css')) {
      if (cleanHtml.includes('</head>')) {
        cleanHtml = cleanHtml.replace('</head>', '  <link rel="stylesheet" href="./style.css">\n  </head>');
      } else if (cleanHtml.includes('<head>')) {
        cleanHtml = cleanHtml.replace('<head>', '<head>\n  <link rel="stylesheet" href="./style.css">');
      }
    }
    
    if (!cleanHtml.includes('script.js')) {
      if (cleanHtml.includes('</body>')) {
        cleanHtml = cleanHtml.replace('</body>', '  <script src="./script.js"></script>\n  </body>');
      } else if (cleanHtml.includes('</html>')) {
        cleanHtml = cleanHtml.replace('</html>', '  <script src="./script.js"></script>\n</html>');
      } else {
        cleanHtml += '\n  <script src="./script.js"></script>';
      }
    }
    
    // Ajouter DOCTYPE si absent
    if (!hasDoctype) {
      cleanHtml = '<!DOCTYPE html>\n' + cleanHtml;
    }
  }
  
  console.log('HTML final généré (premiers 200 caractères):', cleanHtml.substring(0, 200));
  
  return { html: cleanHtml, css, js };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { htmlContent, title } = await req.json();
    
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

    // Créer un nom de projet unique
    const projectName = `site-${Date.now()}`;
    
    // Vérifier si le projet existe déjà
    const listProjectsResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${cloudflareAccountId}/pages/projects`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${cloudflareToken}`,
        },
      }
    );

    let projectExists = false;
    if (listProjectsResponse.ok) {
      const projectsList = await listProjectsResponse.json();
      projectExists = projectsList.result?.some((p: any) => p.name === projectName) || false;
    }

    // Créer le projet seulement s'il n'existe pas
    if (!projectExists) {
      console.log(`Creating new Cloudflare Pages project: ${projectName}`);
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
        console.error('Cloudflare project creation error:', errorText);
        throw new Error('Failed to create Cloudflare project');
      }
    } else {
      console.log(`Project ${projectName} already exists, creating new deployment`);
    }

    // Extraire HTML, CSS et JS
  const { html, css, js } = extractContent(htmlContent);
  console.log('Extracted content:', { hasHtml: !!html, hasCss: !!css, hasJs: !!js });
  
  // Vérifier que le HTML final contient du contenu visible
  const htmlFinal = html || DEFAULT_HTML;
  const hasVisibleContent = /<body[^>]*>[\s\S]*?<\/body>/i.test(htmlFinal) && 
                            htmlFinal.replace(/<[^>]*>/g, '').trim().length > 0;
  
  console.log('HTML final généré (premiers 200 caractères):', htmlFinal.substring(0, 200));
  console.log('Contenu visible détecté:', hasVisibleContent);

    // Optimiser et minifier les assets pour production
    const optimizedHTML = optimizeHTML(htmlFinal);
    const minifiedCSS = css ? minifyCSS(css) : '/* Styles vides */';
    const minifiedJS = js ? minifyJS(js) : '// Script vide';
    
    console.log('Optimisations:', {
      htmlReduction: `${htmlFinal.length} -> ${optimizedHTML.length} bytes`,
      cssReduction: css ? `${css.length} -> ${minifiedCSS.length} bytes` : 'empty',
      jsReduction: js ? `${js.length} -> ${minifiedJS.length} bytes` : 'empty'
    });

    // Créer un fichier ZIP avec JSZip - TOUJOURS créer les 3 fichiers optimisés
    const zip = new JSZip();
    zip.file('index.html', optimizedHTML);
    zip.file('style.css', minifiedCSS);
    zip.file('script.js', minifiedJS);
    
    // Ajouter _headers pour configuration CDN Cloudflare
    const headersConfig = `/*
  Cache-Control: public, max-age=31536000, immutable
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  X-XSS-Protection: 1; mode=block
  Referrer-Policy: strict-origin-when-cross-origin

/*.css
  Content-Type: text/css
  Cache-Control: public, max-age=31536000, immutable

/*.js
  Content-Type: application/javascript
  Cache-Control: public, max-age=31536000, immutable

/*.html
  Content-Type: text/html; charset=utf-8
  Cache-Control: public, max-age=3600`;
    
    zip.file('_headers', headersConfig);

    // Générer le ZIP en tant qu'ArrayBuffer
    const zipArrayBuffer = await zip.generateAsync({ type: 'arraybuffer' });
    console.log(`ZIP created, size: ${zipArrayBuffer.byteLength} bytes`);

    // Créer le manifest pour Cloudflare avec les 4 fichiers (HTML, CSS, JS, headers)
    const manifestEntries: Record<string, { path: string }> = {
      "index.html": { path: "index.html" },
      "style.css": { path: "style.css" },
      "script.js": { path: "script.js" },
      "_headers": { path: "_headers" }
    };

    // Créer le FormData avec le manifest ET le fichier ZIP
    const formData = new FormData();
    formData.append('manifest', JSON.stringify({ entries: manifestEntries }));
    
    // Ajouter le fichier ZIP
    const zipBlob = new Blob([zipArrayBuffer], { type: 'application/zip' });
    formData.append('file', zipBlob, 'build.zip');

    console.log(`Deploying to Cloudflare Pages project: ${projectName}`);
    const deployResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${cloudflareAccountId}/pages/projects/${projectName}/deployments`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${cloudflareToken}`,
        },
        body: formData,
      }
    );

    if (!deployResponse.ok) {
      const errorText = await deployResponse.text();
      console.error('Cloudflare deployment error:', errorText);
      throw new Error(`Failed to deploy to Cloudflare: ${errorText}`);
    }

    const deployData = await deployResponse.json();
    const cloudflareUrl = deployData.result?.url || `https://${projectName}.pages.dev`;
    console.log(`Deployment successful: ${cloudflareUrl}`);

    // Sauvegarder dans la base de données
    const { data: website, error: insertError } = await supabase
      .from('websites')
      .insert({
        user_id: user.id,
        title: title || 'Mon site web',
        html_content: htmlFinal, // Enregistrer le HTML nettoyé, pas le brut
        cloudflare_url: cloudflareUrl,
        cloudflare_project_name: projectName,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Database insert error:', insertError);
      throw insertError;
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
    console.error('Error in deploy-to-cloudflare:', error);
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
