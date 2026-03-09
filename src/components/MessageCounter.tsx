import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Progress } from '@/components/ui/progress';
import { MessageSquare } from 'lucide-react';
import { PLANS, type PlanId } from '@/config/constants';

interface MessageCounterProps {
  isDark: boolean;
  userId?: string;
}

export function MessageCounter({ isDark, userId }: MessageCounterProps) {
  const [messagesUsed, setMessagesUsed] = useState(0);
  const [messagesQuota, setMessagesQuota] = useState(5); // default free plan

  useEffect(() => {
    if (!userId) return;

    const fetchMessageData = async () => {
      console.log('💬 MessageCounter: Fetching messages for userId:', userId);

      const { data, error } = await supabase
        .from('billing')
        .select('messages_used_this_month, messages_limit, plan')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.error('💬 MessageCounter: Error fetching messages:', error);
      } else if (data) {
        const used = (data as any).messages_used_this_month || 0;
        const plan = ((data as any).plan || 'free') as PlanId;
        const limit = (data as any).messages_limit || PLANS[plan]?.messagesPerMonth || 5;
        console.log('💬 MessageCounter: Messages used -', {
          messages_used: used,
          plan,
          messages_limit: limit
        });
        setMessagesUsed(Math.min(used, limit));
        setMessagesQuota(limit);
      } else {
        console.warn('💬 MessageCounter: No billing data found');
      }
    };

    fetchMessageData();

    // Listen for real-time changes
    console.log('💬 MessageCounter: Subscribing to real-time updates');
    const channel = supabase
      .channel('message-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'billing',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          console.log('💬 MessageCounter: Real-time update received:', payload.new);
          if (payload.new) {
            const used = (payload.new as any).messages_used_this_month || 0;
            const plan = ((payload.new as any).plan || 'free') as PlanId;
            const limit = (payload.new as any).messages_limit || PLANS[plan]?.messagesPerMonth || 5;
            console.log('💬 MessageCounter: Updated messages used -', {
              messages_used: used,
              plan,
              messages_limit: limit
            });
            setMessagesUsed(Math.min(used, limit));
            setMessagesQuota(limit);
          }
        }
      )
      .subscribe();

    return () => {
      console.log('💬 MessageCounter: Unsubscribing from updates');
      supabase.removeChannel(channel);
    };
  }, [userId]);

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
      <MessageSquare className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#03A5C0' }} />

      <div className="flex items-center gap-2.5">
        <Progress
          value={progressPercentage}
          className="h-2 w-24"
          style={{
            backgroundColor: isDark ? '#2A2A2A' : '#D1D5DB',
          }}
        />

        <span className="text-xs font-medium whitespace-nowrap" style={{ color: isDark ? '#ffffff' : '#1F2937', fontSize: '12px' }}>
          {messagesRemaining}/{messagesQuota}
        </span>
      </div>
    </div>
  );
}
