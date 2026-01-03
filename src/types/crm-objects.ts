/**
 * Types TypeScript pour le modèle CRM flexible
 * Basé sur l'architecture Attio avec JSONB
 * Phase 1 du plan de refonte CRM
 */

// ============================================================================
// FIELD TYPES - Types de champs supportés
// ============================================================================

export type FieldType =
  | 'text'           // Texte simple
  | 'number'         // Nombre
  | 'currency'       // Montant (avec devise)
  | 'date'           // Date (sans heure)
  | 'datetime'       // Date et heure
  | 'email'          // Email (avec validation)
  | 'phone'          // Téléphone
  | 'url'            // URL (avec validation)
  | 'checkbox'       // Boolean
  | 'select'         // Liste déroulante (single)
  | 'multi_select'   // Sélection multiple
  | 'status'         // Statut (avec couleur)
  | 'relation'       // Relation vers un autre objet
  | 'user'           // Référence utilisateur
  | 'rating'         // Note (1-5 étoiles)
  | 'json';          // JSON libre

// ============================================================================
// SELECT OPTIONS - Options pour select/multi_select/status
// ============================================================================

export interface SelectOption {
  id: string;
  label: string;
  color?: string;
  icon?: string;
  description?: string;
}

// ============================================================================
// FIELD DEFINITION - Définition d'un champ
// ============================================================================

export interface FieldDefinition {
  id: string;
  name: string;                    // Nom technique (snake_case)
  label: string;                   // Label affiché
  type: FieldType;
  description?: string;
  isRequired: boolean;
  isUnique: boolean;
  isSearchable: boolean;
  defaultValue?: unknown;
  config?: {
    // Pour select/multi_select/status
    options?: SelectOption[];

    // Pour relation
    targetObject?: string;
    relationType?: 'one-to-one' | 'one-to-many' | 'many-to-many';

    // Pour number
    precision?: number;
    min?: number;
    max?: number;

    // Pour currency
    currency?: string;              // 'EUR', 'USD', etc.

    // Pour text
    maxLength?: number;
    minLength?: number;
    pattern?: string;               // Regex pattern

    // Pour date/datetime
    minDate?: string;
    maxDate?: string;

    // Général
    placeholder?: string;
    helpText?: string;
  };
}

// ============================================================================
// OBJECT DEFINITION - Définition d'un type d'objet
// ============================================================================

export interface ViewConfig {
  default: 'table' | 'kanban' | 'timeline' | 'calendar';
  available: Array<'table' | 'kanban' | 'timeline' | 'calendar'>;
}

export interface ObjectSettings {
  labelField?: string;              // Champ utilisé comme label du record
  descriptionField?: string;
  iconField?: string;
  colorField?: string;
  enableComments?: boolean;
  enableAttachments?: boolean;
  enableActivity?: boolean;
}

export interface ObjectDefinition {
  id: string;
  projectId: string;
  name: string;                      // Nom technique (snake_case)
  singularLabel: string;             // Label singulier ("Contact")
  pluralLabel: string;               // Label pluriel ("Contacts")
  icon?: string;                     // Nom icône Lucide
  color?: string;                    // Couleur hex
  description?: string;
  fields: FieldDefinition[];
  viewConfig?: ViewConfig;
  settings?: ObjectSettings;
  isSystem: boolean;                 // true pour objets prédéfinis
  generatedByAi: boolean;            // true si généré par IA
  displayOrder: number;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// CUSTOM OBJECT - Instance d'un objet (record)
// ============================================================================

export interface CustomObject<T extends Record<string, unknown> = Record<string, unknown>> {
  id: string;
  projectId: string;
  objectType: string;
  data: T;                           // Données flexibles en JSONB
  metadata?: {
    enrichedAt?: Date;
    enrichmentSource?: string;
    tags?: string[];
    [key: string]: unknown;
  };
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// OBJECT RELATION - Relation entre objets
// ============================================================================

export interface ObjectRelation {
  id: string;
  projectId: string;
  sourceType: string;
  sourceId: string;
  targetType: string;
  targetId: string;
  relationType: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

// ============================================================================
// OBJECT VIEW - Vue personnalisée
// ============================================================================

export type ViewType = 'table' | 'kanban' | 'timeline' | 'calendar';

export interface FilterCondition {
  field: string;
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'in' | 'is_null' | 'is_not_null';
  value: unknown;
  logic?: 'and' | 'or';
}

export interface SortConfig {
  field: string;
  direction: 'asc' | 'desc';
}

export interface KanbanLayoutConfig {
  groupBy: string;                   // Field à utiliser pour grouper
  cardFields: string[];              // Fields à afficher sur les cartes
  sortBy?: string;
  showCount?: boolean;
}

export interface TimelineLayoutConfig {
  startDateField: string;
  endDateField?: string;
  groupBy?: string;
  sortBy?: string;
}

export interface CalendarLayoutConfig {
  dateField: string;
  titleField: string;
  colorField?: string;
  allDayField?: string;
}

export interface TableLayoutConfig {
  columnWidths?: Record<string, number>;
  frozenColumns?: string[];
}

export type LayoutConfig =
  | KanbanLayoutConfig
  | TimelineLayoutConfig
  | CalendarLayoutConfig
  | TableLayoutConfig;

export interface ObjectView {
  id: string;
  projectId: string;
  objectType: string;
  name: string;
  viewType: ViewType;
  filters: FilterCondition[];
  sortConfig?: SortConfig;
  visibleFields: string[];           // IDs des fields visibles
  layoutConfig: LayoutConfig;
  isDefault: boolean;
  isSystem: boolean;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// TYPES SPÉCIFIQUES POUR OBJETS SYSTÈME
// ============================================================================

export interface ContactData {
  firstName?: string;
  lastName?: string;
  email: string;
  phone?: string;
  company?: string;
  jobTitle?: string;
  linkedin?: string;
  avatar?: string;
  source?: string;
  tags?: string[];
  [key: string]: unknown;
}

export interface CompanyData {
  name: string;
  domain?: string;
  industry?: string;
  size?: string;
  location?: string;
  description?: string;
  logo?: string;
  linkedin?: string;
  annualRevenue?: number;
  [key: string]: unknown;
}

export interface DealData {
  name: string;
  value: number;
  currency: string;
  stage: string;
  probability?: number;
  expectedCloseDate?: Date;
  ownerId?: string;
  contactId?: string;
  companyId?: string;
  [key: string]: unknown;
}

// ============================================================================
// QUERY OPTIONS - Options pour requêtes
// ============================================================================

export interface QueryOptions {
  filters?: FilterCondition[];
  orderBy?: SortConfig;
  limit?: number;
  offset?: number;
  search?: string;
  searchFields?: string[];
}

// ============================================================================
// VALIDATION RESULT - Résultat de validation
// ============================================================================

export interface ValidationResult {
  success: boolean;
  data?: Record<string, unknown>;
  errors?: Record<string, string>;
}

// ============================================================================
// HELPER TYPES
// ============================================================================

export type TypedCustomObject<T> = Omit<CustomObject, 'data'> & { data: T };

export type Contact = TypedCustomObject<ContactData>;
export type Company = TypedCustomObject<CompanyData>;
export type Deal = TypedCustomObject<DealData>;
