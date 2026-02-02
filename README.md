# Magellan - Crée ton site web avec l'IA

Magellan est une plateforme SaaS qui permet de créer des sites web professionnels en quelques secondes grâce à l'intelligence artificielle.

## Technologies

- **Frontend**: React 18, TypeScript, Vite
- **UI**: Tailwind CSS, shadcn/ui, Radix UI
- **Backend**: Supabase (Auth, Database, Storage, Edge Functions)
- **IA**: VibeSDK (Cloudflare AI)
- **Déploiement**: Cloudflare Pages

## Installation locale

```sh
# Cloner le repository
git clone https://github.com/BaptisteLam/magellanlabs.git
cd magellanlabs

# Installer les dépendances
npm install

# Configurer les variables d'environnement
cp .env.example .env
# Éditer .env avec vos clés Supabase et VibeSDK

# Lancer le serveur de développement
npm run dev
```

## Configuration

### Variables d'environnement requises

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key
VITE_USE_VIBESDK=true
VITE_VIBESDK_API_KEY=your-vibesdk-key
```

### Base de données Supabase

Appliquez les migrations dans l'ordre depuis le dossier `supabase/migrations/`.

## Déploiement

### Cloudflare Pages

```sh
# Build du projet
npm run build

# Déploiement
npx wrangler pages deploy dist --project-name=magellan
```

### Variables d'environnement Cloudflare

Configurez ces variables dans Settings > Environment variables:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_USE_VIBESDK`
- `VITE_VIBESDK_API_KEY`

## Structure du projet

```
src/
├── components/     # Composants React réutilisables
├── pages/          # Pages de l'application
├── hooks/          # Hooks React personnalisés
├── lib/            # Utilitaires et helpers
├── services/       # Services (VibeSDK, etc.)
├── stores/         # Stores Zustand
└── integrations/   # Intégrations (Supabase)

supabase/
├── functions/      # Edge Functions
└── migrations/     # Migrations SQL
```

## Licence

Propriétaire - Magellan Labs
