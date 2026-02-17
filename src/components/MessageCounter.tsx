import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Progress } from '@/components/ui/progress';
import { MessageSquare } from 'lucide-react';
import { PLANS } from '@/config/constants';

interface MessageCounterProps {
  isDark: boolean;
  userId?: string;
}

export function MessageCounter({ isDark, userId }: MessageCounterProps) {
  const [messagesUsed, setMessagesUsed] = useState(0);
  const [messagesLimit, setMessagesLimit] = useState(PLANS.free.messagesPerMonth);
  const [plan, setPlan] = useState<'free' | 'premium'>('free');

  useEffect(() => {
    if (!userId) return;

    const fetchBillingData = async () => {
      // Fetch from billing table for real plan data
      const { data, error } = await supabase
        .from('billing')
        .select('plan, messages_used_this_month, messages_limit')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.error('💬 MessageCounter: Erreur récupération billing:', error);
        // Fallback to profiles
        const { data: profile } = await supabase
          .from('profiles')
          .select('messages_used')
          .eq('id', userId)
          .maybeSingle();
        if (profile) {
          setMessagesUsed((profile as any).messages_used || 0);
        }
        return;
      }

      if (data) {
        const userPlan = (data as any).plan || 'free';
        const used = (data as any).messages_used_this_month || 0;
        const limit = (data as any).messages_limit || PLANS[userPlan as keyof typeof PLANS]?.messagesPerMonth || 5;

        setPlan(userPlan as 'free' | 'premium');
        setMessagesUsed(used);
        setMessagesLimit(limit);

        console.log('💬 MessageCounter:', { plan: userPlan, used, limit });
      }
    };

    fetchBillingData();

    // Écouter les changements en temps réel sur billing
    const channel = supabase
      .channel('billing-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'billing',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          console.log('💬 MessageCounter: Mise à jour billing reçue:', payload.new);
          if (payload.new) {
            const userPlan = (payload.new as any).plan || 'free';
            const used = (payload.new as any).messages_used_this_month || 0;
            const limit = (payload.new as any).messages_limit || PLANS[userPlan as keyof typeof PLANS]?.messagesPerMonth || 5;
            setPlan(userPlan as 'free' | 'premium');
            setMessagesUsed(used);
            setMessagesLimit(limit);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${userId}`,
        },
        (payload) => {
          // Also listen to profiles for backwards compatibility
          if (payload.new) {
            const used = (payload.new as any).messages_used || 0;
            setMessagesUsed(used);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const messagesRemaining = Math.max(0, messagesLimit - messagesUsed);
  const progressPercentage = messagesLimit > 0 ? (messagesRemaining / messagesLimit) * 100 : 0;

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
        <span className="text-xs font-medium whitespace-nowrap" style={{ color: isDark ? '#ffffff' : '#1F2937', fontSize: '12px' }}>
          {messagesRemaining}/{messagesLimit}
        </span>
      </div>
    </div>
  );
}
