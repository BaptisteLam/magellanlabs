/**
 * Validation dynamique avec Zod pour le CRM flexible
 * Génère des schemas Zod à partir des définitions de champs
 */

import { z, ZodTypeAny } from 'zod';
import { FieldDefinition, FieldType, ObjectDefinition, ValidationResult } from '@/types/crm-objects';

// ============================================================================
// GÉNÉRATION DE SCHEMA ZOD POUR UN CHAMP
// ============================================================================

function getZodTypeForField(field: FieldDefinition): ZodTypeAny {
  const typeMap: Record<FieldType, () => ZodTypeAny> = {
    text: () => {
      let schema = z.string();
      if (field.config?.maxLength) {
        schema = schema.max(field.config.maxLength, `${field.label} ne peut pas dépasser ${field.config.maxLength} caractères`);
      }
      if (field.config?.minLength) {
        schema = schema.min(field.config.minLength, `${field.label} doit contenir au moins ${field.config.minLength} caractères`);
      }
      if (field.config?.pattern) {
        schema = schema.regex(new RegExp(field.config.pattern), `${field.label} ne correspond pas au format attendu`);
      }
      return schema;
    },

    number: () => {
      let schema = z.number({ invalid_type_error: `${field.label} doit être un nombre` });
      if (field.config?.min !== undefined) {
        schema = schema.min(field.config.min, `${field.label} doit être >= ${field.config.min}`);
      }
      if (field.config?.max !== undefined) {
        schema = schema.max(field.config.max, `${field.label} doit être <= ${field.config.max}`);
      }
      return schema;
    },

    currency: () => z.number().nonnegative(`${field.label} doit être positif`),

    date: () => z.string().datetime({ message: `${field.label} doit être une date valide` }).or(z.date()),

    datetime: () => z.string().datetime({ message: `${field.label} doit être une date et heure valides` }).or(z.date()),

    email: () => z.string().email(`${field.label} doit être un email valide`),

    phone: () => z.string().regex(
      /^[\d\s\-\+\(\)]+$/,
      `${field.label} doit être un numéro de téléphone valide`
    ),

    url: () => z.string().url(`${field.label} doit être une URL valide`),

    checkbox: () => z.boolean({ invalid_type_error: `${field.label} doit être vrai ou faux` }),

    select: () => {
      if (field.config?.options && field.config.options.length > 0) {
        const optionIds = field.config.options.map(o => o.id) as [string, ...string[]];
        return z.enum(optionIds, {
          errorMap: () => ({ message: `${field.label} doit être une des options valides` })
        });
      }
      return z.string();
    },

    multi_select: () => {
      if (field.config?.options && field.config.options.length > 0) {
        const optionIds = field.config.options.map(o => o.id);
        return z.array(z.string()).refine(
          (values) => values.every(v => optionIds.includes(v)),
          { message: `${field.label} contient des options invalides` }
        );
      }
      return z.array(z.string());
    },

    status: () => {
      if (field.config?.options && field.config.options.length > 0) {
        const optionIds = field.config.options.map(o => o.id) as [string, ...string[]];
        return z.enum(optionIds, {
          errorMap: () => ({ message: `${field.label} doit être un statut valide` })
        });
      }
      return z.string();
    },

    relation: () => z.string().uuid(`${field.label} doit être un ID valide`),

    user: () => z.string().uuid(`${field.label} doit être un ID utilisateur valide`),

    rating: () => z.number().min(1, `${field.label} doit être >= 1`).max(5, `${field.label} doit être <= 5`),

    json: () => z.record(z.unknown()),
  };

  let schema = typeMap[field.type]?.() ?? z.unknown();

  // Ajouter optional/nullable si pas requis
  if (!field.isRequired) {
    schema = schema.optional().nullable();
  }

  return schema;
}

// ============================================================================
// CRÉATION D'UN SCHEMA ZOD COMPLET POUR UN OBJET
// ============================================================================

export function createDynamicSchema(fields: FieldDefinition[]) {
  const shape: Record<string, ZodTypeAny> = {};

  for (const field of fields) {
    shape[field.name] = getZodTypeForField(field);
  }

  // passthrough() permet d'accepter des champs additionnels non définis
  return z.object(shape).passthrough();
}

// ============================================================================
// VALIDATION DES DONNÉES D'UN OBJET
// ============================================================================

export function validateObjectData(
  data: Record<string, unknown>,
  definition: ObjectDefinition
): ValidationResult {
  const schema = createDynamicSchema(definition.fields);
  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  const errors: Record<string, string> = {};
  result.error.errors.forEach(err => {
    const path = err.path.join('.');
    errors[path] = err.message;
  });

  return { success: false, errors };
}

// ============================================================================
// VALIDATION D'UN SEUL CHAMP
// ============================================================================

export function validateField(
  value: unknown,
  field: FieldDefinition
): { valid: boolean; error?: string } {
  const schema = getZodTypeForField(field);
  const result = schema.safeParse(value);

  if (result.success) {
    return { valid: true };
  }

  return {
    valid: false,
    error: result.error.errors[0]?.message || 'Valeur invalide'
  };
}

// ============================================================================
// VALEURS PAR DÉFAUT SELON LE TYPE
// ============================================================================

export function getDefaultValueForField(field: FieldDefinition): unknown {
  if (field.defaultValue !== undefined) {
    return field.defaultValue;
  }

  const defaults: Record<FieldType, unknown> = {
    text: '',
    number: null,
    currency: null,
    date: null,
    datetime: null,
    email: '',
    phone: '',
    url: '',
    checkbox: false,
    select: null,
    multi_select: [],
    status: field.config?.options?.[0]?.id || null,
    relation: null,
    user: null,
    rating: null,
    json: {},
  };

  return defaults[field.type];
}

// ============================================================================
// SANITIZATION DES DONNÉES
// ============================================================================

export function sanitizeObjectData(
  data: Record<string, unknown>,
  definition: ObjectDefinition
): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};

  for (const field of definition.fields) {
    const value = data[field.name];

    // Si pas de valeur et champ requis, utiliser la valeur par défaut
    if (value === undefined || value === null) {
      if (field.isRequired) {
        sanitized[field.name] = getDefaultValueForField(field);
      } else {
        sanitized[field.name] = null;
      }
      continue;
    }

    // Sanitize selon le type
    switch (field.type) {
      case 'text':
      case 'email':
      case 'phone':
      case 'url':
        sanitized[field.name] = String(value).trim();
        break;

      case 'number':
      case 'currency':
      case 'rating':
        sanitized[field.name] = typeof value === 'number' ? value : Number(value);
        break;

      case 'checkbox':
        sanitized[field.name] = Boolean(value);
        break;

      case 'multi_select':
        sanitized[field.name] = Array.isArray(value) ? value : [];
        break;

      default:
        sanitized[field.name] = value;
    }
  }

  return sanitized;
}
