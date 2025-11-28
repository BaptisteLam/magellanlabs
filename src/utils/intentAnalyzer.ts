/**
 * Analyse l'intent d'un prompt utilisateur pour déterminer
 * s'il nécessite une régénération complète ou un simple patch
 */

export function analyzeIntent(
  prompt: string,
  projectFiles: Record<string, string>
): 'quick-modification' | 'full-generation' {
  const lowerPrompt = prompt.toLowerCase().trim();
  
  // Si pas de fichiers existants, toujours faire une génération complète
  if (Object.keys(projectFiles).length === 0) {
    return 'full-generation';
  }
  
  // Mots-clés pour modifications rapides (petits changements)
  const quickModificationKeywords = [
    // Changements de texte
    'change le titre', 'modifie le titre', 'change le texte', 'modifie le texte',
    'remplace', 'corrige', 'change en', 'mets', 'met le',
    
    // Changements de couleur
    'change la couleur', 'met en rouge', 'met en bleu', 'couleur',
    'background', 'fond', 'color',
    
    // Changements de style simple
    'plus grand', 'plus petit', 'taille', 'police', 'font',
    'gras', 'italique', 'souligné',
    
    // Petites modifications de contenu
    'ajoute un texte', 'supprime le texte', 'enlève', 'retire',
    'change le prix', 'modifie le prix', 'prix',
    
    // Corrections mineures
    'corrige la faute', 'orthographe', 'grammaire',
  ];
  
  // Mots-clés pour génération complète (gros changements)
  const fullGenerationKeywords = [
    // Nouvelles pages/sections
    'ajoute une page', 'crée une page', 'nouvelle page',
    'ajoute une section', 'crée une section',
    
    // Gros changements structurels
    'refais', 'refait', 'redesign', 'restructure',
    'réorganise', 'change tout', 'modifie tout',
    
    // Nouvelles fonctionnalités
    'ajoute une galerie', 'crée un formulaire', 'formulaire de contact',
    'menu de navigation', 'carrousel', 'slider',
    'système de', 'intégration',
    
    // Changements majeurs de design
    'change le design', 'nouveau design', 'style différent',
    'thème', 'layout', 'mise en page',
  ];
  
  // Vérifier d'abord les mots-clés de génération complète (priorité)
  for (const keyword of fullGenerationKeywords) {
    if (lowerPrompt.includes(keyword)) {
      console.log('🔄 Intent détecté: FULL GENERATION -', keyword);
      return 'full-generation';
    }
  }
  
  // Puis vérifier les mots-clés de modification rapide
  for (const keyword of quickModificationKeywords) {
    if (lowerPrompt.includes(keyword)) {
      console.log('⚡ Intent détecté: QUICK MODIFICATION -', keyword);
      return 'quick-modification';
    }
  }
  
  // Heuristiques additionnelles
  
  // Si le prompt est très court (< 50 caractères), probablement une petite modif
  if (prompt.length < 50) {
    console.log('⚡ Intent détecté: QUICK MODIFICATION - prompt court');
    return 'quick-modification';
  }
  
  // Si le prompt mentionne plusieurs fichiers ou composants, probablement un gros changement
  const fileKeywords = ['fichier', 'composant', 'component', 'page', 'section'];
  const fileCount = fileKeywords.filter(k => lowerPrompt.includes(k)).length;
  if (fileCount >= 2) {
    console.log('🔄 Intent détecté: FULL GENERATION - multiples fichiers/composants');
    return 'full-generation';
  }
  
  // Par défaut, si incertain, préférer la modification rapide pour une meilleure UX
  console.log('⚡ Intent détecté: QUICK MODIFICATION - par défaut');
  return 'quick-modification';
}

/**
 * Identifie les fichiers pertinents pour une modification
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
    
    // Bonus si le fichier est mentionné dans le prompt
    if (lowerPrompt.includes(lowerPath)) {
      score += 100;
    }
    
    // Bonus pour les fichiers principaux
    if (path === 'index.html' || path === 'App.tsx' || path === 'App.jsx') {
      score += 50;
    }
    
    // Chercher des mots-clés du prompt dans le contenu
    const words = lowerPrompt.split(/\s+/).filter(w => w.length > 3);
    for (const word of words) {
      const matches = (lowerContent.match(new RegExp(word, 'g')) || []).length;
      score += matches * 10;
    }
    
    // Bonus pour les fichiers récemment créés/modifiés (on suppose qu'ils sont plus pertinents)
    if (path.includes('component') || path.includes('page')) {
      score += 20;
    }
    
    relevantFiles.push({ path, content, score });
  }
  
  // Trier par score décroissant et prendre les N premiers
  return relevantFiles
    .sort((a, b) => b.score - a.score)
    .slice(0, maxFiles)
    .map(({ path, content }) => ({ path, content }));
}
