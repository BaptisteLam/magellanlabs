import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Progress } from '@/components/ui/progress';
import { Coins } from 'lucide-react';

interface TokenCounterProps {
  isDark: boolean;
  userId?: string;
}

export function TokenCounter({ isDark, userId }: TokenCounterProps) {
  const [tokensUsed, setTokensUsed] = useState(0);
  const [tokensQuota, setTokensQuota] = useState(1000000);

  useEffect(() => {
    if (!userId) return;

    const fetchTokenData = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('tokens_used, tokens_quota')
        .eq('id', userId)
        .maybeSingle();

      if (data && !error) {
        setTokensUsed(data.tokens_used || 0);
        setTokensQuota(data.tokens_quota || 1000000);
      }
    };

    fetchTokenData();

    // Écouter les changements en temps réel
    const channel = supabase
      .channel('token-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${userId}`,
        },
        (payload) => {
          if (payload.new) {
            setTokensUsed(payload.new.tokens_used || 0);
            setTokensQuota(payload.new.tokens_quota || 1000000);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const formatTokenCount = (count: number): string => {
    if (count >= 1000000) {
      return `${Math.floor(count / 1000000)}M`;
    } else if (count >= 1000) {
      return `${Math.floor(count / 1000)}k`;
    }
    return count.toString();
  };

  const tokensRemaining = tokensQuota - tokensUsed;
  const progressPercentage = (tokensRemaining / tokensQuota) * 100;

  return (
    <div
      className="flex items-center gap-2.5 px-4 py-2 rounded-full border"
      style={{
        backgroundColor: isDark ? 'rgba(3, 165, 192, 0.05)' : 'rgba(3, 165, 192, 0.05)',
        borderColor: '#03A5C0',
      }}
    >
      {/* Icône token à gauche */}
      <Coins className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#03A5C0' }} />

      {/* Barre de progression */}
      <div className="flex items-center gap-2.5">
        <Progress
          value={progressPercentage}
          className="h-2 w-24"
          style={{
            backgroundColor: isDark ? '#2A2A2A' : '#D1D5DB',
          }}
        />

        {/* Compteur de tokens - Tokens restants/Total */}
        <span className="text-xs font-medium whitespace-nowrap" style={{ color: '#ffffff', fontSize: '12px' }}>
          {formatTokenCount(tokensRemaining)}/{formatTokenCount(tokensQuota)}
        </span>
      </div>
    </div>
  );
}
