/**
 * FormWidget - Formulaire de saisie de données
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import type { WidgetProps } from './WidgetRegistry';

interface FieldConfig {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'email' | 'select' | 'date';
  placeholder?: string;
  required?: boolean;
  options?: string[]; // Pour type='select'
}

export default function FormWidget({ widgetId, title, config, onUpdate }: WidgetProps) {
  const fields: FieldConfig[] = config.fields || [];
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (key: string, value: any) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Validation basique
      const requiredFields = fields.filter(f => f.required);
      const missing = requiredFields.filter(f => !formData[f.key]);

      if (missing.length > 0) {
        toast.error(`Champs requis: ${missing.map(f => f.label).join(', ')}`);
        return;
      }

      // Callback pour sauvegarder
      if (onUpdate) {
        await onUpdate(formData);
      }

      toast.success('Données enregistrées');
      setFormData({});
    } catch (error) {
      console.error('Form submission error:', error);
      toast.error('Erreur lors de l\'enregistrement');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderField = (field: FieldConfig) => {
    const value = formData[field.key] || '';

    switch (field.type) {
      case 'textarea':
        return (
          <Textarea
            id={field.key}
            placeholder={field.placeholder}
            value={value}
            onChange={(e) => handleChange(field.key, e.target.value)}
            required={field.required}
            rows={4}
          />
        );

      case 'select':
        return (
          <Select value={value} onValueChange={(v) => handleChange(field.key, v)}>
            <SelectTrigger>
              <SelectValue placeholder={field.placeholder || 'Sélectionner...'} />
            </SelectTrigger>
            <SelectContent>
              {(field.options || []).map(option => (
                <SelectItem key={option} value={option}>{option}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      default:
        return (
          <Input
            id={field.key}
            type={field.type}
            placeholder={field.placeholder}
            value={value}
            onChange={(e) => handleChange(field.key, e.target.value)}
            required={field.required}
          />
        );
    }
  };

  return (
    <div className="space-y-4 h-full flex flex-col">
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>

      <form onSubmit={handleSubmit} className="flex-1 space-y-4">
        {fields.map((field) => (
          <div key={field.key} className="space-y-2">
            <Label htmlFor={field.key}>
              {field.label}
              {field.required && <span className="text-destructive ml-1">*</span>}
            </Label>
            {renderField(field)}
          </div>
        ))}

        <Button
          type="submit"
          disabled={isSubmitting}
          className="w-full"
          style={{
            backgroundColor: '#03A5C0',
            color: 'white'
          }}
        >
          {isSubmitting ? 'Enregistrement...' : 'Enregistrer'}
        </Button>
      </form>
    </div>
  );
}
