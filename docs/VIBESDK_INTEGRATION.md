# Intégration Cloudflare VibeSDK

Ce document décrit l'intégration du Cloudflare VibeSDK dans Magellan Studio pour la génération de landing pages par IA.

## Vue d'ensemble

Le VibeSDK de Cloudflare offre une plateforme complète pour la génération de code par IA avec :
- **Génération multi-phases** : planning → coding → debugging
- **Sandboxes isolées** : Exécution sécurisée du code généré
- **Preview URLs automatiques** : URLs de prévisualisation instantanées
- **Déploiement one-click** : Déploiement direct sur Cloudflare
- **Multi-LLM** : Support Claude, Gemini, et autres modèles

## Architecture

### Fichiers créés

```
src/services/vibesdk/
├── index.ts          # Point d'entrée - exports
├── types.ts          # Types TypeScript complets
├── client.ts         # Client WebSocket + HTTP
└── service.ts        # Service d'intégration Magellan

src/hooks/
├── useVibeSDK.ts         # Hook principal d'initialisation
├── useVibeGenerate.ts    # Hook génération (remplace useGenerateSite)
├── useVibeModify.ts      # Hook modification (remplace useUnifiedModify)
├── useVibePreview.ts     # Hook preview avec sandbox
└── useSmartGeneration.ts # Hook intelligent routing VibeSDK/Legacy
```

### Configuration

Variables d'environnement dans `.env` :

```env
# Activer VibeSDK
VITE_USE_VIBESDK="true"

# Clé API VibeSDK
VITE_VIBESDK_API_KEY="votre-cle-api"

# URL de base (optionnel)
VITE_VIBESDK_BASE_URL="https://build.cloudflare.dev"
```

## Utilisation

### Migration progressive avec useSmartGeneration

Le hook `useSmartGeneration` permet une migration progressive sans casser l'existant :

```typescript
import { useSmartGeneration } from '@/hooks/useSmartGeneration';

function MyComponent() {
  const {
    generateSite,
    modifySite,
    isGenerating,
    isModifying,
    provider, // 'vibesdk' ou 'legacy'
    previewUrl,
  } = useSmartGeneration();

  // Génération automatiquement routée vers VibeSDK ou legacy
  const handleGenerate = async () => {
    const result = await generateSite({
      prompt: "Crée un site pour un restaurant",
      sessionId: "xxx",
      projectType: 'website',
    }, {
      onGenerationEvent: (event) => console.log(event),
      onFiles: (files) => console.log('Files:', files),
    });
  };
}
```

### Utilisation directe de VibeSDK

```typescript
import { vibeSDKService } from '@/services/vibesdk';

// Initialiser
vibeSDKService.initialize('votre-cle-api');

// Générer un site
const result = await vibeSDKService.generateSite({
  prompt: "Crée un site pour un restaurant",
  sessionId: "xxx",
  projectType: 'website',
}, {
  onGenerationEvent: (event) => console.log(event),
  onFiles: (files) => console.log('Files:', files),
  onPreviewReady: (url) => console.log('Preview:', url),
});

// Modifier un site existant
const modifyResult = await vibeSDKService.modifySite({
  message: "Change le titre en rouge",
  projectFiles: currentFiles,
  sessionId: "xxx",
}, {
  onFileModified: (file, desc) => console.log(`Modified: ${file}`),
});

// Déployer sur Cloudflare
const deployResult = await vibeSDKService.deployToCloudflare(sessionId);
```

### Hook de preview

```typescript
import { useVibePreview } from '@/hooks/useVibePreview';

function PreviewComponent({ sessionId, projectFiles }) {
  const {
    previewState,
    previewUrl,      // URL sandbox VibeSDK
    isReady,
    localHtml,       // HTML pour iframe local
    refreshPreview,
    switchMode,      // 'local' ou 'sandbox'
  } = useVibePreview({
    sessionId,
    projectFiles,
    preferSandbox: true, // Préférer sandbox VibeSDK
  });

  return (
    <div>
      {previewState.mode === 'sandbox' && previewUrl ? (
        <iframe src={previewUrl} />
      ) : (
        <iframe srcDoc={localHtml} />
      )}
    </div>
  );
}
```

## Types

### Événements de génération

```typescript
type VibeEventType =
  | 'state_change'
  | 'phase_start'
  | 'phase_complete'
  | 'phase_error'
  | 'file_created'
  | 'file_modified'
  | 'file_deleted'
  | 'preview_ready'
  | 'deploy_ready'
  | 'deploy_complete'
  | 'error'
  | 'stream_chunk'
  | 'generation_progress';

interface VibeEvent {
  type: VibeEventType;
  timestamp: Date;
  data: any;
}
```

### États de session

```typescript
type SessionStatus =
  | 'initializing'
  | 'planning'
  | 'coding'
  | 'debugging'
  | 'deployable'
  | 'deployed'
  | 'error';
```

## Compatibilité

L'intégration maintient une compatibilité totale avec le système existant :

1. **Callbacks legacy** : Les callbacks `onGenerationEvent`, `onFiles`, etc. fonctionnent de la même manière
2. **Types GenerationEvent** : Conversion automatique des événements VibeSDK vers le format legacy
3. **Supabase sync** : Synchronisation automatique des fichiers avec Supabase
4. **Tracking quotas** : Mise à jour automatique des tokens utilisés dans les profils utilisateurs

## Phases de génération VibeSDK

1. **Planning** : Analyse du prompt et planification de l'architecture
2. **Coding** : Génération du code source
3. **Debugging** : Vérification et correction des erreurs
4. **Deployable** : Code prêt pour la preview/déploiement

## Déploiement

### Preview Sandbox

Les previews sont automatiquement disponibles via une URL sandbox isolée fournie par VibeSDK.

### Déploiement Cloudflare

```typescript
const result = await vibeSDKService.deployToCloudflare(sessionId);
// result.url = "https://mon-projet.pages.dev"
```

## Sources

- [GitHub VibeSDK](https://github.com/cloudflare/vibesdk)
- [Documentation Cloudflare Sandbox](https://developers.cloudflare.com/sandbox/)
- [Blog Cloudflare](https://blog.cloudflare.com/deploy-your-own-ai-vibe-coding-platform/)
