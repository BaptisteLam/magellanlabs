import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ProjectFile {
  name: string;
  content: string;
  type: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🚀 Deploy to Netlify function called');
    
    // Authentication
    const authHeader = req.headers.get('Authorization');
    console.log('Auth header present:', !!authHeader);
    
    if (!authHeader) {
      console.error('❌ No authorization header');
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract JWT token from Authorization header
    const token = authHeader.replace('Bearer ', '');
    console.log('Token extracted, length:', token.length);

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    console.log('Supabase URL:', supabaseUrl);
    console.log('Service key present:', !!supabaseServiceKey);

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase configuration missing');
    }

    // Create admin client with service role key
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Verify the JWT token and get user
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      console.error('❌ Authentication error:', authError);
      return new Response(
        JSON.stringify({ error: 'Not authenticated', details: authError?.message }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ User authenticated:', user.id);

    const requestBody = await req.json();
    const { sessionId, projectFiles } = requestBody;
    
    console.log('Session ID:', sessionId);
    console.log('Files count:', projectFiles?.length);
    
    if (!sessionId || !projectFiles) {
      console.error('❌ Missing sessionId or projectFiles');
      return new Response(
        JSON.stringify({ error: 'Session ID and project files are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('📦 Deploying project to Netlify...');
    
    // Get GA4 Measurement ID from environment
    const GA_MEASUREMENT_ID = Deno.env.get('GA_MEASUREMENT_ID');
    console.log('GA4 Measurement ID configured:', !!GA_MEASUREMENT_ID);

    // Get session data
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('build_sessions')
      .select('netlify_site_id, netlify_deployment_url, title')
      .eq('id', sessionId)
      .single();

    if (sessionError) {
      console.error('❌ Session error:', sessionError);
      throw new Error(`Failed to get session: ${sessionError.message}`);
    }

    console.log('Session data retrieved:', session?.title);

    const NETLIFY_TOKEN = Deno.env.get('NETLIFY_TOKEN');


    if (!NETLIFY_TOKEN) {
      throw new Error('Netlify token not configured');
    }

    // Create ZIP file
    const filesMap: Record<string, Uint8Array> = {};
    projectFiles.forEach((file: ProjectFile) => {
      const fileName = file.name.startsWith('/') ? file.name.slice(1) : file.name;
      
      // Gérer les fichiers base64 (comme le favicon)
      if (file.content.startsWith('data:')) {
        // Extraire le contenu base64
        const base64Data = file.content.split(',')[1];
        const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
        filesMap[fileName] = binaryData;
      } else {
        // Fichier texte normal
        filesMap[fileName] = new TextEncoder().encode(file.content);
      }
    });

    // Create simple ZIP (using basic ZIP structure)
    const zipData = await createZip(filesMap);

    console.log('🚀 Deploying to Netlify...');
    
    // Deploy to Netlify
    // Ajouter un identifiant unique pour éviter les conflits de noms
    const baseTitle = session.title?.toLowerCase().replace(/[^a-z0-9]/g, '-') || 'site';
    const uniqueId = sessionId.slice(0, 8);
    const siteName = `${baseTitle}-${uniqueId}`;
    
    // Create or update site
    let siteId = session.netlify_site_id;
    
    if (!siteId) {
      // Create new site
      const createSiteResponse = await fetch('https://api.netlify.com/api/v1/sites', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${NETLIFY_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: siteName,
        }),
      });

      if (!createSiteResponse.ok) {
        const errorText = await createSiteResponse.text();
        console.error('❌ Failed to create site:', errorText);
        throw new Error(`Failed to create site: ${errorText}`);
      }

      const siteData = await createSiteResponse.json();
      siteId = siteData.id;
      console.log('✅ Site created:', siteId);
    }

    // Deploy ZIP to site
    const deployResponse = await fetch(`https://api.netlify.com/api/v1/sites/${siteId}/deploys`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NETLIFY_TOKEN}`,
        'Content-Type': 'application/zip',
      },
      body: zipData as unknown as BodyInit,
    });

    if (!deployResponse.ok) {
      const errorText = await deployResponse.text();
      console.error('❌ Deployment failed:', errorText);
      throw new Error(`Deployment failed: ${errorText}`);
    }

    const deployResult = await deployResponse.json();
    console.log('✅ Deployed to Netlify:', deployResult);

    const deploymentUrl = deployResult.ssl_url || deployResult.url || `https://${siteName}.netlify.app`;

    // Update session
    const { error: updateError } = await supabaseAdmin
      .from('build_sessions')
      .update({
        netlify_site_id: siteId,
        netlify_deployment_url: deploymentUrl,
      })
      .eq('id', sessionId);

    if (updateError) {
      console.error('⚠️ Failed to update session:', updateError);
    }

    // Create or update website entry to mark as published
    console.log('📝 Creating/updating website entry...');
    
    // Get project files to extract HTML content
    const htmlFile = projectFiles.find((f: ProjectFile) => f.name === 'index.html');
    const htmlContent = htmlFile?.content || '';
    
    // Check if website entry already exists for this session
    const { data: existingWebsite } = await supabaseAdmin
      .from('websites')
      .select('id')
      .eq('user_id', user.id)
      .eq('title', session.title)
      .maybeSingle();
    
    let websiteId: string;
    
    if (existingWebsite) {
      websiteId = existingWebsite.id;
      
      // Update existing entry
      const { error: websiteUpdateError } = await supabaseAdmin
        .from('websites')
        .update({
          netlify_url: deploymentUrl,
          netlify_site_id: siteId,
          html_content: htmlContent,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingWebsite.id);
      
      if (websiteUpdateError) {
        console.error('⚠️ Failed to update website:', websiteUpdateError);
      } else {
        console.log('✅ Website entry updated');
      }
    } else {
      // Create new website entry
      const { data: newWebsite, error: websiteInsertError } = await supabaseAdmin
        .from('websites')
        .insert({
          user_id: user.id,
          title: session.title || 'Sans titre',
          netlify_url: deploymentUrl,
          netlify_site_id: siteId,
          html_content: htmlContent,
        })
        .select('id')
        .single();
      
      if (websiteInsertError || !newWebsite) {
        console.error('⚠️ Failed to create website:', websiteInsertError);
        websiteId = '';
      } else {
        console.log('✅ Website entry created');
        websiteId = newWebsite.id;
      }
    }
    
    // Link build_session to website
    if (websiteId) {
      const { error: linkError } = await supabaseAdmin
        .from('build_sessions')
        .update({ website_id: websiteId })
        .eq('id', sessionId);
      
      if (linkError) {
        console.error('⚠️ Failed to link session to website:', linkError);
      } else {
        console.log('✅ Session linked to website');
      }
    }
    
    // Inject GA4 tracking script if measurement ID is configured
    if (GA_MEASUREMENT_ID && htmlContent) {
      console.log('📊 Injecting GA4 tracking script...');
      
      const gaScript = `
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', '${GA_MEASUREMENT_ID}', {
    'page_path': window.location.pathname,
    'custom_map': {'dimension1': 'hostname'}
  });
  gtag('event', 'page_view', {
    'hostname': window.location.hostname
  });
</script>`;
      
      // Find the HTML file and inject GA4 script
      const htmlFileIndex = projectFiles.findIndex((f: ProjectFile) => f.name === 'index.html');
      if (htmlFileIndex !== -1) {
        const originalHtml = projectFiles[htmlFileIndex].content;
        
        // Inject script before closing </head> tag or at the beginning of <body>
        let modifiedHtml = originalHtml;
        if (originalHtml.includes('</head>')) {
          modifiedHtml = originalHtml.replace('</head>', `${gaScript}\n</head>`);
        } else if (originalHtml.includes('<body')) {
          modifiedHtml = originalHtml.replace('<body', `${gaScript}\n<body`);
        } else {
          // If no head or body, add at the beginning
          modifiedHtml = gaScript + '\n' + originalHtml;
        }
        
        // Update the file content
        projectFiles[htmlFileIndex].content = modifiedHtml;
        
        // Recreate ZIP with updated HTML
        const newFilesMap: Record<string, Uint8Array> = {};
        projectFiles.forEach((file: ProjectFile) => {
          const fileName = file.name.startsWith('/') ? file.name.slice(1) : file.name;
          
          if (file.content.startsWith('data:')) {
            const base64Data = file.content.split(',')[1];
            const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
            newFilesMap[fileName] = binaryData;
          } else {
            newFilesMap[fileName] = new TextEncoder().encode(file.content);
          }
        });
        
        const newZipData = await createZip(newFilesMap);
        
        // Redeploy with GA4 script
        const redeployResponse = await fetch(`https://api.netlify.com/api/v1/sites/${siteId}/deploys`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${NETLIFY_TOKEN}`,
            'Content-Type': 'application/zip',
          },
          body: newZipData as unknown as BodyInit,
        });
        
        if (redeployResponse.ok) {
          console.log('✅ Redeployed with GA4 tracking');
        } else {
          console.error('⚠️ Failed to redeploy with GA4');
        }
      }
    }

    console.log('✅ Deployment successful:', deploymentUrl);

    // Generate screenshot after deployment (fire and forget)
    console.log('📸 Generating screenshot...');
    
    // Call with service role key for authentication
    const screenshotPromise = fetch(`${supabaseUrl}/functions/v1/generate-screenshot`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: deploymentUrl,
        sessionId: sessionId,
      }),
    }).then(async (response) => {
      if (!response.ok) {
        const error = await response.text();
        console.error('⚠️ Screenshot generation failed:', error);
      } else {
        const data = await response.json();
        console.log('✅ Screenshot generated:', data?.thumbnailUrl);
      }
    }).catch((error) => {
      console.error('⚠️ Screenshot error:', error);
    });
    
    // Don't await, let it run in background
    screenshotPromise;

    return new Response(
      JSON.stringify({
        success: true,
        url: deploymentUrl,
        siteId: siteId,
        websiteId: websiteId || null,
        state: deployResult.state || 'ready',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Deployment error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Simple ZIP creation function
async function createZip(files: Record<string, Uint8Array>): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  const centralDirectory: Uint8Array[] = [];
  let offset = 0;

  for (const [filename, content] of Object.entries(files)) {
    const filenameBytes = new TextEncoder().encode(filename);
    
    // Local file header
    const localHeader = new Uint8Array(30 + filenameBytes.length);
    const view = new DataView(localHeader.buffer);
    
    view.setUint32(0, 0x04034b50, true); // Local file header signature
    view.setUint16(4, 20, true); // Version needed to extract
    view.setUint16(6, 0, true); // General purpose bit flag
    view.setUint16(8, 0, true); // Compression method (0 = no compression)
    view.setUint16(10, 0, true); // Last mod file time
    view.setUint16(12, 0, true); // Last mod file date
    view.setUint32(14, crc32(content), true); // CRC-32
    view.setUint32(18, content.length, true); // Compressed size
    view.setUint32(22, content.length, true); // Uncompressed size
    view.setUint16(26, filenameBytes.length, true); // File name length
    view.setUint16(28, 0, true); // Extra field length
    
    localHeader.set(filenameBytes, 30);
    
    chunks.push(localHeader);
    chunks.push(content);
    
    // Central directory header
    const centralHeader = new Uint8Array(46 + filenameBytes.length);
    const centralView = new DataView(centralHeader.buffer);
    
    centralView.setUint32(0, 0x02014b50, true); // Central file header signature
    centralView.setUint16(4, 20, true); // Version made by
    centralView.setUint16(6, 20, true); // Version needed to extract
    centralView.setUint16(8, 0, true); // General purpose bit flag
    centralView.setUint16(10, 0, true); // Compression method
    centralView.setUint16(12, 0, true); // Last mod file time
    centralView.setUint16(14, 0, true); // Last mod file date
    centralView.setUint32(16, crc32(content), true); // CRC-32
    centralView.setUint32(20, content.length, true); // Compressed size
    centralView.setUint32(24, content.length, true); // Uncompressed size
    centralView.setUint16(28, filenameBytes.length, true); // File name length
    centralView.setUint16(30, 0, true); // Extra field length
    centralView.setUint16(32, 0, true); // File comment length
    centralView.setUint16(34, 0, true); // Disk number start
    centralView.setUint16(36, 0, true); // Internal file attributes
    centralView.setUint32(38, 0, true); // External file attributes
    centralView.setUint32(42, offset, true); // Relative offset of local header
    
    centralHeader.set(filenameBytes, 46);
    centralDirectory.push(centralHeader);
    
    offset += localHeader.length + content.length;
  }

  const centralDirSize = centralDirectory.reduce((sum, h) => sum + h.length, 0);
  
  // End of central directory record
  const endRecord = new Uint8Array(22);
  const endView = new DataView(endRecord.buffer);
  
  endView.setUint32(0, 0x06054b50, true); // End of central dir signature
  endView.setUint16(4, 0, true); // Number of this disk
  endView.setUint16(6, 0, true); // Disk where central directory starts
  endView.setUint16(8, centralDirectory.length, true); // Number of central directory records on this disk
  endView.setUint16(10, centralDirectory.length, true); // Total number of central directory records
  endView.setUint32(12, centralDirSize, true); // Size of central directory
  endView.setUint32(16, offset, true); // Offset of start of central directory
  endView.setUint16(20, 0, true); // ZIP file comment length
  
  // Combine all parts
  const totalSize = chunks.reduce((sum, c) => sum + c.length, 0) + centralDirSize + endRecord.length;
  const result = new Uint8Array(totalSize);
  
  let pos = 0;
  for (const chunk of chunks) {
    result.set(chunk, pos);
    pos += chunk.length;
  }
  
  for (const header of centralDirectory) {
    result.set(header, pos);
    pos += header.length;
  }
  
  result.set(endRecord, pos);
  
  return result;
}

// CRC32 calculation
function crc32(data: Uint8Array): number {
  const table = makeCrc32Table();
  let crc = 0xFFFFFFFF;
  
  for (let i = 0; i < data.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ data[i]) & 0xFF];
  }
  
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function makeCrc32Table(): Uint32Array {
  const table = new Uint32Array(256);
  
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c >>> 0;
  }
  
  return table;
}
