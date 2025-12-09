import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Wallet, TrendingUp, TrendingDown, CreditCard, Loader2 } from 'lucide-react';
import { useProjectData } from '@/hooks/useProjectData';

export function Finance() {
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get('projectId');
  const { data: finance, isLoading } = useProjectData(projectId, 'finance');
  const { data: invoices } = useProjectData(projectId, 'invoices');

  const totalRevenue = invoices?.filter(i => i.status === 'paid').reduce((sum, i) => sum + Number(i.amount), 0) || 0;
  const pendingRevenue = invoices?.filter(i => i.status === 'pending').reduce((sum, i) => sum + Number(i.amount), 0) || 0;

  if (!projectId) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Finance</h2>
          <p className="text-muted-foreground">Sélectionnez un projet pour voir les finances</p>
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
        <h2 className="text-2xl font-bold text-foreground">Finance</h2>
        <p className="text-muted-foreground">Vue d'ensemble financière de votre projet</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="rounded-[8px]">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Revenus totaux</p>
                    <p className="text-2xl font-bold text-green-600">{totalRevenue.toFixed(2)} €</p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-green-500/20 flex items-center justify-center">
                    <TrendingUp className="h-6 w-6 text-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-[8px]">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">En attente</p>
                    <p className="text-2xl font-bold text-yellow-600">{pendingRevenue.toFixed(2)} €</p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-yellow-500/20 flex items-center justify-center">
                    <Wallet className="h-6 w-6 text-yellow-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-[8px]">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Dépenses</p>
                    <p className="text-2xl font-bold text-red-600">0.00 €</p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-red-500/20 flex items-center justify-center">
                    <TrendingDown className="h-6 w-6 text-red-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Payment Methods */}
          <Card className="rounded-[8px]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Moyens de paiement
              </CardTitle>
            </CardHeader>
            <CardContent>
              {finance?.payment_methods && finance.payment_methods.length > 0 ? (
                <div className="space-y-3">
                  {finance.payment_methods.map((method: any, index: number) => (
                    <div key={index} className="flex items-center gap-3 p-3 border rounded-lg">
                      <CreditCard className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{method.type || 'Carte'}</p>
                        <p className="text-sm text-muted-foreground">{method.last4 ? `**** ${method.last4}` : 'Non configuré'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Aucun moyen de paiement configuré</p>
                  <p className="text-sm mt-2">Configurez vos moyens de paiement pour recevoir des paiements</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Transactions */}
          <Card className="rounded-[8px]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="h-5 w-5" />
                Transactions récentes
              </CardTitle>
            </CardHeader>
            <CardContent>
              {invoices && invoices.filter(i => i.status === 'paid').length > 0 ? (
                <div className="space-y-3">
                  {invoices.filter(i => i.status === 'paid').slice(0, 5).map((invoice) => (
                    <div key={invoice.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">{invoice.invoice_number}</p>
                        <p className="text-sm text-muted-foreground">{invoice.client_info?.name || 'Client'}</p>
                      </div>
                      <span className="font-bold text-green-600">+{Number(invoice.amount).toFixed(2)} €</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p>Aucune transaction récente</p>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
