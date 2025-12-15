import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Progress } from '@/components/ui/progress';
import { MessageSquare } from 'lucide-react';

interface MessageCounterProps {
  isDark: boolean;
  userId?: string;
}

export function MessageCounter({ isDark, userId }: MessageCounterProps) {
  const [messagesUsed, setMessagesUsed] = useState(0);
  const [messagesQuota] = useState(100); // 100 messages par mois fixe

  useEffect(() => {
    if (!userId) return;

    const fetchMessageData = async () => {
      console.log('💬 MessageCounter: Récupération des messages pour userId:', userId);

      const { data, error } = await supabase
        .from('profiles')
        .select('tokens_used')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('💬 MessageCounter: Erreur récupération messages:', error);
      } else if (data) {
        // Utiliser tokens_used comme proxy pour messages (1 message ≈ 1000 tokens)
        const estimatedMessages = Math.floor((data.tokens_used || 0) / 1000);
        console.log('💬 MessageCounter: Messages estimés -', {
          tokens_used: data.tokens_used || 0,
          messages_estimated: estimatedMessages,
          messages_quota: messagesQuota
        });
        setMessagesUsed(Math.min(estimatedMessages, messagesQuota));
      } else {
        console.warn('💬 MessageCounter: Aucune donnée de profil trouvée');
      }
    };

    fetchMessageData();

    // Écouter les changements en temps réel
    console.log('💬 MessageCounter: Abonnement aux mises à jour en temps réel');
    const channel = supabase
      .channel('message-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${userId}`,
        },
        (payload) => {
          console.log('💬 MessageCounter: Mise à jour en temps réel reçue:', payload.new);
          if (payload.new) {
            const tokensUsed = (payload.new as { tokens_used?: number }).tokens_used || 0;
            const estimatedMessages = Math.floor(tokensUsed / 1000);
            console.log('💬 MessageCounter: Nouveaux messages estimés -', {
              tokens_used: tokensUsed,
              messages_estimated: estimatedMessages
            });
            setMessagesUsed(Math.min(estimatedMessages, messagesQuota));
          }
        }
      )
      .subscribe();

    return () => {
      console.log('💬 MessageCounter: Désinscription des mises à jour');
      supabase.removeChannel(channel);
    };
  }, [userId, messagesQuota]);

  const messagesRemaining = messagesQuota - messagesUsed;
  const progressPercentage = (messagesRemaining / messagesQuota) * 100;

  return (
    <div
      className="flex items-center gap-2.5 px-4 py-2 rounded-full border"
      style={{
        backgroundColor: isDark ? 'rgba(3, 165, 192, 0.05)' : 'rgba(3, 165, 192, 0.05)',
        borderColor: '#03A5C0',
      }}
    >
      {/* Icône message à gauche */}
      <MessageSquare className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#03A5C0' }} />

      {/* Barre de progression */}
      <div className="flex items-center gap-2.5">
        <Progress
          value={progressPercentage}
          className="h-2 w-24"
          style={{
            backgroundColor: isDark ? '#2A2A2A' : '#D1D5DB',
          }}
        />

        {/* Compteur de messages - Messages restants/Total */}
        <span className="text-xs font-medium whitespace-nowrap" style={{ color: '#ffffff', fontSize: '12px' }}>
          {messagesRemaining}/{messagesQuota}
        </span>
      </div>
    </div>
  );
}
