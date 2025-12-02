import { supabase } from '@/lib/supabase/client';
import { toast as sonnerToast } from 'sonner';
import type { Message } from '@/pages/BuilderSession';
import type { ASTModification } from '@/types/ast';

interface GenerationOptions {
  sessionId: string;
  user: any;
  projectFiles: Record<string, string>;
  memory: any;
  updateMemory: (changes: any[], issues: any[]) => Promise<void>;
  updateFiles: (files: Record<string, string>, immediate?: boolean) => Promise<void>;
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  setGenerationEvents: React.Dispatch<React.SetStateAction<any[]>>;
  generationEventsRef: React.MutableRefObject<any[]>;
  setGeneratedHtml: (html: string) => void;
  setSelectedFile: (path: string | null) => void;
  setSelectedFileContent: (content: string) => void;
  selectedFile: string | null;
  setUser: React.Dispatch<React.SetStateAction<any>>;
  captureThumbnail: (html: string) => Promise<void>;
  setViewMode: (mode: 'preview' | 'code' | 'analytics') => void;
  viewMode: 'preview' | 'code' | 'analytics';
  setIsInitialGeneration?: (value: boolean) => void;
  isInitialGenerationRef?: React.MutableRefObject<boolean>;
  initialPromptProcessed: boolean;
  setInitialPromptProcessed: (value: boolean) => void;
  isFirstGeneration: boolean;
}

/**
 * Fonction unifiée pour gérer toutes les générations/modifications
 * Combine le meilleur d'Agent-V2 et Modify-Site
 */
export async function handleUnifiedGeneration(
  userPrompt: string,
  attachedFiles: Array<{ name: string; base64: string; type: string }>,
  unifiedModify: any,
  options: GenerationOptions
) {
  const {
    sessionId,
    user,
    projectFiles,
    memory,
    updateMemory,
    updateFiles,
    setMessages,
    setGenerationEvents,
    generationEventsRef,
    setGeneratedHtml,
    setSelectedFile,
    setSelectedFileContent,
    selectedFile,
    setUser,
    captureThumbnail,
    setViewMode,
    viewMode,
    setIsInitialGeneration,
    isInitialGenerationRef,
    initialPromptProcessed,
    setInitialPromptProcessed,
    isFirstGeneration
  } = options;

  // Construire le message utilisateur
  let userMessageContent: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;

  if (attachedFiles.length > 0) {
    const contentArray: Array<{ type: string; text?: string; image_url?: { url: string } }> = [];
    if (userPrompt) {
      contentArray.push({ type: 'text', text: userPrompt });
    }
    attachedFiles.forEach(file => {
      contentArray.push({
        type: 'image_url',
        image_url: { url: file.base64 }
      });
    });
    userMessageContent = contentArray;
  } else {
    userMessageContent = userPrompt;
  }

  // Ajouter le message utilisateur
  const userMessage: Message = {
    role: 'user',
    content: userMessageContent,
    created_at: new Date().toISOString()
  };

  setMessages(prev => {
    const lastMessage = prev[prev.length - 1];
    const isUserMessageAlreadyAdded = lastMessage &&
      lastMessage.role === 'user' &&
      lastMessage.content === userMessageContent;

    if (isUserMessageAlreadyAdded) {
      return prev;
    }
    return [...prev, userMessage];
  });

  // Sauvegarder le message utilisateur dans la DB
  await supabase.from('chat_messages').insert({
    session_id: sessionId,
    role: 'user',
    content: typeof userMessageContent === 'string' ? userMessageContent : '[message multimédia]',
    created_at: new Date().toISOString(),
    token_count: 0,
    metadata: {
      has_images: attachedFiles.length > 0,
      attachedFiles: attachedFiles.length > 0 ? attachedFiles : undefined
    }
  });

  // Créer le message de génération initial
  const introMessage: Message = {
    role: 'assistant',
    content: "Je vais analyser votre demande...",
    created_at: new Date().toISOString(),
    metadata: {
      type: 'generation',
      thought_duration: 0,
      intent_message: 'Analyzing...',
      generation_events: [],
      files_modified: 0,
      modified_files: [],
      total_tokens: 0
    }
  };

  setMessages(prev => [...prev, introMessage]);

  // Réinitialiser les événements
  setGenerationEvents([]);
  generationEventsRef.current = [];
  const generationStartTime = Date.now();

  // ═══════════════════════════════════════════════════════════
  // FLAG LOADING PREVIEW: Seulement pour la PREMIÈRE génération
  // ═══════════════════════════════════════════════════════════
  if (isFirstGeneration && !initialPromptProcessed && setIsInitialGeneration) {
    console.log('🎬 PREMIÈRE GÉNÉRATION - Activation loading preview');
    setIsInitialGeneration(true);
    if (isInitialGenerationRef) isInitialGenerationRef.current = true;
    setInitialPromptProcessed(true);
  } else {
    console.log('🔄 GÉNÉRATION ULTÉRIEURE - Pas de loading preview');
  }

  // Analyser la complexité
  const { analyzeIntentDetailed } = await import('@/utils/intentAnalyzer');
  const analysis = analyzeIntentDetailed(userPrompt, projectFiles);
  console.log(`📊 Complexity: ${analysis.complexity}, Score: ${analysis.score}`);

  const complexity = analysis.complexity as 'trivial' | 'simple' | 'complex';

  // Variables pour collecter les résultats
  let modifications: ASTModification[] = [];
  let receivedTokens = { input_tokens: 0, output_tokens: 0, total_tokens: 0 };
  const updatedFiles: Record<string, string> = { ...projectFiles };

  // ═══════════════════════════════════════════════════════════
  // APPEL SYSTÈME UNIFIÉ
  // ═══════════════════════════════════════════════════════════
  await unifiedModify.modifySite(
    userPrompt,
    projectFiles,
    sessionId,
    complexity,
    memory,
    {
      onGenerationEvent: (event: any) => {
        console.log('🔄 Generation event:', event);
        generationEventsRef.current = [...generationEventsRef.current, event];
        setGenerationEvents(prev => [...prev, event]);

        // Mettre à jour le message de génération
        setMessages(prev => {
          const lastMessage = prev[prev.length - 1];
          if (lastMessage && lastMessage.metadata?.type === 'generation') {
            return prev.map((msg, idx) =>
              idx === prev.length - 1
                ? {
                    ...msg,
                    metadata: {
                      ...msg.metadata,
                      generation_events: [...(msg.metadata.generation_events || []), event]
                    }
                  }
                : msg
            );
          }
          return prev;
        });
      },

      onMessage: (content: string) => {
        // Message conversationnel streamé
        console.log('💬 Message chunk:', content);
      },

      onTokens: (tokens: any) => {
        receivedTokens = tokens;
        console.log('💰 Tokens received:', tokens);
      },

      onASTModifications: async (mods: ASTModification[]) => {
        console.log(`⚡ Received ${mods.length} AST modifications`);
        modifications = mods;

        if (modifications.length === 0) {
          console.warn('⚠️ No modifications received');
          sonnerToast.error('Aucune modification générée');
          return;
        }

        // ═══════════════════════════════════════════════════════════
        // APPLICATION DES MODIFICATIONS AST
        // ═══════════════════════════════════════════════════════════
        try {
          const { applyModificationsToFiles } = await import('@/services/ast/astModifier');
          const result = await applyModificationsToFiles(projectFiles, modifications);

          if (!result.success) {
            console.error('❌ Failed to apply modifications:', result.errors);
            sonnerToast.error('Échec de l\'application des modifications');
            return;
          }

          // Mettre à jour les fichiers
          Object.assign(updatedFiles, result.updatedFiles);

          const modifiedFilesList = Object.keys(result.updatedFiles).filter(
            path => result.updatedFiles[path] !== projectFiles[path]
          );

          console.log('✅ AST modifications applied:', modifiedFilesList);

          // Mettre à jour la preview si index.html modifié
          if (result.updatedFiles['index.html']) {
            setGeneratedHtml(result.updatedFiles['index.html']);
          }

          // ═══════════════════════════════════════════════════════════
          // VALIDATION & SAUVEGARDE
          // ═══════════════════════════════════════════════════════════

          // Mettre à jour la mémoire du projet
          const codeChanges = modifiedFilesList.map(path => ({
            path,
            type: (projectFiles[path] ? 'modify' : 'create') as 'create' | 'modify' | 'delete',
            description: `Updated ${path}`
          }));

          if (codeChanges.length > 0) {
            try {
              await updateMemory(codeChanges, []);
              console.log('✅ Memory updated');
            } catch (memError) {
              console.warn('⚠️ Failed to update memory:', memError);
            }
          }

          // Sauvegarder les fichiers
          await updateFiles(result.updatedFiles, true);

          // Mettre à jour build_sessions
          await supabase
            .from('build_sessions')
            .update({
              project_files: result.updatedFiles,
              updated_at: new Date().toISOString()
            })
            .eq('id', sessionId);

          // Capturer thumbnail
          if (result.updatedFiles['index.html']) {
            await captureThumbnail(result.updatedFiles['index.html']);
          }

          // Générer le message de conclusion
          const generationDuration = Date.now() - generationStartTime;
          const newFiles = modifiedFilesList.filter(path => !projectFiles[path]);
          const modifiedFiles = modifiedFilesList.filter(path => projectFiles[path]);

          const conclusionMessage = modifiedFiles.length > 0
            ? `${modifiedFiles.length} fichier${modifiedFiles.length > 1 ? 's' : ''} modifié${modifiedFiles.length > 1 ? 's' : ''} avec succès.`
            : `${newFiles.length} fichier${newFiles.length > 1 ? 's' : ''} créé${newFiles.length > 1 ? 's' : ''} avec succès.`;

          // Sauvegarder le message de génération
          const { data: insertedMessage } = await supabase
            .from('chat_messages')
            .insert([{
              session_id: sessionId,
              role: 'assistant',
              content: conclusionMessage,
              token_count: receivedTokens.total_tokens,
              created_at: new Date().toISOString(),
              metadata: {
                type: 'generation' as const,
                thought_duration: generationDuration,
                generation_events: generationEventsRef.current,
                files_modified: modifiedFilesList.length,
                modified_files: modifiedFilesList,
                project_files: result.updatedFiles,
                input_tokens: receivedTokens.input_tokens,
                output_tokens: receivedTokens.output_tokens,
                total_tokens: receivedTokens.total_tokens,
                saved_at: new Date().toISOString()
              }
            }])
            .select()
            .single();

          // Mettre à jour l'interface
          setMessages(prev => {
            const withoutTemp = prev.filter(m => !(m.role === 'assistant' && !m.id));

            return [
              ...withoutTemp,
              {
                role: 'assistant' as const,
                content: conclusionMessage,
                token_count: receivedTokens.total_tokens,
                id: insertedMessage?.id,
                created_at: new Date().toISOString(),
                metadata: {
                  type: 'generation' as const,
                  thought_duration: generationDuration,
                  generation_events: generationEventsRef.current,
                  files_modified: modifiedFilesList.length,
                  modified_files: modifiedFilesList,
                  project_files: result.updatedFiles,
                  input_tokens: receivedTokens.input_tokens,
                  output_tokens: receivedTokens.output_tokens,
                  total_tokens: receivedTokens.total_tokens
                }
              }
            ];
          });

          // Décompter les tokens
          if (user?.id && receivedTokens.total_tokens > 0) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('tokens_used')
              .eq('id', user.id)
              .single();

            if (profile) {
              const newTokensUsed = (profile.tokens_used || 0) + receivedTokens.total_tokens;

              await supabase
                .from('profiles')
                .update({ tokens_used: newTokensUsed })
                .eq('id', user.id);

              setUser((prev: any) => ({
                ...prev,
                tokens_used: newTokensUsed
              }));
            }
          }

          // ═══════════════════════════════════════════════════════════
          // SEULEMENT MAINTENANT: Désactiver loading preview
          // ═══════════════════════════════════════════════════════════
          setTimeout(() => {
            if (setIsInitialGeneration && isInitialGenerationRef) {
              setIsInitialGeneration(false);
              isInitialGenerationRef.current = false;
            }

            if (viewMode !== 'preview') {
              setViewMode('preview');
            }
          }, 300);

          sonnerToast.success('Modifications appliquées !');

        } catch (error: any) {
          console.error('❌ Error applying modifications:', error);
          sonnerToast.error(`Erreur: ${error.message}`);
        }
      },

      onError: (error: string) => {
        console.error('❌ Generation error:', error);
        sonnerToast.error(`Erreur: ${error}`);

        if (setIsInitialGeneration && isInitialGenerationRef) {
          setIsInitialGeneration(false);
          isInitialGenerationRef.current = false;
        }
      }
    }
  );
}
