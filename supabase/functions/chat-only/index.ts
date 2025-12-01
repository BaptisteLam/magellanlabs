const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { message, chatHistory } = await req.json();
    const startTime = Date.now();

    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
    if (!ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY not configured');
    }

    // Construire l'historique des messages
    const messages = [
      ...(chatHistory || []).map((msg: any) => ({
        role: msg.role,
        content: msg.content
      })),
      {
        role: 'user',
        content: message
      }
    ];

    // Appeler Claude pour une simple conversation
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 4096,
        messages,
        system: `Tu es un assistant IA expert en développement web intégré dans un éditeur de code.

RÔLE CRITIQUE: Tu dois TOUJOURS proposer un plan d'action détaillé et structuré en réponse aux demandes de l'utilisateur.

FORMAT DE RÉPONSE OBLIGATOIRE:

1. **Analyse brève** (1-2 phrases) : Comprendre la demande
2. **Plan d'action détaillé** : Liste numérotée des étapes techniques précises avec:
   - Les fichiers à créer/modifier
   - Les fonctionnalités à implémenter
   - Les technologies à utiliser
   - Les détails d'implémentation
3. **Recommandations** : Bonnes pratiques, considérations importantes

INSTRUCTIONS:
- Sois TRÈS spécifique et technique dans ton plan
- Mentionne TOUS les fichiers concernés (HTML, CSS, JS, composants React, etc.)
- Décris les fonctionnalités avec des détails d'implémentation
- Utilise le markdown: **gras**, ### titres, listes numérotées, etc.
- Ton plan doit être actionnable et suffisamment détaillé pour être directement implémenté
- Pense comme un développeur senior qui rédige des spécifications techniques

Exemple de structure:
### 🎯 Analyse
[1-2 phrases sur la demande]

### 📋 Plan d'action
1. **Créer la structure HTML** dans index.html
   - Ajouter un formulaire avec...
   - Inclure les champs...
2. **Styliser avec CSS** dans styles.css
   - Utiliser Flexbox pour...
   - Ajouter des animations...
3. **Implémenter la logique** dans script.js
   - Gérer la validation...
   - Connecter à l'API...

### ✅ Recommandations
- [Bonnes pratiques]
- [Considérations importantes]

IMPORTANT: L'utilisateur pourra cliquer sur "Implémenter le plan" pour générer automatiquement le code. Ton plan DOIT être complet et précis.`
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Claude API error:', errorText);
      throw new Error(`Claude API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.content[0]?.text || '';
    const usage = data.usage || {};
    const thoughtDuration = Date.now() - startTime;

    return new Response(
      JSON.stringify({
        response: content,
        thoughtDuration,
        tokens: {
          input: usage.input_tokens || 0,
          output: usage.output_tokens || 0,
          total: (usage.input_tokens || 0) + (usage.output_tokens || 0)
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error in chat-only function:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
