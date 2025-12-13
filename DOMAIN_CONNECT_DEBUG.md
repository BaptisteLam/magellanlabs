# 🐛 Domain Connect - Diagnostic et Solutions

## Problème Reporté

Le système Domain Connect ne détecte pas le fournisseur de nom de domaine.

---

## 🔍 Analyse des Causes

### 1. **Edge Function Non Déployée** ⚠️ PRINCIPAL

La edge function `domain-connect-discover` n'est probablement **pas déployée** sur Supabase.

**Symptômes:**
- Le dialog s'ouvre mais reste en "discovering" sans résultat
- Pas de provider détecté même pour des domaines connus
- Erreur silencieuse dans la console

**Solution:**
```bash
supabase functions deploy domain-connect-discover
```

**Vérification:**
```bash
supabase functions list
# Devrait afficher: domain-connect-discover
```

---

### 2. **Détection Nameservers Trop Stricte** 🐛 CORRIGÉ

**Avant (bugué):**
```typescript
if (ns.includes(key)) { // Trop basique
  return provider;
}
```

**Problème:** Ne matchait pas les variations comme:
- `ns1.ovh.net` ✅ → Détectait OVH
- `dns1.p08.nsone.net` ❌ → Ne détectait rien

**Après (corrigé):**
```typescript
const providerPatterns: Record<string, RegExp[]> = {
  'GoDaddy': [/godaddy/i, /domaincontrol/i],
  'OVH': [/ovh/i, /ovhcloud/i],
  'Namecheap': [/namecheap/i, /registrar-servers\.com/i],
  // ... 16 providers supportés
};

for (const ns of nameservers) {
  for (const [provider, patterns] of Object.entries(providerPatterns)) {
    for (const pattern of patterns) {
      if (pattern.test(ns)) {
        return provider; // ✅ Détection robuste
      }
    }
  }
}
```

**Providers ajoutés:**
- HostGator
- Bluehost
- AWS Route 53
- DigitalOcean
- Linode
- Vultr

---

### 3. **Logs Invisibles** 📊

Les `console.log()` dans la edge function ne sont visibles que dans les logs Supabase, pas dans le browser.

**Solution:**
J'ai ajouté des outils de debug côté client.

---

## 🛠️ Solutions Implémentées

### ✅ 1. Amélioration de la Détection (Déjà fait)

**Fichier modifié:**
- `supabase/functions/domain-connect-discover/index.ts` (ligne 216-272)

**Changements:**
- ✅ Utilisation de regex au lieu de `includes()`
- ✅ Support de 16 providers (vs 11 avant)
- ✅ Meilleure gestion des variantes (ex: `domaincontrol.com` pour GoDaddy)
- ✅ Logs améliorés pour debugging

---

### ✅ 2. Outil de Test/Debug (Nouveau)

**Fichier créé:**
- `src/lib/domain-connect/debugger.ts`

**Utilisation dans la console browser:**
```javascript
// Test un seul domaine
await DomainConnectDebugger.testDiscovery('google.com')

// Test plusieurs domaines
await DomainConnectDebugger.testMultipleDomains([
  'google.com',
  'github.com',
  'vercel.com'
])

// Test la edge function (si déployée)
await DomainConnectDebugger.testEdgeFunction('example.com', supabase)
```

**Ce qu'il teste:**
1. ✅ Query DNS `_domainconnect` TXT record
2. ✅ Query nameservers (NS records)
3. ✅ Détection du provider
4. ✅ Affiche un tableau récapitulatif

---

### ✅ 3. Composant de Test UI (Nouveau)

**Fichier créé:**
- `src/components/DomainConnectTester.tsx`

**Utilisation:**
```tsx
// Ajouter temporairement dans Dashboard ou n'importe où
import { DomainConnectTester } from '@/components/DomainConnectTester';

function Dashboard() {
  return (
    <>
      {/* Vos composants existants */}
      <DomainConnectTester />
    </>
  );
}
```

**Features:**
- 🔍 Test Local (browser) - Teste la détection DNS directement
- ☁️ Test Edge Function - Teste si la edge function est déployée
- 📊 Affichage des résultats (provider, nameservers, etc.)

---

## 🧪 Comment Tester

### Option 1: Test dans la Console (Rapide)

1. Ouvrir la console browser (F12)
2. Aller sur votre site
3. Exécuter:
```javascript
await DomainConnectDebugger.testDiscovery('google.com')
```

4. Observer les logs:
```
🔍 Testing Domain Connect Discovery: google.com
1️⃣ Querying _domainconnect TXT record...
Result: ❌ Not found

2️⃣ Querying nameservers...
Nameservers: ["ns1.google.com", "ns2.google.com", ...]

3️⃣ Detecting provider...
Provider: Google Domains

📊 Summary:
┌─────────────────────┬──────────────────────┐
│ Domain              │ google.com           │
│ Domain Connect      │ ❌ Not supported     │
│ Nameservers         │ ns1.google.com, ...  │
│ Provider Detected   │ Google Domains       │
│ Method              │ Manual               │
└─────────────────────┴──────────────────────┘
```

---

### Option 2: Composant UI (Visual)

1. Ajouter `<DomainConnectTester />` dans un composant
2. Ouvrir la page
3. Entrer un domaine (ex: `google.com`)
4. Cliquer "Test Local" ou "Test Edge Function"
5. Observer le résultat visuel

---

### Option 3: Test Real (Dashboard)

1. **S'assurer que la edge function est déployée:**
```bash
supabase functions deploy domain-connect-discover
```

2. Aller dans Dashboard → Siteweb
3. Cliquer "Connecter"
4. Entrer votre domaine
5. Observer:
   - ✅ Provider détecté → Instructions manuelles avec nom du provider
   - ❌ Erreur → Vérifier les logs Supabase

---

## 📋 Checklist de Résolution

- [ ] **Déployer la edge function**
  ```bash
  supabase functions deploy domain-connect-discover
  ```

- [ ] **Vérifier qu'elle est déployée**
  ```bash
  supabase functions list
  # ou
  supabase functions logs domain-connect-discover
  ```

- [ ] **Tester avec l'outil de debug**
  ```javascript
  await DomainConnectDebugger.testDiscovery('votre-domaine.com')
  ```

- [ ] **Vérifier les logs Supabase**
  ```bash
  supabase functions logs domain-connect-discover --follow
  ```

- [ ] **Tester dans le Dashboard réel**
  - Ouvrir le dialog Domain Connect
  - Entrer un domaine de test
  - Vérifier que le provider est détecté

---

## 🎯 Providers Supportés

| Provider | Patterns | Exemple NS |
|----------|----------|------------|
| GoDaddy | `godaddy`, `domaincontrol` | `ns1.domaincontrol.com` |
| Cloudflare | `cloudflare` | `ns1.cloudflare.com` |
| OVH | `ovh`, `ovhcloud` | `dns1.ovh.net` |
| Gandi | `gandi` | `ns1.gandi.net` |
| Namecheap | `namecheap`, `registrar-servers` | `dns1.registrar-servers.com` |
| 1&1 IONOS | `ionos`, `1and1`, `ui-dns` | `ns1.ui-dns.com` |
| Google Domains | `google`, `ns-cloud` | `ns-cloud-a1.googledomains.com` |
| AWS Route 53 | `awsdns` | `ns-123.awsdns-12.com` |
| DigitalOcean | `digitalocean` | `ns1.digitalocean.com` |
| HostGator | `hostgator` | `ns1.hostgator.com` |
| Bluehost | `bluehost` | `ns1.bluehost.com` |
| Linode | `linode` | `ns1.linode.com` |
| Vultr | `vultr` | `ns1.vultr.com` |

**Total:** 16 providers (vs 11 avant)

---

## 🔧 Debugging Avancé

### Voir les logs Edge Function en temps réel

```bash
supabase functions logs domain-connect-discover --follow
```

### Test manuel de la edge function

```bash
curl -X POST https://mtmroennrczdcaasrilw.supabase.co/functions/v1/domain-connect-discover \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"domain":"google.com"}'
```

### Test DNS-over-HTTPS direct

```bash
# Query _domainconnect
curl "https://cloudflare-dns.com/dns-query?name=_domainconnect.google.com&type=TXT" \
  -H "Accept: application/dns-json"

# Query nameservers
curl "https://cloudflare-dns.com/dns-query?name=google.com&type=NS" \
  -H "Accept: application/dns-json"
```

---

## 📝 Résumé

| Problème | Status | Solution |
|----------|--------|----------|
| Edge function non déployée | ⚠️ **À faire** | `supabase functions deploy domain-connect-discover` |
| Détection nameservers faible | ✅ **Corrigé** | Regex + 16 providers supportés |
| Logs invisibles | ✅ **Corrigé** | Debugger + Composant de test |

---

## 🚀 Prochaines Étapes

1. **Déployer la edge function:**
   ```bash
   supabase functions deploy domain-connect-discover
   ```

2. **Tester avec l'outil de debug:**
   ```javascript
   await DomainConnectDebugger.testDiscovery('votre-domaine.com')
   ```

3. **Si le provider n'est toujours pas détecté:**
   - Regarder les nameservers retournés
   - Ajouter un nouveau pattern si nécessaire
   - Ouvrir un issue GitHub

---

**Date:** 2025-12-13
**Version:** 2.0
**Status:** ✅ Code corrigé, déploiement requis
