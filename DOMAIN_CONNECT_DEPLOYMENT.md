# 🚀 Guide de Déploiement Domain Connect

Ce guide vous explique étape par étape comment déployer et activer le système Domain Connect.

## 📋 Prérequis

- [x] Compte Supabase avec projet actif
- [x] Compte Cloudflare avec Workers activés
- [x] Supabase CLI installé (`npm install -g supabase`)
- [x] Wrangler CLI installé (`npm install -g wrangler`)
- [x] Accès au compte GitHub pour modifier le template Domain Connect

---

## Étape 1: Installer les CLI nécessaires ⚙️

```bash
# Installer Supabase CLI
npm install -g supabase

# Installer Wrangler (Cloudflare CLI)
npm install -g wrangler

# Vérifier les installations
supabase --version
wrangler --version
```

---

## Étape 2: Se connecter aux services 🔐

### Supabase

```bash
# Se connecter à Supabase
supabase login

# Lier le projet local au projet Supabase
supabase link --project-ref mtmroennrczdcaasrilw
```

### Cloudflare

```bash
# Se connecter à Cloudflare
wrangler login
```

---

## Étape 3: Déployer les Edge Functions Supabase 📤

```bash
# Déployer la fonction de découverte
supabase functions deploy domain-connect-discover

# Déployer la fonction de vérification
supabase functions deploy domain-connect-verify

# Vérifier le déploiement
supabase functions list
```

**Résultat attendu:**
```
✓ domain-connect-discover deployed
✓ domain-connect-verify deployed
```

---

## Étape 4: Appliquer la migration de base de données 🗄️

```bash
# Appliquer la migration pour créer la table custom_domains
supabase db push

# Vérifier que la table existe
supabase db diff
```

**Résultat attendu:**
```
✓ Migration 20251213195212_custom_domains_table.sql applied
✓ Table custom_domains created
✓ Policies and indexes created
```

---

## Étape 5: Créer le KV Namespace Cloudflare 🗂️

```bash
# Créer le namespace pour stocker les mappings domaine → projectName
cd workers/domain-proxy
wrangler kv:namespace create "DOMAINS_KV"
```

**Résultat attendu:**
```
🌀 Creating namespace with title "domain-proxy-DOMAINS_KV"
✨ Success!
Add the following to your configuration file:
kv_namespaces = [
  { binding = "DOMAINS_KV", id = "abc123def456..." }
]
```

**Action requise:**
Copier l'ID retourné (ex: `abc123def456...`) et le mettre dans `workers/domain-proxy/wrangler.toml`:

```toml
kv_namespaces = [
  { binding = "DOMAINS_KV", id = "abc123def456..." }  # ← Remplacer avec votre ID
]
```

---

## Étape 6: Déployer le Worker Proxy Cloudflare ☁️

```bash
# Toujours dans workers/domain-proxy
wrangler deploy
```

**Résultat attendu:**
```
✨ Success!
Your worker is available at:
https://domain-proxy.{votre-subdomain}.workers.dev
```

---

## Étape 7: Configurer le Custom Domain sur le Worker 🌐

### Option A: Via Dashboard Cloudflare (Recommandé)

1. Aller sur https://dash.cloudflare.com
2. Workers & Pages → `domain-proxy`
3. Settings → Triggers → Custom Domains
4. Add Custom Domain → `proxy.builtbymagellan.com`
5. Cloudflare configure automatiquement le DNS

### Option B: Via CLI

```bash
# Dans workers/domain-proxy
wrangler domains add proxy.builtbymagellan.com
```

**Vérification:**
```bash
# Tester le worker
curl https://proxy.builtbymagellan.com
# Devrait retourner: "Built by Magellan - Domain Proxy Service"
```

---

## Étape 8: Configurer les Variables d'Environnement Supabase 🔑

Les edge functions ont besoin des clés Cloudflare pour ajouter les domaines.

### Via Supabase Dashboard:

1. Aller sur https://supabase.com/dashboard
2. Votre projet → Settings → Edge Functions → Manage secrets
3. Ajouter ces variables:
   - `CLOUDFLARE_API_TOKEN` → Votre token API Cloudflare
   - `CLOUDFLARE_ACCOUNT_ID` → Votre Account ID Cloudflare
   - `CLOUDFLARE_KV_NAMESPACE_ID` → L'ID KV créé à l'étape 5

### Via CLI:

```bash
supabase secrets set CLOUDFLARE_API_TOKEN=your_token_here
supabase secrets set CLOUDFLARE_ACCOUNT_ID=your_account_id_here
supabase secrets set CLOUDFLARE_KV_NAMESPACE_ID=your_kv_id_here
```

**Comment obtenir ces valeurs:**

#### CLOUDFLARE_API_TOKEN
1. Dashboard Cloudflare → Mon profil → Jetons API
2. Créer un jeton → Modifier les Workers Cloudflare
3. Permissions:
   - Account → Workers Scripts → Edit
   - Account → Workers KV Storage → Edit
   - Account → Cloudflare Pages → Edit

#### CLOUDFLARE_ACCOUNT_ID
- Dashboard Cloudflare → Workers & Pages → Overview
- Visible dans l'URL ou dans la sidebar (Account ID)

---

## Étape 9: Mettre à jour domain-connect-verify pour KV 📝

Ajouter le code pour enregistrer le domaine dans KV après vérification DNS.

Modifier `supabase/functions/domain-connect-verify/index.ts` après la ligne 99:

```typescript
// Après avoir ajouté le domaine à Cloudflare Pages
if (addDomainResponse.ok) {
  // Enregistrer le mapping dans KV
  const KV_NAMESPACE_ID = Deno.env.get('CLOUDFLARE_KV_NAMESPACE_ID');

  if (KV_NAMESPACE_ID) {
    const kvKey = `domain:${domain}`;
    const kvValue = session.cloudflare_project_name;

    await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces/${KV_NAMESPACE_ID}/values/${kvKey}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
          'Content-Type': 'text/plain',
        },
        body: kvValue,
      }
    );

    console.log('✅ Domain mapping added to KV:', kvKey, '->', kvValue);
  }

  // Reste du code...
```

Puis redéployer:
```bash
supabase functions deploy domain-connect-verify
```

---

## Étape 10: Template GitHub Domain Connect (Optionnel) 📄

Votre template `builtbymagellan.com.websitehosting.json` est déjà créé! ✅

Pour qu'il soit officiel:
1. Fork le repo https://github.com/Domain-Connect/templates
2. Ajouter votre fichier dans le dossier approprié
3. Créer une Pull Request

**En attendant**, votre template fonctionne localement pour les providers qui le supportent.

---

## Étape 11: Test Complet 🧪

### 1. Test de découverte

```bash
curl -X POST https://mtmroennrczdcaasrilw.supabase.co/functions/v1/domain-connect-discover \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"domain":"example.com"}'
```

### 2. Test de vérification

```bash
curl -X POST https://mtmroennrczdcaasrilw.supabase.co/functions/v1/domain-connect-verify \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"domain":"example.com","sessionId":"your-session-id"}'
```

### 3. Test du worker proxy

```bash
# Ajouter un domaine de test dans KV
wrangler kv:key put \
  --namespace-id=YOUR_KV_ID \
  "domain:test.example.com" \
  "your-project-name"

# Tester (avec le DNS configuré)
curl -H "Host: test.example.com" https://proxy.builtbymagellan.com
```

---

## Étape 12: Commit et Push 💾

```bash
git add workers/domain-proxy/
git add supabase/config.toml
git add DOMAIN_CONNECT_DEPLOYMENT.md
git commit -m "Feat: Ajout du worker proxy Domain Connect + guide de déploiement"
git push
```

---

## ✅ Checklist de Déploiement

- [ ] Supabase CLI installé et connecté
- [ ] Wrangler CLI installé et connecté
- [ ] Edge functions déployées (discover + verify)
- [ ] Migration DB appliquée (custom_domains table)
- [ ] KV Namespace créé
- [ ] Worker proxy déployé
- [ ] Custom domain configuré (proxy.builtbymagellan.com)
- [ ] Variables d'environnement Supabase configurées
- [ ] Code KV ajouté dans domain-connect-verify
- [ ] Tests effectués

---

## 🐛 Troubleshooting

### Edge functions ne se déploient pas
```bash
# Vérifier les logs
supabase functions logs domain-connect-discover

# Redéployer avec verbosité
supabase functions deploy domain-connect-discover --debug
```

### Worker ne répond pas
```bash
# Vérifier les logs en temps réel
wrangler tail

# Vérifier la configuration
wrangler whoami
```

### DNS ne se vérifie pas
- Attendre 5-10 minutes (propagation DNS)
- Vérifier avec: `dig CNAME example.com`
- Vérifier les logs: `supabase functions logs domain-connect-verify`

---

## 📚 Ressources

- [Documentation Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Documentation Cloudflare Workers](https://developers.cloudflare.com/workers/)
- [Domain Connect Protocol](https://www.domainconnect.org/)
- [Cloudflare KV](https://developers.cloudflare.com/kv/)

---

## 🎉 C'est Terminé!

Une fois toutes ces étapes complétées, votre système Domain Connect sera entièrement opérationnel!

Les utilisateurs pourront:
1. Cliquer sur "Connecter" dans le Dashboard
2. Entrer leur domaine
3. Soit configuration automatique (si provider supporté)
4. Soit instructions manuelles
5. Domaine actif en quelques minutes! 🚀
