import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Receipt, Plus, Download, Trash2, Loader2, Euro } from 'lucide-react';
import { useProjectData, ProjectInvoice } from '@/hooks/useProjectData';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export function Facture() {
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get('projectId');
  const { data: invoices, isLoading, create, update, remove } = useProjectData(projectId, 'invoices');
  
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({ 
    invoice_number: '', 
    amount: '', 
    client_name: '',
    client_email: '',
    due_date: '' 
  });
  const [isSaving, setIsSaving] = useState(false);

  const generateInvoiceNumber = () => {
    const year = new Date().getFullYear();
    const count = (invoices?.length || 0) + 1;
    return `FAC-${year}-${String(count).padStart(4, '0')}`;
  };

  const handleCreate = async () => {
    if (!formData.amount) {
      toast.error('Montant requis');
      return;
    }
    setIsSaving(true);
    try {
      await create({ 
        invoice_number: formData.invoice_number || generateInvoiceNumber(),
        amount: parseFloat(formData.amount),
        client_info: { 
          name: formData.client_name, 
          email: formData.client_email 
        },
        due_date: formData.due_date || null,
        status: 'pending'
      });
      toast.success('Facture créée');
      setFormData({ invoice_number: '', amount: '', client_name: '', client_email: '', due_date: '' });
      setIsCreating(false);
    } catch {
      toast.error('Erreur lors de la création');
    } finally {
      setIsSaving(false);
    }
  };

  const handleMarkPaid = async (invoice: ProjectInvoice) => {
    try {
      await update(invoice.id, { 
        status: 'paid',
        paid_at: new Date().toISOString()
      });
      toast.success('Facture marquée comme payée');
    } catch {
      toast.error('Erreur');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer cette facture ?')) return;
    try {
      await remove(id);
      toast.success('Facture supprimée');
    } catch {
      toast.error('Erreur lors de la suppression');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-600 border-yellow-500">En attente</Badge>;
      case 'paid':
        return <Badge variant="default" className="bg-green-500/20 text-green-600 border-green-500">Payée</Badge>;
      case 'overdue':
        return <Badge variant="destructive">En retard</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const totalPending = invoices?.filter(i => i.status === 'pending').reduce((sum, i) => sum + Number(i.amount), 0) || 0;
  const totalPaid = invoices?.filter(i => i.status === 'paid').reduce((sum, i) => sum + Number(i.amount), 0) || 0;

  if (!projectId) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Factures</h2>
          <p className="text-muted-foreground">Sélectionnez un projet pour voir les factures</p>
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
          <h2 className="text-2xl font-bold text-foreground">Factures</h2>
          <p className="text-muted-foreground">Gérez vos factures et paiements</p>
        </div>
        <Dialog open={isCreating} onOpenChange={setIsCreating}>
          <DialogTrigger asChild>
            <Button 
              className="rounded-full border-[#03A5C0] bg-[#03A5C0]/10 text-[#03A5C0] hover:bg-[#03A5C0]/20"
              variant="outline"
            >
              <Plus className="h-4 w-4 mr-2" />
              Nouvelle facture
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nouvelle facture</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <Input
                placeholder={`Numéro (ex: ${generateInvoiceNumber()})`}
                value={formData.invoice_number}
                onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })}
              />
              <div className="relative">
                <Euro className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="number"
                  placeholder="Montant"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  className="pl-9"
                />
              </div>
              <Input
                placeholder="Nom du client"
                value={formData.client_name}
                onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
              />
              <Input
                type="email"
                placeholder="Email du client"
                value={formData.client_email}
                onChange={(e) => setFormData({ ...formData, client_email: e.target.value })}
              />
              <Input
                type="date"
                placeholder="Date d'échéance"
                value={formData.due_date}
                onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
              />
              <Button 
                onClick={handleCreate} 
                disabled={isSaving}
                className="w-full rounded-full border-[#03A5C0] bg-[#03A5C0]/10 text-[#03A5C0] hover:bg-[#03A5C0]/20"
                variant="outline"
              >
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Créer la facture
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="rounded-[8px]">
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">En attente</div>
            <div className="text-2xl font-bold text-yellow-600">{totalPending.toFixed(2)} €</div>
          </CardContent>
        </Card>
        <Card className="rounded-[8px]">
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Payées</div>
            <div className="text-2xl font-bold text-green-600">{totalPaid.toFixed(2)} €</div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-[8px]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Historique des factures
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !invoices || invoices.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Receipt className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Aucune facture pour le moment</p>
            </div>
          ) : (
            <div className="space-y-3">
              {invoices.map((invoice) => (
                <div 
                  key={invoice.id} 
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono font-medium">{invoice.invoice_number}</span>
                      {getStatusBadge(invoice.status)}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {invoice.client_info?.name || 'Client'} · {format(new Date(invoice.created_at), "d MMM yyyy", { locale: fr })}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-bold text-lg">{Number(invoice.amount).toFixed(2)} €</span>
                    <div className="flex items-center gap-1">
                      {invoice.status === 'pending' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleMarkPaid(invoice)}
                          className="text-green-600 hover:text-green-700"
                        >
                          Marquer payée
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" title="Télécharger">
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(invoice.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
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
