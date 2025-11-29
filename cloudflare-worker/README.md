# Guide de Déploiement - Worker Cloudflare KV

Ce guide explique comment déployer le Worker Cloudflare pour servir les sites Magellan depuis KV (publication instantanée).

## Prérequis

- Un compte Cloudflare
- Node.js 18+ installé
- npm ou bun installé
- Le domaine `builtbymagellan.com` configuré sur Cloudflare

## Étape 1 : Créer le KV Namespace

1. Connectez-vous au [Dashboard Cloudflare](https://dash.cloudflare.com/)
2. Allez dans **Workers & Pages** → **KV**
3. Cliquez sur **Create a namespace**
4. Nommez-le `magellan-sites`
5. Copiez l'**ID du namespace** (vous en aurez besoin pour les étapes suivantes)

## Étape 2 : Configurer le Worker

1. Ouvrez le fichier `wrangler.toml`
2. Remplacez `YOUR_KV_NAMESPACE_ID` par l'ID que vous avez copié :

```toml
[[kv_namespaces]]
binding = "SITES_KV"
id = "votre-id-namespace-ici"  # Remplacez par l'ID réel
```

## Étape 3 : Déployer le Worker

```bash
# Dans le dossier cloudflare-worker/
cd cloudflare-worker

# Installer les dépendances (si nécessaire)
npm install -g wrangler

# Se connecter à Cloudflare
wrangler login

# Déployer le Worker
wrangler deploy
```

Le Worker sera déployé et accessible à l'URL :
`https://magellan-sites-worker.votre-compte.workers.dev`

## Étape 4 : Configurer le DNS Wildcard

### Option A : Via le Dashboard Cloudflare (Recommandé)

1. Allez dans **DNS** → **Records**
2. Ajoutez un enregistrement CNAME wildcard :
   - **Type**: CNAME
   - **Name**: `*` (wildcard)
   - **Target**: `magellan-sites-worker.votre-compte.workers.dev`
   - **Proxy status**: Activé (orange cloud)
   - **TTL**: Auto

### Option B : Via Workers Routes

1. Allez dans **Workers & Pages** → **magellan-sites-worker**
2. Cliquez sur **Triggers** → **Routes** → **Add route**
3. Ajoutez la route :
   - **Route**: `*.builtbymagellan.com/*`
   - **Zone**: `builtbymagellan.com`

## Étape 5 : Ajouter le Secret Cloudflare KV Namespace ID

Dans votre backend Supabase (déjà fait via l'interface) :

Le secret `CLOUDFLARE_KV_NAMESPACE_ID` doit contenir l'ID du namespace KV créé à l'étape 1.

## Test de Fonctionnement

1. Publiez un projet depuis l'interface Magellan
2. Attendez le message de succès (devrait prendre ~100-500ms)
3. Visitez l'URL : `https://nom-du-projet.builtbymagellan.com`

### Test Manuel via API Cloudflare

Vous pouvez tester manuellement l'écriture dans KV :

```bash
curl -X PUT "https://api.cloudflare.com/client/v4/accounts/ACCOUNT_ID/storage/kv/namespaces/NAMESPACE_ID/values/test-project:/index.html" \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Content-Type: text/plain" \
  --data "<h1>Test</h1>"
```

Puis visitez : `https://test-project.builtbymagellan.com`

## Dépannage

### Le site ne se charge pas

1. **Vérifiez que le Worker est déployé** :
   ```bash
   wrangler tail
   ```
   Puis visitez votre site et observez les logs en temps réel.

2. **Vérifiez le DNS** :
   ```bash
   nslookup test-project.builtbymagellan.com
   ```
   Devrait pointer vers le Worker Cloudflare.

3. **Vérifiez que les fichiers sont dans KV** :
   - Allez dans **Workers & Pages** → **KV** → **magellan-sites**
   - Cherchez les clés commençant par le nom de votre projet

### Erreur "Namespace not found"

- Vérifiez que l'ID du namespace dans `wrangler.toml` est correct
- Redéployez le Worker après modification

### Erreur CORS

- Le Worker inclut déjà les headers CORS nécessaires
- Vérifiez que le proxy Cloudflare est activé (orange cloud)

### Page 404 pour tous les sites

- Vérifiez la route DNS wildcard `*.builtbymagellan.com`
- Vérifiez que le binding KV `SITES_KV` est correct dans `wrangler.toml`

## Performance

Avec cette architecture :
- **Publication** : ~100-500ms (vs 5-15s avec Pages API)
- **Chargement** : ~50-200ms (edge cache)
- **Limite** : ~1000 requêtes/sec par projet
- **Coût** : ~$5-10/mois pour 1000 projets avec 10k visites/jour

## Maintenance

### Mettre à jour le Worker

```bash
cd cloudflare-worker
wrangler deploy
```

### Nettoyer les anciens projets

Pour supprimer un projet du KV :

```bash
# Lister toutes les clés d'un projet
wrangler kv:key list --namespace-id=NAMESPACE_ID --prefix="project-name:"

# Supprimer toutes les clés d'un projet
wrangler kv:key delete --namespace-id=NAMESPACE_ID "project-name:/index.html"
wrangler kv:key delete --namespace-id=NAMESPACE_ID "project-name:/styles.css"
# etc.
```

### Monitorer l'utilisation

- Dashboard Cloudflare → **Analytics & Logs** → **Workers**
- Visualisez les requêtes, erreurs, et latence
- Configurez des alertes pour les erreurs

## Structure des Clés KV

Format : `project-name:/path/to/file`

Exemples :
- `mon-site:/index.html`
- `mon-site:/styles.css`
- `mon-site:/script.js`
- `mon-site:/images/logo.png`

## Limites de Cloudflare KV

- **Taille max par valeur** : 25 MB
- **Requêtes en lecture** : Illimitées (plan gratuit)
- **Requêtes en écriture** : 1000/jour (gratuit), illimité (payant ~$0.50/million)
- **Stockage** : 1 GB (gratuit), $0.50/GB/mois au-delà

Pour les projets avec plus de 1000 publications/jour, passez au plan Workers Paid ($5/mois).

## Support

Pour toute question :
- Documentation Cloudflare Workers : https://developers.cloudflare.com/workers/
- Documentation KV : https://developers.cloudflare.com/kv/
