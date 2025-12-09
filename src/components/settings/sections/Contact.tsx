import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Mail, 
  Phone, 
  User, 
  MessageSquare, 
  Check, 
  Archive, 
  Loader2, 
  Search, 
  Download,
  Filter,
  Eye
} from 'lucide-react';
import { useProjectData, ProjectContact } from '@/hooks/useProjectData';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export function Contact() {
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get('projectId');
  const { data: contacts, isLoading, update } = useProjectData(projectId, 'contacts');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedContact, setSelectedContact] = useState<ProjectContact | null>(null);

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

  // Filtrage des contacts
  const filteredContacts = useMemo(() => {
    if (!contacts) return [];
    
    return contacts.filter((contact: ProjectContact) => {
      // Filtre par statut
      if (statusFilter !== 'all' && contact.status !== statusFilter) {
        return false;
      }
      
      // Filtre par recherche
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          contact.name.toLowerCase().includes(query) ||
          contact.email.toLowerCase().includes(query) ||
          (contact.phone && contact.phone.toLowerCase().includes(query)) ||
          (contact.message && contact.message.toLowerCase().includes(query))
        );
      }
      
      return true;
    });
  }, [contacts, searchQuery, statusFilter]);

  // Export Excel (CSV)
  const handleExportExcel = () => {
    if (!filteredContacts.length) {
      toast.error('Aucun contact à exporter');
      return;
    }

    const headers = ['Nom', 'Email', 'Téléphone', 'Message', 'Statut', 'Date'];
    const csvContent = [
      headers.join(';'),
      ...filteredContacts.map((contact: ProjectContact) => [
        `"${contact.name.replace(/"/g, '""')}"`,
        `"${contact.email.replace(/"/g, '""')}"`,
        `"${(contact.phone || '').replace(/"/g, '""')}"`,
        `"${(contact.message || '').replace(/"/g, '""')}"`,
        `"${contact.status}"`,
        `"${format(new Date(contact.created_at), 'dd/MM/yyyy HH:mm')}"`
      ].join(';'))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `contacts_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    
    toast.success(`${filteredContacts.length} contact(s) exporté(s)`);
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Messages de contact</h2>
          <p className="text-muted-foreground">
            {filteredContacts.length} message(s) {statusFilter !== 'all' ? `(${statusFilter})` : ''}
          </p>
        </div>
        <Button 
          onClick={handleExportExcel}
          disabled={!filteredContacts.length}
          className="rounded-full border-[#03A5C0] bg-[#03A5C0]/10 text-[#03A5C0] hover:bg-[#03A5C0]/20 px-4 py-0"
          variant="outline"
        >
          <Download className="h-4 w-4 mr-2" />
          Exporter Excel
        </Button>
      </div>

      {/* Filtres et recherche */}
      <Card className="rounded-[8px]">
        <CardContent className="py-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par nom, email, téléphone ou message..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 rounded-full"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px] rounded-full">
                  <SelectValue placeholder="Filtrer par statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  <SelectItem value="new">Nouveau</SelectItem>
                  <SelectItem value="read">Lu</SelectItem>
                  <SelectItem value="replied">Répondu</SelectItem>
                  <SelectItem value="archived">Archivé</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tableau des contacts */}
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
          ) : !filteredContacts.length ? (
            <div className="text-center py-8 text-muted-foreground">
              <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>{searchQuery || statusFilter !== 'all' ? 'Aucun résultat trouvé' : 'Aucun message reçu pour le moment'}</p>
              <p className="text-sm mt-2">Les messages de votre formulaire de contact apparaîtront ici</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Contact</TableHead>
                    <TableHead>Téléphone</TableHead>
                    <TableHead>Message</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredContacts.map((contact: ProjectContact) => (
                    <TableRow key={contact.id} className="hover:bg-muted/50">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-[#03A5C0]/20 flex items-center justify-center">
                            <User className="h-4 w-4 text-[#03A5C0]" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">{contact.name}</p>
                            <p className="text-xs text-muted-foreground">{contact.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {contact.phone ? (
                          <div className="flex items-center gap-1 text-sm">
                            <Phone className="h-3 w-3" />
                            {contact.phone}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[200px]">
                        <p className="text-sm truncate" title={contact.message || ''}>
                          {contact.message || '-'}
                        </p>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(contact.status)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {format(new Date(contact.created_at), "d MMM 'à' HH:mm", { locale: fr })}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setSelectedContact(contact)}
                            title="Voir le détail"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {contact.status !== 'replied' && (
                            <Button 
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                              onClick={() => handleStatusChange(contact, 'replied')}
                              disabled={updatingId === contact.id}
                              title="Marquer comme répondu"
                            >
                              {updatingId === contact.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Check className="h-4 w-4" />
                              )}
                            </Button>
                          )}
                          {contact.status !== 'archived' && (
                            <Button 
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleStatusChange(contact, 'archived')}
                              disabled={updatingId === contact.id}
                              title="Archiver"
                            >
                              <Archive className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog détail contact */}
      <Dialog open={!!selectedContact} onOpenChange={() => setSelectedContact(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Détail du message
            </DialogTitle>
          </DialogHeader>
          {selectedContact && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <div className="h-12 w-12 rounded-full bg-[#03A5C0]/20 flex items-center justify-center">
                  <User className="h-6 w-6 text-[#03A5C0]" />
                </div>
                <div>
                  <p className="font-medium">{selectedContact.name}</p>
                  <p className="text-sm text-muted-foreground">{selectedContact.email}</p>
                  {selectedContact.phone && (
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      {selectedContact.phone}
                    </p>
                  )}
                </div>
              </div>
              
              <div>
                <p className="text-sm font-medium mb-2">Message</p>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-sm whitespace-pre-wrap">{selectedContact.message || 'Aucun message'}</p>
                </div>
              </div>
              
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Statut :</span>
                  {getStatusBadge(selectedContact.status)}
                </div>
                <span className="text-muted-foreground">
                  {format(new Date(selectedContact.created_at), "d MMMM yyyy 'à' HH:mm", { locale: fr })}
                </span>
              </div>
              
              <div className="flex gap-2 pt-2">
                {selectedContact.status !== 'replied' && (
                  <Button 
                    onClick={() => {
                      handleStatusChange(selectedContact, 'replied');
                      setSelectedContact(null);
                    }}
                    disabled={updatingId === selectedContact.id}
                    className="flex-1 rounded-full border-[#03A5C0] bg-[#03A5C0]/10 text-[#03A5C0] hover:bg-[#03A5C0]/20"
                    variant="outline"
                  >
                    <Check className="h-4 w-4 mr-2" />
                    Marquer comme répondu
                  </Button>
                )}
                {selectedContact.status !== 'archived' && (
                  <Button 
                    variant="outline"
                    onClick={() => {
                      handleStatusChange(selectedContact, 'archived');
                      setSelectedContact(null);
                    }}
                    disabled={updatingId === selectedContact.id}
                    className="rounded-full"
                  >
                    <Archive className="h-4 w-4 mr-2" />
                    Archiver
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
