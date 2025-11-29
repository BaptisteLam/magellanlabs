/**
 * Système d'analyse d'intent amélioré avec scoring pondéré (0-100)
 * pour déterminer le type de génération nécessaire
 */

export interface IntentAnalysis {
  type: 'quick-modification' | 'full-generation';
  score: number; // 0-100 (0 = trivial, 100 = complexe)
  confidence: number; // 0-100
  reasoning: string;
  complexity: 'trivial' | 'simple' | 'moderate' | 'complex';
}

/**
 * Analyse l'intent d'un prompt avec scoring pondéré
 */
export function analyzeIntent(
  prompt: string,
  projectFiles: Record<string, string>
): 'quick-modification' | 'full-generation' {
  const analysis = analyzeIntentDetailed(prompt, projectFiles);
  return analysis.type;
}

/**
 * Analyse détaillée avec scoring
 */
export function analyzeIntentDetailed(
  prompt: string,
  projectFiles: Record<string, string>
): IntentAnalysis {
  const lowerPrompt = prompt.toLowerCase().trim();
  
  // Si pas de fichiers existants, toujours génération complète
  if (Object.keys(projectFiles).length === 0) {
    return {
      type: 'full-generation',
      score: 100,
      confidence: 100,
      reasoning: 'Aucun fichier existant - génération initiale requise',
      complexity: 'complex'
    };
  }
  
  let score = 0;
  const reasons: string[] = [];
  
  // === ANALYSE 1: Mots-clés et patterns (40 points max) ===
  
  // Patterns de modification simple (points négatifs = favorise quick-mod)
  const simplePatterns = [
    { regex: /change\s+(le|la|les)?\s*(titre|texte|couleur|prix)/i, points: -15, reason: 'Changement de contenu simple' },
    { regex: /modifie\s+(le|la|les)?\s*(titre|texte|couleur)/i, points: -15, reason: 'Modification de contenu' },
    { regex: /remplace\s+["'].*["']\s+par\s+["'].*["']/i, points: -20, reason: 'Remplacement textuel direct' },
    { regex: /met(s)?\s+(en)?\s+(rouge|bleu|vert|jaune|noir|blanc)/i, points: -10, reason: 'Changement de couleur' },
    { regex: /corrige\s+(la|le|les)?\s*(faute|orthographe|grammaire)/i, points: -15, reason: 'Correction mineure' },
    { regex: /plus\s+(grand|petit|gros)/i, points: -8, reason: 'Ajustement de taille' },
    { regex: /(gras|italique|souligné|bold|italic|underline)/i, points: -8, reason: 'Style de texte' },
    { regex: /enlève|supprime|retire/i, points: -12, reason: 'Suppression d\'élément' },
  ];
  
  // Patterns de génération complète (points positifs)
  const complexPatterns = [
    { regex: /(ajoute|crée|créer)\s+(une)?\s*page/i, points: 40, reason: 'Création de page' },
    { regex: /(ajoute|crée)\s+(une|un)?\s*(section|formulaire|galerie)/i, points: 35, reason: 'Nouvelle section/fonctionnalité' },
    { regex: /(refais|refait|redesign|restructure)/i, points: 45, reason: 'Restructuration majeure' },
    { regex: /change\s+(tout|le\s+design|la\s+structure)/i, points: 40, reason: 'Changement global' },
    { regex: /(navigation|menu|carrousel|slider|système)/i, points: 30, reason: 'Composant complexe' },
    { regex: /(responsive|mobile|desktop|tablette)/i, points: 25, reason: 'Adaptation responsive' },
    { regex: /(animation|transition|effet)/i, points: 20, reason: 'Animations' },
    { regex: /(api|intégration|backend|database)/i, points: 35, reason: 'Intégration externe' },
  ];
  
  // Évaluer les patterns simples
  for (const pattern of simplePatterns) {
    if (pattern.regex.test(prompt)) {
      score += pattern.points;
      reasons.push(pattern.reason);
    }
  }
  
  // Évaluer les patterns complexes
  for (const pattern of complexPatterns) {
    if (pattern.regex.test(prompt)) {
      score += pattern.points;
      reasons.push(pattern.reason);
    }
  }
  
  // === ANALYSE 2: Complexité syntaxique (20 points max) ===
  
  const wordCount = prompt.split(/\s+/).length;
  const sentenceCount = prompt.split(/[.!?]+/).filter(s => s.trim()).length;
  const hasMultipleSentences = sentenceCount > 1;
  const hasConjunctions = /\s+(et|ou|puis|ensuite|également|aussi)\s+/i.test(prompt);
  
  if (wordCount < 10) {
    score -= 10;
    reasons.push('Prompt très court (modification ciblée)');
  } else if (wordCount < 30) {
    score -= 5;
    reasons.push('Prompt court');
  } else if (wordCount > 50) {
    score += 10;
    reasons.push('Prompt long et détaillé');
  }
  
  if (hasMultipleSentences) {
    score += 5;
    reasons.push('Plusieurs phrases (instructions multiples)');
  }
  
  if (hasConjunctions) {
    score += 5;
    reasons.push('Conjonctions multiples (tâches combinées)');
  }
  
  // === ANALYSE 3: Mentions de fichiers/composants (20 points) ===
  
  const fileKeywords = ['fichier', 'component', 'composant', 'page', 'section', 'module'];
  const mentionedFiles = fileKeywords.filter(k => lowerPrompt.includes(k)).length;
  
  if (mentionedFiles >= 3) {
    score += 20;
    reasons.push('Multiples fichiers/composants mentionnés');
  } else if (mentionedFiles >= 2) {
    score += 10;
    reasons.push('Plusieurs fichiers/composants');
  }
  
  // Détection de mentions spécifiques de fichiers existants
  const filePaths = Object.keys(projectFiles);
  const mentionedSpecificFiles = filePaths.filter(path => 
    lowerPrompt.includes(path.toLowerCase())
  );
  
  if (mentionedSpecificFiles.length === 1) {
    score -= 10;
    reasons.push(`Fichier spécifique ciblé: ${mentionedSpecificFiles[0]}`);
  } else if (mentionedSpecificFiles.length > 1) {
    score += 15;
    reasons.push('Multiples fichiers spécifiques ciblés');
  }
  
  // === ANALYSE 4: Scope de l'impact (20 points) ===
  
  // Indicateurs d'impact limité
  if (/(un|une|le|la)\s+(seul|unique|premier|dernier)/i.test(prompt)) {
    score -= 8;
    reasons.push('Impact limité à un élément');
  }
  
  // Indicateurs d'impact large
  if (/(tous|toutes|partout|chaque|global|entier)/i.test(prompt)) {
    score += 15;
    reasons.push('Impact global/multiple éléments');
  }
  
  // Quantificateurs
  const numbers = prompt.match(/\d+/g);
  if (numbers && numbers.some(n => parseInt(n) > 3)) {
    score += 10;
    reasons.push('Modifications nombreuses demandées');
  }
  
  // === DÉTERMINATION FINALE ===
  
  // Normaliser le score entre -50 et 100
  score = Math.max(-50, Math.min(100, score));
  
  // Calculer la confiance (plus le score est extrême, plus on est confiant)
  const confidence = Math.min(100, Math.abs(score) * 1.5);
  
  // Déterminer la complexité
  let complexity: 'trivial' | 'simple' | 'moderate' | 'complex';
  if (score < -20) complexity = 'trivial';
  else if (score < 10) complexity = 'simple';
  else if (score < 30) complexity = 'moderate';
  else complexity = 'complex';
  
  // Décision: seuil à 15 (favorise quick-mod pour meilleure UX)
  const type = score < 15 ? 'quick-modification' : 'full-generation';
  
  const reasoning = reasons.length > 0 
    ? reasons.slice(0, 3).join(', ')
    : 'Analyse heuristique standard';
  
  console.log(`📊 Intent Analysis: ${type} (score: ${score}, confidence: ${confidence}%, complexity: ${complexity})`);
  console.log(`   Reasoning: ${reasoning}`);
  
  return {
    type,
    score,
    confidence,
    reasoning,
    complexity
  };
}

/**
 * Estime le temps de génération en secondes basé sur la complexité
 */
export function estimateGenerationTime(
  prompt: string,
  projectFiles: Record<string, string>
): { estimatedTime: number; range: { min: number; max: number } } {
  const analysis = analyzeIntentDetailed(prompt, projectFiles);
  
  // Estimation basée sur la complexité et le type
  const timeEstimates = {
    'quick-modification': {
      trivial: { base: 2, variance: 1 },      // 1-3s
      simple: { base: 4, variance: 2 },       // 2-6s
      moderate: { base: 8, variance: 3 },     // 5-11s
      complex: { base: 15, variance: 5 }      // 10-20s
    },
    'full-generation': {
      trivial: { base: 10, variance: 3 },     // 7-13s
      simple: { base: 18, variance: 5 },      // 13-23s
      moderate: { base: 30, variance: 8 },    // 22-38s
      complex: { base: 50, variance: 15 }     // 35-65s
    }
  };
  
  const config = timeEstimates[analysis.type][analysis.complexity];
  const estimatedTime = config.base;
  const min = Math.max(1, config.base - config.variance);
  const max = config.base + config.variance;
  
  return {
    estimatedTime,
    range: { min, max }
  };
}

/**
 * Identifie les fichiers pertinents avec scoring amélioré
 */
export function identifyRelevantFiles(
  prompt: string,
  projectFiles: Record<string, string>,
  maxFiles: number = 3
): Array<{ path: string; content: string }> {
  const lowerPrompt = prompt.toLowerCase();
  const relevantFiles: Array<{ path: string; content: string; score: number }> = [];
  
  // Calculer un score de pertinence pour chaque fichier
  for (const [path, content] of Object.entries(projectFiles)) {
    let score = 0;
    const lowerPath = path.toLowerCase();
    const lowerContent = content.toLowerCase();
    
    // === SCORING PONDÉRÉ ===
    
    // 1. Mention directe du fichier (score très élevé)
    if (lowerPrompt.includes(lowerPath)) {
      score += 200;
    }
    
    // Mention du nom de fichier sans extension
    const fileName = path.split('/').pop()?.replace(/\.[^.]+$/, '') || '';
    if (fileName && lowerPrompt.includes(fileName.toLowerCase())) {
      score += 150;
    }
    
    // 2. Fichiers principaux (haute priorité)
    const mainFilePriority: Record<string, number> = {
      'index.html': 100,
      'App.tsx': 90,
      'App.jsx': 90,
      'main.tsx': 80,
      'main.jsx': 80,
      'index.tsx': 80,
      'index.jsx': 80,
      'styles.css': 70,
      'index.css': 70,
    };
    
    const baseName = path.split('/').pop() || '';
    if (mainFilePriority[baseName]) {
      score += mainFilePriority[baseName];
    }
    
    // 3. Correspondance de mots-clés (scoring par fréquence)
    const keywords = lowerPrompt
      .split(/\s+/)
      .filter(w => w.length > 3 && !['dans', 'avec', 'pour', 'cette', 'change'].includes(w));
    
    for (const keyword of keywords) {
      // Correspondance dans le contenu
      const contentMatches = (lowerContent.match(new RegExp(keyword, 'g')) || []).length;
      score += contentMatches * 15;
      
      // Correspondance dans le chemin
      if (lowerPath.includes(keyword)) {
        score += 50;
      }
    }
    
    // 4. Type de fichier pertinent au contexte
    const extension = path.split('.').pop()?.toLowerCase();
    const promptContext = {
      style: ['css', 'scss', 'sass'],
      script: ['js', 'jsx', 'ts', 'tsx'],
      markup: ['html', 'jsx', 'tsx'],
      config: ['json', 'config', 'env'],
    };
    
    if (lowerPrompt.includes('style') || lowerPrompt.includes('couleur') || lowerPrompt.includes('design')) {
      if (extension && promptContext.style.includes(extension)) {
        score += 60;
      }
    }
    
    if (lowerPrompt.includes('fonction') || lowerPrompt.includes('logic') || lowerPrompt.includes('script')) {
      if (extension && promptContext.script.includes(extension)) {
        score += 60;
      }
    }
    
    // 5. Bonus pour fichiers récents/importants
    if (path.includes('component') || path.includes('Component')) {
      score += 30;
    }
    
    if (path.includes('page') || path.includes('Page')) {
      score += 30;
    }
    
    // 6. Pénalité pour fichiers de configuration (sauf si explicitement mentionnés)
    if (['package.json', 'tsconfig.json', '.gitignore', 'README.md'].includes(baseName)) {
      score -= 50;
    }
    
    relevantFiles.push({ path, content, score });
  }
  
  // Trier par score décroissant et prendre les N premiers
  const sorted = relevantFiles
    .sort((a, b) => b.score - a.score)
    .slice(0, maxFiles);
  
  console.log(`📂 Relevant files (top ${maxFiles}):`);
  sorted.forEach(f => console.log(`   ${f.path} (score: ${f.score})`));
  
  return sorted.map(({ path, content }) => ({ path, content }));
}
