import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Download, Trash2, Check, Eye, FileText, Receipt } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ProjectInvoice } from '@/hooks/useProjectData';

interface FactureCardProps {
  invoice: ProjectInvoice;
  onMarkPaid: () => void;
  onDelete: () => void;
  onDownload: () => void;
  style?: React.CSSProperties;
}

export function FactureCard({ invoice, onMarkPaid, onDelete, onDownload, style }: FactureCardProps) {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge className="bg-yellow-500/20 text-yellow-600 border-yellow-500/50 hover:bg-yellow-500/30">En attente</Badge>;
      case 'paid':
        return <Badge className="bg-green-500/20 text-green-600 border-green-500/50 hover:bg-green-500/30">Payée</Badge>;
      case 'overdue':
        return <Badge className="bg-red-500/20 text-red-600 border-red-500/50 hover:bg-red-500/30">En retard</Badge>;
      case 'quote':
        return <Badge className="bg-blue-500/20 text-blue-600 border-blue-500/50 hover:bg-blue-500/30">Devis</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getTypeIcon = () => {
    if (invoice.status === 'quote') {
      return <FileText className="h-5 w-5 text-blue-500" />;
    }
    return <Receipt className="h-5 w-5 text-[#03A5C0]" />;
  };

  const getTypeLabel = () => {
    return invoice.status === 'quote' ? 'Devis' : 'Facture';
  };

  return (
    <Card 
      className="group relative overflow-hidden rounded-xl border border-border/50 hover:border-[#03A5C0]/30 transition-all duration-300 hover:shadow-lg"
      style={style}
    >
      {/* Header avec statut et type */}
      <div className="absolute top-3 left-3 right-3 flex items-center justify-between z-10">
        <div className="flex items-center gap-2">
          {getTypeIcon()}
          <span className="text-xs font-medium text-muted-foreground">{getTypeLabel()}</span>
        </div>
        {getStatusBadge(invoice.status)}
      </div>

      {/* Actions au survol */}
      <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-20">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-full bg-background/80 backdrop-blur-sm hover:bg-background"
          onClick={onDownload}
        >
          <Download className="h-4 w-4" />
        </Button>
        {invoice.status === 'pending' && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full bg-green-500/20 text-green-600 hover:bg-green-500/30"
            onClick={onMarkPaid}
          >
            <Check className="h-4 w-4" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-full bg-destructive/20 text-destructive hover:bg-destructive/30"
          onClick={onDelete}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <CardContent className="pt-14 pb-4">
        {/* Numéro de facture */}
        <div className="mb-3">
          <h3 className="font-mono font-semibold text-lg text-foreground truncate">
            {invoice.invoice_number}
          </h3>
        </div>

        {/* Montant */}
        <div className="text-2xl font-bold text-foreground mb-3">
          {Number(invoice.amount).toFixed(2)} €
        </div>

        {/* Client */}
        <div className="text-sm text-muted-foreground mb-2">
          {invoice.client_info?.name || 'Client non spécifié'}
        </div>

        {/* Dates */}
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-3 border-t border-border/50">
          <div>
            <span className="block text-muted-foreground/70">Émise le</span>
            <span>{format(new Date(invoice.created_at), "d MMM yyyy", { locale: fr })}</span>
          </div>
          {invoice.due_date && (
            <div className="text-right">
              <span className="block text-muted-foreground/70">Échéance</span>
              <span>{format(new Date(invoice.due_date), "d MMM yyyy", { locale: fr })}</span>
            </div>
          )}
          {invoice.paid_at && (
            <div className="text-right">
              <span className="block text-muted-foreground/70">Payée le</span>
              <span className="text-green-600">{format(new Date(invoice.paid_at), "d MMM yyyy", { locale: fr })}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
