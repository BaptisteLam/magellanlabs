/**
 * TemplateGallery - Galerie de templates de widgets par secteur
 * Permet l'installation rapide de widgets préconfigurés selon le métier
 */

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { WIDGET_TEMPLATES, getAllSectors } from '@/data/widgetTemplates';
import { crmGenerator } from '@/services/crmGenerator';
import { useToast } from '@/hooks/use-toast';
import {
  Sparkles,
  Grid,
  CheckCircle2,
  ArrowRight,
  Loader2,
} from 'lucide-react';

export interface TemplateGalleryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  moduleId: string;
  onTemplatesInstalled?: () => void;
}

export function TemplateGallery({
  open,
  onOpenChange,
  moduleId,
  onTemplatesInstalled,
}: TemplateGalleryProps) {
  const [selectedSectorId, setSelectedSectorId] = useState<string | null>(null);
  const [isInstalling, setIsInstalling] = useState(false);
  const { toast } = useToast();

  const sectors = getAllSectors();
  const selectedTemplate = selectedSectorId
    ? WIDGET_TEMPLATES.find((t) => t.id === selectedSectorId)
    : null;

  const handleInstallTemplates = async () => {
    if (!selectedTemplate) return;

    setIsInstalling(true);

    try {
      // Créer tous les widgets du template
      const createPromises = selectedTemplate.widgets.map((widget) =>
        crmGenerator.createWidget(moduleId, {
          widget_type: widget.widget_type,
          title: widget.title,
          config: widget.config,
          layout: widget.layout,
        })
      );

      await Promise.all(createPromises);

      toast({
        title: 'Templates installés !',
        description: `${selectedTemplate.widgets.length} widgets ajoutés au module`,
      });

      if (onTemplatesInstalled) {
        onTemplatesInstalled();
      }

      onOpenChange(false);
    } catch (error: any) {
      console.error('[TemplateGallery] Error installing templates:', error);
      toast({
        title: 'Erreur',
        description: error.message || 'Échec de l\'installation des templates',
        variant: 'destructive',
      });
    } finally {
      setIsInstalling(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[85vh] p-0 bg-card/95 backdrop-blur-md border-[#03A5C0]/20">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/50">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-lg bg-[#03A5C0]/10 flex items-center justify-center">
              <Grid className="w-5 h-5 text-[#03A5C0]" />
            </div>
            <div>
              <DialogTitle className="text-xl font-semibold">
                Galerie de Templates
              </DialogTitle>
              <DialogDescription>
                Installez des widgets préconfigurés selon votre secteur d'activité
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex h-full overflow-hidden">
          {/* Panel gauche : Secteurs */}
          <div className="w-64 border-r border-border/50 p-4">
            <p className="text-sm font-semibold text-muted-foreground mb-3 px-2">
              Secteurs disponibles
            </p>
            <ScrollArea className="h-[calc(85vh-12rem)]">
              <div className="space-y-2">
                {sectors.map((sector) => {
                  const isSelected = selectedSectorId === sector.id;
                  return (
                    <motion.button
                      key={sector.id}
                      onClick={() => setSelectedSectorId(sector.id)}
                      className={`w-full text-left px-3 py-2.5 rounded-lg transition-all ${
                        isSelected
                          ? 'bg-[#03A5C0]/10 border-[#03A5C0]/50 border'
                          : 'bg-muted/30 hover:bg-muted/50 border border-transparent'
                      }`}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{sector.icon}</span>
                        <div className="flex-1">
                          <p
                            className={`text-sm font-medium ${
                              isSelected ? 'text-[#03A5C0]' : ''
                            }`}
                          >
                            {sector.name}
                          </p>
                        </div>
                        {isSelected && (
                          <CheckCircle2 className="w-4 h-4 text-[#03A5C0]" />
                        )}
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </ScrollArea>
          </div>

          {/* Panel droit : Preview des widgets */}
          <div className="flex-1 flex flex-col">
            {selectedTemplate ? (
              <>
                <ScrollArea className="flex-1 p-6">
                  <div className="mb-4">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-4xl">{selectedTemplate.sectorIcon}</span>
                      <div>
                        <h3 className="text-lg font-semibold">
                          {selectedTemplate.sector}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {selectedTemplate.widgets.length} widgets préconfigurés
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Liste des widgets */}
                  <div className="space-y-3">
                    {selectedTemplate.widgets.map((widget, index) => (
                      <motion.div
                        key={index}
                        className="p-4 rounded-lg bg-card/80 border border-border/50 hover:border-[#03A5C0]/30 transition-colors"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-lg bg-[#03A5C0]/10 flex items-center justify-center flex-shrink-0">
                            <Sparkles className="w-5 h-5 text-[#03A5C0]" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-semibold text-sm">
                                {widget.title}
                              </h4>
                              <Badge
                                variant="outline"
                                className="text-xs border-[#03A5C0]/30 text-[#03A5C0]"
                              >
                                {widget.widget_type}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {widget.description}
                            </p>
                            <div className="flex gap-2 mt-2">
                              <Badge variant="secondary" className="text-xs">
                                {widget.layout.w}/12 largeur
                              </Badge>
                              <Badge variant="secondary" className="text-xs">
                                {widget.layout.h} hauteur
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </ScrollArea>

                {/* Footer avec bouton d'installation */}
                <div className="border-t border-border/50 p-4 bg-card/50">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">
                        {selectedTemplate.widgets.length} widgets seront ajoutés
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Vous pourrez les personnaliser après installation
                      </p>
                    </div>
                    <Button
                      onClick={handleInstallTemplates}
                      disabled={isInstalling}
                      className="bg-[#03A5C0] hover:bg-[#03A5C0]/90 text-white"
                    >
                      {isInstalling ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Installation...
                        </>
                      ) : (
                        <>
                          Installer les templates
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              // État vide
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center max-w-sm px-4">
                  <div className="w-16 h-16 rounded-full bg-muted/30 flex items-center justify-center mx-auto mb-4">
                    <Grid className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium text-foreground mb-1">
                    Sélectionnez un secteur
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Choisissez votre secteur d'activité pour voir les templates
                    disponibles
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
