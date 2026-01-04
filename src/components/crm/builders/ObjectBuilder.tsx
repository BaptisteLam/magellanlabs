/**
 * ObjectBuilder - Constructeur d'objets CRM
 * Permet de créer et modifier des object_definitions
 */

import { useState, useEffect } from 'react';
import { ObjectDefinition } from '@/types/crm-objects';
import { crmGenerator } from '@/services/crmGenerator';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Save, X, Palette } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { toast } from 'sonner';
import { FieldBuilder } from './FieldBuilder';

interface ObjectBuilderProps {
  projectId: string;
  objectId?: string; // Si fourni, on édite l'objet existant
  onSave?: (objectDef: ObjectDefinition) => void;
  onCancel?: () => void;
}

// Liste des icônes populaires pour le CRM
const POPULAR_ICONS = [
  'Users',
  'Building',
  'Briefcase',
  'ShoppingCart',
  'Package',
  'Calendar',
  'FileText',
  'DollarSign',
  'Mail',
  'Phone',
  'MapPin',
  'Tag',
  'Star',
  'Heart',
  'Zap',
];

// Liste des couleurs prédéfinies
const PRESET_COLORS = [
  '#03A5C0', // Magellan Cyan
  '#10B981', // Green
  '#F59E0B', // Amber
  '#EF4444', // Red
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#3B82F6', // Blue
];

export function ObjectBuilder({ projectId, objectId, onSave, onCancel }: ObjectBuilderProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [singularLabel, setSingularLabel] = useState('');
  const [pluralLabel, setPluralLabel] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('Box');
  const [color, setColor] = useState('#03A5C0');
  const [fields, setFields] = useState<ObjectDefinition['fields']>([]);
  const [viewConfig, setViewConfig] = useState({
    default: 'table',
    available: ['table', 'kanban', 'timeline', 'calendar'],
  });

  // Charger l'objet existant si objectId est fourni
  useEffect(() => {
    if (objectId) {
      loadObject();
    }
  }, [objectId]);

  const loadObject = async () => {
    setIsLoading(true);
    try {
      const objectDef = await crmGenerator.getObjectDefinition(projectId, objectId!);
      if (objectDef) {
        setName(objectDef.name);
        setSingularLabel(objectDef.singularLabel);
        setPluralLabel(objectDef.pluralLabel);
        setDescription(objectDef.description || '');
        setIcon(objectDef.icon || 'Box');
        setColor(objectDef.color || '#03A5C0');
        setFields(objectDef.fields || []);
        setViewConfig(objectDef.viewConfig || viewConfig);
      }
    } catch (error) {
      console.error('Error loading object:', error);
      toast.error('Erreur lors du chargement de l\'objet');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    // Validation
    if (!name || !singularLabel || !pluralLabel) {
      toast.error('Veuillez remplir tous les champs obligatoires');
      return;
    }

    if (fields.length === 0) {
      toast.error('Ajoutez au moins un champ à votre objet');
      return;
    }

    setIsSaving(true);
    try {
      let result: ObjectDefinition;

      if (objectId) {
        // Update existing
        await crmGenerator.updateObjectDefinition(objectId, {
          name,
          singularLabel,
          pluralLabel,
          description,
          icon,
          color,
          fields,
          viewConfig,
        } as Partial<ObjectDefinition>);

        const updated = await crmGenerator.getObjectDefinition(projectId, name);
        result = updated!;
      } else {
        // Create new
        result = await crmGenerator.createObjectDefinition(projectId, {
          name,
          singularLabel,
          pluralLabel,
          description,
          icon,
          color,
          fields,
          viewConfig,
          displayOrder: 0,
          isSystem: false,
          generatedByAi: false,
        } as Partial<ObjectDefinition>);
      }

      toast.success(objectId ? 'Objet mis à jour' : 'Objet créé avec succès');
      onSave?.(result);
    } catch (error) {
      console.error('Error saving object:', error);
      toast.error('Erreur lors de l\'enregistrement');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="general" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="general">Général</TabsTrigger>
          <TabsTrigger value="fields">Champs ({fields.length})</TabsTrigger>
          <TabsTrigger value="views">Vues</TabsTrigger>
        </TabsList>

        {/* General Tab */}
        <TabsContent value="general" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Informations générales</CardTitle>
              <CardDescription>
                Configurez les propriétés de base de votre objet CRM
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Name (technical) */}
              <div className="space-y-2">
                <Label htmlFor="name">
                  Nom technique <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
                  placeholder="contacts"
                  disabled={!!objectId} // Cannot change name after creation
                  className="font-mono"
                />
                <p className="text-xs text-gray-400">
                  Nom utilisé dans la base de données (lettres minuscules, chiffres, underscores)
                </p>
              </div>

              {/* Singular Label */}
              <div className="space-y-2">
                <Label htmlFor="singularLabel">
                  Label singulier <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="singularLabel"
                  value={singularLabel}
                  onChange={(e) => setSingularLabel(e.target.value)}
                  placeholder="Contact"
                />
              </div>

              {/* Plural Label */}
              <div className="space-y-2">
                <Label htmlFor="pluralLabel">
                  Label pluriel <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="pluralLabel"
                  value={pluralLabel}
                  onChange={(e) => setPluralLabel(e.target.value)}
                  placeholder="Contacts"
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Gestion des contacts clients et prospects"
                  rows={3}
                />
              </div>

              {/* Icon */}
              <div className="space-y-2">
                <Label>Icône</Label>
                <div className="grid grid-cols-8 gap-2">
                  {POPULAR_ICONS.map((iconName) => {
                    const IconComponent = (LucideIcons as any)[iconName];
                    return (
                      <button
                        key={iconName}
                        onClick={() => setIcon(iconName)}
                        className={`p-2 rounded-lg border-2 transition-colors ${
                          icon === iconName
                            ? 'border-cyan-500 bg-cyan-500/10'
                            : 'border-white/10 hover:border-white/30'
                        }`}
                      >
                        <IconComponent className="w-5 h-5" />
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Color */}
              <div className="space-y-2">
                <Label>Couleur</Label>
                <div className="flex items-center gap-2">
                  {PRESET_COLORS.map((presetColor) => (
                    <button
                      key={presetColor}
                      onClick={() => setColor(presetColor)}
                      className={`w-8 h-8 rounded-full border-2 transition-transform ${
                        color === presetColor
                          ? 'border-white scale-110'
                          : 'border-transparent'
                      }`}
                      style={{ backgroundColor: presetColor }}
                    />
                  ))}
                  <Input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="w-16 h-8"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Fields Tab */}
        <TabsContent value="fields" className="space-y-4">
          <FieldBuilder
            fields={fields}
            onChange={setFields}
          />
        </TabsContent>

        {/* Views Tab */}
        <TabsContent value="views" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Configuration des vues</CardTitle>
              <CardDescription>
                Choisissez les vues disponibles pour cet objet
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Vue par défaut</Label>
                <Select
                  value={viewConfig.default}
                  onValueChange={(value) =>
                    setViewConfig({ ...viewConfig, default: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="table">Table</SelectItem>
                    <SelectItem value="kanban">Kanban</SelectItem>
                    <SelectItem value="timeline">Timeline</SelectItem>
                    <SelectItem value="calendar">Calendrier</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Vues disponibles</Label>
                <div className="space-y-2">
                  {['table', 'kanban', 'timeline', 'calendar'].map((view) => (
                    <label key={view} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={viewConfig.available.includes(view)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setViewConfig({
                              ...viewConfig,
                              available: [...viewConfig.available, view],
                            });
                          } else {
                            setViewConfig({
                              ...viewConfig,
                              available: viewConfig.available.filter((v) => v !== view),
                            });
                          }
                        }}
                        className="w-4 h-4"
                      />
                      <span className="capitalize">{view}</span>
                    </label>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 pt-4 border-t border-white/10">
        <Button variant="outline" onClick={onCancel}>
          <X className="w-4 h-4 mr-2" />
          Annuler
        </Button>
        <Button
          onClick={handleSave}
          disabled={isSaving}
          className="bg-cyan-500 hover:bg-cyan-600"
        >
          {isSaving ? (
            <>
              <div className="w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Enregistrement...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              {objectId ? 'Mettre à jour' : 'Créer l\'objet'}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
