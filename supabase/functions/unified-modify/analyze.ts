// Phase 1: Analyse d'intention et détection de complexité

export interface AnalysisResult {
  complexity: 'trivial' | 'simple' | 'moderate' | 'complex';
  intentType: 'quick-modification' | 'full-generation';
  confidence: number;
  explanation: string;
  score: number;
  detectedPatterns: string[];
}

// Patterns simples (+15 points chacun) - P1: Enrichi avec plus de patterns FR/EN
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
  // P1: Nouveaux patterns
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

export function analyzeIntent(
  prompt: string,
  projectFiles: Record<string, string>
): AnalysisResult {
  let score = 50; // Score de base
  const detectedPatterns: string[] = [];
  
  // Analyse des patterns simples (+15 points)
  for (const pattern of SIMPLE_PATTERNS) {
    if (pattern.test(prompt)) {
      score += 15;
      detectedPatterns.push(`simple: ${pattern.source}`);
    }
  }
  
  // Analyse des patterns complexes (-20 points)
  for (const pattern of COMPLEX_PATTERNS) {
    if (pattern.test(prompt)) {
      score -= 20;
      detectedPatterns.push(`complex: ${pattern.source}`);
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
  
  // Normalisation du score entre -50 et 100
  score = Math.max(-50, Math.min(100, score));
  
  // Mapping vers les niveaux de complexité
  let complexity: AnalysisResult['complexity'];
  if (score > 60) complexity = 'trivial';
  else if (score > 20) complexity = 'simple';
  else if (score > -20) complexity = 'moderate';
  else complexity = 'complex';
  
  // Calcul du niveau de confiance
  const confidence = Math.abs(score) / 100;
  
  // Détermination du type d'intention
  const intentType = complexity === 'trivial' || complexity === 'simple' 
    ? 'quick-modification' 
    : 'full-generation';
  
  // Génération de l'explication
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
