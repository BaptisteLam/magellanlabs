import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Plus, 
  Trash2, 
  Loader2, 
  ArrowUp,
  FileText,
  Building2,
  User,
  Package,
  Palette
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface InvoiceLine {
  designation: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price_ht: number;
  tva_rate: number;
  discount_percent: number;
}

interface InvoiceCreatorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  onSuccess: () => void;
  existingInvoicesCount: number;
}

export function InvoiceCreatorDialog({ 
  open, 
  onOpenChange, 
  projectId,
  onSuccess,
  existingInvoicesCount 
}: InvoiceCreatorDialogProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedHtml, setGeneratedHtml] = useState<string | null>(null);
  const [promptLibre, setPromptLibre] = useState('');

  // Type de document
  const [typeDocument, setTypeDocument] = useState<'devis' | 'facture'>('devis');

  // Informations document
  const [docNumber, setDocNumber] = useState('');
  const [docDate, setDocDate] = useState(new Date().toISOString().split('T')[0]);
  const [docDateValidite, setDocDateValidite] = useState('');

  // Émetteur
  const [emetteurNom, setEmetteurNom] = useState('');
  const [emetteurForme, setEmetteurForme] = useState('');
  const [emetteurSiret, setEmetteurSiret] = useState('');
  const [emetteurTva, setEmetteurTva] = useState('');
  const [emetteurAdresse, setEmetteurAdresse] = useState('');
  const [emetteurEmail, setEmetteurEmail] = useState('');
  const [emetteurTelephone, setEmetteurTelephone] = useState('');

  // Client
  const [clientNom, setClientNom] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientTelephone, setClientTelephone] = useState('');
  const [clientAdresse, setClientAdresse] = useState('');

  // Lignes
  const [lignes, setLignes] = useState<InvoiceLine[]>([
    { designation: '', description: '', quantity: 1, unit: 'unité', unit_price_ht: 0, tva_rate: 20, discount_percent: 0 }
  ]);

  // Conditions
  const [conditionsPaiement, setConditionsPaiement] = useState('Paiement à 30 jours');
  const [modePaiement, setModePaiement] = useState('Virement bancaire');
  const [referencesBancaires, setReferencesBancaires] = useState('');
  const [mentionsLegales, setMentionsLegales] = useState('');

  // Template
  const [couleurPrincipale, setCouleurPrincipale] = useState('#03A5C0');

  const generateDocNumber = () => {
    const year = new Date().getFullYear();
    const count = existingInvoicesCount + 1;
    const prefix = typeDocument === 'devis' ? 'DEV' : 'FAC';
    return `${prefix}-${year}-${String(count).padStart(4, '0')}`;
  };

  const addLigne = () => {
    setLignes([...lignes, { 
      designation: '', 
      description: '', 
      quantity: 1, 
      unit: 'unité', 
      unit_price_ht: 0, 
      tva_rate: 20, 
      discount_percent: 0 
    }]);
  };

  const removeLigne = (index: number) => {
    if (lignes.length > 1) {
      setLignes(lignes.filter((_, i) => i !== index));
    }
  };

  const updateLigne = (index: number, field: keyof InvoiceLine, value: string | number) => {
    const updated = [...lignes];
    updated[index] = { ...updated[index], [field]: value };
    setLignes(updated);
  };

  // Calcul des totaux
  const calculateTotals = () => {
    let sous_total_ht = 0;
    let montant_total_remises = 0;
    let total_tva = 0;

    for (const ligne of lignes) {
      const montant_ligne_ht = ligne.quantity * ligne.unit_price_ht;
      const remise = montant_ligne_ht * (ligne.discount_percent / 100);
      const montant_apres_remise = montant_ligne_ht - remise;
      const tva_ligne = montant_apres_remise * (ligne.tva_rate / 100);

      sous_total_ht += montant_ligne_ht;
      montant_total_remises += remise;
      total_tva += tva_ligne;
    }

    const total_ht = sous_total_ht - montant_total_remises;
    const total_ttc = total_ht + total_tva;

    return { sous_total_ht, montant_total_remises, total_ht, total_tva, total_ttc };
  };

  const totals = calculateTotals();

  const handleGenerate = async () => {
    if (!emetteurNom || !clientNom || lignes.every(l => !l.designation)) {
      toast.error('Veuillez remplir au minimum: société émettrice, client et une ligne de prestation');
      return;
    }

    setIsGenerating(true);
    try {
      const payload = {
        type_document: typeDocument,
        informations_document: {
          numero: docNumber || generateDocNumber(),
          date_document: docDate,
          date_validite_ou_echeance: docDateValidite
        },
        emetteur: {
          nom_societe: emetteurNom,
          forme_juridique: emetteurForme || undefined,
          siret: emetteurSiret || undefined,
          tva: emetteurTva || undefined,
          adresse: emetteurAdresse,
          email: emetteurEmail,
          telephone: emetteurTelephone
        },
        client: {
          nom: clientNom,
          email: clientEmail,
          telephone: clientTelephone || undefined,
          adresse: clientAdresse
        },
        lignes: lignes.filter(l => l.designation),
        conditions_paiement: conditionsPaiement || undefined,
        mode_paiement: modePaiement || undefined,
        references_bancaires: referencesBancaires || undefined,
        mentions_legales: mentionsLegales || undefined,
        options_template: {
          couleur_principale: couleurPrincipale
        },
        prompt_libre: promptLibre
      };

      const { data, error } = await supabase.functions.invoke('generate-invoice', {
        body: payload
      });

      if (error) throw error;

      if (data.success && data.document_html) {
        setGeneratedHtml(data.document_html);
        toast.success(`${typeDocument === 'devis' ? 'Devis' : 'Facture'} généré(e) avec succès`);
      } else {
        throw new Error(data.error || 'Erreur de génération');
      }
    } catch (error) {
      console.error('Error generating invoice:', error);
      toast.error('Erreur lors de la génération du document');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = () => {
    if (!generatedHtml) return;

    const blob = new Blob([generatedHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${typeDocument}-${docNumber || generateDocNumber()}.html`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Document téléchargé');
  };

  const handleSaveAndClose = async () => {
    try {
      // Sauvegarder dans la base de données via le hook parent
      toast.success('Document enregistré');
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving invoice:', error);
      toast.error('Erreur lors de l\'enregistrement');
    }
  };

  if (generatedHtml) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0">
          <DialogHeader className="p-6 pb-4 border-b">
            <DialogTitle>Aperçu du document</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto p-4 bg-muted/30">
            <iframe
              srcDoc={generatedHtml}
              className="w-full h-full bg-white rounded-lg shadow-lg"
              style={{ minHeight: '600px' }}
            />
          </div>
          <div className="p-4 border-t flex justify-between gap-3">
            <Button 
              variant="outline" 
              onClick={() => setGeneratedHtml(null)}
              className="rounded-lg"
            >
              Modifier
            </Button>
            <div className="flex gap-3">
              <Button 
                variant="outline" 
                onClick={handleDownload}
                className="rounded-lg"
              >
                Télécharger HTML
              </Button>
              <Button 
                onClick={handleSaveAndClose}
                className="rounded-full border-[#03A5C0] bg-[#03A5C0]/10 text-[#03A5C0] hover:bg-[#03A5C0]/20"
                variant="outline"
              >
                Enregistrer et fermer
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0 gap-0">
        {/* Header */}
        <DialogHeader className="p-6 pb-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-[#03A5C0]" />
            Nouveau document
          </DialogTitle>
        </DialogHeader>

        {/* Scrollable content */}
        <ScrollArea className="flex-1">
          <div className="p-6 space-y-8">
            
            {/* Type de document */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Type de document</Label>
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant={typeDocument === 'devis' ? 'default' : 'outline'}
                  onClick={() => setTypeDocument('devis')}
                  className={`flex-1 rounded-lg ${typeDocument === 'devis' ? 'bg-[#03A5C0] hover:bg-[#03A5C0]/90' : ''}`}
                >
                  Devis
                </Button>
                <Button
                  type="button"
                  variant={typeDocument === 'facture' ? 'default' : 'outline'}
                  onClick={() => setTypeDocument('facture')}
                  className={`flex-1 rounded-lg ${typeDocument === 'facture' ? 'bg-[#03A5C0] hover:bg-[#03A5C0]/90' : ''}`}
                >
                  Facture
                </Button>
              </div>
            </div>

            {/* Informations document */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <FileText className="h-4 w-4" />
                Informations document
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Numéro</Label>
                  <Input
                    placeholder={generateDocNumber()}
                    value={docNumber}
                    onChange={(e) => setDocNumber(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Date du document</Label>
                  <Input
                    type="date"
                    value={docDate}
                    onChange={(e) => setDocDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{typeDocument === 'devis' ? 'Date de validité' : "Date d'échéance"}</Label>
                  <Input
                    type="date"
                    value={docDateValidite}
                    onChange={(e) => setDocDateValidite(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Émetteur */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Building2 className="h-4 w-4" />
                Émetteur
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nom de la société *</Label>
                  <Input
                    placeholder="Ma Société"
                    value={emetteurNom}
                    onChange={(e) => setEmetteurNom(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Forme juridique</Label>
                  <Input
                    placeholder="SARL, SAS, Auto-entrepreneur..."
                    value={emetteurForme}
                    onChange={(e) => setEmetteurForme(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>SIRET</Label>
                  <Input
                    placeholder="123 456 789 00001"
                    value={emetteurSiret}
                    onChange={(e) => setEmetteurSiret(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>N° TVA</Label>
                  <Input
                    placeholder="FR 12 345678901"
                    value={emetteurTva}
                    onChange={(e) => setEmetteurTva(e.target.value)}
                  />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label>Adresse</Label>
                  <Input
                    placeholder="123 rue de la Paix, 75001 Paris"
                    value={emetteurAdresse}
                    onChange={(e) => setEmetteurAdresse(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    placeholder="contact@societe.fr"
                    value={emetteurEmail}
                    onChange={(e) => setEmetteurEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Téléphone</Label>
                  <Input
                    placeholder="01 23 45 67 89"
                    value={emetteurTelephone}
                    onChange={(e) => setEmetteurTelephone(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Client */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <User className="h-4 w-4" />
                Client
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nom / Entreprise *</Label>
                  <Input
                    placeholder="Client ou Entreprise"
                    value={clientNom}
                    onChange={(e) => setClientNom(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    placeholder="client@email.com"
                    value={clientEmail}
                    onChange={(e) => setClientEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Téléphone</Label>
                  <Input
                    placeholder="01 23 45 67 89"
                    value={clientTelephone}
                    onChange={(e) => setClientTelephone(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Adresse</Label>
                  <Input
                    placeholder="Adresse du client"
                    value={clientAdresse}
                    onChange={(e) => setClientAdresse(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Lignes de prestations */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Package className="h-4 w-4" />
                  Lignes de prestations / produits
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addLigne}
                  className="rounded-lg"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Ajouter
                </Button>
              </div>

              <div className="space-y-4">
                {lignes.map((ligne, index) => (
                  <div key={index} className="p-4 border rounded-lg space-y-3 bg-muted/20">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 space-y-2">
                        <Label>Désignation *</Label>
                        <Input
                          placeholder="Nom du produit ou service"
                          value={ligne.designation}
                          onChange={(e) => updateLigne(index, 'designation', e.target.value)}
                        />
                      </div>
                      {lignes.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeLigne(index)}
                          className="text-destructive hover:text-destructive mt-7"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>Description</Label>
                      <Textarea
                        placeholder="Description détaillée (optionnel)"
                        value={ligne.description}
                        onChange={(e) => updateLigne(index, 'description', e.target.value)}
                        rows={2}
                      />
                    </div>
                    <div className="grid grid-cols-5 gap-3">
                      <div className="space-y-2">
                        <Label>Quantité</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={ligne.quantity}
                          onChange={(e) => updateLigne(index, 'quantity', parseFloat(e.target.value) || 0)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Unité</Label>
                        <Select
                          value={ligne.unit}
                          onValueChange={(v) => updateLigne(index, 'unit', v)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="unité">Unité</SelectItem>
                            <SelectItem value="heure">Heure</SelectItem>
                            <SelectItem value="jour">Jour</SelectItem>
                            <SelectItem value="mois">Mois</SelectItem>
                            <SelectItem value="forfait">Forfait</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Prix U. HT (€)</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={ligne.unit_price_ht}
                          onChange={(e) => updateLigne(index, 'unit_price_ht', parseFloat(e.target.value) || 0)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>TVA (%)</Label>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          value={ligne.tva_rate}
                          onChange={(e) => updateLigne(index, 'tva_rate', parseFloat(e.target.value) || 0)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Remise (%)</Label>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          value={ligne.discount_percent}
                          onChange={(e) => updateLigne(index, 'discount_percent', parseFloat(e.target.value) || 0)}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Totaux */}
              <div className="flex justify-end">
                <div className="w-64 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Sous-total HT:</span>
                    <span>{totals.sous_total_ht.toFixed(2)} €</span>
                  </div>
                  {totals.montant_total_remises > 0 && (
                    <div className="flex justify-between text-orange-600">
                      <span>Remises:</span>
                      <span>-{totals.montant_total_remises.toFixed(2)} €</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total HT:</span>
                    <span>{totals.total_ht.toFixed(2)} €</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">TVA:</span>
                    <span>{totals.total_tva.toFixed(2)} €</span>
                  </div>
                  <div className="flex justify-between font-semibold text-base pt-2 border-t" style={{ color: couleurPrincipale }}>
                    <span>Total TTC:</span>
                    <span>{totals.total_ttc.toFixed(2)} €</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Conditions */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                Conditions et mentions
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Conditions de paiement</Label>
                  <Input
                    placeholder="Paiement à 30 jours"
                    value={conditionsPaiement}
                    onChange={(e) => setConditionsPaiement(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Mode de paiement</Label>
                  <Input
                    placeholder="Virement bancaire"
                    value={modePaiement}
                    onChange={(e) => setModePaiement(e.target.value)}
                  />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label>Références bancaires</Label>
                  <Textarea
                    placeholder="IBAN: FR76 ... / BIC: ..."
                    value={referencesBancaires}
                    onChange={(e) => setReferencesBancaires(e.target.value)}
                    rows={2}
                  />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label>Mentions légales</Label>
                  <Textarea
                    placeholder="Mentions légales ou notes additionnelles..."
                    value={mentionsLegales}
                    onChange={(e) => setMentionsLegales(e.target.value)}
                    rows={2}
                  />
                </div>
              </div>
            </div>

            {/* Template et style */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Palette className="h-4 w-4" />
                Style du document
              </div>
              <div className="flex items-center gap-4">
                <div className="space-y-2">
                  <Label>Couleur principale</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={couleurPrincipale}
                      onChange={(e) => setCouleurPrincipale(e.target.value)}
                      className="w-10 h-10 rounded cursor-pointer border-0"
                    />
                    <Input
                      value={couleurPrincipale}
                      onChange={(e) => setCouleurPrincipale(e.target.value)}
                      className="w-28"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>

        {/* Prompt bar fusionnée en bas */}
        <div className="shrink-0 border-t bg-muted/30 p-4">
          <div className="flex items-center gap-3">
            <div className="flex-1 relative">
              <Textarea
                placeholder="Ajoutez des instructions à l'IA pour personnaliser le devis ou la facture (ex: ajoute une remise de 10%, formule une phrase d'introduction, etc.)"
                value={promptLibre}
                onChange={(e) => setPromptLibre(e.target.value)}
                rows={2}
                className="resize-none pr-12"
              />
            </div>
            <Button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="h-12 rounded-full border-[#03A5C0] bg-[#03A5C0] text-white hover:bg-[#03A5C0]/90 px-6"
            >
              {isGenerating ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  <ArrowUp className="h-5 w-5 mr-2" />
                  Générer
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
