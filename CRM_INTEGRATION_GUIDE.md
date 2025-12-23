# 🚀 Guide d'Intégration CRM - Phase 1 Complétée

**Date**: 23 Décembre 2025
**Status**: ✅ Infrastructure prête pour intégration

---

## 📋 Ce qui a été implémenté

### 1. ✅ Base de Données Supabase

**Migration créée**: `supabase/migrations/20251223000001_create_crm_tables.sql`

**4 nouvelles tables** :
- `crm_modules` : Modules CRM par projet
- `crm_widgets` : Widgets dans chaque module
- `widget_data` : Données des widgets
- Extension de `build_sessions` avec `business_sector` et `initial_modules_config`

**Row Level Security (RLS)** : Activé sur toutes les tables

### 2. ✅ Edge Function Supabase

**Fonction créée**: `supabase/functions/generate-crm/index.ts`

**Fonctionnalités** :
- Analyse du prompt utilisateur avec Claude API (Sonnet 4.5)
- Détection automatique du secteur d'activité (17 secteurs supportés)
- Génération de 5-10 modules CRM pertinents
- Création de 2-5 widgets par module
- Budget : 30k tokens max
- Prompt engineering optimisé avec templates

### 3. ✅ Service TypeScript Client

**Service créé**: `src/services/crmGenerator.ts`

**Méthodes disponibles** :
- `generateCRM(projectId, userPrompt)` - Génère le CRM complet
- `getProjectModules(projectId)` - Récupère les modules d'un projet
- `getModuleWidgets(moduleId)` - Récupère les widgets d'un module
- `updateWidgetData(widgetId, data)` - Met à jour les données d'un widget
- `createWidget(moduleId, widgetSpec)` - Crée un nouveau widget
- `deleteWidget(widgetId)` - Supprime un widget
- `updateWidgetConfig(widgetId, config)` - Met à jour la config d'un widget

### 4. ✅ Hook React

**Hook créé**: `src/hooks/useGenerateCRM.ts`

```typescript
const { generateCRM, isGenerating, generationResult } = useGenerateCRM();

// Dans un composant
await generateCRM(projectId, userPrompt);
```

---

## 🔧 Comment Intégrer dans BuilderSession

### Étape 1 : Modifier le Hook de Génération de Site

Dans `src/hooks/useGenerateSite.ts`, ajouter l'appel CRM après la génération du site :

```typescript
import { useGenerateCRM } from './useGenerateCRM';

export function useGenerateSite() {
  const { generateCRM } = useGenerateCRM();

  const generateSite = async (prompt: string, sessionId: string) => {
    try {
      // 1. Génération du site (existant)
      const siteResult = await generateSiteCode(prompt);

      // 2. Sauvegarder en DB
      await saveToDatabase(sessionId, siteResult);

      // 3. NOUVEAU : Générer le CRM automatiquement
      try {
        console.log('[BuilderSession] Triggering CRM generation...');
        await generateCRM(sessionId, prompt);

        // Notification
        toast.success('Site et CRM générés !', {
          description: 'Votre CRM personnalisé est prêt',
          action: {
            label: 'Voir le CRM',
            onClick: () => navigate(`/project/${sessionId}/crm`)
          }
        });
      } catch (crmError) {
        console.error('[BuilderSession] CRM generation failed:', crmError);
        // Ne pas bloquer si le CRM échoue
        toast.warning('Site créé, mais erreur CRM', {
          description: 'Le site est prêt, mais le CRM n\'a pas pu être généré'
        });
      }

      return siteResult;
    } catch (error) {
      // Gestion d'erreur
      throw error;
    }
  };

  return { generateSite };
}
```

### Étape 2 : Ajouter un Bouton "Voir le CRM"

Dans `src/pages/BuilderSession.tsx` :

```tsx
import { useNavigate } from 'react-router-dom';

export default function BuilderSession() {
  const navigate = useNavigate();
  const { sessionId } = useParams();

  return (
    <div>
      {/* Header existant */}
      <div className="flex items-center gap-2">
        {/* Boutons existants */}

        {/* NOUVEAU : Bouton CRM */}
        <Button
          onClick={() => navigate(`/project/${sessionId}/crm`)}
          className="flex items-center gap-2"
          style={{
            borderColor: '#03A5C0',
            backgroundColor: 'rgba(3,165,192,0.1)',
            color: '#03A5C0'
          }}
        >
          <LayoutDashboard className="h-4 w-4" />
          Voir le CRM
        </Button>
      </div>

      {/* Reste du composant */}
    </div>
  );
}
```

---

## 🗺️ Prochaines Étapes (Phase 2)

Pour continuer l'implémentation, les prochaines tâches sont :

### Phase 2 : Système de Widgets (Semaines 3-4)

1. **Créer la Widget Registry**
   ```
   src/components/crm/widgets/
   ├── WidgetRegistry.tsx
   ├── DataTable.tsx
   ├── KPICard.tsx
   ├── LineChart.tsx
   ├── FormWidget.tsx
   └── CalendarWidget.tsx
   ```

2. **Créer le Module Viewer**
   ```
   src/components/crm/
   ├── ModuleViewer.tsx
   ├── CRMLayout.tsx
   └── CRMSidebar.tsx
   ```

3. **Créer la Page CRM**
   ```
   src/pages/ProjectCRM.tsx
   ```

4. **Ajouter la Route**
   ```typescript
   // src/App.tsx
   <Route path="/project/:id/crm" element={<ProjectCRM />} />
   ```

---

## 🧪 Tests Recommandés

### Test 1 : Génération CRM pour Agence Immobilière

```typescript
const prompt = "Je veux un site pour mon agence immobilière à Paris";
const result = await crmGenerator.generateCRM(projectId, prompt);

// Vérifications
expect(result.business_sector).toBe('real_estate');
expect(result.modules_count).toBeGreaterThanOrEqual(5);
expect(result.modules_count).toBeLessThanOrEqual(10);
```

### Test 2 : Récupération des Modules

```typescript
const modules = await crmGenerator.getProjectModules(projectId);

expect(modules.length).toBeGreaterThan(0);
expect(modules[0]).toHaveProperty('name');
expect(modules[0]).toHaveProperty('widgets');
```

### Test 3 : Génération pour E-commerce

```typescript
const prompt = "Je veux une boutique en ligne pour vendre des chaussures";
const result = await crmGenerator.generateCRM(projectId, prompt);

expect(result.business_sector).toBe('ecommerce');
```

---

## 📊 Exemple de Résultat CRM

Pour le prompt "Site pour mon agence immobilière", Claude génère :

```json
{
  "business_sector": "real_estate",
  "sector_confidence": 0.95,
  "business_description": "Agence immobilière",
  "suggested_modules": [
    {
      "name": "Gestion de Biens",
      "module_type": "inventory",
      "icon": "Building2",
      "priority": 10,
      "widgets": [
        {
          "widget_type": "data-table",
          "title": "Liste des Biens",
          "config": {
            "columns": [
              {"key": "address", "label": "Adresse", "type": "text"},
              {"key": "price", "label": "Prix", "type": "currency"},
              {"key": "surface", "label": "Surface", "type": "number", "unit": "m²"}
            ]
          }
        },
        {
          "widget_type": "kpi-card",
          "title": "Biens Actifs",
          "config": {"icon": "Home", "color": "#03A5C0"}
        }
      ]
    },
    // ... 4 à 9 modules supplémentaires
  ]
}
```

---

## ⚠️ Points d'Attention

### Budget Tokens

- **Site Web** : 20k tokens max
- **CRM** : 30k tokens max
- **Total première génération** : 50k tokens max

Si vous dépassez, ajuster le prompt système ou limiter le nombre de widgets par module.

### Gestion d'Erreurs

L'Edge Function peut échouer si :
- Prompt trop vague (pas de secteur détectable)
- Réponse Claude non-JSON
- Problème de connexion API

Toujours wrapper dans try/catch et prévoir un fallback.

### RLS Policies

Les policies sont configurées pour que chaque user ne voit que ses propres modules.
Vérifier l'auth avant tout appel DB.

---

## 📝 Changelog Phase 1

- ✅ Migration Supabase avec 4 tables + RLS
- ✅ Edge Function `generate-crm` avec prompt engineering
- ✅ Service TypeScript `CRMGeneratorService`
- ✅ Hook React `useGenerateCRM`
- ✅ Documentation d'intégration

**Prochaine Phase** : Widgets Registry + Module Viewer + Page CRM

---

**Auteur**: Claude (Architecture & Development)
**Status**: ✅ Phase 1 Complétée - Prêt pour Phase 2
