# Architecture : Bac à Sable de Widgets Dynamiques Magellan CRM

## 🎯 Vision

Transformer le CRM Magellan en un **vrai bac à sable** où l'utilisateur peut créer **n'importe quel widget** via des prompts en langage naturel. Claude Sonnet 4.5 génère du **code React complet** à la volée pour répondre à toute demande.

### Exemples de Prompts Supportés

```
✅ "Créer un graphique qui reprend les ventes par région"
✅ "Je veux un tableau qui affiche les 10 derniers clients"
✅ "Ajoute un widget qui montre le CA du mois vs objectif"
✅ "Lie ce graphique aux données du formulaire de contact du site web"
✅ "Créer un calendrier avec les rendez-vous clients"
✅ "Modifier ce widget pour ajouter un filtre par date"
✅ "Créer un KPI qui calcule le taux de conversion en temps réel"
```

**Principe clé** : Pas de limitation aux widgets prédéfinis. Claude génère du code React sur mesure.

---

## 🏗️ Architecture Technique

### 1. Système de Génération Dynamique de Code

#### A. Table `crm_widgets` (existante, déjà utilisée)

```sql
CREATE TABLE crm_widgets (
  id UUID PRIMARY KEY,
  module_id UUID REFERENCES crm_modules(id),
  widget_type TEXT, -- 'custom' pour les widgets générés
  title TEXT,
  config JSONB,
  layout JSONB, -- {x, y, w, h}

  -- ⭐ CHAMPS CRITIQUES POUR LE BAC À SABLE
  generated_code TEXT, -- Code React JSX complet généré par Claude
  is_code_generated BOOLEAN DEFAULT false,

  -- Métadonnées de génération
  generation_prompt TEXT, -- Prompt original de l'utilisateur
  generation_timestamp TIMESTAMPTZ,
  code_version INT DEFAULT 1, -- Incrémenté à chaque régénération

  -- Accès aux données
  data_sources JSONB -- Ex: {"site_forms": ["contact"], "crm_widgets": [id1, id2]}
);
```

#### B. Flux de Génération

```
User Prompt
    ↓
Chat Panel → Edge Function "generate-widget"
    ↓
Claude Sonnet 4.5 (30k tokens)
    ↓
Code React JSX complet
    ↓
Stockage DB (generated_code field)
    ↓
DynamicWidget Component
    ↓
Rendu dans le CRM
```

### 2. Composant `DynamicWidget`

**Responsabilité** : Exécuter le code React généré par Claude de manière sécurisée.

```typescript
// src/components/crm/widgets/DynamicWidget.tsx

interface DynamicWidgetProps {
  widgetId: string;
  generatedCode: string;
  title: string;
  config: any;
  dataSources?: {
    site_forms?: string[];
    crm_widgets?: string[];
    external_apis?: string[];
  };
}

export function DynamicWidget({ widgetId, generatedCode, config, dataSources }: DynamicWidgetProps) {
  const [Component, setComponent] = useState<React.ComponentType | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Contexte fourni au code généré
  const widgetContext = {
    React,
    useState,
    useEffect,
    supabase,
    Icons: LucideIcons,
    // Composants shadcn/ui
    Card, Button, Table, Chart,
    // Données du site web
    siteData: useSiteData(dataSources?.site_forms),
    // Données d'autres widgets CRM
    crmData: useCRMData(dataSources?.crm_widgets),
    // Utilitaires
    formatCurrency,
    formatDate,
    toast
  };

  useEffect(() => {
    try {
      // Compile le code généré en composant React
      const compiledComponent = compileReactCode(generatedCode, widgetContext);
      setComponent(() => compiledComponent);
      setError(null);
    } catch (err) {
      setError(err.message);
      console.error('[DynamicWidget] Compilation error:', err);
    }
  }, [generatedCode]);

  if (error) {
    return <WidgetError error={error} onRetry={() => regenerateWidget(widgetId)} />;
  }

  if (!Component) {
    return <WidgetSkeleton />;
  }

  return (
    <ErrorBoundary fallback={<WidgetCrash onRegenerate={() => regenerateWidget(widgetId)} />}>
      <Component config={config} />
    </ErrorBoundary>
  );
}
```

### 3. Système de Compilation de Code

```typescript
// src/lib/widgetCompiler.ts

function compileReactCode(code: string, context: Record<string, any>): React.ComponentType {
  // Prépare le scope avec React, hooks, composants, etc.
  const scope = {
    React: context.React,
    useState: context.useState,
    useEffect: context.useEffect,
    // ... tous les autres imports
  };

  // Transforme le code JSX en JavaScript exécutable
  const transformedCode = transformJSX(code);

  // Crée une fonction qui retourne le composant
  const functionBody = `
    return function GeneratedWidget(props) {
      ${transformedCode}
    };
  `;

  // Exécute dans un scope contrôlé
  const factory = new Function(...Object.keys(scope), functionBody);
  const Component = factory(...Object.values(scope));

  return Component;
}

function transformJSX(code: string): string {
  // Option 1 : Utiliser Babel standalone (client-side)
  // Option 2 : Sucrase (plus léger)
  // Option 3 : Pré-compiler côté serveur dans l'edge function

  // Pour la simplicité, on peut demander à Claude de générer du JSX
  // déjà transformé en React.createElement()
  return code;
}
```

### 4. Edge Function `generate-widget`

```typescript
// supabase/functions/generate-widget/index.ts

const WIDGET_GENERATION_PROMPT = `Tu es un expert React/TypeScript.
Génère un composant React COMPLET et AUTONOME basé sur la demande de l'utilisateur.

CONTEXTE DISPONIBLE :
- React, { useState, useEffect, useMemo }
- Lucide Icons (import * as Icons from 'lucide-react')
- shadcn/ui components : Card, Button, Table, Badge, Input, Select, etc.
- Recharts : LineChart, BarChart, PieChart, AreaChart, etc.
- Tailwind CSS (toutes les classes disponibles)
- Magellan Design System : couleur primaire #03A5C0

DONNÉES ACCESSIBLES via props.config :
- config.siteData : données des formulaires du site web
- config.crmData : données d'autres widgets CRM
- config.externalData : données d'APIs externes

RÈGLES :
1. Code JSX valide et autonome
2. Utiliser UNIQUEMENT les imports mentionnés ci-dessus
3. Gestion d'erreurs avec try/catch
4. États de chargement avec Skeleton
5. Responsive design (mobile-first)
6. Respecter le design system Magellan (#03A5C0)
7. Retourner UNIQUEMENT le code du composant, rien d'autre

EXEMPLE DE STRUCTURE :
\`\`\`jsx
function CustomWidget({ config }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Charger les données
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Logique de chargement
      setData(...);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <Skeleton />;

  return (
    <Card className="p-6">
      {/* Contenu du widget */}
    </Card>
  );
}
\`\`\`

DEMANDE UTILISATEUR : {user_prompt}

Génère le code React complet :`;

async function generateWidget(userPrompt: string, context: any) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': Deno.env.get('ANTHROPIC_API_KEY'),
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 30000,
      system: WIDGET_GENERATION_PROMPT,
      messages: [{
        role: 'user',
        content: userPrompt
      }]
    })
  });

  const data = await response.json();
  const generatedCode = extractCodeFromResponse(data.content[0].text);

  return {
    code: generatedCode,
    prompt: userPrompt,
    timestamp: new Date().toISOString()
  };
}
```

### 5. Chat Panel (Phase 3)

```typescript
// src/components/crm/CRMChatPanel.tsx

export function CRMChatPanel({ projectId, currentModuleId }: CRMChatPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const handleSendMessage = async () => {
    const userMessage = { role: 'user', content: input };
    setMessages([...messages, userMessage]);
    setInput('');
    setIsGenerating(true);

    try {
      // Appel à l'edge function pour générer le widget
      const { data } = await supabase.functions.invoke('generate-widget', {
        body: {
          projectId,
          moduleId: currentModuleId,
          userPrompt: input,
          conversationHistory: messages
        }
      });

      const assistantMessage = {
        role: 'assistant',
        content: `✅ Widget créé avec succès ! "${data.widget_title}"`,
        widgetId: data.widget_id
      };

      setMessages([...messages, userMessage, assistantMessage]);

      toast.success('Widget créé !');

    } catch (error) {
      toast.error('Erreur lors de la génération du widget');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <>
      {/* Bouton flottant */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-[#03A5C0] hover:bg-[#03A5C0]/90 shadow-lg z-50"
      >
        <MessageSquare className="w-6 h-6 text-white" />
      </button>

      {/* Panneau slide-in */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25 }}
            className="fixed top-0 right-0 h-full w-[400px] bg-card border-l shadow-2xl z-50 flex flex-col"
          >
            {/* Header */}
            <div className="h-16 border-b flex items-center justify-between px-4">
              <h2 className="font-semibold">Assistant CRM</h2>
              <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
              {messages.map((msg, i) => (
                <ChatMessage key={i} message={msg} />
              ))}
              {isGenerating && <TypingIndicator />}
            </ScrollArea>

            {/* Input */}
            <div className="border-t p-4">
              <div className="flex gap-2">
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ex: Créer un graphique avec mes ventes par région..."
                  className="min-h-[60px]"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={!input.trim() || isGenerating}
                  className="bg-[#03A5C0]"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>

              {/* Suggestions rapides */}
              <div className="mt-2 flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => setInput('Créer un graphique avec mes ventes')}>
                  📊 Graphique ventes
                </Button>
                <Button variant="outline" size="sm" onClick={() => setInput('Ajouter un tableau des clients')}>
                  📋 Tableau clients
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
```

### 6. Accès aux Données du Site Web

```typescript
// src/hooks/useSiteData.ts

export function useSiteData(formNames?: string[]) {
  const [data, setData] = useState<any>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSiteData = async () => {
      try {
        // Récupère les données du site depuis build_sessions
        const { data: siteData } = await supabase
          .from('build_sessions')
          .select('sections, forms, analytics')
          .single();

        // Si des formulaires spécifiques sont demandés
        if (formNames && siteData.forms) {
          const filteredForms = formNames.reduce((acc, name) => {
            acc[name] = siteData.forms[name];
            return acc;
          }, {});

          setData({ forms: filteredForms, sections: siteData.sections });
        } else {
          setData(siteData);
        }
      } catch (error) {
        console.error('Error fetching site data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSiteData();
  }, [formNames]);

  return { data, loading };
}
```

---

## 🔄 Workflow Utilisateur

### Scénario 1 : Créer un Widget de Zéro

```
User: [Ouvre le chat panel]
User: "Créer un graphique qui montre l'évolution de mes ventes sur les 6 derniers mois"

→ Edge Function invoquée avec le prompt
→ Claude génère code React avec LineChart de Recharts
→ Code stocké en DB
→ DynamicWidget affiche le graphique immédiatement
```

### Scénario 2 : Modifier un Widget Existant

```
User: [Clique sur menu du widget]
User: "Ajoute un filtre par région à ce graphique"

→ Edge Function reçoit le prompt + code actuel du widget
→ Claude modifie le code existant pour ajouter le filtre
→ Code mis à jour en DB (code_version: 2)
→ Widget se rafraîchit avec le filtre
```

### Scénario 3 : Lier aux Données du Site Web

```
User: "Je veux que ce tableau affiche les soumissions du formulaire de contact de mon site"

→ Edge Function détecte la demande de liaison
→ Claude génère code avec useSiteData(['contact'])
→ data_sources: {"site_forms": ["contact"]} stocké en DB
→ Widget accède aux vraies données du formulaire
```

### Scénario 4 : Widget Complexe Multi-Sources

```
User: "Créer un dashboard qui combine les ventes du CRM + les visiteurs analytics du site + météo API"

→ Claude génère widget complexe avec 3 sources de données
→ data_sources: {
    "crm_widgets": ["sales_widget_id"],
    "site_data": ["analytics"],
    "external_apis": ["openweathermap"]
  }
→ Widget agrège toutes les données et affiche un dashboard unifié
```

---

## 🛠️ Implémentation Technique

### Dépendances Nécessaires

```json
{
  "dependencies": {
    "@babel/standalone": "^7.23.0", // Pour compiler JSX côté client
    "framer-motion": "^10.16.0", // Pour animations du chat panel (déjà installé)
    "react-error-boundary": "^4.0.11" // Pour isoler les erreurs de widgets
  }
}
```

### Sécurité et Isolation

**Problèmes de sécurité avec eval() :**
- XSS injection
- Accès non autorisé aux données
- Code malveillant

**Solutions :**

1. **Sandboxing avec iframes** (option la plus sûre)
```typescript
function DynamicWidget({ generatedCode }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const iframe = iframeRef.current;
    const doc = iframe?.contentDocument;

    // Injecte React, shadcn/ui, et le code généré dans un iframe isolé
    doc?.write(`
      <html>
        <head>
          <script src="react.js"></script>
          <script src="react-dom.js"></script>
          <link href="tailwind.css" rel="stylesheet">
        </head>
        <body>
          <div id="root"></div>
          <script>${generatedCode}</script>
        </body>
      </html>
    `);
  }, [generatedCode]);

  return <iframe ref={iframeRef} sandbox="allow-scripts" />;
}
```

2. **Validation côté serveur**
- Claude génère le code
- Edge function valide le code (AST parsing)
- Détecte les patterns dangereux (eval, Function, XMLHttpRequest non autorisés)
- Rejette le code malveillant

3. **Contexte limité**
```typescript
const SAFE_CONTEXT = {
  // Autorisé
  React, useState, useEffect,
  Card, Button, Chart,
  supabase: createRestrictedSupabaseClient(), // Client avec RLS strict

  // Interdit (pas exposé)
  // window, document, localStorage, fetch (sauf via helper sécurisé)
};
```

### Performance et Caching

```typescript
// Cache des composants compilés
const componentCache = new Map<string, React.ComponentType>();

function compileReactCode(code: string, cacheKey: string) {
  if (componentCache.has(cacheKey)) {
    return componentCache.get(cacheKey);
  }

  const Component = actuallyCompile(code);
  componentCache.set(cacheKey, Component);

  return Component;
}
```

---

## 📊 Exemples de Code Généré par Claude

### Exemple 1 : Graphique Ventes Par Région

**Prompt User :** "Créer un graphique qui montre mes ventes par région"

**Code Généré :**
```jsx
function SalesPerRegionChart({ config }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSalesData();
  }, []);

  const fetchSalesData = async () => {
    try {
      const { data: salesData } = await supabase
        .from('widget_data')
        .select('data')
        .eq('widget_id', config.widgetId)
        .single();

      // Agrège les ventes par région
      const aggregated = aggregateByRegion(salesData.data.sales);
      setData(aggregated);
    } catch (error) {
      console.error('Error fetching sales:', error);
    } finally {
      setLoading(false);
    }
  };

  const aggregateByRegion = (sales) => {
    return sales.reduce((acc, sale) => {
      const region = sale.region;
      if (!acc[region]) {
        acc[region] = { name: region, total: 0 };
      }
      acc[region].total += sale.amount;
      return acc;
    }, {});
  };

  if (loading) {
    return <div className="animate-pulse h-64 bg-muted rounded" />;
  }

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">Ventes par Région</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={Object.values(data)}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip formatter={(value) => `${value.toLocaleString()} €`} />
          <Bar dataKey="total" fill="#03A5C0" />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}
```

### Exemple 2 : KPI avec Données du Site Web

**Prompt User :** "Créer un KPI qui montre le nombre de soumissions du formulaire de contact cette semaine vs semaine dernière"

**Code Généré :**
```jsx
function ContactSubmissionsKPI({ config }) {
  const { data: siteData, loading } = useSiteData(['contact']);
  const [stats, setStats] = useState({ thisWeek: 0, lastWeek: 0, trend: 0 });

  useEffect(() => {
    if (!loading && siteData.forms?.contact) {
      calculateStats(siteData.forms.contact.submissions);
    }
  }, [siteData, loading]);

  const calculateStats = (submissions) => {
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const thisWeek = submissions.filter(s =>
      new Date(s.created_at) >= oneWeekAgo
    ).length;

    const lastWeek = submissions.filter(s =>
      new Date(s.created_at) >= twoWeeksAgo &&
      new Date(s.created_at) < oneWeekAgo
    ).length;

    const trend = lastWeek === 0 ? 100 : ((thisWeek - lastWeek) / lastWeek) * 100;

    setStats({ thisWeek, lastWeek, trend });
  };

  if (loading) {
    return <Skeleton className="h-32" />;
  }

  return (
    <Card className="p-6 bg-gradient-to-br from-card to-card/50">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Soumissions de Contact</p>
          <p className="text-4xl font-bold mt-2">{stats.thisWeek}</p>
          <div className="flex items-center gap-2 mt-2">
            {stats.trend >= 0 ? (
              <TrendingUp className="w-4 h-4 text-green-500" />
            ) : (
              <TrendingDown className="w-4 h-4 text-red-500" />
            )}
            <span className={stats.trend >= 0 ? 'text-green-500' : 'text-red-500'}>
              {stats.trend.toFixed(1)}% vs semaine dernière
            </span>
          </div>
        </div>
        <div className="w-16 h-16 rounded-full bg-[#03A5C0]/10 flex items-center justify-center">
          <Mail className="w-8 h-8 text-[#03A5C0]" />
        </div>
      </div>
    </Card>
  );
}
```

---

## 🎨 Design du Chat Panel

### Layout
```
┌─────────────────────────────────┐
│  🤖 Assistant CRM          [X]  │  ← Header (h-16)
├─────────────────────────────────┤
│                                 │
│  User: Créer un graphique...   │
│                                 │
│  ✅ Assistant: Widget créé !   │
│  [Preview du widget]            │  ← Zone messages (flex-1)
│                                 │
│  User: Ajoute un filtre...     │
│                                 │
│  💭 Assistant: En train...     │
│                                 │
├─────────────────────────────────┤
│  ┌─────────────────────────┐   │
│  │ Votre message...        │   │  ← Input zone
│  │                         │ 📤 │
│  └─────────────────────────┘   │
│  [📊 Graphique] [📋 Tableau]   │  ← Quick actions
└─────────────────────────────────┘

Bouton flottant (bottom-right) : 💬
```

### Couleurs (Magellan Design System)
- Primary: `#03A5C0` (cyan Magellan)
- Background: `bg-card/80 backdrop-blur-sm` (glassmorphism)
- Border: `border-border`
- Hover: `hover:bg-[#03A5C0]/10`

---

## 🚀 Plan d'Implémentation (Phase 3 + Refonte)

### Étape 1 : Système de Compilation Dynamique ✅
1. Créer `src/lib/widgetCompiler.ts`
2. Intégrer @babel/standalone
3. Créer `DynamicWidget.tsx`
4. Tests avec code simple

### Étape 2 : Edge Function Widget Generation ✅
1. Créer `supabase/functions/generate-widget/index.ts`
2. Prompt engineering pour génération de code React
3. Validation et sécurité du code généré
4. Stockage en DB avec metadata

### Étape 3 : Chat Panel UI ✅
1. Créer `CRMChatPanel.tsx`
2. Bouton flottant + slide-in animation
3. Interface de messages
4. Quick actions

### Étape 4 : Hooks d'Accès aux Données ✅
1. `useSiteData.ts` - Accès aux données du site
2. `useCRMData.ts` - Accès aux autres widgets
3. `useExternalAPI.ts` - Appels APIs externes

### Étape 5 : Intégration dans ProjectCRM ✅
1. Ajouter CRMChatPanel dans ProjectCRM
2. Gérer création/modification/suppression de widgets
3. Preview temps réel

### Étape 6 : Tests et Polissage ✅
1. Tester avec prompts complexes
2. Gestion d'erreurs robuste
3. UX/UI polish

---

## 🔐 Sécurité - Checklist

- [ ] Validation AST du code généré (pas de eval, Function, etc.)
- [ ] RLS Supabase activé sur toutes les tables
- [ ] Rate limiting sur l'edge function (éviter spam)
- [ ] Sandboxing des widgets (iframe ou contexte limité)
- [ ] CSP (Content Security Policy) headers
- [ ] Logs de toutes les générations de code
- [ ] Revue manuelle possible des widgets générés
- [ ] Limite de tokens Claude par projet/jour

---

## 💡 Améliorations Futures

1. **Marketplace de Widgets**
   - Les utilisateurs peuvent partager leurs widgets générés
   - Templates pré-générés par secteur

2. **A/B Testing de Widgets**
   - Tester 2 versions d'un widget
   - Analytics automatique

3. **Widgets Collaboratifs**
   - Plusieurs utilisateurs modifient le même widget via chat

4. **Export de Widgets**
   - Exporter le code React pour utilisation externe
   - NPM package généré automatiquement

5. **Visual Widget Editor**
   - Drag & drop + génération de code en arrière-plan
   - Claude suggère des améliorations en temps réel

---

## 📝 Notes Techniques

### Pourquoi Babel Standalone ?
- Permet de compiler JSX côté client
- Pas besoin de build step
- 2.5MB (acceptable pour un CRM complet)

### Alternative : Sucrase
- Plus léger (500KB)
- Moins de features mais suffisant pour JSX
- Plus rapide

### Alternative : Server-Side Compilation
- Edge function compile le JSX en JS
- Envoie du JS pur au client
- Meilleure sécurité, meilleures perfs
- **RECOMMANDÉ pour production**

---

## 🎯 Résumé

Cette architecture transforme Magellan CRM en un **véritable bac à sable programmable** où :

✅ L'utilisateur peut créer **n'importe quel widget** via prompts
✅ Claude génère du **code React complet** à la volée
✅ Les widgets peuvent accéder aux **données du site web**
✅ Système **100% dynamique** sans limitation aux types prédéfinis
✅ Chat panel intuitif avec **preview temps réel**
✅ **Sécurisé** avec validation et sandboxing

**Prochaine étape** : Implémentation complète de Phase 3 + système de compilation dynamique.