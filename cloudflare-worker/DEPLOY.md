# Déploiement du Worker de routage Magellan

Ce guide explique comment déployer le Worker de routage principal qui sert tous les projets depuis `*.builtbymagellan.com`.

## Architecture

Le système utilise:
1. **Un Worker de routage unique** (`magellan-sites-worker`) qui intercepte toutes les requêtes `*.builtbymagellan.com`
2. **Cloudflare KV** pour stocker les fichiers de chaque projet (clé format: `projet-name:/chemin/fichier`)
3. **DNS wildcard** pointant vers le Worker de routage

## Prérequis

- Compte Cloudflare avec accès au domaine `builtbymagellan.com`
- Wrangler CLI installé: `npm install -g wrangler`
- Accès au Zone ID du domaine

## Étapes de déploiement

### 1. Créer le KV Namespace

Dans le dashboard Cloudflare:
- Allez dans **Workers & Pages** → **KV**
- Cliquez sur **Create a namespace**
- Nom: `magellan-sites`
- Copiez l'ID du namespace (format: `abc123...`)

### 2. Configurer wrangler.toml

Éditez `cloudflare-worker/wrangler.toml`:

```toml
name = "magellan-sites-worker"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[[kv_namespaces]]
binding = "SITES_KV"
id = "VOTRE_KV_NAMESPACE_ID"  # Remplacez par l'ID copié à l'étape 1
```

### 3. Déployer le Worker

Depuis le dossier `cloudflare-worker/`:

```bash
# Se connecter à Cloudflare
wrangler login

# Déployer le Worker
wrangler deploy
```

Le Worker sera déployé sur: `https://magellan-sites-worker.VOTRE-ACCOUNT.workers.dev`

### 4. Configurer le DNS wildcard

Dans le dashboard Cloudflare, DNS de `builtbymagellan.com`:

**Option A: CNAME wildcard (recommandé)**
- Type: `CNAME`
- Nom: `*` (wildcard)
- Cible: `magellan-sites-worker.VOTRE-ACCOUNT.workers.dev`
- Proxy: ✅ Activé (orange cloud)

**Option B: Worker Routes (alternative)**
- Allez dans **Workers & Pages** → **magellan-sites-worker** → **Settings** → **Triggers**
- Ajoutez une route:
  - Pattern: `*.builtbymagellan.com/*`
  - Zone: `builtbymagellan.com`

### 5. Ajouter le KV Namespace ID dans Supabase

Le secret `CLOUDFLARE_KV_NAMESPACE_ID` doit contenir l'ID du namespace KV créé à l'étape 1.

Vérifiez que ce secret existe dans Supabase Edge Functions.

## Vérification

### Test du routage

Publiez un projet depuis Magellan, puis testez:

```bash
curl -I https://nom-projet.builtbymagellan.com
```

Vous devriez recevoir un `200 OK` avec le contenu du site.

### Vérifier les fichiers dans KV

Dans le dashboard Cloudflare:
- **Workers & Pages** → **KV** → `magellan-sites`
- Vous devriez voir des clés au format: `nom-projet:/index.html`, `nom-projet:/styles.css`, etc.

### Logs du Worker

```bash
wrangler tail
```

Cela affichera les logs en temps réel du Worker pour déboguer les problèmes.

## Dépannage

### Le site ne s'affiche pas (404)

1. Vérifier que le DNS wildcard est correctement configuré:
   ```bash
   dig +short nom-projet.builtbymagellan.com
   ```

2. Vérifier que les fichiers sont bien dans KV (dashboard Cloudflare)

3. Vérifier les logs du Worker:
   ```bash
   wrangler tail
   ```

### Erreur "Namespace not found"

- Le `CLOUDFLARE_KV_NAMESPACE_ID` dans Supabase doit correspondre à l'ID du namespace
- Redéployez le Worker après avoir mis à jour le `wrangler.toml`

### CORS errors

Le Worker gère automatiquement les CORS. Si vous avez des erreurs:
- Vérifiez que le Worker est bien déployé
- Vérifiez les logs pour voir les requêtes entrantes

## Maintenance

### Nettoyer les anciens projets

Les projets publiés restent indéfiniment dans KV. Pour nettoyer:

```bash
# Lister toutes les clés d'un projet
wrangler kv:key list --namespace-id=VOTRE_ID --prefix="nom-projet:"

# Supprimer un projet complet
wrangler kv:key delete --namespace-id=VOTRE_ID "nom-projet:/index.html"
# Répéter pour chaque fichier...
```

### Mise à jour du Worker

Après avoir modifié `src/index.ts`:

```bash
wrangler deploy
```

Les changements sont instantanés sur tous les projets.

## Limites Cloudflare KV

- **Free tier**: 100,000 lectures/jour, 1,000 écritures/jour, 1 GB stockage
- **Workers Paid**: $5/mois → lectures illimitées, 1M écritures, 1 GB stockage
- **Additional storage**: $0.50/GB/mois

Estimation pour 1000 projets avec 10k visites/jour: ~$5-10/mois
