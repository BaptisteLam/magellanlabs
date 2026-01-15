# Domain Connect Template Submission Guide

## Vue d'ensemble

Ce guide explique comment soumettre le template Domain Connect de Magellan au repository officiel pour activer la configuration automatique des DNS.

## Prérequis

1. **TXT Record de vérification** - Ajouter sur builtbymagellan.com :
   ```
   Type: TXT
   Name: _domainconnect-verification
   Value: domain-connect-template-v1
   ```

2. **Template hébergé** - Le fichier doit être accessible à :
   ```
   https://builtbymagellan.com/.well-known/domain-connect/builtbymagellan.com/websitehosting.json
   ```

## Étapes de soumission

### 1. Forker le repository

```bash
# 1. Aller sur https://github.com/Domain-Connect/templates
# 2. Cliquer sur "Fork"
# 3. Cloner votre fork
git clone https://github.com/VOTRE_USERNAME/templates.git
cd templates
```

### 2. Créer le fichier template

Créer le fichier `builtbymagellan.com.websitehosting.json` dans le dossier `templates/` :

```json
{
  "providerId": "builtbymagellan.com",
  "providerName": "Magellan",
  "serviceId": "websitehosting",
  "serviceName": "Website Hosting",
  "version": 1,
  "logoUrl": "https://builtbymagellan.com/lovable-uploads/magellan-logo-dark.png",
  "description": "Connect your domain to Magellan website hosting",
  "variableDescription": "The target for your website hosting",
  "syncRedirectDomain": true,
  "syncPubKeyDomain": "builtbymagellan.com",
  "syncBlock": false,
  "shared": false,
  "warnPhishing": true,
  "hostRequired": false,
  "records": [
    {
      "type": "A",
      "host": "@",
      "pointsTo": "185.158.133.1",
      "ttl": 3600
    },
    {
      "type": "CNAME",
      "host": "www",
      "pointsTo": "proxy.builtbymagellan.com",
      "ttl": 3600
    }
  ]
}
```

### 3. Commit et Push

```bash
git add templates/builtbymagellan.com.websitehosting.json
git commit -m "Add Magellan website hosting template"
git push origin main
```

### 4. Créer la Pull Request

Aller sur GitHub et créer une Pull Request avec ce contenu :

---

**Titre:** Add Magellan website hosting template

**Description:**

## Service Provider Information

| Field | Value |
|-------|-------|
| Provider Name | Magellan |
| Provider ID | builtbymagellan.com |
| Service ID | websitehosting |
| Service Name | Website Hosting |
| Website | https://builtbymagellan.com |
| Contact Email | support@builtbymagellan.com |

## Template Purpose

This template enables users to connect their custom domains to Magellan-hosted websites with a single click. Magellan is a no-code website builder that allows users to create and deploy professional websites.

## DNS Records Added

| Type | Host | Value | TTL |
|------|------|-------|-----|
| A | @ | 185.158.133.1 | 3600 |
| CNAME | www | proxy.builtbymagellan.com | 3600 |

## Verification

- [x] TXT record `_domainconnect-verification.builtbymagellan.com` added
- [x] Template hosted at `/.well-known/domain-connect/`
- [x] Logo accessible at provided URL

## Testing

Tested with domains hosted at:
- GoDaddy
- 1&1 IONOS

---

## Après la soumission

### Timeline estimée

| Étape | Durée |
|-------|-------|
| Review PR | 1-2 semaines |
| Merge | 1-4 semaines |
| Import par GoDaddy | 1 semaine après merge |
| Import par 1&1 IONOS | 2-4 semaines après merge |

### Providers qui supportent Domain Connect

| Provider | Status |
|----------|--------|
| GoDaddy | ✅ Actif - importe régulièrement |
| 1&1 IONOS | ✅ Actif - importe régulièrement |
| Plesk | ✅ Actif |
| United Domains | ✅ Actif |
| OVH | ⚠️ Support partiel |
| Namecheap | ❌ Non supporté |
| Cloudflare | ❌ Non supporté (utilise leur propre système) |

## Vérification du template

Pour vérifier que votre template fonctionne :

```bash
# 1. Vérifier le TXT record
dig TXT _domainconnect-verification.builtbymagellan.com

# 2. Vérifier le template JSON
curl https://builtbymagellan.com/.well-known/domain-connect/builtbymagellan.com/websitehosting.json

# 3. Tester avec un domaine sur GoDaddy (après approbation)
# L'option "Connexion automatique" apparaîtra dans le dialog
```

## Ressources

- [Domain Connect Specification](https://github.com/Domain-Connect/spec)
- [Template Examples](https://github.com/Domain-Connect/templates)
- [Domain Connect Website](https://www.domainconnect.org/)

## Contact

Pour toute question sur la soumission :
- GitHub Issues sur le repo Domain Connect
- Email: support@builtbymagellan.com
