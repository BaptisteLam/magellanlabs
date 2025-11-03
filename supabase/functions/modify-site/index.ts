import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ProjectFile {
  path: string;
  content: string;
  type: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

// Parser pour extraire les fichiers avec le marqueur FILE_MODIFIED:
function parseModifiedFiles(code: string, existingFiles: ProjectFile[]): ProjectFile[] {
  const modifiedFiles: ProjectFile[] = [];
  const existingFilesMap = new Map(existingFiles.map(f => [f.path, f]));
  
  // Parse FILE_MODIFIED: markers
  const fileModifiedRegex = /FILE_MODIFIED:\s*(.+?)\n([\s\S]*?)(?=FILE_MODIFIED:|$)/g;
  let match;
  
  while ((match = fileModifiedRegex.exec(code)) !== null) {
    const filePath = match[1].trim();
    const content = match[2].trim();
    
    if (filePath && content) {
      const fileType = getFileType(filePath.split('.').pop() || 'txt');
      modifiedFiles.push({ path: filePath, content, type: fileType });
      existingFilesMap.delete(filePath); // Remove from existing since it's modified
    }
  }
  
  // Merge: modified files + unmodified existing files
  return [...modifiedFiles, ...Array.from(existingFilesMap.values())];
}

function getFileType(extension: string): string {
  const typeMap: Record<string, string> = {
    'html': 'html',
    'htm': 'html',
    'css': 'stylesheet',
    'js': 'javascript',
    'jsx': 'javascript',
    'ts': 'typescript',
    'tsx': 'typescript',
    'json': 'json',
    'md': 'markdown',
    'txt': 'text'
  };
  
  return typeMap[extension.toLowerCase()] || 'text';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get authorization
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse request - NEW format with relevantFiles and chatHistory
    const { 
      message,           // User's modification request
      sessionId, 
      relevantFiles,     // Array of { path, content } for context
      chatHistory        // Last 5 messages for context
    } = await req.json();

    if (!message || !sessionId) {
      return new Response(JSON.stringify({ error: 'message and sessionId are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[modify-site] User ${user.id} modifying session ${sessionId}`);

    const openRouterKey = Deno.env.get('OPENROUTER_API_KEY');
    if (!openRouterKey) {
      throw new Error('OPENROUTER_API_KEY not configured');
    }

    const existingFiles: ProjectFile[] = Array.isArray(relevantFiles) ? relevantFiles : [];

    // Build optimized AI prompt with context
    const systemPrompt = `Tu es un expert développeur. Tu modifies uniquement les fichiers nécessaires pour répondre à la demande.

RÈGLES CRITIQUES :
1. RETOURNE UNIQUEMENT LES FICHIERS MODIFIÉS
2. Chaque fichier modifié commence par : FILE_MODIFIED: [chemin/complet.tsx]
3. Donne le contenu COMPLET mis à jour du fichier
4. Utilise React 18 + TypeScript + Tailwind CSS
5. Code production-ready avec bonnes pratiques

FORMAT ATTENDU pour chaque fichier modifié :
FILE_MODIFIED: src/components/Button.tsx
[contenu COMPLET mis à jour]

FILE_MODIFIED: src/styles/globals.css
[contenu COMPLET mis à jour]`;

    // Build context from relevant files
    const filesContext = existingFiles.map(f => 
      `FILE_MODIFIED: ${f.path}\n${f.content}`
    ).join('\n\n');

    // Build chat history context
    const historyContext = Array.isArray(chatHistory) 
      ? chatHistory.slice(-5).map((msg: ChatMessage) => `${msg.role === 'user' ? 'User' : 'AI'}: ${msg.content}`).join('\n')
      : '';

    const userMessage = `CONTEXTE ACTUEL :
${filesContext}

${historyContext ? `HISTORIQUE :\n${historyContext}\n\n` : ''}DEMANDE ACTUELLE :
${message}

RETOURNE UNIQUEMENT LES FICHIERS MODIFIÉS avec le marqueur FILE_MODIFIED:`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage }
    ];

    // Stream from OpenRouter
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openRouterKey}`,
        'HTTP-Referer': 'https://trinitystudio.ai',
        'X-Title': 'Trinity Studio AI',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'anthropic/claude-3.5-sonnet', // Latest Claude model on OpenRouter
        messages,
        stream: true,
        max_tokens: 16000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenRouter error:', response.status, errorText);
      
      // Return generic error message to user
      const statusMessages: Record<number, string> = {
        400: 'Invalid request. Please check your input.',
        401: 'Authentication failed. Please try again.',
        402: 'Insufficient credits. Please try again later.',
        429: 'Too many requests. Please try again in a few moments.',
        500: 'An unexpected error occurred. Please try again later.'
      };
      
      return new Response(JSON.stringify({ error: statusMessages[response.status] || 'Request failed. Please try again later.' }), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Setup SSE streaming with enhanced events
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        let accumulated = '';
        const detectedModifications: string[] = [];

        try {
          // Send start event
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'start', sessionId })}\n\n`));

          const reader = response.body!.getReader();
          const decoder = new TextDecoder();

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n').filter(Boolean);

            for (const line of lines) {
              if (!line.startsWith('data:')) continue;
              
              const dataStr = line.replace('data:', '').trim();
              if (dataStr === '[DONE]') continue;

              try {
                const json = JSON.parse(dataStr);
                const delta = json?.choices?.[0]?.delta?.content || '';
                if (!delta) continue;

                accumulated += delta;
                
                // Send chunk event for streaming display
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'chunk', content: delta })}\n\n`));

                // Detect FILE_MODIFIED markers in real-time
                const fileModifiedMatches = accumulated.matchAll(/FILE_MODIFIED:\s*(.+?)\n/g);
                for (const match of fileModifiedMatches) {
                  const filePath = match[1].trim();
                  if (!detectedModifications.includes(filePath)) {
                    detectedModifications.push(filePath);
                    // Send file_detected event
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
                      type: 'file_detected', 
                      data: { path: filePath }
                    })}\n\n`));
                  }
                }
              } catch {
                // Ignore partial JSON
              }
            }
          }

          // Parse all modified files
          const updatedFiles = parseModifiedFiles(accumulated, existingFiles);

          // Update session in DB
          const { error: updateError } = await supabase
            .from('build_sessions')
            .update({ 
              project_files: updatedFiles,
              updated_at: new Date().toISOString() 
            })
            .eq('id', sessionId);

          if (updateError) {
            console.error('Error updating session:', updateError);
          }

          // Send completion event
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
            type: 'complete', 
            data: { 
              totalFiles: updatedFiles.length,
              modifiedFiles: detectedModifications 
            }
          })}\n\n`));
          controller.close();
        } catch (error) {
          console.error('Streaming error:', error);
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
            type: 'error', 
            data: { message: errorMessage }
          })}\n\n`));
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error('[modify-site] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Request failed. Please try again later.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
