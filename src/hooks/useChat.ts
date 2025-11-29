import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface Message {
  role: 'user' | 'assistant';
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
  token_count?: number;
  id?: string;
  created_at?: string;
  metadata?: {
    type?: 'intro' | 'recap';
    generation_events?: any[];
    files_updated?: number;
    new_files?: string[];
    modified_files?: string[];
    project_files?: Record<string, string>;
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
    attachedFiles?: Array<{ name: string; base64: string; type: string }>;
    [key: string]: any;
  };
}

export function useChat(sessionId?: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [attachedFiles, setAttachedFiles] = useState<Array<{ name: string; base64: string; type: string }>>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (sessionId) {
      loadMessages();
    }
  }, [sessionId]);

  const loadMessages = async () => {
    if (!sessionId) return;

    try {
      const { data: chatMessages, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });

      if (!error && chatMessages && chatMessages.length > 0) {
        const loadedMessages: Message[] = chatMessages.map(msg => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
          token_count: msg.token_count ?? undefined,
          id: msg.id,
          created_at: msg.created_at,
          metadata: msg.metadata as any
        }));
        setMessages(loadedMessages);

        // Extraire les images attachées du premier message
        const firstUserMessage = loadedMessages.find(m => m.role === 'user');
        if (firstUserMessage?.metadata?.attachedFiles) {
          setAttachedFiles(firstUserMessage.metadata.attachedFiles);
        }
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const addMessage = (message: Message) => {
    setMessages(prev => [...prev, message]);
  };

  const updateLastMessage = (updates: Partial<Message>) => {
    setMessages(prev => {
      const newMessages = [...prev];
      const lastIndex = newMessages.length - 1;
      if (lastIndex >= 0) {
        newMessages[lastIndex] = { ...newMessages[lastIndex], ...updates };
      }
      return newMessages;
    });
  };

  const saveMessagesToDb = async () => {
    if (!sessionId) return;

    try {
      // Supprimer les anciens messages
      await supabase
        .from('chat_messages')
        .delete()
        .eq('session_id', sessionId);

      // Insérer les nouveaux messages
      const messagesData = messages.map(msg => ({
        session_id: sessionId,
        role: msg.role,
        content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
        token_count: msg.token_count ?? null,
        metadata: msg.metadata ?? null
      }));

      if (messagesData.length > 0) {
        const { error } = await supabase
          .from('chat_messages')
          .insert(messagesData);

        if (error) {
          console.error('Error saving messages:', error);
        }
      }
    } catch (error) {
      console.error('Error in saveMessagesToDb:', error);
    }
  };

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  return {
    messages,
    setMessages,
    attachedFiles,
    setAttachedFiles,
    chatEndRef,
    addMessage,
    updateLastMessage,
    saveMessagesToDb,
    scrollToBottom
  };
}
