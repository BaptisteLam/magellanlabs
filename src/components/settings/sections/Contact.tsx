import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
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
  Phone, 
  User, 
  Check, 
  Archive, 
  Loader2, 
  Search, 
  Download,
  Eye,
  Plus,
  Users,
  ArrowDown
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
  const { data: contacts, isLoading, update, create } = useProjectData(projectId, 'contacts');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedContact, setSelectedContact] = useState<ProjectContact | null>(null);
  const [showNewContactDialog, setShowNewContactDialog] = useState(false);
  const [newContact, setNewContact] = useState({ name: '', email: '', phone: '', message: '' });
  const [isCreating, setIsCreating] = useState(false);

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

  const handleCreateContact = async () => {
    if (!newContact.name || !newContact.email) {
      toast.error('Nom et email requis');
      return;
    }
    setIsCreating(true);
    try {
      await create({
        project_id: projectId,
        name: newContact.name,
        email: newContact.email,
        phone: newContact.phone || null,
        message: newContact.message || null,
        status: 'new'
      });
      toast.success('Contact créé');
      setShowNewContactDialog(false);
      setNewContact({ name: '', email: '', phone: '', message: '' });
    } catch {
      toast.error('Erreur lors de la création');
    } finally {
      setIsCreating(false);
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
      <div className="flex flex-col items-center justify-center h-[60vh] text-muted-foreground">
        <Users className="h-16 w-16 mb-4 opacity-30" />
        <h3 className="text-xl font-semibold text-foreground mb-2">Contacts</h3>
        <p>Sélectionnez un projet pour voir les messages</p>
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {/* Header avec titre, recherche et bouton */}
      <div className="flex items-center justify-between py-4 border-b">
        <div className="flex items-center gap-3">
          <Users className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold text-foreground">Contacts</h2>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-[200px] h-9 rounded-lg border-border bg-background"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px] h-9 rounded-lg">
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous</SelectItem>
              <SelectItem value="new">Nouveau</SelectItem>
              <SelectItem value="read">Lu</SelectItem>
              <SelectItem value="replied">Répondu</SelectItem>
              <SelectItem value="archived">Archivé</SelectItem>
            </SelectContent>
          </Select>
          <Button 
            onClick={handleExportExcel}
            disabled={!filteredContacts.length}
            variant="outline"
            size="sm"
            className="h-9 rounded-lg"
          >
            <Download className="h-4 w-4 mr-2" />
            Exporter
          </Button>
          <Button 
            onClick={() => setShowNewContactDialog(true)}
            className="h-9 rounded-full border-[#03A5C0] bg-[#03A5C0]/10 text-[#03A5C0] hover:bg-[#03A5C0]/20 px-4"
            variant="outline"
          >
            <Plus className="h-4 w-4 mr-2" />
            Nouveau contact
          </Button>
        </div>
      </div>

      {/* En-tête du tableau */}
      <div className="border-b">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[200px] font-medium">Nom</TableHead>
              <TableHead className="w-[220px] font-medium">Email</TableHead>
              <TableHead className="font-medium">Dernier message</TableHead>
              <TableHead className="w-[140px] font-medium">Téléphone</TableHead>
              <TableHead className="w-[140px] font-medium">
                <div className="flex items-center gap-1">
                  Date d'ajout
                  <ArrowDown className="h-3 w-3" />
                </div>
              </TableHead>
              <TableHead className="w-[100px] font-medium">Statut</TableHead>
              <TableHead className="w-[80px]"></TableHead>
            </TableRow>
          </TableHeader>
        </Table>
      </div>

      {/* Corps du tableau ou état vide */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !filteredContacts.length ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <div className="h-16 w-16 rounded-full border-2 border-muted-foreground/30 flex items-center justify-center mb-4">
            <User className="h-8 w-8 opacity-50" />
          </div>
          <h3 className="text-xl font-semibold text-foreground mb-2">Contacts</h3>
          <p className="mb-4">
            {searchQuery || statusFilter !== 'all' 
              ? "Aucun résultat trouvé" 
              : "Vous n'avez pas encore de contacts."}
          </p>
          <Button 
            onClick={() => setShowNewContactDialog(true)}
            variant="outline"
            className="rounded-lg"
          >
            <Plus className="h-4 w-4 mr-2" />
            Nouveau contact
          </Button>
        </div>
      ) : (
        <Table>
          <TableBody>
            {filteredContacts.map((contact: ProjectContact) => (
              <TableRow key={contact.id} className="hover:bg-muted/50 cursor-pointer" onClick={() => setSelectedContact(contact)}>
                <TableCell className="w-[200px] font-medium">{contact.name}</TableCell>
                <TableCell className="w-[220px] text-muted-foreground">{contact.email}</TableCell>
                <TableCell className="max-w-[300px]">
                  <p className="truncate text-muted-foreground" title={contact.message || ''}>
                    {contact.message || '-'}
                  </p>
                </TableCell>
                <TableCell className="w-[140px] text-muted-foreground">
                  {contact.phone || '-'}
                </TableCell>
                <TableCell className="w-[140px] text-muted-foreground whitespace-nowrap">
                  {format(new Date(contact.created_at), "d MMM yyyy", { locale: fr })}
                </TableCell>
                <TableCell className="w-[100px]">
                  {getStatusBadge(contact.status)}
                </TableCell>
                <TableCell className="w-[80px]">
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
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
      )}

      {/* Dialog détail contact */}
      <Dialog open={!!selectedContact} onOpenChange={() => setSelectedContact(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Détail du message</DialogTitle>
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

      {/* Dialog nouveau contact */}
      <Dialog open={showNewContactDialog} onOpenChange={setShowNewContactDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nouveau contact</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Nom *</label>
              <Input
                value={newContact.name}
                onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
                placeholder="Nom complet"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Email *</label>
              <Input
                type="email"
                value={newContact.email}
                onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
                placeholder="email@exemple.com"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Téléphone</label>
              <Input
                value={newContact.phone}
                onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
                placeholder="+33 6 00 00 00 00"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Message</label>
              <Input
                value={newContact.message}
                onChange={(e) => setNewContact({ ...newContact, message: e.target.value })}
                placeholder="Note ou message..."
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowNewContactDialog(false)} className="rounded-full">
                Annuler
              </Button>
              <Button 
                onClick={handleCreateContact}
                disabled={isCreating || !newContact.name || !newContact.email}
                className="rounded-full border-[#03A5C0] bg-[#03A5C0]/10 text-[#03A5C0] hover:bg-[#03A5C0]/20"
                variant="outline"
              >
                {isCreating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                Créer
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
