/**
 * Prompt conversationnel avec logo Magellan flottant
 * Chat contextuel pour créer/modifier des objets et records
 */

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { X, Send, Sparkles, Plus, Filter, Layout, Columns } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface ConversationalPromptProps {
  projectId: string;
  currentObjectType?: string;
  selectedElement?: {
    type: string;
    id: string;
    label: string;
  } | null;
  className?: string;
}

export function ConversationalPrompt({
  projectId,
  currentObjectType,
  selectedElement,
  className,
}: ConversationalPromptProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Bonjour ! Je suis votre assistant Magellan. Comment puis-je vous aider avec votre CRM aujourd\'hui ?',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Quick actions selon le contexte
  const quickActions = selectedElement
    ? [
        { icon: Sparkles, label: `Modifier ${selectedElement.label}`, prompt: `Modifie ${selectedElement.type} ${selectedElement.label}` },
        { icon: Plus, label: 'Ajouter un champ', prompt: 'Ajoute un champ à cet objet' },
      ]
    : currentObjectType
    ? [
        { icon: Plus, label: 'Nouveau record', prompt: `Crée un nouveau ${currentObjectType}` },
        { icon: Filter, label: 'Créer un filtre', prompt: 'Crée un filtre pour cette vue' },
        { icon: Layout, label: 'Nouvelle vue', prompt: 'Crée une nouvelle vue' },
        { icon: Columns, label: 'Ajouter un champ', prompt: `Ajoute un champ à ${currentObjectType}` },
      ]
    : [
        { icon: Plus, label: 'Nouvel objet', prompt: 'Crée un nouvel objet CRM' },
        { icon: Sparkles, label: 'Suggérer des objets', prompt: 'Suggère-moi des objets CRM pour mon activité' },
      ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // TODO: Appeler l'Edge Function ai-crm-command
      // Pour l'instant, réponse mockée
      await new Promise(resolve => setTimeout(resolve, 1000));

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `J'ai bien reçu votre demande : "${input}". Cette fonctionnalité sera disponible une fois l'Edge Function ai-crm-command implémentée.`,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickAction = (prompt: string) => {
    setInput(prompt);
  };

  return (
    <div className={cn('fixed bottom-6 right-6 z-50', className)}>
      {/* Logo Magellan Flottant */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsOpen(true)}
            className="w-14 h-14 rounded-full bg-gradient-to-br from-cyan-400 to-cyan-600 shadow-lg shadow-cyan-500/50 flex items-center justify-center transition-all hover:shadow-xl hover:shadow-cyan-500/70"
          >
            <Sparkles className="w-6 h-6 text-white" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Panel Chat */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute bottom-16 right-0 w-[420px] h-[650px] bg-surface/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/10 flex flex-col"
          >
            {/* Header */}
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-400 to-cyan-600 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">Assistant Magellan</h3>
                  {selectedElement ? (
                    <Badge variant="outline" className="mt-0.5 border-cyan-500/30 text-cyan-400">
                      {selectedElement.label} sélectionné
                    </Badge>
                  ) : currentObjectType ? (
                    <Badge variant="outline" className="mt-0.5 border-cyan-500/30 text-cyan-400">
                      {currentObjectType}
                    </Badge>
                  ) : (
                    <p className="text-xs text-gray-400">Votre assistant IA personnel</p>
                  )}
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsOpen(false)}
                className="hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={cn(
                      'flex',
                      message.role === 'user' ? 'justify-end' : 'justify-start'
                    )}
                  >
                    <div
                      className={cn(
                        'max-w-[80%] rounded-2xl px-4 py-3',
                        message.role === 'user'
                          ? 'bg-cyan-500 text-white'
                          : 'bg-white/10 text-gray-100'
                      )}
                    >
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                      <p
                        className={cn(
                          'text-[10px] mt-1',
                          message.role === 'user' ? 'text-cyan-100' : 'text-gray-500'
                        )}
                      >
                        {message.timestamp.toLocaleTimeString('fr-FR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>
                ))}

                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-white/10 rounded-2xl px-4 py-3">
                      <div className="flex gap-1">
                        <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Quick Actions */}
            {quickActions.length > 0 && (
              <div className="p-3 border-t border-white/10 bg-white/5">
                <p className="text-xs text-gray-500 mb-2">Actions rapides</p>
                <div className="grid grid-cols-2 gap-2">
                  {quickActions.map((action, index) => (
                    <Button
                      key={index}
                      variant="outline"
                      size="sm"
                      onClick={() => handleQuickAction(action.prompt)}
                      className="justify-start text-left border-white/10 hover:bg-white/10 hover:border-cyan-500/30"
                    >
                      <action.icon className="w-3 h-3 mr-2 text-cyan-400" />
                      <span className="text-xs truncate">{action.label}</span>
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Input */}
            <div className="p-4 border-t border-white/10">
              <div className="flex gap-2">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                  placeholder={
                    selectedElement
                      ? `Modifier ${selectedElement.label}...`
                      : currentObjectType
                      ? `Que voulez-vous faire avec ${currentObjectType} ?`
                      : 'Que voulez-vous créer ?'
                  }
                  className="flex-1 bg-white/5 border-white/10 focus:border-cyan-500/50"
                  disabled={isLoading}
                />
                <Button
                  onClick={handleSend}
                  disabled={!input.trim() || isLoading}
                  className="bg-cyan-500 hover:bg-cyan-600"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-[10px] text-gray-600 mt-2 text-center">
                IA powered by Claude · Magellan v1.0
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
