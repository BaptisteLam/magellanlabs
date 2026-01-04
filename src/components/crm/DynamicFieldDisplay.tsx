/**
 * DynamicFieldDisplay - Affichage en lecture seule d'une valeur de champ
 * Complément de DynamicField (qui est pour l'édition)
 */

import { FieldDefinition } from '@/types/crm-objects';
import { Badge } from '@/components/ui/badge';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Check, X, Star, Mail, Phone, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DynamicFieldDisplayProps {
  field: FieldDefinition;
  value: unknown;
  className?: string;
}

export function DynamicFieldDisplay({ field, value, className }: DynamicFieldDisplayProps) {
  // Null/undefined
  if (value === null || value === undefined || value === '') {
    return <span className={cn('text-gray-500 text-sm italic', className)}>-</span>;
  }

  switch (field.type) {
    case 'text':
      return <span className={cn('text-sm text-white', className)}>{String(value)}</span>;

    case 'email':
      return (
        <a
          href={`mailto:${value}`}
          className={cn('text-sm text-cyan-400 hover:underline flex items-center gap-1', className)}
        >
          <Mail className="w-3 h-3" />
          {String(value)}
        </a>
      );

    case 'phone':
      return (
        <a
          href={`tel:${value}`}
          className={cn('text-sm text-cyan-400 hover:underline flex items-center gap-1', className)}
        >
          <Phone className="w-3 h-3" />
          {String(value)}
        </a>
      );

    case 'url':
      return (
        <a
          href={String(value)}
          target="_blank"
          rel="noopener noreferrer"
          className={cn('text-sm text-cyan-400 hover:underline flex items-center gap-1', className)}
        >
          <ExternalLink className="w-3 h-3" />
          {String(value).replace(/^https?:\/\//, '')}
        </a>
      );

    case 'number':
      const numberValue = Number(value);
      const unit = (field.config as any)?.unit;
      return (
        <span className={cn('text-sm text-white font-mono', className)}>
          {numberValue.toLocaleString('fr-FR')}
          {unit && <span className="ml-1 text-gray-400">{unit}</span>}
        </span>
      );

    case 'currency':
      const currencyValue = Number(value);
      const currency = field.config?.currency || 'EUR';
      const currencySymbol = currency === 'EUR' ? '€' : currency === 'USD' ? '$' : currency;
      return (
        <span className={cn('text-sm text-white font-mono', className)}>
          {currencyValue.toLocaleString('fr-FR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}{' '}
          {currencySymbol}
        </span>
      );

    case 'date':
      try {
        const date = parseISO(String(value));
        return (
          <span className={cn('text-sm text-white', className)}>
            {format(date, 'dd MMMM yyyy', { locale: fr })}
          </span>
        );
      } catch {
        return <span className={cn('text-sm text-white', className)}>{String(value)}</span>;
      }

    case 'datetime':
      try {
        const datetime = parseISO(String(value));
        return (
          <span className={cn('text-sm text-white', className)}>
            {format(datetime, 'dd/MM/yyyy à HH:mm', { locale: fr })}
          </span>
        );
      } catch {
        return <span className={cn('text-sm text-white', className)}>{String(value)}</span>;
      }

    case 'checkbox':
      return (
        <span className={cn('flex items-center gap-1 text-sm', className)}>
          {value ? (
            <>
              <Check className="w-4 h-4 text-green-400" />
              <span className="text-green-400">Oui</span>
            </>
          ) : (
            <>
              <X className="w-4 h-4 text-gray-400" />
              <span className="text-gray-400">Non</span>
            </>
          )}
        </span>
      );

    case 'select':
    case 'status':
      const option = field.config?.options?.find((opt: any) => opt.id === value);
      if (!option) {
        return <span className={cn('text-sm text-white', className)}>{String(value)}</span>;
      }
      return (
        <Badge
          variant="outline"
          className={cn('text-xs', className)}
          style={{
            backgroundColor: `${option.color}20`,
            borderColor: option.color,
            color: option.color,
          }}
        >
          {option.icon && <span className="mr-1">{option.icon}</span>}
          {option.label}
        </Badge>
      );

    case 'multi_select':
      const values = Array.isArray(value) ? value : [];
      if (values.length === 0) {
        return <span className={cn('text-gray-500 text-sm italic', className)}>-</span>;
      }
      return (
        <div className={cn('flex flex-wrap gap-1', className)}>
          {values.map((v: string) => {
            const opt = field.config?.options?.find((o: any) => o.id === v);
            return (
              <Badge
                key={v}
                variant="outline"
                className="text-xs"
                style={{
                  backgroundColor: `${opt?.color || '#03A5C0'}20`,
                  borderColor: opt?.color || '#03A5C0',
                  color: opt?.color || '#03A5C0',
                }}
              >
                {opt?.label || v}
              </Badge>
            );
          })}
        </div>
      );

    case 'rating':
      const rating = Number(value);
      return (
        <div className={cn('flex items-center gap-0.5', className)}>
          {[1, 2, 3, 4, 5].map((star) => (
            <Star
              key={star}
              className={cn(
                'w-4 h-4',
                star <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-600'
              )}
            />
          ))}
        </div>
      );

    case 'json':
      try {
        const jsonValue = typeof value === 'string' ? JSON.parse(value) : value;
        return (
          <pre className={cn('text-xs text-white font-mono bg-black/20 p-2 rounded', className)}>
            {JSON.stringify(jsonValue, null, 2)}
          </pre>
        );
      } catch {
        return <span className={cn('text-sm text-white', className)}>{String(value)}</span>;
      }

    case 'relation':
    case 'user':
      // Pour les relations, afficher juste l'ID pour l'instant
      // Dans une vraie implémentation, on devrait fetch l'objet lié
      return <span className={cn('text-sm text-cyan-400', className)}>{String(value)}</span>;

    default:
      return <span className={cn('text-sm text-white', className)}>{String(value)}</span>;
  }
}
