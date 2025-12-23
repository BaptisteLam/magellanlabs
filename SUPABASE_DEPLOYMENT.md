# 🚀 Guide de Déploiement Supabase - CRM System

**Phase 2 terminée** ! Avant de pouvoir utiliser le CRM, vous devez appliquer la migration Supabase.

---

## ⚠️ ÉTAPE CRITIQUE : Appliquer la Migration

### Option 1 : Via Supabase Dashboard (Recommandé)

1. **Aller sur Supabase** : https://supabase.com/dashboard
2. **Sélectionner votre projet** Magellan
3. **Aller dans SQL Editor** (menu de gauche)
4. **Créer une nouvelle query**
5. **Copier-coller** le contenu de :
   ```
   supabase/migrations/20251223000001_create_crm_tables.sql
   ```
6. **Exécuter** la query (bouton RUN)
7. **Vérifier** qu'il n'y a pas d'erreurs

✅ **Vous devriez voir** :
- ✅ `Successfully executed query`
- ✅ 4 nouvelles tables créées

---

### Option 2 : Via Supabase CLI

Si vous avez Supabase CLI installé localement :

```bash
# 1. Login
supabase login

# 2. Link au projet
supabase link --project-ref YOUR_PROJECT_REF

# 3. Appliquer les migrations
supabase db push

# 4. Vérifier
supabase db diff
```

---

## ✅ Vérification Post-Migration

### Dans Supabase Dashboard → Table Editor

Vous devriez voir **4 nouvelles tables** :

1. **crm_modules**
   - Colonnes : id, project_id, name, module_type, icon, display_order, config, is_active, etc.
   - RLS activé ✅

2. **crm_widgets**
   - Colonnes : id, module_id, widget_type, title, config, layout, is_visible, etc.
   - RLS activé ✅

3. **widget_data**
   - Colonnes : id, widget_id, data (JSONB), metadata, created_at, updated_at
   - RLS activé ✅

4. **build_sessions** (modifiée)
   - Nouvelles colonnes : `business_sector`, `initial_modules_config`

---

## 🔧 Déployer l'Edge Function

L'Edge Function `generate-crm` doit être déployée sur Supabase :

### Via Supabase CLI (Recommandé)

```bash
# Déployer la fonction
supabase functions deploy generate-crm

# Vérifier qu'elle est déployée
supabase functions list
```

### Via Supabase Dashboard

1. **Aller dans Edge Functions** (menu de gauche)
2. **Create a new function** → `generate-crm`
3. **Copier-coller** le code de `supabase/functions/generate-crm/index.ts`
4. **Deploy**

---

## 🔑 Variables d'Environnement

L'Edge Function a besoin de **ANTHROPIC_API_KEY** :

### Dans Supabase Dashboard

1. **Settings** → **Edge Functions** → **Secrets**
2. **Add secret** :
   - Name: `ANTHROPIC_API_KEY`
   - Value: `votre-clé-anthropic`

---

## 📝 TODO après Migration

### ⚠️ CONNEXION SUPABASE À FAIRE

**Vous devez maintenant connecter Supabase dans Lovable** :

1. **Aller sur Lovable.dev**
2. **Ouvrir votre projet** Magellan
3. **Settings** → **Integrations** → **Supabase**
4. **Entrer vos credentials** :
   - Project URL : `https://YOUR_PROJECT.supabase.co`
   - Anon Key : `votre-anon-key`
   - Service Role Key : `votre-service-role-key`

OU

**Claude Code peut générer le code de connexion** si vous préférez le faire manuellement.

---

## 🧪 Tester le Système

### Test 1 : Accès à la page CRM

```
1. Créer un nouveau projet (ou utiliser un existant)
2. Naviguer vers : /project/{projectId}/crm
3. Vous devriez voir :
   ✅ La sidebar avec "Modules CRM"
   ✅ Le message "Bienvenue dans votre CRM"
```

### Test 2 : Génération CRM

Dans votre code (ou via console) :

```typescript
import { crmGenerator } from '@/services/crmGenerator';

const projectId = 'votre-project-id';
const prompt = "Je veux un site pour mon agence immobilière";

const result = await crmGenerator.generateCRM(projectId, prompt);

console.log(result);
// Devrait retourner : { success: true, business_sector: 'real_estate', modules_count: 5-10, ... }
```

### Test 3 : Visualisation des Modules

```
1. Après génération CRM
2. Recharger /project/{projectId}/crm
3. Vous devriez voir :
   ✅ 5-10 modules dans la sidebar
   ✅ En cliquant sur un module → widgets affichés
```

---

## 🐛 Troubleshooting

### Erreur : "relation crm_modules does not exist"

➡️ La migration n'a pas été appliquée. Refaites l'Option 1 ci-dessus.

### Erreur : "Function generate-crm not found"

➡️ L'Edge Function n'est pas déployée. Déployez-la via CLI ou Dashboard.

### Erreur : "ANTHROPIC_API_KEY is not defined"

➡️ Ajoutez la clé API dans Supabase Secrets (voir section Variables d'Environnement).

### Pas de modules générés

➡️ Vérifiez que `business_sector` est bien rempli dans `build_sessions` après génération.

### Widgets ne s'affichent pas

➡️ Vérifiez que les widgets ont bien été créés en DB (`crm_widgets` table).

---

## 📊 Structure Finale

Après déploiement, votre système devrait ressembler à :

```
Supabase
├── Tables
│   ├── build_sessions (extended)
│   ├── crm_modules (nouveau)
│   ├── crm_widgets (nouveau)
│   └── widget_data (nouveau)
│
├── Edge Functions
│   └── generate-crm (nouveau)
│
└── Secrets
    └── ANTHROPIC_API_KEY (configuré)
```

---

## 🎯 Next Steps Après Déploiement

Une fois la migration appliquée et l'Edge Function déployée :

1. **Intégrer dans BuilderSession** (voir `CRM_INTEGRATION_GUIDE.md`)
2. **Tester la génération automatique**
3. **Phase 3** : Ajouter le chat panel CRM (optionnel)

---

**Besoin d'aide ?** Consultez `CRM_INTEGRATION_GUIDE.md` pour les détails d'intégration.
