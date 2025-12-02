/**
 * PHASE 1: ANALYSE INTELLIGENTE
 * - Détection de complexité
 * - Scoring 0-100
 */

export interface IntentAnalysis {
  type: 'quick-modification' | 'full-generation';
  score: number;
  confidence: number;
  reasoning: string;
  complexity: 'trivial' | 'simple' | 'moderate' | 'complex';
}

export function analyzeIntent(
  prompt: string,
  projectFiles: Record<string, string>
): IntentAnalysis {
  const lowerPrompt = prompt.toLowerCase().trim();

  // Si pas de fichiers existants, génération initiale
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

  // Patterns de modification simple (points négatifs = quick-mod)
  const simplePatterns = [
    { regex: /change\s+(le|la|les)?\s*(titre|texte|couleur|prix)/i, points: -50, reason: 'Changement simple' },
    { regex: /modifie\s+(le|la|les)?\s*(titre|texte|couleur|style)/i, points: -50, reason: 'Modification contenu' },
    { regex: /remplace\s+["'].*["']\s+par\s+["'].*["']/i, points: -60, reason: 'Remplacement textuel' },
    { regex: /met(s)?\s+(en)?\s+(rouge|bleu|vert|jaune)/i, points: -45, reason: 'Changement couleur' },
    { regex: /(enlève|supprime|retire|cache)/i, points: -45, reason: 'Suppression élément' },
    { regex: /(centre|aligne)\s+(à\s+)?(gauche|droite|centre)/i, points: -40, reason: 'Alignement' },
  ];

  // Patterns de génération complexe (points positifs)
  const complexPatterns = [
    { regex: /(crée|créer|génère)\s+(un\s+nouveau\s+site|from\s+scratch)/i, points: 80, reason: 'Création site' },
    { regex: /ajoute\s+(plusieurs|5|six|sept)\s+pages/i, points: 70, reason: 'Multiples pages' },
    { regex: /(refais|redesign|restructure)\s+(tout|complètement)/i, points: 75, reason: 'Restructuration' },
  ];

  for (const pattern of simplePatterns) {
    if (pattern.regex.test(prompt)) {
      score += pattern.points;
      reasons.push(pattern.reason);
    }
  }

  for (const pattern of complexPatterns) {
    if (pattern.regex.test(prompt)) {
      score += pattern.points;
      reasons.push(pattern.reason);
    }
  }

  // Analyse syntaxique
  const wordCount = prompt.split(/\s+/).length;
  if (wordCount < 10) {
    score -= 25;
    reasons.push('Prompt court (modification ciblée)');
  } else if (wordCount > 50) {
    score += 10;
    reasons.push('Prompt détaillé');
  }

  // Normaliser entre -50 et 100
  score = Math.max(-50, Math.min(100, score));

  const confidence = Math.min(100, Math.abs(score) * 1.5);

  let complexity: 'trivial' | 'simple' | 'moderate' | 'complex';
  if (score < -20) complexity = 'trivial';
  else if (score < 10) complexity = 'simple';
  else if (score < 30) complexity = 'moderate';
  else complexity = 'complex';

  const type = score < 70 ? 'quick-modification' : 'full-generation';

  const reasoning = reasons.length > 0
    ? reasons.slice(0, 3).join(', ')
    : 'Analyse heuristique standard';

  console.log(`📊 Intent: ${type} (score: ${score}, confidence: ${confidence}%, complexity: ${complexity})`);

  return { type, score, confidence, reasoning, complexity };
}
