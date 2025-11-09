# Architecture Agent API - Style Bolt

## Vue d'ensemble

Magellan utilise maintenant une architecture à deux étapes inspirée de Bolt pour traiter les requêtes utilisateur :

1. **Analyse d'intention** (OpenAI gpt-4o-mini) - Rapide et économique
2. **Génération de code** (Claude Sonnet 4.5) - Puissant et précis

## Flux de traitement

```
┌─────────────┐
│   Utilisateur   │
│  envoie prompt  │
└────────┬────────┘
         │
         ▼
┌────────────────────────────────────┐
│   API /agent (Edge Function)       │
│                                    │
│  ┌──────────────────────────────┐  │
│  │ 1. Analyse d'intention       │  │
│  │    (OpenAI gpt-4o-mini)      │  │
│  │                              │  │
│  │  Détecte:                    │  │
│  │  - generate_code             │  │
│  │  - modify_code               │  │
│  │  - add_feature               │  │
│  │  - chat/explain              │  │
│  └──────────┬───────────────────┘  │
│             │                      │
│             ▼                      │
│  ┌──────────────────────────────┐  │
│  │ 2. Exécution                 │  │
│  │                              │  │
│  │  Si code requis:             │  │
│  │  └─> Claude Sonnet 4.5       │  │
│  │       (avec résumé projet)   │  │
│  │                              │  │
│  │  Si chat:                    │  │
│  │  └─> Réponse directe         │  │
│  └──────────┬───────────────────┘  │
│             │                      │
└─────────────┼──────────────────────┘
              │
              ▼
       ┌─────────────┐
       │  Streaming  │
       │    NDJSON   │
       └─────────────┘
```

## Types d'événements (NDJSON)

L'API agent stream des événements au format NDJSON (newline-delimited JSON) :

```typescript
type AIEvent =
  | { type: "status"; content: string }           // Message de statut
  | { type: "message"; content: string }          // Message conversationnel
  | { type: "intent"; action: string; ... }       // Intention détectée
  | { type: "code_update"; path: string; code: string }  // Mise à jour fichier
  | { type: "complete" }                          // Fin du streaming
```

### Exemple de flux:

```json
{"type":"status","content":"Analyse de votre demande..."}
{"type":"intent","action":"modify_code","target":"src/Header.tsx","description":"Changer couleur fond en rouge"}
{"type":"status","content":"Génération du code..."}
{"type":"code_update","path":"src/Header.tsx","code":"<header style='background:red'>...</header>"}
{"type":"complete"}
```

## Optimisations

### 1. Résumé de projet (< 600 tokens)

Au lieu d'envoyer tout l'historique à Claude, on génère un résumé synthétique :

```typescript
Projet contenant 12 fichiers:
- index.html
- style.css
- script.js
- src/components/Header.tsx
...
```

### 2. Fenêtre glissante de conversation

Seulement les **3 derniers messages** sont envoyés pour le contexte, au lieu de tout l'historique.

### 3. Sélection intelligente de fichiers

Pour les modifications, on envoie uniquement les **5 fichiers les plus pertinents** basés sur:
- Mots-clés dans le chemin du fichier
- Mots-clés dans le contenu
- Score de priorité (index.html/App.tsx ont un bonus)

## Utilisation Frontend

### Hook `useAgentAPI`

```typescript
const agent = useAgentAPI();

await agent.callAgent(
  message,            // Message utilisateur
  projectFiles,       // Tous les fichiers du projet
  relevantFiles,      // Fichiers pertinents sélectionnés
  chatHistory,        // Historique (3 derniers)
  sessionId,
  {
    onStatus: (status) => console.log(status),
    onMessage: (msg) => updateChat(msg),
    onCodeUpdate: (path, code) => updateFile(path, code),
    onComplete: () => saveSession(),
    onError: (err) => showError(err)
  }
);
```

### État du hook

- `agent.isLoading` - Requête en cours
- `agent.isStreaming` - Streaming actif
- `agent.abort()` - Annuler la requête

## Coûts et performances

| Étape | Modèle | Coût relatif | Latence |
|-------|--------|--------------|---------|
| Analyse intention | gpt-4o-mini | ~$0.0001 | ~200ms |
| Génération code | Claude Sonnet 4.5 | ~$0.01 | ~2-5s |

**Économies** : ~70% par rapport à l'utilisation de Claude pour tout

## Configuration

### Edge Function

Fichier : `supabase/functions/agent/index.ts`

Secrets requis :
- `OPENAI_API_KEY` - Pour l'analyse d'intention
- `ANTHROPIC_API_KEY` - Pour la génération de code

### Config supabase

```toml
[functions.agent]
verify_jwt = true
```

## Migration depuis l'ancien système

L'ancien système utilisant `/modify-site` et `/ai-generate` reste fonctionnel mais **l'API `/agent` est désormais privilégiée** pour:

✅ Meilleure classification des tâches  
✅ Coûts réduits (modèle léger pour l'analyse)  
✅ Streaming unifié et cohérent  
✅ Résumé intelligent du contexte  

## Tests

Pour tester l'API agent :

```bash
curl -X POST https://[PROJECT].supabase.co/functions/v1/agent \
  -H "Authorization: Bearer [TOKEN]" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Change the header background to red",
    "projectFiles": {...},
    "relevantFiles": [...],
    "chatHistory": [...],
    "sessionId": "..."
  }'
```

## Logs et debugging

Les logs sont disponibles dans :
- Supabase Edge Functions logs
- Console du navigateur (événements streaming)

Chaque événement est logué avec son type pour faciliter le debugging.
