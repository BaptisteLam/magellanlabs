#!/bin/bash

# Script de déploiement automatisé pour Domain Connect
# Usage: ./scripts/deploy-domain-connect.sh

set -e

echo "🚀 Déploiement Domain Connect"
echo "=============================="
echo ""

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Vérifier les prérequis
echo "📋 Vérification des prérequis..."

if ! command -v supabase &> /dev/null; then
    echo -e "${RED}✗ Supabase CLI non installé${NC}"
    echo "  Installer avec: npm install -g supabase"
    exit 1
fi
echo -e "${GREEN}✓ Supabase CLI installé${NC}"

if ! command -v wrangler &> /dev/null; then
    echo -e "${RED}✗ Wrangler CLI non installé${NC}"
    echo "  Installer avec: npm install -g wrangler"
    exit 1
fi
echo -e "${GREEN}✓ Wrangler CLI installé${NC}"

echo ""

# Étape 1: Déployer les Edge Functions
echo "📤 Étape 1: Déploiement des Edge Functions Supabase..."
echo ""

read -p "Déployer domain-connect-discover ? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    supabase functions deploy domain-connect-discover
    echo -e "${GREEN}✓ domain-connect-discover déployé${NC}"
fi

read -p "Déployer domain-connect-verify ? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    supabase functions deploy domain-connect-verify
    echo -e "${GREEN}✓ domain-connect-verify déployé${NC}"
fi

echo ""

# Étape 2: Appliquer la migration DB
echo "🗄️  Étape 2: Application de la migration DB..."
echo ""

read -p "Appliquer la migration custom_domains ? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    supabase db push
    echo -e "${GREEN}✓ Migration appliquée${NC}"
fi

echo ""

# Étape 3: Cloudflare Worker
echo "☁️  Étape 3: Déploiement du Worker Cloudflare..."
echo ""

read -p "Créer le KV Namespace ? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    cd workers/domain-proxy
    echo ""
    echo -e "${YELLOW}Exécutez cette commande et copiez l'ID retourné:${NC}"
    echo "  wrangler kv:namespace create DOMAINS_KV"
    echo ""
    echo -e "${YELLOW}Puis mettez l'ID dans workers/domain-proxy/wrangler.toml${NC}"
    echo ""
    read -p "Appuyez sur Entrée pour continuer..."
    cd ../..
fi

echo ""

read -p "Déployer le worker proxy ? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    cd workers/domain-proxy
    wrangler deploy
    echo -e "${GREEN}✓ Worker déployé${NC}"
    cd ../..
fi

echo ""

# Étape 4: Configuration DNS
echo "🌐 Étape 4: Configuration du Custom Domain..."
echo ""

echo -e "${YELLOW}Action manuelle requise:${NC}"
echo "1. Aller sur: https://dash.cloudflare.com"
echo "2. Workers & Pages → domain-proxy"
echo "3. Settings → Triggers → Custom Domains"
echo "4. Add Custom Domain: proxy.builtbymagellan.com"
echo ""

read -p "Configuration DNS faite ? (y/n) " -n 1 -r
echo

echo ""

# Étape 5: Variables d'environnement
echo "🔑 Étape 5: Variables d'environnement Supabase..."
echo ""

echo -e "${YELLOW}Action manuelle requise:${NC}"
echo "Configurer ces variables dans Supabase Dashboard:"
echo "  - CLOUDFLARE_API_TOKEN"
echo "  - CLOUDFLARE_ACCOUNT_ID"
echo "  - CLOUDFLARE_KV_NAMESPACE_ID"
echo ""
echo "Ou via CLI:"
echo "  supabase secrets set CLOUDFLARE_API_TOKEN=..."
echo "  supabase secrets set CLOUDFLARE_ACCOUNT_ID=..."
echo "  supabase secrets set CLOUDFLARE_KV_NAMESPACE_ID=..."
echo ""

read -p "Variables configurées ? (y/n) " -n 1 -r
echo

echo ""
echo "=============================="
echo -e "${GREEN}✅ Déploiement terminé!${NC}"
echo ""
echo "📖 Pour plus de détails, consultez:"
echo "   DOMAIN_CONNECT_DEPLOYMENT.md"
echo ""
echo "🧪 Testez avec:"
echo "   curl https://proxy.builtbymagellan.com"
echo ""
