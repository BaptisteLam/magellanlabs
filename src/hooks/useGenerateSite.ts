import { useState, useRef, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

// ============= Types =============

export interface GenerateSiteParams {
  prompt: string;
  sessionId: string;
}

export interface GeneratedFiles {
  [path: string]: string;
}

export interface GenerateSiteResult {
  success: boolean;
  files: GeneratedFiles;
  tokens: {
    input: number;
    output: number;
    total: number;
  };
  duration: number;
}

// Réutiliser le type de agent.ts pour la compatibilité
import { GenerationEvent } from '@/types/agent';
export type { GenerationEvent };

export interface UseGenerateSiteOptions {
  onProgress?: (content: string) => void;
  onFiles?: (files: GeneratedFiles) => void;
  onTokens?: (tokens: { input: number; output: number; total: number }) => void;
  onError?: (error: string) => void;
  onComplete?: (result: GenerateSiteResult) => void;
  onGenerationEvent?: (event: GenerationEvent) => void;
  onProjectName?: (name: string) => void;
  onPreviewUrl?: (url: string) => void;
}

// ============= WebSocket File Collector =============

/**
 * Connect to VibeSDK WebSocket and collect generated files.
 * Protocol:
 * - Send { type: "generate_all" } on connect (for new builds)
 * - Listen for file_generated / file_regenerated events
 * - On generation_complete, send { type: "preview" } to request deployment
 * - Resolve on deployment_completed (with previewURL) or generation_complete (if already has previewURL)
 */
function collectFilesViaWebSocket(
  wsUrl: string,
  ticket: string,
  isFollowUp: boolean,
  onFileGenerated?: (filePath: string) => void,
  onPhaseUpdate?: (message: string) => void,
  onAbort?: AbortSignal,
  onGenerationEvent?: (event: GenerationEvent) => void,
): Promise<{
  files: GeneratedFiles;
  previewUrl?: string;
  projectName?: string;
}> {
  return new Promise((resolve, reject) => {
    const files: GeneratedFiles = {};
    let previewUrl: string | undefined;
    let projectName: string | undefined;
    let resolved = false;

    const fullUrl = `${wsUrl}?ticket=${ticket}`;
    console.log(`[useGenerateSite] Connecting to WebSocket: ${wsUrl.substring(0, 60)}...`);

    const ws = new WebSocket(fullUrl);

    // 3-minute timeout for generation
    let subTimeout: ReturnType<typeof setTimeout> | null = null;
    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        if (subTimeout) clearTimeout(subTimeout);
        console.warn(`[useGenerateSite] WebSocket timeout, returning ${Object.keys(files).length} files`);
        try { ws.close(); } catch { /* ignore */ }
        resolve({ files, previewUrl, projectName });
      }
    }, 180_000);

    // Handle abort signal
    if (onAbort) {
      onAbort.addEventListener('abort', () => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          if (subTimeout) clearTimeout(subTimeout);
          try { ws.close(); } catch { /* ignore */ }
          reject(new DOMException('Aborted', 'AbortError'));
        }
      });
    }

    ws.onopen = () => {
      console.log('[useGenerateSite] WebSocket connected');
      if (!isFollowUp) {
        ws.send(JSON.stringify({ type: 'generate_all' }));
        console.log('[useGenerateSite] Sent generate_all');
      }
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(typeof event.data === 'string' ? event.data : '');

        switch (msg.type) {
          case 'agent_connected': {
            const state = msg.state || msg;
            if (state.generatedFilesMap && typeof state.generatedFilesMap === 'object') {
              for (const [path, fileObj] of Object.entries(state.generatedFilesMap)) {
                const content = typeof fileObj === 'string'
                  ? fileObj
                  : (fileObj as any)?.fileContents || '';
                if (content) {
                  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
                  files[normalizedPath] = content;
                }
              }
              console.log(`[useGenerateSite] agent_connected: ${Object.keys(state.generatedFilesMap).length} existing files`);
            }
            if (state.previewUrl) previewUrl = state.previewUrl;
            break;
          }

          case 'generation_started':
            console.log(`[useGenerateSite] Generation started: ${msg.totalFiles || '?'} files`);
            onPhaseUpdate?.(`Génération de ${msg.totalFiles || 'plusieurs'} fichiers...`);
            onGenerationEvent?.({
              type: 'plan',
              message: `Génération de ${msg.totalFiles || 'plusieurs'} fichiers...`,
              status: 'in-progress',
            });
            break;

          case 'file_generating':
            console.log(`[useGenerateSite] Generating: ${msg.filePath}`);
            onFileGenerated?.(msg.filePath);
            onGenerationEvent?.({
              type: 'write',
              file: msg.filePath,
              message: `Génération: ${msg.filePath}`,
              status: 'in-progress',
            });
            break;

          case 'file_generated':
          case 'file_regenerated': {
            const file = msg.file;
            if (file?.filePath && file?.fileContents) {
              const normalizedPath = file.filePath.startsWith('/') ? file.filePath : `/${file.filePath}`;
              files[normalizedPath] = file.fileContents;
              console.log(`[useGenerateSite] File ready: ${normalizedPath} (${file.fileContents.length} chars)`);
              onFileGenerated?.(normalizedPath);
              onGenerationEvent?.({
                type: 'create',
                file: normalizedPath,
                message: `Fichier créé: ${normalizedPath}`,
                status: 'completed',
              });
            }
            break;
          }

          case 'project_name_updated':
            if (msg.projectName) projectName = msg.projectName;
            break;

          case 'generation_complete': {
            console.log(`[useGenerateSite] Generation complete! ${Object.keys(files).length} files`);
            if (msg.previewURL) previewUrl = msg.previewURL;

            if (previewUrl) {
              // Already have a previewUrl from generation_complete, resolve immediately
              if (!resolved) {
                resolved = true;
                clearTimeout(timeout);
                try { ws.close(); } catch { /* ignore */ }
                resolve({ files, previewUrl, projectName });
              }
            } else {
              // Request preview deployment from VibeSDK to get a previewUrl
              try {
                ws.send(JSON.stringify({ type: 'preview' }));
                console.log('[useGenerateSite] Sent preview request, waiting for deployment_completed...');
                // Set a 30-second sub-timeout for the preview deployment
                subTimeout = setTimeout(() => {
                  if (!resolved) {
                    resolved = true;
                    clearTimeout(timeout);
                    console.warn('[useGenerateSite] Preview deployment timeout, resolving without previewUrl');
                    try { ws.close(); } catch { /* ignore */ }
                    resolve({ files, previewUrl, projectName });
                  }
                }, 30_000);
              } catch {
                // If sending fails, resolve with files we have
                if (!resolved) {
                  resolved = true;
                  clearTimeout(timeout);
                  try { ws.close(); } catch { /* ignore */ }
                  resolve({ files, previewUrl, projectName });
                }
              }
            }
            break;
          }

          case 'deployment_completed':
            if (msg.previewURL) previewUrl = msg.previewURL;
            console.log('[useGenerateSite] Deployment completed! previewUrl:', previewUrl);
            if (!resolved) {
              resolved = true;
              clearTimeout(timeout);
              try { ws.close(); } catch { /* ignore */ }
              resolve({ files, previewUrl, projectName });
            }
            break;

          case 'error':
          case 'rate_limit_error':
            console.error(`[useGenerateSite] WebSocket error: ${msg.error || JSON.stringify(msg)}`);
            break;

          case 'phase_generating':
            onPhaseUpdate?.(`Phase: ${msg.phase?.name || msg.message || 'Planning...'}`);
            onGenerationEvent?.({
              type: 'plan',
              message: msg.phase?.name || msg.message || 'Planning...',
              status: 'in-progress',
            });
            break;
          case 'phase_implementing':
            onPhaseUpdate?.(`Implémentation: ${msg.phase?.name || msg.message || '...'}`);
            onGenerationEvent?.({
              type: 'write',
              message: msg.phase?.name || msg.message || 'Implementing...',
              status: 'in-progress',
            });
            break;
          case 'phase_validated':
            onPhaseUpdate?.(`Validé: ${msg.phase?.name || msg.message || '...'}`);
            onGenerationEvent?.({
              type: 'edit',
              message: msg.phase?.name || msg.message || 'Validated',
              status: 'completed',
            });
            break;

          default:
            break;
        }
      } catch (e) {
        console.warn('[useGenerateSite] Failed to parse WS message:', e);
      }
    };

    ws.onerror = (err) => {
      console.error('[useGenerateSite] WebSocket error:', err);
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        resolve({ files, previewUrl, projectName });
      }
    };

    ws.onclose = () => {
      console.log(`[useGenerateSite] WebSocket closed, ${Object.keys(files).length} files`);
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        resolve({ files, previewUrl, projectName });
      }
    };
  });
}

// ============= Hook =============

export function useGenerateSite() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState('');

  const abortControllerRef = useRef<AbortController | null>(null);

  const abort = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  // Cleanup: abort generation on component unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, []);

  const generateSite = useCallback(async (
    params: GenerateSiteParams,
    options: UseGenerateSiteOptions = {}
  ): Promise<GenerateSiteResult | null> => {
    const { prompt, sessionId } = params;
    const { onProgress, onFiles, onTokens, onError, onComplete, onGenerationEvent, onProjectName, onPreviewUrl } = options;

    setIsGenerating(true);
    setProgress('Démarrage de la génération...');

    onGenerationEvent?.({
      type: 'analyze',
      message: 'Analyse de votre demande...',
      status: 'in-progress'
    });

    abortControllerRef.current = new AbortController();

    const startTime = Date.now();

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      if (!supabaseUrl) {
        throw new Error('VITE_SUPABASE_URL not configured');
      }
      const url = `${supabaseUrl}/functions/v1/vibesdk-chat`;

      console.log('[useGenerateSite] Starting generation:', {
        promptLength: prompt.length,
        sessionId,
      });

      // Step 1: Call edge function to create agent + get WS ticket
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ prompt, sessionId }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      // Step 2: Parse SSE stream from edge function
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let finalResult: GenerateSiteResult | null = null;
      let accumulatedContent = '';

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          console.log('[useGenerateSite] SSE stream completed');
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() || '';

        for (const eventStr of events) {
          if (!eventStr.trim()) continue;

          const lines = eventStr.split('\n');

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;

            const dataStr = line.slice(6);

            try {
              const data = JSON.parse(dataStr);

              switch (data.type) {
                case 'start':
                  console.log('[useGenerateSite] Generation started:', data.data);
                  setProgress('🎨 Création de votre site...');
                  onGenerationEvent?.({
                    type: 'analyze',
                    message: 'Analyse de votre demande...',
                    status: 'completed'
                  });
                  onGenerationEvent?.({
                    type: 'thought',
                    message: 'Génération du code en cours...',
                    status: 'in-progress'
                  });
                  break;

                case 'ws_connect': {
                  // ===== KEY EVENT: Connect to VibeSDK WebSocket =====
                  const { wsUrl, ticket, agentId, isFollowUp } = data.data;
                  console.log(`[useGenerateSite] Connecting to VibeSDK WebSocket (agent: ${agentId})`);
                  setProgress('🔌 Connexion à VibeSDK...');

                  onGenerationEvent?.({
                    type: 'thought',
                    message: 'Connexion au serveur de génération...',
                    status: 'completed'
                  });

                  onGenerationEvent?.({
                    type: 'write',
                    message: 'Génération des fichiers en cours...',
                    status: 'in-progress'
                  });

                  try {
                    const wsResult = await collectFilesViaWebSocket(
                      wsUrl,
                      ticket,
                      isFollowUp,
                      (filePath) => {
                        setProgress(`📄 ${filePath}`);
                      },
                      (message) => {
                        setProgress(`⚡ ${message}`);
                      },
                      abortControllerRef.current?.signal,
                      onGenerationEvent,
                    );

                    const { files, previewUrl, projectName } = wsResult;

                    // Notify with previewUrl if available
                    if (previewUrl) {
                      console.log('[useGenerateSite] Preview URL from VibeSDK:', previewUrl);
                      onPreviewUrl?.(previewUrl);
                    }

                    if (Object.keys(files).length > 0) {
                      console.log(`[useGenerateSite] Got ${Object.keys(files).length} files from WebSocket`);

                      onFiles?.(files);
                      setProgress('✅ Fichiers créés avec succès');

                      if (projectName) {
                        onProjectName?.(projectName);
                      }

                      const duration = Date.now() - startTime;
                      finalResult = {
                        success: true,
                        files,
                        tokens: { input: 0, output: 0, total: 0 },
                        duration,
                      };

                      onGenerationEvent?.({
                        type: 'complete',
                        message: 'Site généré avec succès!',
                        status: 'completed'
                      });

                      onComplete?.(finalResult);
                      setProgress('✨ Site prêt !');

                      // Save files to DB
                      try {
                        await supabase
                          .from('build_sessions')
                          .update({
                            project_files: files,
                            updated_at: new Date().toISOString(),
                          })
                          .eq('id', sessionId);
                      } catch (dbError) {
                        console.warn('[useGenerateSite] Failed to save files to DB:', dbError);
                      }
                    } else {
                      console.warn('[useGenerateSite] No files from WebSocket');
                      onError?.('Aucun fichier généré. Veuillez réessayer.');
                      setProgress('❌ Aucun fichier généré');
                    }
                  } catch (wsError) {
                    if (wsError instanceof DOMException && wsError.name === 'AbortError') {
                      throw wsError;
                    }
                    console.error('[useGenerateSite] WebSocket error:', wsError);
                    onError?.(`WebSocket error: ${wsError instanceof Error ? wsError.message : 'Unknown'}`);
                    setProgress('❌ Connexion échouée');
                  }
                  break;
                }

                case 'stream':
                  if (data.data?.content) {
                    accumulatedContent += data.data.content;
                    onProgress?.(accumulatedContent);
                  }
                  break;

                case 'files':
                  console.log('[useGenerateSite] Files parsed:', {
                    count: Object.keys(data.data.files || {}).length,
                  });
                  if (data.data.files) {
                    Object.keys(data.data.files).forEach(filePath => {
                      onGenerationEvent?.({
                        type: 'create',
                        file: filePath,
                        message: `Fichier créé: ${filePath}`,
                        status: 'completed'
                      });
                    });
                    onFiles?.(data.data.files);
                    setProgress('✅ Fichiers créés avec succès');
                  }
                  break;

                case 'tokens':
                  if (data.data) {
                    onTokens?.(data.data);
                  }
                  break;

                case 'complete':
                  if (!finalResult) {
                    const duration = Date.now() - startTime;
                    finalResult = {
                      success: true,
                      files: data.data.files || {},
                      tokens: data.data.tokens || { input: 0, output: 0, total: 0 },
                      duration,
                    };

                    onGenerationEvent?.({
                      type: 'complete',
                      message: 'Site généré avec succès!',
                      status: 'completed'
                    });

                    onComplete?.(finalResult);
                    setProgress('✨ Site prêt !');
                  }
                  break;

                case 'generation_event':
                  if (data.data) {
                    onGenerationEvent?.(data.data);
                  }
                  break;

                case 'project_name':
                  if (data.data?.name) {
                    onProjectName?.(data.data.name);
                  }
                  break;

                case 'credits':
                  console.log('[useGenerateSite] Credits:', data.data);
                  break;

                case 'error':
                  console.error('[useGenerateSite] Error:', data.data.message);
                  onError?.(data.data.message || 'Unknown error');
                  setProgress('❌ Génération échouée');
                  break;

                default:
                  console.log('[useGenerateSite] Unknown event:', data.type);
              }
            } catch (parseError) {
              console.error('[useGenerateSite] Failed to parse event:', parseError, dataStr);
            }
          }
        }
      }

      return finalResult;

    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          console.log('[useGenerateSite] Request aborted');
          setProgress('Cancelled');
        } else {
          console.error('[useGenerateSite] Error:', error);
          onError?.(error.message);
          setProgress('Failed');
        }
      } else {
        console.error('[useGenerateSite] Unknown error:', error);
        onError?.('Unknown error occurred');
        setProgress('Failed');
      }
      return null;

    } finally {
      setIsGenerating(false);
      abortControllerRef.current = null;
    }
  }, []);

  return {
    generateSite,
    abort,
    isGenerating,
    progress,
  };
}

export default useGenerateSite;
