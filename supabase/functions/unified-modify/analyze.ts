// Phase 1: Analyse d'intention avancée avec détection multi-tours et coréférences

export interface AnalysisResult {
  complexity: 'trivial' | 'simple' | 'moderate' | 'complex';
  intentType: 'quick-modification' | 'full-generation';
  confidence: number;
  explanation: string;
  score: number;
  detectedPatterns: string[];
  // P0: Nouvelles propriétés pour contexte multi-tours
  resolvedPrompt?: string;
  implicitReferences?: string[];
  multiIntent?: MultiIntent;
}

// P1: Interface pour multi-intentions
interface MultiIntent {
  intentions: Array<{
    text: string;
    complexity: AnalysisResult['complexity'];
    dependencies: number[];
  }>;
  executionStrategy: 'sequential' | 'parallel' | 'hybrid';
}

// P0: Interface pour l'historique de conversation enrichi
interface ConversationMessage {
  role: string;
  content: string;
  metadata?: {
    files_modified?: string[];
    intent_message?: string;
    filesAffected?: Array<{ path: string; changeType: string }>;
  };
}

// Patterns simples (+15 points chacun) - Enrichi
const SIMPLE_PATTERNS = [
  /chang(e|er|é)?\s*(la|le|les)?\s*couleur/i,
  /modifi(e|er|é)?\s*(le|la|les)?\s*texte/i,
  /corrig(e|er|é)?\s*(la|le|les)?\s*typo/i,
  /ajout(e|er|é)?\s*(une|des)?\s*class(e|es)?\s*css/i,
  /supprim(e|er|é)?\s*(le|la|les)?\s*style/i,
  /modifi(e|er|é)?\s*(le|la|les)?\s*css/i,
  /change.*background/i,
  /change.*color/i,
  /update.*text/i,
  /fix.*typo/i,
  /add.*class/i,
  /remove.*style/i,
  /font.*size/i,
  /margin|padding/i,
  /border.*radius/i,
  // P1: Patterns enrichis
  /responsive|mobile|tablet/i,
  /hover|survol|effet/i,
  /gradient|dégradé/i,
  /dark.*mode|mode.*sombre/i,
  /espacement|spacing/i,
  /arrondi|rounded/i,
  /ombre|shadow/i,
  /centrer|center/i,
  /alignement|align/i,
  /largeur|width/i,
  /hauteur|height/i,
  // P0: Patterns de référence implicite
  /plus\s*(grand|petit|foncé|clair|gros|fin)/i,
  /moins\s*(grand|petit|visible)/i,
  /pareil|même\s*chose|idem/i,
  /comme\s*(avant|ça|cela)/i,
];

// Patterns complexes (-20 points chacun)
const COMPLEX_PATTERNS = [
  /cré(e|er|é)?\s*(un|une|des)?\s*composant/i,
  /refactor/i,
  /chang(e|er|é)?\s*(l')?architecture/i,
  /ajout(e|er|é)?\s*(une|des)?\s*fonctionnalit/i,
  /implément(e|er|é)?\s*(la|une)?\s*logique/i,
  /modifi(e|er|é)?\s*(la)?\s*base\s*de\s*données/i,
  /cré(e|er|é)?\s*(un|des)?\s*endpoint/i,
  /ajout(e|er|é)?\s*(l')?authentification/i,
  /create.*component/i,
  /add.*feature/i,
  /implement.*logic/i,
  /database/i,
  /api.*endpoint/i,
  /authentication/i,
  /new.*page/i,
  /routing/i,
  /state.*management/i,
];

// P0: Patterns pour détecter les références implicites
const IMPLICIT_REFERENCE_PATTERNS = [
  { pattern: /\b(le|la|les|ce|cette|ces)\s+(même|pareil)/i, type: 'same_reference' },
  { pattern: /\bplus\s+(grand|petit|foncé|clair|épais|fin)/i, type: 'comparative' },
  { pattern: /\bmoins\s+(grand|visible|large)/i, type: 'comparative' },
  { pattern: /\baussi\b/i, type: 'additional' },
  { pattern: /\bpareil\b|\bidem\b/i, type: 'same_reference' },
  { pattern: /\bcomme\s+(avant|ça|le reste|les autres)/i, type: 'reference_to_previous' },
];

// P0: Extraire les références implicites du prompt
function extractImplicitReferences(
  prompt: string,
  conversationHistory?: ConversationMessage[]
): { references: string[]; resolvedContext: string } {
  const references: string[] = [];
  let resolvedContext = '';

  for (const { pattern, type } of IMPLICIT_REFERENCE_PATTERNS) {
    if (pattern.test(prompt)) {
      references.push(type);
    }
  }

  // Si références trouvées, chercher le contexte dans l'historique
  if (references.length > 0 && conversationHistory && conversationHistory.length > 0) {
    // Chercher le dernier message avec des fichiers modifiés
    for (let i = conversationHistory.length - 1; i >= 0; i--) {
      const msg = conversationHistory[i];
      if (msg.metadata?.files_modified?.length || msg.metadata?.filesAffected?.length) {
        const files = msg.metadata.files_modified || 
          msg.metadata.filesAffected?.map(f => f.path) || [];
        resolvedContext = `Contexte précédent: fichiers ${files.join(', ')}`;
        break;
      }
      // Chercher aussi le message d'intention
      if (msg.metadata?.intent_message) {
        resolvedContext = `Action précédente: ${msg.metadata.intent_message}`;
        break;
      }
    }
  }

  return { references, resolvedContext };
}

// P0: Extraire les dernières valeurs modifiées depuis l'historique
function extractLastModifiedValues(conversationHistory: ConversationMessage[]): {
  lastColor?: string;
  lastElement?: string;
  lastProperty?: string;
  lastFiles?: string[];
} {
  const result: {
    lastColor?: string;
    lastElement?: string;
    lastProperty?: string;
    lastFiles?: string[];
  } = {};
  
  // Parcourir l'historique en ordre inverse pour trouver les dernières valeurs
  for (let i = conversationHistory.length - 1; i >= 0; i--) {
    const msg = conversationHistory[i];
    const content = msg.content || '';
    
    // Chercher des couleurs mentionnées (codes hex ou noms)
    if (!result.lastColor) {
      const hexMatch = content.match(/#[0-9a-fA-F]{3,6}/);
      const colorNameMatch = content.match(/\b(bleu|rouge|vert|jaune|orange|violet|rose|noir|blanc|gris|blue|red|green|yellow|purple|pink|black|white|gray|navy|cyan|teal)/i);
      if (hexMatch) result.lastColor = hexMatch[0];
      else if (colorNameMatch) result.lastColor = colorNameMatch[0];
    }
    
    // Chercher des éléments UI mentionnés
    if (!result.lastElement) {
      const elementMatch = content.match(/\b(bouton|button|titre|header|footer|navigation|nav|menu|card|carte|image|logo|icon|formulaire|form|texte|section|hero|background|fond|lien|link)/i);
      if (elementMatch) result.lastElement = elementMatch[0];
    }
    
    // Chercher des propriétés CSS mentionnées
    if (!result.lastProperty) {
      const propMatch = content.match(/\b(couleur|color|taille|size|police|font|marge|margin|padding|bordure|border|arrondi|radius|ombre|shadow)/i);
      if (propMatch) result.lastProperty = propMatch[0];
    }
    
    // Chercher les fichiers modifiés
    if (!result.lastFiles && msg.metadata?.filesAffected) {
      result.lastFiles = msg.metadata.filesAffected.map(f => typeof f === 'string' ? f : f.path);
    }
    
    // Arrêter si on a trouvé toutes les valeurs
    if (result.lastColor && result.lastElement && result.lastProperty && result.lastFiles) break;
  }
  
  return result;
}

// P0: Résoudre les coréférences dans le prompt avec contexte enrichi
function resolveCoref(
  prompt: string,
  conversationHistory?: ConversationMessage[]
): string {
  if (!conversationHistory || conversationHistory.length === 0) {
    return prompt;
  }

  let resolved = prompt;
  const lastValues = extractLastModifiedValues(conversationHistory);

  // Trouver le dernier message utilisateur pour contexte
  const lastUserMsg = [...conversationHistory]
    .reverse()
    .find(m => m.role === 'user');
  
  const lastAssistantMsg = [...conversationHistory]
    .reverse()
    .find(m => m.role === 'assistant' && m.metadata?.intent_message);

  // P0 AMÉLIORÉ: Résoudre "plus foncé/clair" avec la dernière couleur trouvée
  if (/plus\s*(foncé|clair|sombre|lumineux|vif|pâle)/i.test(prompt)) {
    if (lastValues.lastColor) {
      resolved = `${prompt} (contexte: ${lastValues.lastColor})`;
    } else if (lastUserMsg?.content) {
      const colorMatch = lastUserMsg.content.match(/\b(bleu|rouge|vert|jaune|orange|violet|rose|noir|blanc|gris|blue|red|green|yellow|#[0-9a-fA-F]{3,6})/i);
      if (colorMatch) {
        resolved = `${prompt} (contexte: ${colorMatch[0]})`;
      }
    }
  }

  // P0 AMÉLIORÉ: Résoudre "pareil/même chose/la même couleur" avec les dernières valeurs
  if (/pareil|même\s*(chose|couleur|style)|idem|aussi/i.test(prompt)) {
    const contextParts: string[] = [];
    if (lastValues.lastColor) contextParts.push(`couleur: ${lastValues.lastColor}`);
    if (lastValues.lastElement) contextParts.push(`élément: ${lastValues.lastElement}`);
    if (lastAssistantMsg?.metadata?.intent_message) {
      contextParts.push(`action: ${lastAssistantMsg.metadata.intent_message}`);
    }
    if (contextParts.length > 0) {
      resolved = `${prompt} (comme: ${contextParts.join(', ')})`;
    }
  }

  // P0: Résoudre "au reste/aux autres/partout" → appliquer aux autres éléments similaires
  if (/au\s*reste|aux\s*autres|partout|everywhere|all/i.test(prompt) && lastValues.lastFiles) {
    resolved = `${prompt} (fichiers précédents: ${lastValues.lastFiles.join(', ')})`;
  }

  // P0: Résoudre "sur le/la/les même(s)" → référencer l'élément précédent
  if (/sur\s*le\s*même|sur\s*la\s*même|les\s*mêmes/i.test(prompt) && lastValues.lastElement) {
    resolved = `${prompt} (élément: ${lastValues.lastElement})`;
  }

  console.log('[resolveCoref] Resolved prompt:', { original: prompt, resolved, lastValues });

  return resolved;
}

// P1: Détecter les multi-intentions
function detectMultiIntents(
  prompt: string,
  projectFiles: Record<string, string>
): MultiIntent | null {
  // Détecter les connecteurs
  const conjunctionPatterns = [
    /\s+et\s+/gi,
    /\s+puis\s+/gi,
    /\s+ensuite\s+/gi,
    /\s+avec\s+/gi,
    /\s+ainsi\s+que\s+/gi,
    /\s+and\s+/gi,
    /\s+then\s+/gi,
  ];

  let hasMultipleIntents = false;
  for (const pattern of conjunctionPatterns) {
    if (pattern.test(prompt)) {
      hasMultipleIntents = true;
      break;
    }
  }

  if (!hasMultipleIntents) {
    return null;
  }

  // Segmenter le prompt
  const segments = prompt.split(/\s+(?:et|puis|ensuite|avec|ainsi que|and|then)\s+/i)
    .map(s => s.trim())
    .filter(s => s.length > 3);

  if (segments.length < 2) {
    return null;
  }

  // Analyser chaque segment
  const intentions = segments.map((seg, idx) => {
    const analysis = analyzeIntentCore(seg, projectFiles);
    return {
      text: seg,
      complexity: analysis.complexity,
      dependencies: idx > 0 ? [idx - 1] : [] // Dépendance séquentielle simple
    };
  });

  // Déterminer la stratégie d'exécution
  const hasComplexIntent = intentions.some(i => i.complexity === 'complex' || i.complexity === 'moderate');
  const strategy = hasComplexIntent ? 'sequential' : 'parallel';

  return { intentions, executionStrategy: strategy };
}

// Core analysis function (sans contexte multi-tours)
function analyzeIntentCore(
  prompt: string,
  projectFiles: Record<string, string>
): AnalysisResult {
  let score = 50;
  const detectedPatterns: string[] = [];
  
  // Analyse des patterns simples (+15 points)
  for (const pattern of SIMPLE_PATTERNS) {
    if (pattern.test(prompt)) {
      score += 15;
      detectedPatterns.push(`simple: ${pattern.source.substring(0, 30)}`);
    }
  }
  
  // Analyse des patterns complexes (-20 points)
  for (const pattern of COMPLEX_PATTERNS) {
    if (pattern.test(prompt)) {
      score -= 20;
      detectedPatterns.push(`complex: ${pattern.source.substring(0, 30)}`);
    }
  }
  
  // Analyse du nombre de fichiers mentionnés
  const fileNames = Object.keys(projectFiles);
  const mentionedFiles = fileNames.filter(f => 
    prompt.toLowerCase().includes(f.toLowerCase().replace(/\.[^.]+$/, ''))
  );
  
  if (mentionedFiles.length > 10) {
    score -= 20;
    detectedPatterns.push('files: >10 mentioned');
  } else if (mentionedFiles.length > 5) {
    score -= 10;
    detectedPatterns.push('files: >5 mentioned');
  }
  
  // Analyse de la longueur du prompt
  if (prompt.length > 200) {
    score -= 15;
    detectedPatterns.push('prompt: long (>200 chars)');
  } else if (prompt.length < 50) {
    score += 10;
    detectedPatterns.push('prompt: short (<50 chars)');
  }
  
  // Normalisation du score
  score = Math.max(-50, Math.min(100, score));
  
  // Mapping vers les niveaux de complexité
  let complexity: AnalysisResult['complexity'];
  if (score > 60) complexity = 'trivial';
  else if (score > 20) complexity = 'simple';
  else if (score > -20) complexity = 'moderate';
  else complexity = 'complex';
  
  const confidence = Math.abs(score) / 100;
  const intentType = complexity === 'trivial' || complexity === 'simple' 
    ? 'quick-modification' 
    : 'full-generation';
  
  const explanation = generateExplanation(complexity, score, detectedPatterns);
  
  return {
    complexity,
    intentType,
    confidence,
    explanation,
    score,
    detectedPatterns,
  };
}

// P0: Fonction principale d'analyse enrichie avec contexte conversationnel
export function analyzeIntent(
  prompt: string,
  projectFiles: Record<string, string>,
  conversationHistory?: ConversationMessage[]
): AnalysisResult {
  // 1. Extraire les références implicites
  const { references, resolvedContext } = extractImplicitReferences(prompt, conversationHistory);
  
  // 2. Résoudre les coréférences
  const resolvedPrompt = resolveCoref(prompt, conversationHistory);
  
  // 3. Détecter les multi-intentions
  const multiIntent = detectMultiIntents(prompt, projectFiles);
  
  // 4. Analyse de base avec le prompt résolu
  const baseAnalysis = analyzeIntentCore(resolvedPrompt, projectFiles);
  
  // 5. Ajuster la complexité si multi-intentions
  if (multiIntent) {
    const maxComplexity = multiIntent.intentions.reduce((max, intent) => {
      const complexityOrder = { trivial: 0, simple: 1, moderate: 2, complex: 3 };
      return complexityOrder[intent.complexity] > complexityOrder[max] 
        ? intent.complexity 
        : max;
    }, baseAnalysis.complexity);
    
    baseAnalysis.complexity = maxComplexity;
    baseAnalysis.detectedPatterns.push(`multi-intent: ${multiIntent.intentions.length} intentions`);
  }
  
  // 6. Retourner l'analyse enrichie
  return {
    ...baseAnalysis,
    resolvedPrompt: resolvedPrompt !== prompt ? resolvedPrompt : undefined,
    implicitReferences: references.length > 0 ? references : undefined,
    multiIntent: multiIntent || undefined,
  };
}

function generateExplanation(
  complexity: string,
  score: number,
  patterns: string[]
): string {
  const simpleCount = patterns.filter(p => p.startsWith('simple:')).length;
  const complexCount = patterns.filter(p => p.startsWith('complex:')).length;
  
  return `Complexité ${complexity} (score: ${score}). ` +
    `${simpleCount} pattern(s) simple(s) détecté(s), ` +
    `${complexCount} pattern(s) complexe(s) détecté(s).`;
}
