/**
 * CRMChatPanel - Interface de chat pour créer/modifier des widgets dynamiquement
 *
 * Permet à l'utilisateur de communiquer avec Claude Sonnet 4.5 via prompts
 * pour générer des widgets CRM personnalisés en temps réel.
 */

import React, { useState, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  MessageSquare,
  X,
  Send,
  Loader2,
  Sparkles,
  BarChart3,
  Table2,
  TrendingUp,
  Calendar,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

export interface CRMChatPanelProps {
  projectId: string;
  currentModuleId: string | null;
  onWidgetCreated?: (widgetId: string) => void;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  widgetId?: string;
  widgetTitle?: string;
  action?: 'created' | 'updated';
  error?: boolean;
}

export function CRMChatPanel({
  projectId,
  currentModuleId,
  onWidgetCreated,
}: CRMChatPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll vers le bas quand de nouveaux messages arrivent
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [messages]);

  // Focus input quand le panel s'ouvre
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Message de bienvenue
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        {
          id: 'welcome',
          role: 'assistant',
          content: `👋 Bonjour ! Je suis votre assistant CRM Magellan.

Je peux créer n'importe quel widget pour vous :
• Graphiques (ventes, analytics, etc.)
• Tableaux de données avec filtres
• KPI et métriques
• Calendriers et timelines
• Widgets personnalisés

Dites-moi simplement ce que vous voulez créer !`,
          timestamp: new Date(),
        },
      ]);
    }
  }, []);

  const handleSendMessage = async () => {
    if (!input.trim() || isGenerating) return;

    if (!currentModuleId) {
      toast({
        title: 'Aucun module sélectionné',
        description: 'Veuillez sélectionner un module dans la sidebar avant de créer un widget.',
        variant: 'destructive',
      });
      return;
    }

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsGenerating(true);

    try {
      // Construire l'historique pour Claude (sans le message de bienvenue)
      const conversationHistory = messages
        .filter((m) => m.id !== 'welcome')
        .map((m) => ({
          role: m.role,
          content: m.content,
        }));

      // Appeler l'edge function generate-widget
      const { data, error } = await supabase.functions.invoke('generate-widget', {
        body: {
          projectId,
          moduleId: currentModuleId,
          userPrompt: input,
          conversationHistory,
        },
      });

      if (error) {
        throw error;
      }

      if (!data.success) {
        throw new Error(data.error || 'Failed to generate widget');
      }

      // Message de succès
      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: `✅ Widget créé avec succès !

**${data.widget_title}**

Le widget a été ajouté à votre module. Vous pouvez le voir ci-dessous dans le CRM.

💡 Vous pouvez me demander de le modifier, par exemple :
• "Ajoute un filtre par date"
• "Change les couleurs"
• "Rend-le plus compact"`,
        timestamp: new Date(),
        widgetId: data.widget_id,
        widgetTitle: data.widget_title,
        action: data.action,
      };

      setMessages((prev) => [...prev, assistantMessage]);

      // Notifier le parent
      if (onWidgetCreated) {
        onWidgetCreated(data.widget_id);
      }

      toast({
        title: 'Widget créé !',
        description: data.widget_title,
      });
    } catch (error: any) {
      console.error('[CRMChatPanel] Error generating widget:', error);

      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `❌ Désolé, une erreur est survenue lors de la génération du widget.

**Erreur:** ${error.message}

Pourriez-vous reformuler votre demande ou être plus précis sur ce que vous voulez créer ?`,
        timestamp: new Date(),
        error: true,
      };

      setMessages((prev) => [...prev, errorMessage]);

      toast({
        title: 'Erreur',
        description: error.message || 'Échec de la génération du widget',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const quickActions = [
    { icon: BarChart3, label: 'Graphique ventes', prompt: 'Créer un graphique qui montre mes ventes' },
    { icon: Table2, label: 'Tableau clients', prompt: 'Créer un tableau avec mes clients' },
    { icon: TrendingUp, label: 'KPI CA', prompt: 'Créer un KPI qui affiche mon chiffre d\'affaires' },
    { icon: Calendar, label: 'Calendrier', prompt: 'Créer un calendrier pour mes rendez-vous' },
  ];

  return (
    <>
      {/* Bouton flottant */}
      <AnimatePresence>
        {!isOpen && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className="fixed bottom-6 right-6 z-50"
          >
            <Button
              onClick={() => setIsOpen(true)}
              className="w-14 h-14 rounded-full shadow-lg bg-[#03A5C0] hover:bg-[#03A5C0]/90 text-white"
              size="icon"
            >
              <MessageSquare className="w-6 h-6" />
            </Button>
            {/* Badge notification pour attirer l'attention */}
            <motion.div
              className="absolute -top-1 -right-1 w-4 h-4 bg-destructive rounded-full"
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ repeat: Infinity, duration: 2 }}
            >
              <Sparkles className="w-3 h-3 text-white" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Panneau slide-in */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
            />

            {/* Panel */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed top-0 right-0 h-full w-full sm:w-[400px] bg-card border-l shadow-2xl z-50 flex flex-col"
            >
              {/* Header */}
              <div className="h-16 border-b flex items-center justify-between px-4 bg-gradient-to-r from-[#03A5C0]/10 to-transparent">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-full bg-[#03A5C0] flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="font-semibold">Assistant CRM</h2>
                    <p className="text-xs text-muted-foreground">Propulsé par Claude Sonnet 4.5</p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>

              {/* Messages */}
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-4">
                  {messages.map((message) => (
                    <ChatMessage key={message.id} message={message} />
                  ))}

                  {/* Typing indicator */}
                  {isGenerating && (
                    <div className="flex items-start gap-2">
                      <div className="w-8 h-8 rounded-full bg-[#03A5C0] flex items-center justify-center flex-shrink-0">
                        <Sparkles className="w-4 h-4 text-white" />
                      </div>
                      <Card className="p-3 bg-muted max-w-[85%]">
                        <div className="flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span className="text-sm text-muted-foreground">
                            Génération du widget...
                          </span>
                        </div>
                      </Card>
                    </div>
                  )}

                  <div ref={scrollRef} />
                </div>
              </ScrollArea>

              {/* Input zone */}
              <div className="border-t p-4 bg-card/50 backdrop-blur-sm">
                {/* Quick actions */}
                {messages.length <= 1 && (
                  <div className="mb-3 flex flex-wrap gap-2">
                    {quickActions.map((action) => (
                      <Button
                        key={action.label}
                        variant="outline"
                        size="sm"
                        onClick={() => setInput(action.prompt)}
                        className="gap-2 text-xs"
                      >
                        <action.icon className="w-3 h-3" />
                        {action.label}
                      </Button>
                    ))}
                  </div>
                )}

                {/* Input */}
                <div className="flex gap-2">
                  <Textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ex: Créer un graphique avec mes ventes par région..."
                    className="min-h-[60px] resize-none"
                    disabled={isGenerating}
                  />
                  <Button
                    onClick={handleSendMessage}
                    disabled={!input.trim() || isGenerating}
                    className="bg-[#03A5C0] hover:bg-[#03A5C0]/90 self-end"
                    size="icon"
                  >
                    {isGenerating ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </Button>
                </div>

                <p className="text-xs text-muted-foreground mt-2 text-center">
                  Shift + Enter pour nouvelle ligne • Enter pour envoyer
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

/**
 * Composant pour afficher un message individuel
 */
function ChatMessage({ message }: { message: Message }) {
  const isUser = message.role === 'user';

  return (
    <div className={cn('flex items-start gap-2', isUser && 'flex-row-reverse')}>
      {/* Avatar */}
      <div
        className={cn(
          'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
          isUser ? 'bg-muted' : 'bg-[#03A5C0]'
        )}
      >
        {isUser ? (
          <span className="text-sm font-semibold">👤</span>
        ) : (
          <Sparkles className="w-4 h-4 text-white" />
        )}
      </div>

      {/* Message content */}
      <div className={cn('flex flex-col gap-1 max-w-[85%]', isUser && 'items-end')}>
        <Card
          className={cn(
            'p-3',
            isUser ? 'bg-[#03A5C0] text-white' : 'bg-muted',
            message.error && 'border-destructive'
          )}
        >
          <div className="text-sm whitespace-pre-wrap">{message.content}</div>

          {/* Widget badge si créé/modifié */}
          {message.widgetId && (
            <div className="mt-2 flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                {message.action === 'created' ? (
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                ) : (
                  <AlertCircle className="w-3 h-3 mr-1" />
                )}
                {message.action === 'created' ? 'Créé' : 'Modifié'}
              </Badge>
            </div>
          )}
        </Card>

        {/* Timestamp */}
        <span className="text-xs text-muted-foreground px-1">
          {message.timestamp.toLocaleTimeString('fr-FR', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
      </div>
    </div>
  );
}
