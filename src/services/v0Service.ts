import { supabase } from '@/integrations/supabase/client';

export interface V0Chat {
  id: string;
  title?: string;
  createdAt: string;
  webUrl?: string;
  demoUrl?: string;
  messages?: V0Message[];
}

export interface V0Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

export interface V0Project {
  id: string;
  chatId: string;
  name: string;
  files: Record<string, string>;
  createdAt: string;
}

class V0Service {
  /**
   * Create a new V0 chat and associate it with a build session
   */
  async createChat(
    initialPrompt: string, 
    userId: string | null,
    projectType: 'website' | 'webapp' | 'mobile' = 'website'
  ): Promise<{ sessionId: string; v0ChatId: string } | null> {
    try {
      const { data: session } = await supabase.auth.getSession();
      
      // Create build session first
      const { data: buildSession, error: sessionError } = await supabase
        .from('build_sessions')
        .insert({
          user_id: userId,
          messages: [{ role: 'user', content: initialPrompt }],
          project_files: [],
          project_type: projectType,
          title: this.extractTitleFromPrompt(initialPrompt),
        })
        .select()
        .single();

      if (sessionError || !buildSession) {
        console.error('[V0Service] Error creating session:', sessionError);
        return null;
      }

      // Call v0-proxy to create a V0 chat
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/v0-proxy`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            prompt: initialPrompt,
            projectType,
            stream: false,
          }),
        }
      );

      if (!response.ok) {
        console.error('[V0Service] V0 proxy error:', response.status);
        // Return session anyway, V0 chat can be retried
        return { sessionId: buildSession.id, v0ChatId: '' };
      }

      const v0Data = await response.json();
      const v0ChatId = v0Data.chatId || v0Data.id || '';

      // Update build session with V0 chat ID
      if (v0ChatId) {
        await supabase
          .from('build_sessions')
          .update({ v0_chat_id: v0ChatId })
          .eq('id', buildSession.id);
      }

      return { sessionId: buildSession.id, v0ChatId };
    } catch (error) {
      console.error('[V0Service] createChat error:', error);
      return null;
    }
  }

  /**
   * Get chat history from a build session (local + V0)
   */
  async getChatHistory(sessionId: string): Promise<V0Chat | null> {
    try {
      const { data: session, error } = await supabase
        .from('build_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (error || !session) {
        console.error('[V0Service] Error fetching session:', error);
        return null;
      }

      // Convert local messages to V0 format
      const messages: V0Message[] = (session.messages as any[] || []).map((msg, index) => ({
        id: `local_${index}`,
        role: msg.role as 'user' | 'assistant',
        content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
        createdAt: session.created_at,
      }));

      return {
        id: session.v0_chat_id || session.id,
        title: session.title || undefined,
        createdAt: session.created_at,
        messages,
      };
    } catch (error) {
      console.error('[V0Service] getChatHistory error:', error);
      return null;
    }
  }

  /**
   * Send a message to an existing V0 chat
   */
  async sendMessage(
    chatId: string, 
    prompt: string,
    projectFiles?: Record<string, string>
  ): Promise<V0Message | null> {
    try {
      const { data: session } = await supabase.auth.getSession();
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/v0-proxy`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            prompt,
            chatId,
            projectFiles,
            stream: false,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || 'V0 API error');
      }

      const data = await response.json();
      
      return {
        id: data.messageId || data.id || `msg_${Date.now()}`,
        role: 'assistant',
        content: data.content || data.choices?.[0]?.message?.content || '',
        createdAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error('[V0Service] sendMessage error:', error);
      return null;
    }
  }

  /**
   * Get V0 usage stats for the current user
   */
  async getUsageStats(userId: string): Promise<{ chatsToday: number; limit: number } | null> {
    try {
      const { data, error } = await supabase
        .from('user_rate_limits')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) {
        // No rate limit entry yet = 0 usage
        return { chatsToday: 0, limit: 50 };
      }

      return {
        chatsToday: data.chats_today || 0,
        limit: 50, // Registered user limit
      };
    } catch (error) {
      console.error('[V0Service] getUsageStats error:', error);
      return null;
    }
  }

  /**
   * Check if user can create a new chat
   */
  async canCreateChat(userId: string | null): Promise<{ allowed: boolean; remaining: number; limit: number }> {
    const limits = {
      anonymous: 3,
      guest: 5,
      registered: 50,
    };

    if (!userId) {
      // Anonymous - we can't check server-side from here, let the proxy handle it
      return { allowed: true, remaining: limits.anonymous, limit: limits.anonymous };
    }

    const stats = await this.getUsageStats(userId);
    if (!stats) {
      return { allowed: true, remaining: limits.registered, limit: limits.registered };
    }

    const remaining = Math.max(0, stats.limit - stats.chatsToday);
    return {
      allowed: remaining > 0,
      remaining,
      limit: stats.limit,
    };
  }

  /**
   * Extract a short title from a prompt
   */
  private extractTitleFromPrompt(prompt: string): string {
    // Clean and truncate
    const cleaned = prompt
      .replace(/[\n\r]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    if (cleaned.length <= 50) return cleaned;
    
    // Try to cut at a word boundary
    const truncated = cleaned.substring(0, 50);
    const lastSpace = truncated.lastIndexOf(' ');
    return (lastSpace > 30 ? truncated.substring(0, lastSpace) : truncated) + '...';
  }
}

export const v0Service = new V0Service();
