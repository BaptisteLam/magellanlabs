# Phase 6 & 7 : Import de Données & Visual Editor

## 🎯 Objectifs

- **Phase 6** : Permettre l'import de données depuis multiples sources (JSON, Excel, Google Sheets, Database)
- **Phase 7** : Créer un éditeur visuel WYSIWYG pour créer des widgets sans code

**Direction Artistique** : Respecte 100% la DA Magellan (cyan #03A5C0, glassmorphism, animations)

---

## 📦 Phase 6 : Import de Données Multi-Sources

### Fonctionnalités

✅ **5 sources de données supportées** :
1. **JSON** - Fichiers .json avec array de données
2. **Excel** - Fichiers .xlsx et .xls
3. **CSV** - Fichiers .csv avec délimiteur personnalisable
4. **Google Sheets** - Import direct depuis spreadsheet ID
5. **Database** - PostgreSQL, MySQL, MongoDB, Supabase

### Architecture

#### 1. Service `dataImportService.ts`

**Méthodes** :
- `importJSON(file: File)` - Parse et importe fichier JSON
- `importExcel(file: File, sheetName?)` - Parse Excel avec xlsx library
- `importCSV(file: File, delimiter)` - Parse CSV
- `importGoogleSheets(spreadsheetId, range)` - Via edge function
- `importFromDatabase(connection)` - Via edge function (sécurisé)
- `detectColumns(sampleRow)` - Détection automatique colonnes + types
- `saveImportedData(widgetId, data)` - Sauvegarde dans widget_data

**Détection automatique** :
```typescript
detectType(value):
  - boolean → 'boolean'
  - number → 'number'
  - date string → 'date'
  - currency (€, $, £) → 'currency'
  - numeric string → 'number'
  - default → 'text'
```

**Format retourné** :
```typescript
interface ImportedData {
  rows: any[];
  columns: Array<{
    key: string;
    label: string;  // Formaté (user_name → User Name)
    type: 'text' | 'number' | 'currency' | 'date' | 'boolean';
  }>;
  metadata: {
    source: 'json' | 'excel' | 'csv' | 'google-sheets' | 'database';
    filename?: string;
    rowCount: number;
    columnCount: number;
  };
}
```

#### 2. Composant `ImportDataDialog.tsx`

**UI/UX** :
- Dialog fullscreen avec glassmorphism (`bg-card/95 backdrop-blur-md`)
- 4 tabs pour chaque source :
  - JSON/Excel/CSV → File upload
  - Google Sheets → Spreadsheet ID + Range
  - Database → Connection form + SQL query
- Preview des données importées (5 premières colonnes)
- Badge compteur (lignes × colonnes)
- Bouton "Lier au widget" (cyan #03A5C0)

**Workflow** :
```
1. User ouvre menu widget → "Importer des données"
2. ImportDataDialog s'ouvre
3. User sélectionne tab (ex: Excel)
4. Upload fichier .xlsx
5. Click "Importer"
6. Service parse le fichier
7. Preview s'affiche
   - "52 lignes • 8 colonnes"
   - Badges des colonnes: [Name (text)] [Price (currency)] [Date (date)]
8. Click "Lier au widget"
9. Données sauvegardées dans widget_data
10. Widget rafraîchi avec vraies données
```

**Design Magellan** :
- Border: `border-[#03A5C0]/20`
- Tabs active: `bg-[#03A5C0]`
- Preview box: `bg-[#03A5C0]/5 border-[#03A5C0]/30`
- Success icon: `text-[#03A5C0]`
- Buttons: `bg-[#03A5C0] hover:bg-[#03A5C0]/90`

#### 3. Edge Functions (Sécurité)

**`import-google-sheets`** :
```typescript
// Appelle l'API Google Sheets avec server-side auth
// Évite d'exposer les credentials côté client
POST /functions/v1/import-google-sheets
Body: { spreadsheetId, range }
Response: { values: [[...], [...]] }
```

**`import-from-database`** :
```typescript
// Exécute requête SQL avec credentials server-side
POST /functions/v1/import-from-database
Body: { type, host, port, query, ... }
Response: { rows: [...] }
```

### Intégration

**WidgetContextMenu** :
- Nouveau item : "Importer des données" avec icône Upload
- Séparateur avant Export/Delete
- Callback `onImportData` déclenchée

---

## 🎨 Phase 7 : Visual Widget Editor

### Concept

Éditeur visuel WYSIWYG pour créer des widgets sans écrire de code ni utiliser le chat.

**Architecture 3-panel** :
```
┌────────────┬──────────────────┬─────────────┐
│            │                  │             │
│ Components │      Canvas      │  Properties │
│  Library   │   (Preview)      │             │
│            │                  │             │
│  [Widgets] │  [Your widget]   │  [Config]   │
│            │                  │             │
└────────────┴──────────────────┴─────────────┘
   Panel 1        Panel 2           Panel 3
   (w-64)       (flex-1)            (w-80)
```

### Composant `VisualWidgetEditor.tsx`

#### Panel 1 : Components Library

**8 types de widgets** :
1. Graphique Barres
2. Graphique Ligne
3. Graphique Circulaire
4. KPI Card
5. Tableau
6. Calendrier
7. Grille KPI
8. Liste

**Card de composant** :
```tsx
<button className={isSelected && 'bg-[#03A5C0]/10 border-[#03A5C0]/50'}>
  <div className={isSelected ? 'bg-[#03A5C0] text-white' : 'bg-muted'}>
    <Icon />
  </div>
  <div>
    <p>Graphique Barres</p>
    <p className="text-muted-foreground">Bar chart pour comparer...</p>
  </div>
</button>
```

**Animations** :
- `whileHover={{ scale: 1.02 }}`
- `whileTap={{ scale: 0.98 }}`

#### Panel 2 : Canvas (Preview)

**Preview temps réel** :
- Affiche le widget avec config actuelle
- Aspect ratio basé sur layout (w/h)
- Placeholder avec icon + description
- Badge info : "Claude générera le code React"

**Empty state** :
```
┌─────────────────────┐
│   [Grid icon]       │
│ Créez votre widget  │
│ Sélectionnez un     │
│ composant...        │
└─────────────────────┘
```

**Header** :
- Icône Eye + "Aperçu"
- Boutons : [Annuler] [Créer le Widget]
- Bouton primaire: `bg-[#03A5C0]` avec icône Sparkles

#### Panel 3 : Properties

**3 tabs** :
1. **Général** - Titre, type, dimensions
2. **Données** - Source (manuel, import, API, DB)
3. **Style** - Couleur, légende, animations

**Configurateurs** :

```tsx
// Général
<Input value={title} />  // Titre
<Select value={chartType}>  // Type (bar, line, pie, area)
<Slider value={layout.w} min={3} max={12} />  // Largeur
<Slider value={layout.h} min={2} max={8} />   // Hauteur

// Données
<Select value={dataSource}>
  - Données manuelles
  - Données importées
  - API externe
  - Base de données
</Select>

// Style
<Input type="color" value={color} />  // Couleur primaire
<Switch checked={showLegend} />       // Légende
<Switch checked={animated} />         // Animations
```

### Workflow Complet

```
1. User clique "Créer widget" (nouveau bouton dans ProjectCRM)
2. VisualWidgetEditor s'ouvre (fullscreen)

3. User clique sur "Graphique Barres" (Panel 1)
   → Preview apparaît (Panel 2)
   → Properties s'ouvrent (Panel 3)

4. User configure (Panel 3) :
   - Titre: "Ventes par Région"
   - Type: Barres
   - Largeur: 6/12
   - Hauteur: 4 unités
   - Couleur: #03A5C0 ✓
   - Légende: ON
   - Animations: ON

5. Preview se met à jour en temps réel (Panel 2)

6. User clique "Créer le Widget"
   → Edge function `generate-widget-from-visual` invoquée
   → Claude génère le code React basé sur config
   → Widget créé en DB avec `is_code_generated: true`
   → Callback `onWidgetCreated(widgetId)`
   → Editor se ferme
   → Widget apparaît dans module avec animation

7. User peut ensuite importer des données via menu contextuel
```

### Génération de Code Automatique

**Edge function `generate-widget-from-visual`** :
```typescript
// Reçoit la config visuelle
{
  componentType: 'bar-chart',
  config: {
    title: 'Ventes par Région',
    chartType: 'bar',
    color: '#03A5C0',
    layout: { w: 6, h: 4 },
    showLegend: true,
    animated: true
  }
}

// Claude génère code React optimisé
// Exemple pour bar-chart:
function GeneratedWidget({ config, widgetId }) {
  const [data, setData] = useState([]);

  return React.createElement(Card, { className: 'p-6' },
    React.createElement('h3', { className: 'text-lg font-semibold mb-4' },
      'Ventes par Région'
    ),
    React.createElement(ResponsiveContainer, { width: '100%', height: 300 },
      React.createElement(BarChart, { data: data },
        React.createElement(CartesianGrid, { strokeDasharray: '3 3' }),
        React.createElement(XAxis, { dataKey: 'region' }),
        React.createElement(YAxis, {}),
        React.createElement(Tooltip, {}),
        React.createElement(Bar, { dataKey: 'sales', fill: '#03A5C0' })
      )
    )
  );
}
```

---

## 📊 Fichiers Créés

### Phase 6 - Import (2 fichiers)
1. `src/services/dataImportService.ts` - Service d'import multi-sources
2. `src/components/crm/ImportDataDialog.tsx` - UI dialog d'import

### Phase 7 - Visual Editor (1 fichier)
3. `src/components/crm/VisualWidgetEditor.tsx` - Éditeur visuel WYSIWYG

### Modifiés (1 fichier)
4. `src/components/crm/WidgetContextMenu.tsx` - Ajout "Importer des données"

**Total** : 3 nouveaux + 1 modifié = **~1500 lignes**

---

## 🎨 Design Magellan Respecté

### Couleurs
✅ Primary: `#03A5C0` (cyan Magellan)
✅ Accent: `bg-[#03A5C0]/10`, `border-[#03A5C0]/20`
✅ Hover: `hover:bg-[#03A5C0]/90`
✅ Success: `text-[#03A5C0]`

### Glassmorphism
✅ `bg-card/95 backdrop-blur-md`
✅ `bg-card/80 backdrop-blur-sm`
✅ `border-border/50`

### Animations
✅ Framer Motion sur tous les éléments interactifs
✅ `whileHover={{ scale: 1.02 }}`
✅ `initial={{ opacity: 0 }} animate={{ opacity: 1 }}`

### Typographie
✅ Font weights cohérents (semibold pour titres)
✅ Text sizes respectant la hiérarchie
✅ `text-muted-foreground` pour hints

---

## 🚀 Utilisation

### Import de Données

```
1. Hover sur widget → Menu (⋮)
2. Click "Importer des données"
3. Choisir source :
   - JSON : Upload fichier
   - Excel : Upload .xlsx
   - Google Sheets : Coller ID + range
   - Database : Config + requête SQL
4. Preview → "Lier au widget"
5. ✅ Données liées !
```

### Visual Editor

```
1. Click bouton "Créer widget" (ProjectCRM header)
2. Sélectionner type (ex: Graphique Barres)
3. Configurer propriétés (titre, couleur, dimensions)
4. Preview temps réel
5. "Créer le Widget" → Claude génère le code
6. ✅ Widget créé !
```

---

## 🔧 Dépendances Requises

### À installer

```bash
npm install xlsx
# OU
yarn add xlsx
```

**Raison** : Parse fichiers Excel (.xlsx, .xls)

### Edge Functions à Déployer

1. `import-google-sheets` - Google Sheets API
2. `import-from-database` - Database connections
3. `generate-widget-from-visual` - Visual editor → Code

**Configuration** :
```bash
# Secrets Supabase
GOOGLE_SHEETS_API_KEY=...
DB_CONNECTION_SECRETS=...  # Si database import
```

---

## ✅ Checklist

### Phase 6
- [x] Service import multi-sources
- [x] Parsers JSON/Excel/CSV
- [x] Import Google Sheets (via edge function)
- [x] Import Database (via edge function)
- [x] Détection automatique types
- [x] Dialog UI avec tabs
- [x] Preview des données
- [x] Sauvegarde dans widget_data
- [x] Intégration menu contextuel

### Phase 7
- [x] Éditeur 3-panel (Components | Canvas | Properties)
- [x] 8 types de widgets disponibles
- [x] Preview temps réel
- [x] Configurateurs (Général, Données, Style)
- [x] Sliders pour dimensions
- [x] Color picker
- [x] Switches pour options
- [x] Génération code via Claude
- [x] Design Magellan 100%

---

## 🎯 Résultat

**Le CRM Magellan propose maintenant** :

✅ **3 façons de créer des widgets** :
1. Chat conversationnel (Phase 3)
2. Visual Editor WYSIWYG (Phase 7)
3. Templates prédéfinis (Phase 2)

✅ **5 sources d'import de données** :
1. JSON
2. Excel
3. CSV
4. Google Sheets
5. Database (PostgreSQL, MySQL, MongoDB, Supabase)

✅ **Expérience utilisateur complète** :
- Création visuelle sans code
- Import de données en quelques clics
- Preview temps réel
- Design cohérent et élégant

**Phases 6 & 7 terminées !** 🚀
