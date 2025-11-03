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

interface FileDiff {
  file: string;
  change_type: 'replace' | 'insert' | 'delete' | 'full';
  old_text?: string;
  new_text?: string;
  full_content?: string;
}

// Applique les diffs sur les fichiers existants
function applyDiffs(existingFiles: ProjectFile[], diffs: FileDiff[]): ProjectFile[] {
  const filesMap = new Map(existingFiles.map(f => [f.path, f]));
  
  for (const diff of diffs) {
    const existingFile = filesMap.get(diff.file);
    
    if (diff.change_type === 'full' && diff.full_content) {
      // Remplacement complet du fichier
      filesMap.set(diff.file, {
        path: diff.file,
        content: diff.full_content,
        type: getFileType(diff.file.split('.').pop() || 'txt')
      });
    } else if (diff.change_type === 'replace' && diff.old_text && diff.new_text) {
      // Remplacement d'une portion
      if (existingFile) {
        const newContent = existingFile.content.replace(diff.old_text, diff.new_text);
        filesMap.set(diff.file, { ...existingFile, content: newContent });
      }
    }
  }
  
  return Array.from(filesMap.values());
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
    const chatHistoryArray: ChatMessage[] = Array.isArray(chatHistory) ? chatHistory : [];

    // Contexte minimal optimisé
    const mainFile = existingFiles.find(f => f.path === 'index.html') || existingFiles[0];
    const fileContext = mainFile ? `Extrait du fichier ${mainFile.path}:\n${mainFile.content.substring(0, 800)}...` : '';

    const systemPrompt = `Tu es un expert en modification de code. Tu dois renvoyer UNIQUEMENT les modifications nécessaires sous forme de DIFFS.

FORMAT DE RÉPONSE (JSON uniquement):
{
  "diffs": [
    {
      "file": "index.html",
      "change_type": "replace",
      "old_text": "texte exact à remplacer",
      "new_text": "nouveau texte"
    }
  ]
}

RÈGLES:
1. Utilise "replace" pour de petites modifications (bouton, couleur, texte)
2. Utilise "full" avec "full_content" pour de grandes modifications (refonte complète)
3. Retourne UNIQUEMENT du JSON valide, pas de markdown
4. Sois PRÉCIS avec old_text (copie exact)`;

    const messages: any[] = [
      { role: 'system', content: systemPrompt }
    ];

    // Ajouter historique de conversation
    chatHistoryArray.slice(-3).forEach(msg => {
      messages.push({ role: msg.role, content: msg.content });
    });

    // Ajouter la nouvelle demande avec contexte
    messages.push({
      role: 'user',
      content: `${fileContext}\n\nModification: ${message}`
    });

    // Stream from OpenRouter avec Claude Sonnet 4.5
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openRouterKey}`,
        'HTTP-Referer': 'https://trinitystudio.ai',
        'X-Title': 'Trinity Studio AI',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'anthropic/claude-sonnet-4.5',
        messages,
        stream: true,
        max_tokens: 4000,
        temperature: 0.7,
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
                
                // Send token-by-token streaming
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'token', content: delta })}\n\n`));

                // Tenter de parser le JSON progressivement
                try {
                  const cleanedJson = accumulated.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
                  const parsedDiffs = JSON.parse(cleanedJson);
                  
                  if (parsedDiffs.diffs && Array.isArray(parsedDiffs.diffs)) {
                    // Diffs détectés et valides
                    for (const diff of parsedDiffs.diffs) {
                      if (diff.file && !detectedModifications.includes(diff.file)) {
                        detectedModifications.push(diff.file);
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
                          type: 'file_detected', 
                          data: { path: diff.file, changeType: diff.change_type }
                        })}\n\n`));
                      }
                    }
                  }
                } catch {
                  // JSON incomplet, continuer à accumuler
                }
              } catch {
                // Ignore partial JSON
              }
            }
          }

          // Parsing final des diffs
          let finalDiffs: FileDiff[] = [];
          try {
            const cleanedJson = accumulated.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
            const parsed = JSON.parse(cleanedJson);
            finalDiffs = parsed.diffs || [];
          } catch (e) {
            console.error('Failed to parse diffs:', e);
            // Fallback: traiter comme modification complète
            if (accumulated.includes('<!DOCTYPE html>') || accumulated.includes('<html')) {
              finalDiffs = [{
                file: 'index.html',
                change_type: 'full',
                full_content: accumulated
              }];
            }
          }

          // Appliquer les diffs
          const updatedFiles = finalDiffs.length > 0 
            ? applyDiffs(existingFiles, finalDiffs)
            : existingFiles;

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

          // Send completion event avec diffs appliqués
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
            type: 'complete', 
            data: { 
              diffs: finalDiffs,
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
