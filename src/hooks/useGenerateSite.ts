import { useState, useRef, useCallback } from 'react';
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
}

// ============= Hook =============

export function useGenerateSite() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState('');

  const abortControllerRef = useRef<AbortController | null>(null);
  const timeoutRef = useRef<number | null>(null);

  const abort = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const generateSite = useCallback(async (
    params: GenerateSiteParams,
    options: UseGenerateSiteOptions = {}
  ): Promise<GenerateSiteResult | null> => {
    const { prompt, sessionId } = params;
    const { onProgress, onFiles, onTokens, onError, onComplete, onGenerationEvent } = options;

    setIsGenerating(true);
    setProgress('Starting generation...');

    // Émettre l'événement d'analyse initial
    onGenerationEvent?.({
      type: 'analyze',
      message: 'Analyse de votre demande...',
      status: 'in-progress'
    });

    // Create abort controller
    abortControllerRef.current = new AbortController();

    // Security timeout: 120 seconds (same as backend)
    timeoutRef.current = window.setTimeout(() => {
      console.warn('[useGenerateSite] Request timeout after 120 seconds');
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      onError?.('Generation timeout after 120 seconds');
    }, 120000);

    const startTime = Date.now();

    try {
      // Get auth token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      // Build request URL
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      if (!supabaseUrl) {
        throw new Error('VITE_SUPABASE_URL not configured');
      }
      const url = `${supabaseUrl}/functions/v1/generate-site`;

      console.log('[useGenerateSite] Starting generation:', {
        promptLength: prompt.length,
        sessionId,
      });

      // Make request
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          prompt,
          sessionId,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      // Parse SSE stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let finalResult: GenerateSiteResult | null = null;
      let accumulatedContent = '';

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          console.log('[useGenerateSite] Stream completed');
          break;
        }

        // Decode chunk and add to buffer
        buffer += decoder.decode(value, { stream: true });

        // Split on double newlines to get complete events
        const events = buffer.split('\n\n');

        // Keep last incomplete event in buffer
        buffer = events.pop() || '';

        // Process complete events
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
                  setProgress('🎨 Creating your site...');
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

                case 'stream':
                  if (data.data?.content) {
                    accumulatedContent += data.data.content;
                    onProgress?.(accumulatedContent);

                    // Update progress message based on content and emit events
                    if (accumulatedContent.includes('FILE: index.html') && !accumulatedContent.includes('FILE: styles.css')) {
                      setProgress('📄 Generating HTML structure...');
                      onGenerationEvent?.({
                        type: 'create',
                        file: 'index.html',
                        message: 'Création de la structure HTML...',
                        status: 'in-progress'
                      });
                    } else if (accumulatedContent.includes('FILE: styles.css') && !accumulatedContent.includes('FILE: script.js')) {
                      setProgress('🎨 Adding beautiful styles...');
                      onGenerationEvent?.({
                        type: 'create',
                        file: 'styles.css',
                        message: 'Application des styles CSS...',
                        status: 'in-progress'
                      });
                    } else if (accumulatedContent.includes('FILE: script.js')) {
                      setProgress('⚡ Creating interactions...');
                      onGenerationEvent?.({
                        type: 'create',
                        file: 'script.js',
                        message: 'Ajout des interactions JavaScript...',
                        status: 'in-progress'
                      });
                    }
                  }
                  break;

                case 'files':
                  console.log('[useGenerateSite] Files parsed:', {
                    count: Object.keys(data.data.files || {}).length,
                  });
                  if (data.data.files) {
                    // Émettre des événements de complétion pour chaque fichier
                    Object.keys(data.data.files).forEach(filePath => {
                      onGenerationEvent?.({
                        type: 'create',
                        file: filePath,
                        message: `Fichier créé: ${filePath}`,
                        status: 'completed'
                      });
                    });
                    onFiles?.(data.data.files);
                    setProgress('✅ Files created successfully');
                  }
                  break;

                case 'tokens':
                  console.log('[useGenerateSite] Tokens:', data.data);
                  if (data.data) {
                    onTokens?.(data.data);
                  }
                  break;

                case 'complete':
                  console.log('[useGenerateSite] Generation complete:', {
                    filesCount: Object.keys(data.data.files || {}).length,
                    tokens: data.data.tokens,
                  });

                  const duration = Date.now() - startTime;
                  finalResult = {
                    success: true,
                    files: data.data.files || {},
                    tokens: data.data.tokens || { input: 0, output: 0, total: 0 },
                    duration,
                  };

                  // Émettre l'événement de complétion
                  onGenerationEvent?.({
                    type: 'complete',
                    message: 'Site généré avec succès!',
                    status: 'completed'
                  });

                  onComplete?.(finalResult);
                  setProgress('✨ Site ready!');
                  break;

                case 'error':
                  console.error('[useGenerateSite] Error:', data.data.message);
                  onError?.(data.data.message || 'Unknown error');
                  setProgress('❌ Generation failed');
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

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

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
