/**
 * Composant pour afficher et éditer dynamiquement un champ
 * Supporte tous les types de champs du CRM flexible
 */

import { FieldDefinition } from '@/types/crm-objects';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { CalendarIcon, Star } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface DynamicFieldProps {
  field: FieldDefinition;
  value: unknown;
  onChange: (value: unknown) => void;
  error?: string;
  disabled?: boolean;
  className?: string;
}

export function DynamicField({
  field,
  value,
  onChange,
  error,
  disabled,
  className
}: DynamicFieldProps) {
  const renderField = () => {
    switch (field.type) {
      case 'text':
      case 'email':
      case 'phone':
      case 'url':
        return (
          <Input
            type={field.type === 'email' ? 'email' : field.type === 'url' ? 'url' : 'text'}
            value={(value as string) ?? ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.config?.placeholder || field.label}
            disabled={disabled}
            className={cn(error && 'border-red-500', className)}
            maxLength={field.config?.maxLength}
          />
        );

      case 'number':
      case 'currency':
        return (
          <div className="relative">
            {field.type === 'currency' && (
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                {field.config?.currency ?? '€'}
              </span>
            )}
            <Input
              type="number"
              value={(value as number) ?? ''}
              onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
              disabled={disabled}
              className={cn(
                field.type === 'currency' && 'pl-8',
                error && 'border-red-500',
                className
              )}
              min={field.config?.min}
              max={field.config?.max}
              step={field.config?.precision ? Math.pow(10, -field.config.precision) : 1}
            />
          </div>
        );

      case 'checkbox':
        return (
          <div className="flex items-center gap-2">
            <Checkbox
              checked={(value as boolean) ?? false}
              onCheckedChange={onChange}
              disabled={disabled}
              id={field.id}
            />
            <label
              htmlFor={field.id}
              className="text-sm text-gray-300 cursor-pointer select-none"
            >
              {field.label}
            </label>
          </div>
        );

      case 'select':
      case 'status':
        return (
          <Select
            value={(value as string) ?? ''}
            onValueChange={onChange}
            disabled={disabled}
          >
            <SelectTrigger className={cn(error && 'border-red-500', className)}>
              <SelectValue placeholder={field.config?.placeholder || `Sélectionner ${field.label}`} />
            </SelectTrigger>
            <SelectContent>
              {field.config?.options?.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  <div className="flex items-center gap-2">
                    {option.color && (
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: option.color }}
                      />
                    )}
                    {option.icon && <span>{option.icon}</span>}
                    <span>{option.label}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'multi_select':
        const selectedValues = (value as string[]) ?? [];
        return (
          <div className={cn("flex flex-wrap gap-2 p-2 border rounded-md min-h-[40px]", className)}>
            {field.config?.options?.map((option) => {
              const isSelected = selectedValues.includes(option.id);
              return (
                <Badge
                  key={option.id}
                  variant={isSelected ? 'default' : 'outline'}
                  className={cn(
                    "cursor-pointer transition-all",
                    isSelected && "bg-cyan-500 hover:bg-cyan-600"
                  )}
                  style={isSelected && option.color ? { backgroundColor: option.color } : undefined}
                  onClick={() => {
                    if (disabled) return;
                    const newValue = isSelected
                      ? selectedValues.filter(v => v !== option.id)
                      : [...selectedValues, option.id];
                    onChange(newValue);
                  }}
                >
                  {option.icon && <span className="mr-1">{option.icon}</span>}
                  {option.label}
                </Badge>
              );
            })}
          </div>
        );

      case 'date':
      case 'datetime':
        const dateValue = value ? new Date(value as string) : undefined;
        return (
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !dateValue && "text-gray-400",
                  error && "border-red-500",
                  className
                )}
                disabled={disabled}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateValue ? (
                  format(dateValue, field.type === 'datetime' ? 'PPP HH:mm' : 'PPP', { locale: fr })
                ) : (
                  <span>Sélectionner une date</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={dateValue}
                onSelect={(date) => onChange(date?.toISOString())}
                initialFocus
              />
              {field.type === 'datetime' && dateValue && (
                <div className="p-3 border-t">
                  <Input
                    type="time"
                    value={format(dateValue, 'HH:mm')}
                    onChange={(e) => {
                      const [hours, minutes] = e.target.value.split(':');
                      const newDate = new Date(dateValue);
                      newDate.setHours(parseInt(hours), parseInt(minutes));
                      onChange(newDate.toISOString());
                    }}
                  />
                </div>
              )}
            </PopoverContent>
          </Popover>
        );

      case 'rating':
        const ratingValue = (value as number) ?? 0;
        return (
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => !disabled && onChange(star)}
                disabled={disabled}
                className={cn(
                  'text-2xl transition-all hover:scale-110',
                  disabled && 'opacity-50 cursor-not-allowed'
                )}
              >
                <Star
                  className={cn(
                    'w-6 h-6',
                    ratingValue >= star
                      ? 'fill-yellow-400 text-yellow-400'
                      : 'fill-none text-gray-600'
                  )}
                />
              </button>
            ))}
          </div>
        );

      case 'relation':
      case 'user':
        return (
          <Input
            value={(value as string) ?? ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={`ID de ${field.label}`}
            disabled={disabled}
            className={cn(error && 'border-red-500', className)}
          />
        );

      case 'json':
        return (
          <textarea
            value={typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
            onChange={(e) => {
              try {
                onChange(JSON.parse(e.target.value));
              } catch {
                onChange(e.target.value);
              }
            }}
            disabled={disabled}
            className={cn(
              'w-full min-h-[100px] p-2 rounded-md border bg-background font-mono text-sm',
              error && 'border-red-500',
              className
            )}
            placeholder='{"key": "value"}'
          />
        );

      default:
        return (
          <Input
            value={String(value ?? '')}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            className={cn(error && 'border-red-500', className)}
          />
        );
    }
  };

  // Pour les checkbox, pas besoin de wrapper car le label est dans le renderField
  if (field.type === 'checkbox') {
    return (
      <div className="space-y-1">
        {renderField()}
        {error && <p className="text-xs text-red-400">{error}</p>}
        {field.config?.helpText && !error && (
          <p className="text-xs text-gray-500">{field.config.helpText}</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-gray-200">
        {field.label}
        {field.isRequired && <span className="text-red-400 ml-1">*</span>}
      </label>
      {renderField()}
      {error && <p className="text-xs text-red-400">{error}</p>}
      {field.config?.helpText && !error && (
        <p className="text-xs text-gray-500">{field.config.helpText}</p>
      )}
    </div>
  );
}

/**
 * Version display-only du champ (pour affichage dans une table par exemple)
 */
export function DynamicFieldDisplay({ field, value }: { field: FieldDefinition; value: unknown }) {
  if (value === null || value === undefined) {
    return <span className="text-gray-500 italic">-</span>;
  }

  switch (field.type) {
    case 'checkbox':
      return (
        <div className="flex items-center">
          <Checkbox checked={value as boolean} disabled />
        </div>
      );

    case 'currency':
      return (
        <span className="font-mono">
          {new Intl.NumberFormat('fr-FR', {
            style: 'currency',
            currency: field.config?.currency || 'EUR',
          }).format(value as number)}
        </span>
      );

    case 'number':
      return <span className="font-mono">{value as number}</span>;

    case 'date':
    case 'datetime':
      return (
        <span>
          {format(
            new Date(value as string),
            field.type === 'datetime' ? 'PPP HH:mm' : 'PPP',
            { locale: fr }
          )}
        </span>
      );

    case 'select':
    case 'status':
      const option = field.config?.options?.find(o => o.id === value);
      if (!option) return <span>{String(value)}</span>;
      return (
        <Badge
          variant="outline"
          style={option.color ? { borderColor: option.color, color: option.color } : undefined}
        >
          {option.icon && <span className="mr-1">{option.icon}</span>}
          {option.label}
        </Badge>
      );

    case 'multi_select':
      const selectedOptions = field.config?.options?.filter(o =>
        (value as string[])?.includes(o.id)
      );
      return (
        <div className="flex flex-wrap gap-1">
          {selectedOptions?.map(option => (
            <Badge
              key={option.id}
              variant="outline"
              style={option.color ? { borderColor: option.color, color: option.color } : undefined}
            >
              {option.label}
            </Badge>
          ))}
        </div>
      );

    case 'rating':
      return (
        <div className="flex gap-0.5">
          {[1, 2, 3, 4, 5].map((star) => (
            <Star
              key={star}
              className={cn(
                'w-4 h-4',
                (value as number) >= star
                  ? 'fill-yellow-400 text-yellow-400'
                  : 'fill-none text-gray-600'
              )}
            />
          ))}
        </div>
      );

    case 'email':
      return (
        <a href={`mailto:${value}`} className="text-cyan-400 hover:underline">
          {String(value)}
        </a>
      );

    case 'url':
      return (
        <a
          href={String(value)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-cyan-400 hover:underline"
        >
          {String(value)}
        </a>
      );

    case 'phone':
      return (
        <a href={`tel:${value}`} className="text-cyan-400 hover:underline">
          {String(value)}
        </a>
      );

    default:
      return <span>{String(value)}</span>;
  }
}
