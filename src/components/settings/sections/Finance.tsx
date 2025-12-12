import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Wallet, TrendingUp, TrendingDown, Loader2, Plus, Calendar } from 'lucide-react';
import { useProjectData } from '@/hooks/useProjectData';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface RevenueItem {
  id: string;
  name: string;
  contact: string;
  status: 'validated' | 'pending';
  amount: number;
  date: string;
}

interface ExpenseItem {
  id: string;
  name: string;
  contact: string;
  status: 'validated' | 'pending';
  amount: number;
  date: string;
}

export function Finance() {
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get('projectId');
  const { data: finance, isLoading, upsert, refetch } = useProjectData(projectId, 'finance');
  
  const [periodFilter, setPeriodFilter] = useState<'month' | 'year'>('month');
  const [revenueDialogOpen, setRevenueDialogOpen] = useState(false);
  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);
  
  // Form states
  const [newRevenue, setNewRevenue] = useState({ name: '', contact: '', amount: '', status: 'pending' as 'validated' | 'pending' });
  const [newExpense, setNewExpense] = useState({ name: '', contact: '', amount: '', status: 'pending' as 'validated' | 'pending' });

  // Parse existing data
  const revenues: RevenueItem[] = finance?.revenue_stats?.items || [];
  const expenses: ExpenseItem[] = finance?.expense_tracking || [];

  // Filter by period
  const now = new Date();
  const filterByPeriod = (items: (RevenueItem | ExpenseItem)[]) => {
    return items.filter(item => {
      const itemDate = new Date(item.date);
      if (periodFilter === 'month') {
        return itemDate.getMonth() === now.getMonth() && itemDate.getFullYear() === now.getFullYear();
      } else {
        return itemDate.getFullYear() === now.getFullYear();
      }
    });
  };

  const filteredRevenues = filterByPeriod(revenues);
  const filteredExpenses = filterByPeriod(expenses);

  // Calculate totals
  const totalRevenue = filteredRevenues.filter(r => r.status === 'validated').reduce((sum, r) => sum + r.amount, 0);
  const pendingRevenue = filteredRevenues.filter(r => r.status === 'pending').reduce((sum, r) => sum + r.amount, 0);
  const totalExpenses = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);

  const handleAddRevenue = async () => {
    if (!newRevenue.name || !newRevenue.amount) {
      toast.error('Veuillez remplir tous les champs obligatoires');
      return;
    }

    const newItem: RevenueItem = {
      id: crypto.randomUUID(),
      name: newRevenue.name,
      contact: newRevenue.contact,
      status: newRevenue.status,
      amount: parseFloat(newRevenue.amount),
      date: new Date().toISOString()
    };

    const updatedRevenues = [...revenues, newItem];
    
    await upsert({
      project_id: projectId,
      revenue_stats: { items: updatedRevenues },
      expense_tracking: expenses
    });
    
    await refetch();
    setNewRevenue({ name: '', contact: '', amount: '', status: 'pending' });
    setRevenueDialogOpen(false);
    toast.success('Revenu ajouté avec succès');
  };

  const handleAddExpense = async () => {
    if (!newExpense.name || !newExpense.amount) {
      toast.error('Veuillez remplir tous les champs obligatoires');
      return;
    }

    const newItem: ExpenseItem = {
      id: crypto.randomUUID(),
      name: newExpense.name,
      contact: newExpense.contact,
      status: newExpense.status,
      amount: parseFloat(newExpense.amount),
      date: new Date().toISOString()
    };

    const updatedExpenses = [...expenses, newItem];
    
    await upsert({
      project_id: projectId,
      revenue_stats: finance?.revenue_stats || { items: [] },
      expense_tracking: updatedExpenses
    });
    
    await refetch();
    setNewExpense({ name: '', contact: '', amount: '', status: 'pending' });
    setExpenseDialogOpen(false);
    toast.success('Dépense ajoutée avec succès');
  };

  if (!projectId) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Finance</h2>
          <p className="text-muted-foreground">Sélectionnez un projet pour voir les finances</p>
        </div>
        <Card className="rounded-[8px] border border-[#03A5C0]/20 bg-background/50 shadow-sm">
          <CardContent className="py-8 text-center text-muted-foreground">
            Aucun projet sélectionné
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with buttons */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Finance</h2>
          <p className="text-muted-foreground">Vue d'ensemble financière de votre projet</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={periodFilter} onValueChange={(v: 'month' | 'year') => setPeriodFilter(v)}>
            <SelectTrigger className="w-[140px] rounded-full border-[#03A5C0]/30">
              <Calendar className="h-4 w-4 mr-2 text-[#03A5C0]" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="month">Ce mois</SelectItem>
              <SelectItem value="year">Cette année</SelectItem>
            </SelectContent>
          </Select>
          <button
            onClick={() => setRevenueDialogOpen(true)}
            className="inline-flex items-center justify-center whitespace-nowrap font-medium text-sm gap-2 transition-all border rounded-full px-4 py-1.5"
            style={{ borderColor: 'rgb(3,165,192)', backgroundColor: 'rgba(3,165,192,0.1)', color: 'rgb(3,165,192)' }}
          >
            <Plus className="h-4 w-4" />
            Nouveau revenu
          </button>
          <button
            onClick={() => setExpenseDialogOpen(true)}
            className="inline-flex items-center justify-center whitespace-nowrap font-medium text-sm gap-2 transition-all border rounded-full px-4 py-1.5"
            style={{ borderColor: 'rgb(3,165,192)', backgroundColor: 'rgba(3,165,192,0.1)', color: 'rgb(3,165,192)' }}
          >
            <Plus className="h-4 w-4" />
            Nouvelle dépense
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="rounded-[8px] border border-[#03A5C0]/20 bg-background/50 shadow-sm">
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

            <Card className="rounded-[8px] border border-[#03A5C0]/20 bg-background/50 shadow-sm">
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

            <Card className="rounded-[8px] border border-[#03A5C0]/20 bg-background/50 shadow-sm">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Dépenses</p>
                    <p className="text-2xl font-bold text-red-600">{totalExpenses.toFixed(2)} €</p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-red-500/20 flex items-center justify-center">
                    <TrendingDown className="h-6 w-6 text-red-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Revenues Widget */}
          <Card className="rounded-[8px] border border-[#03A5C0]/20 bg-background/50 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-600" />
                Revenus
              </CardTitle>
            </CardHeader>
            <CardContent>
              {filteredRevenues.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nom</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Montant</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRevenues.map((revenue) => (
                      <TableRow key={revenue.id}>
                        <TableCell className="font-medium">{revenue.name}</TableCell>
                        <TableCell>{revenue.contact || '-'}</TableCell>
                        <TableCell>
                          <Badge variant={revenue.status === 'validated' ? 'default' : 'secondary'} className={revenue.status === 'validated' ? 'bg-green-500/20 text-green-600 border-green-500/30' : 'bg-yellow-500/20 text-yellow-600 border-yellow-500/30'}>
                            {revenue.status === 'validated' ? 'Validé' : 'En attente'}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-bold text-green-600">+{revenue.amount.toFixed(2)} €</TableCell>
                        <TableCell>{format(new Date(revenue.date), 'd MMM yyyy', { locale: fr })}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Aucun revenu pour cette période</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Expenses Widget */}
          <Card className="rounded-[8px] border border-[#03A5C0]/20 bg-background/50 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingDown className="h-5 w-5 text-red-600" />
                Dépenses
              </CardTitle>
            </CardHeader>
            <CardContent>
              {filteredExpenses.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nom</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Montant</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredExpenses.map((expense) => (
                      <TableRow key={expense.id}>
                        <TableCell className="font-medium">{expense.name}</TableCell>
                        <TableCell>{expense.contact || '-'}</TableCell>
                        <TableCell>
                          <Badge variant={expense.status === 'validated' ? 'default' : 'secondary'} className={expense.status === 'validated' ? 'bg-green-500/20 text-green-600 border-green-500/30' : 'bg-yellow-500/20 text-yellow-600 border-yellow-500/30'}>
                            {expense.status === 'validated' ? 'Validé' : 'En attente'}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-bold text-red-600">-{expense.amount.toFixed(2)} €</TableCell>
                        <TableCell>{format(new Date(expense.date), 'd MMM yyyy', { locale: fr })}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <TrendingDown className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Aucune dépense pour cette période</p>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Revenue Dialog */}
      <Dialog open={revenueDialogOpen} onOpenChange={setRevenueDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Nouveau revenu</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="revenue-name">Nom *</Label>
              <Input
                id="revenue-name"
                value={newRevenue.name}
                onChange={(e) => setNewRevenue({ ...newRevenue, name: e.target.value })}
                placeholder="Ex: Vente produit A"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="revenue-contact">Contact</Label>
              <Input
                id="revenue-contact"
                value={newRevenue.contact}
                onChange={(e) => setNewRevenue({ ...newRevenue, contact: e.target.value })}
                placeholder="Ex: client@email.com"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="revenue-amount">Montant (€) *</Label>
              <Input
                id="revenue-amount"
                type="number"
                step="0.01"
                value={newRevenue.amount}
                onChange={(e) => setNewRevenue({ ...newRevenue, amount: e.target.value })}
                placeholder="0.00"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="revenue-status">Statut</Label>
              <Select value={newRevenue.status} onValueChange={(v: 'validated' | 'pending') => setNewRevenue({ ...newRevenue, status: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">En attente</SelectItem>
                  <SelectItem value="validated">Validé</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevenueDialogOpen(false)}>Annuler</Button>
            <button
              onClick={handleAddRevenue}
              className="inline-flex items-center justify-center whitespace-nowrap font-medium text-sm gap-2 transition-all border rounded-full px-4 py-1.5"
              style={{ borderColor: 'rgb(3,165,192)', backgroundColor: 'rgba(3,165,192,0.1)', color: 'rgb(3,165,192)' }}
            >
              Enregistrer
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Expense Dialog */}
      <Dialog open={expenseDialogOpen} onOpenChange={setExpenseDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Nouvelle dépense</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="expense-name">Nom *</Label>
              <Input
                id="expense-name"
                value={newExpense.name}
                onChange={(e) => setNewExpense({ ...newExpense, name: e.target.value })}
                placeholder="Ex: Achat fournitures"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="expense-contact">Contact</Label>
              <Input
                id="expense-contact"
                value={newExpense.contact}
                onChange={(e) => setNewExpense({ ...newExpense, contact: e.target.value })}
                placeholder="Ex: fournisseur@email.com"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="expense-amount">Montant (€) *</Label>
              <Input
                id="expense-amount"
                type="number"
                step="0.01"
                value={newExpense.amount}
                onChange={(e) => setNewExpense({ ...newExpense, amount: e.target.value })}
                placeholder="0.00"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="expense-status">Statut</Label>
              <Select value={newExpense.status} onValueChange={(v: 'validated' | 'pending') => setNewExpense({ ...newExpense, status: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">En attente</SelectItem>
                  <SelectItem value="validated">Validé</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExpenseDialogOpen(false)}>Annuler</Button>
            <button
              onClick={handleAddExpense}
              className="inline-flex items-center justify-center whitespace-nowrap font-medium text-sm gap-2 transition-all border rounded-full px-4 py-1.5"
              style={{ borderColor: 'rgb(3,165,192)', backgroundColor: 'rgba(3,165,192,0.1)', color: 'rgb(3,165,192)' }}
            >
              Enregistrer
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
