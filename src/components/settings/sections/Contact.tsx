import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Mail, Phone, User, MessageSquare, Check, Archive, Loader2 } from 'lucide-react';
import { useProjectData, ProjectContact } from '@/hooks/useProjectData';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export function Contact() {
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get('projectId');
  const { data: contacts, isLoading, update } = useProjectData(projectId, 'contacts');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const handleStatusChange = async (contact: ProjectContact, newStatus: string) => {
    setUpdatingId(contact.id);
    try {
      await update(contact.id, { status: newStatus });
      toast.success('Statut mis à jour');
    } catch {
      toast.error('Erreur lors de la mise à jour');
    } finally {
      setUpdatingId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'new':
        return <Badge variant="default" className="bg-[#03A5C0]/20 text-[#03A5C0] border-[#03A5C0]">Nouveau</Badge>;
      case 'read':
        return <Badge variant="secondary">Lu</Badge>;
      case 'replied':
        return <Badge variant="outline" className="border-green-500 text-green-500">Répondu</Badge>;
      case 'archived':
        return <Badge variant="outline" className="text-muted-foreground">Archivé</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  if (!projectId) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Contact</h2>
          <p className="text-muted-foreground">Sélectionnez un projet pour voir les messages</p>
        </div>
        <Card className="rounded-[8px]">
          <CardContent className="py-8 text-center text-muted-foreground">
            Aucun projet sélectionné
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Messages de contact</h2>
        <p className="text-muted-foreground">Gérez les messages reçus via votre formulaire de contact</p>
      </div>

      <Card className="rounded-[8px]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Boîte de réception
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !contacts || contacts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Aucun message reçu pour le moment</p>
              <p className="text-sm mt-2">Les messages de votre formulaire de contact apparaîtront ici</p>
            </div>
          ) : (
            <div className="space-y-4">
              {contacts.map((contact) => (
                <div 
                  key={contact.id} 
                  className="p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-[#03A5C0]/20 flex items-center justify-center">
                        <User className="h-5 w-5 text-[#03A5C0]" />
                      </div>
                      <div>
                        <p className="font-medium">{contact.name}</p>
                        <p className="text-sm text-muted-foreground">{contact.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(contact.status)}
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(contact.created_at), "d MMM 'à' HH:mm", { locale: fr })}
                      </span>
                    </div>
                  </div>

                  {contact.phone && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                      <Phone className="h-4 w-4" />
                      {contact.phone}
                    </div>
                  )}

                  {contact.message && (
                    <p className="text-sm text-foreground bg-muted/50 p-3 rounded-md">
                      {contact.message}
                    </p>
                  )}

                  <div className="flex gap-2 mt-3">
                    {contact.status !== 'replied' && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleStatusChange(contact, 'replied')}
                        disabled={updatingId === contact.id}
                        className="rounded-full border-[#03A5C0] bg-[#03A5C0]/10 text-[#03A5C0] hover:bg-[#03A5C0]/20"
                      >
                        {updatingId === contact.id ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-1" />
                        ) : (
                          <Check className="h-4 w-4 mr-1" />
                        )}
                        Marquer comme répondu
                      </Button>
                    )}
                    {contact.status !== 'archived' && (
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleStatusChange(contact, 'archived')}
                        disabled={updatingId === contact.id}
                      >
                        <Archive className="h-4 w-4 mr-1" />
                        Archiver
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
