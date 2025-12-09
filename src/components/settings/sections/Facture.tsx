import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Receipt, 
  Plus, 
  Search, 
  Loader2, 
  Filter
} from 'lucide-react';
import { useProjectData, ProjectInvoice } from '@/hooks/useProjectData';
import { toast } from 'sonner';
import { FactureCard } from '@/components/settings/FactureCard';
import { InvoiceCreatorDialog } from '@/components/settings/InvoiceCreatorDialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export function Facture() {
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get('projectId');
  const { data: invoices, isLoading, update, remove, refetch } = useProjectData(projectId, 'invoices');
  
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [isCreating, setIsCreating] = useState(false);
  const [deleteInvoiceId, setDeleteInvoiceId] = useState<string | null>(null);

  // Filtrage des factures
  const filteredInvoices = useMemo(() => {
    if (!invoices) return [];
    
    return invoices.filter((invoice: ProjectInvoice) => {
      if (statusFilter !== 'all' && invoice.status !== statusFilter) {
        return false;
      }
      if (typeFilter === 'quote' && invoice.status !== 'quote') {
        return false;
      }
      if (typeFilter === 'invoice' && invoice.status === 'quote') {
        return false;
      }
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          invoice.invoice_number.toLowerCase().includes(query) ||
          (invoice.client_info?.name && invoice.client_info.name.toLowerCase().includes(query)) ||
          (invoice.client_info?.email && invoice.client_info.email.toLowerCase().includes(query))
        );
      }
      return true;
    });
  }, [invoices, searchQuery, statusFilter, typeFilter]);

  const handleMarkPaid = async (invoice: ProjectInvoice) => {
    try {
      await update(invoice.id, { 
        status: 'paid',
        paid_at: new Date().toISOString()
      });
      toast.success('Facture marquée comme payée');
      refetch();
    } catch {
      toast.error('Erreur');
    }
  };

  const handleDelete = async () => {
    if (!deleteInvoiceId) return;
    try {
      await remove(deleteInvoiceId);
      toast.success('Facture supprimée');
      setDeleteInvoiceId(null);
    } catch {
      toast.error('Erreur lors de la suppression');
    }
  };

  const totalPending = invoices?.filter((i: ProjectInvoice) => i.status === 'pending').reduce((sum: number, i: ProjectInvoice) => sum + Number(i.amount), 0) || 0;
  const totalPaid = invoices?.filter((i: ProjectInvoice) => i.status === 'paid').reduce((sum: number, i: ProjectInvoice) => sum + Number(i.amount), 0) || 0;

  if (!projectId) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-muted-foreground">
        <Receipt className="h-16 w-16 mb-4 opacity-30" />
        <h3 className="text-xl font-semibold text-foreground mb-2">Factures</h3>
        <p>Sélectionnez un projet pour gérer les factures</p>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col min-h-[calc(100vh-200px)]">
      {/* Header */}
      <div className="flex items-center justify-between py-4 border-b mb-6">
        <div className="flex items-center gap-3">
          <Receipt className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold text-foreground">Factures</h2>
          {invoices && invoices.length > 0 && (
            <span className="text-sm text-muted-foreground">
              ({filteredInvoices.length} document{filteredInvoices.length > 1 ? 's' : ''})
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-[200px] h-9 rounded-lg"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px] h-9 rounded-lg">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous</SelectItem>
              <SelectItem value="pending">En attente</SelectItem>
              <SelectItem value="paid">Payées</SelectItem>
              <SelectItem value="overdue">En retard</SelectItem>
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[130px] h-9 rounded-lg">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous</SelectItem>
              <SelectItem value="invoice">Factures</SelectItem>
              <SelectItem value="quote">Devis</SelectItem>
            </SelectContent>
          </Select>
          <Button 
            onClick={() => setIsCreating(true)}
            className="h-9 rounded-full border-[#03A5C0] bg-[#03A5C0]/10 text-[#03A5C0] hover:bg-[#03A5C0]/20 px-4"
            variant="outline"
          >
            <Plus className="h-4 w-4 mr-2" />
            Nouveau
          </Button>
          <InvoiceCreatorDialog
            open={isCreating}
            onOpenChange={setIsCreating}
            projectId={projectId}
            onSuccess={refetch}
            existingInvoicesCount={invoices?.length || 0}
          />
        </div>
      </div>

      {/* Stats résumées */}
      <div className="flex items-center gap-6 mb-6 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-yellow-500/50" />
          <span className="text-muted-foreground">En attente:</span>
          <span className="font-semibold text-yellow-600">{totalPending.toFixed(2)} €</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-500/50" />
          <span className="text-muted-foreground">Payées:</span>
          <span className="font-semibold text-green-600">{totalPaid.toFixed(2)} €</span>
        </div>
      </div>

      {/* Contenu avec flex-1 pour prendre l'espace disponible */}
      <div className="flex-1 overflow-auto pb-24">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !filteredInvoices.length ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <div className="h-16 w-16 rounded-full border-2 border-muted-foreground/30 flex items-center justify-center mb-4">
              <Receipt className="h-8 w-8 opacity-50" />
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">Aucun document</h3>
            <p className="mb-4">
              {searchQuery || statusFilter !== 'all' || typeFilter !== 'all'
                ? "Aucun résultat trouvé" 
                : "Créez votre première facture ou devis"}
            </p>
            <Button 
              onClick={() => setIsCreating(true)}
              variant="outline"
              className="rounded-lg"
            >
              <Plus className="h-4 w-4 mr-2" />
              Nouveau document
            </Button>
          </div>
        ) : (
          <>
            {/* Grille de cards avec effet de fade en bas */}
            <div className="relative">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredInvoices.map((invoice: ProjectInvoice, index: number) => {
                  // Calculer l'opacité en fonction de la position (fade vers le bas)
                  const totalItems = filteredInvoices.length;
                  const rowIndex = Math.floor(index / 3);
                  const totalRows = Math.ceil(totalItems / 3);
                  const fadeStart = Math.max(0, totalRows - 2);
                  
                  let opacity = 1;
                  if (rowIndex >= fadeStart && totalRows > 2) {
                    const fadeProgress = (rowIndex - fadeStart + 1) / (totalRows - fadeStart);
                    opacity = Math.max(0.3, 1 - fadeProgress * 0.7);
                  }

                  return (
                    <FactureCard
                      key={invoice.id}
                      invoice={invoice}
                      onMarkPaid={() => handleMarkPaid(invoice)}
                      onDelete={() => setDeleteInvoiceId(invoice.id)}
                      onDownload={() => toast.info('Téléchargement bientôt disponible')}
                      style={{ opacity }}
                    />
                  );
                })}
              </div>

              {/* Gradient overlay pour effet de fade */}
              {filteredInvoices.length > 3 && (
                <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent pointer-events-none" />
              )}
            </div>
          </>
        )}
      </div>

      {/* Dialog de confirmation de suppression */}
      <AlertDialog open={!!deleteInvoiceId} onOpenChange={() => setDeleteInvoiceId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce document ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Le document sera définitivement supprimé.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-lg">Annuler</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-lg"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
