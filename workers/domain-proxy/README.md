# Domain Proxy Worker

Worker Cloudflare qui route les requêtes de domaines personnalisés vers les sites Cloudflare Pages correspondants.

## Architecture

```
domaine-client.com → proxy.builtbymagellan.com → project-name.pages.dev
```

## Déploiement

### 1. Créer le KV Namespace

```bash
# Créer le KV namespace pour stocker les mappings domaine → projectName
wrangler kv:namespace create "DOMAINS_KV"
```

Copier l'ID retourné et le mettre dans `wrangler.toml` à la place de `YOUR_KV_NAMESPACE_ID`.

### 2. Déployer le Worker

```bash
cd workers/domain-proxy
wrangler deploy
```

### 3. Configurer le Custom Domain

Via le dashboard Cloudflare:
1. Aller dans Workers & Pages → domain-proxy
2. Settings → Triggers → Custom Domains
3. Ajouter: `proxy.builtbymagellan.com`

Ou via CLI:
```bash
wrangler domains add proxy.builtbymagellan.com
```

### 4. Configurer DNS

Dans la zone DNS `builtbymagellan.com`:
```
CNAME proxy → domain-proxy.workers.dev
```

Ou laisser Cloudflare le faire automatiquement lors de l'ajout du custom domain.

## Utilisation

### Ajouter un domaine personnalisé

Quand un utilisateur connecte un domaine (ex: `monsite.com`), ajouter l'entrée dans KV:

```bash
# Via CLI
wrangler kv:key put --namespace-id=YOUR_KV_NAMESPACE_ID "domain:monsite.com" "project-name-abc123"

# Via API Cloudflare (dans verify edge function)
PUT https://api.cloudflare.com/client/v4/accounts/{account_id}/storage/kv/namespaces/{namespace_id}/values/domain:monsite.com
Authorization: Bearer {api_token}
Body: "project-name-abc123"
```

### Supprimer un domaine

```bash
wrangler kv:key delete --namespace-id=YOUR_KV_NAMESPACE_ID "domain:monsite.com"
```

### Lister tous les domaines

```bash
wrangler kv:key list --namespace-id=YOUR_KV_NAMESPACE_ID --prefix="domain:"
```

## Test Local

```bash
# Installer wrangler si nécessaire
npm install -g wrangler

# Se connecter à Cloudflare
wrangler login

# Lancer en local
wrangler dev
```

## Variables d'environnement

Le worker utilise:
- `DOMAINS_KV` - KV namespace binding (configuré dans wrangler.toml)

Aucune variable d'environnement supplémentaire nécessaire.

## Monitoring

Logs disponibles dans:
- Cloudflare Dashboard → Workers & Pages → domain-proxy → Logs
- Ou via CLI: `wrangler tail`
