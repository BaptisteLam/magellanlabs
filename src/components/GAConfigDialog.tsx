import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/magellan/client";
import { toast } from "sonner";

interface GAConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  websiteId: string;
  onSuccess: (propertyId: string, measurementId: string) => void;
}

export default function GAConfigDialog({ open, onOpenChange, websiteId, onSuccess }: GAConfigDialogProps) {
  const [propertyId, setPropertyId] = useState('');
  const [measurementId, setMeasurementId] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!propertyId.trim() || !measurementId.trim()) {
      toast.error("Veuillez remplir tous les champs");
      return;
    }

    if (!measurementId.startsWith('G-')) {
      toast.error("Le Measurement ID doit commencer par 'G-'");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('websites')
        .update({
          ga_property_id: propertyId.trim(),
          ga_measurement_id: measurementId.trim(),
        })
        .eq('id', websiteId);

      if (error) throw error;

      toast.success("Configuration Google Analytics enregistrée !");
      onSuccess(propertyId.trim(), measurementId.trim());
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error saving GA config:', error);
      toast.error("Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Configuration Google Analytics 4</DialogTitle>
          <DialogDescription>
            Configurez votre compte Google Analytics pour voir les statistiques de votre site.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="property-id">Property ID</Label>
            <Input
              id="property-id"
              placeholder="123456789"
              value={propertyId}
              onChange={(e) => setPropertyId(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Trouvez-le dans Google Analytics : Admin → Informations sur la propriété → ID DE LA PROPRIÉTÉ
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="measurement-id">Measurement ID</Label>
            <Input
              id="measurement-id"
              placeholder="G-XXXXXXXXXX"
              value={measurementId}
              onChange={(e) => setMeasurementId(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Trouvez-le dans Google Analytics : Admin → Flux de données → Sélectionnez votre flux → ID DE MESURE
            </p>
          </div>

          <div className="rounded-lg bg-blue-50 dark:bg-blue-950 p-4 text-sm">
            <p className="font-semibold mb-2">💡 Comment obtenir ces informations :</p>
            <ol className="list-decimal list-inside space-y-1 text-xs">
              <li>Créez un compte sur <a href="https://analytics.google.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">analytics.google.com</a></li>
              <li>Créez une propriété GA4</li>
              <li>Créez un flux de données Web avec l'URL de votre site</li>
              <li>Récupérez les identifiants ci-dessus</li>
            </ol>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Enregistrement..." : "Enregistrer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
