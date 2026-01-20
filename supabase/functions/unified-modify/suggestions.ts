// P3: Système de suggestions proactives après modifications

import { ASTModification } from "./generate.ts";

export interface ProactiveSuggestion {
  type: 'improvement' | 'consistency' | 'accessibility' | 'performance' | 'best-practice';
  message: string;
  messageEn: string;
  autoApplicable: boolean;
  priority: 'low' | 'medium' | 'high';
  modification?: ASTModification;
}

// Couleurs connues pour calculer le contraste
const KNOWN_COLORS: Record<string, { r: number; g: number; b: number }> = {
  'white': { r: 255, g: 255, b: 255 },
  'black': { r: 0, g: 0, b: 0 },
  'red': { r: 255, g: 0, b: 0 },
  'blue': { r: 0, g: 0, b: 255 },
  'green': { r: 0, g: 128, b: 0 },
  '#03A5C0': { r: 3, g: 165, b: 192 },
  '#fff': { r: 255, g: 255, b: 255 },
  '#000': { r: 0, g: 0, b: 0 },
};

// Générer des suggestions basées sur les modifications appliquées
export function generateProactiveSuggestions(
  appliedMods: ASTModification[],
  projectFiles: Record<string, string>
): ProactiveSuggestion[] {
  const suggestions: ProactiveSuggestion[] = [];
  
  for (const mod of appliedMods) {
    // Suggestions pour les changements CSS
    if (mod.type === 'css-change') {
      // 1. Suggérer un état hover si on change la couleur d'un bouton
      if (mod.property === 'color' || mod.property === 'background-color') {
        const hoverSuggestion = checkForHoverState(mod, projectFiles);
        if (hoverSuggestion) suggestions.push(hoverSuggestion);
        
        // 2. Vérifier le contraste pour l'accessibilité
        const contrastSuggestion = checkColorContrast(mod);
        if (contrastSuggestion) suggestions.push(contrastSuggestion);
      }
      
      // 3. Suggérer d'ajouter une transition si pas présente
      if (['color', 'background-color', 'transform', 'opacity'].includes(mod.property || '')) {
        const transitionSuggestion = checkForTransition(mod, projectFiles);
        if (transitionSuggestion) suggestions.push(transitionSuggestion);
      }
      
      // 4. Suggérer focus state pour accessibilité
      if (mod.target?.includes('button') || mod.target?.includes('btn') || mod.target?.includes('input')) {
        const focusSuggestion = checkForFocusState(mod, projectFiles);
        if (focusSuggestion) suggestions.push(focusSuggestion);
      }
    }
    
    // Suggestions pour les changements JSX
    if (mod.type === 'jsx-change') {
      // 5. Suggérer aria-label si on ajoute un bouton sans texte
      const ariaSuggestion = checkForAriaLabel(mod);
      if (ariaSuggestion) suggestions.push(ariaSuggestion);
      
      // 6. Suggérer alt pour les images
      const altSuggestion = checkForAltAttribute(mod);
      if (altSuggestion) suggestions.push(altSuggestion);
    }
  }
  
  // Limiter à 3 suggestions max pour ne pas surcharger
  return suggestions
    .sort((a, b) => priorityWeight(b.priority) - priorityWeight(a.priority))
    .slice(0, 3);
}

function priorityWeight(priority: 'low' | 'medium' | 'high'): number {
  return { low: 1, medium: 2, high: 3 }[priority];
}

// Vérifier si un état hover existe pour le sélecteur
function checkForHoverState(
  mod: ASTModification,
  projectFiles: Record<string, string>
): ProactiveSuggestion | null {
  const cssContent = projectFiles[mod.path] || '';
  const target = mod.target || '';
  
  // Ignorer si le target est déjà une pseudo-classe
  if (target.includes(':hover') || target.includes(':focus')) {
    return null;
  }
  
  // Vérifier si :hover existe déjà
  const hoverSelector = `${target}:hover`;
  if (cssContent.includes(hoverSelector)) {
    return null;
  }
  
  // Générer une couleur hover (plus foncée)
  const hoverValue = generateDarkerColor(mod.value || '');
  
  return {
    type: 'improvement',
    message: `💡 Ajouter un état :hover pour ${target} ?`,
    messageEn: `💡 Add a :hover state for ${target}?`,
    autoApplicable: true,
    priority: 'medium',
    modification: {
      type: 'css-change',
      path: mod.path,
      target: hoverSelector,
      property: mod.property,
      value: hoverValue
    }
  };
}

// Vérifier le contraste de couleur pour l'accessibilité
function checkColorContrast(mod: ASTModification): ProactiveSuggestion | null {
  const value = mod.value?.toLowerCase() || '';
  
  // Vérifier si c'est une couleur claire sur fond potentiellement clair
  const isLightColor = value.includes('white') || 
                       value.includes('#fff') || 
                       value.includes('rgb(255');
  
  if (isLightColor && mod.property === 'color') {
    return {
      type: 'accessibility',
      message: `⚠️ Le texte clair peut avoir un contraste insuffisant. Vérifiez le fond.`,
      messageEn: `⚠️ Light text may have insufficient contrast. Check the background.`,
      autoApplicable: false,
      priority: 'high'
    };
  }
  
  return null;
}

// Vérifier si une transition existe
function checkForTransition(
  mod: ASTModification,
  projectFiles: Record<string, string>
): ProactiveSuggestion | null {
  const cssContent = projectFiles[mod.path] || '';
  const target = mod.target || '';
  
  // Vérifier si transition existe déjà
  const targetBlock = extractCSSBlock(cssContent, target);
  if (targetBlock && targetBlock.includes('transition')) {
    return null;
  }
  
  return {
    type: 'improvement',
    message: `✨ Ajouter une transition fluide pour ${mod.property} ?`,
    messageEn: `✨ Add a smooth transition for ${mod.property}?`,
    autoApplicable: true,
    priority: 'low',
    modification: {
      type: 'css-change',
      path: mod.path,
      target,
      property: 'transition',
      value: `${mod.property} 0.2s ease`
    }
  };
}

// Vérifier si un état focus existe
function checkForFocusState(
  mod: ASTModification,
  projectFiles: Record<string, string>
): ProactiveSuggestion | null {
  const cssContent = projectFiles[mod.path] || '';
  const target = mod.target || '';
  
  if (target.includes(':focus')) return null;
  
  const focusSelector = `${target}:focus`;
  if (cssContent.includes(focusSelector)) return null;
  
  return {
    type: 'accessibility',
    message: `♿ Ajouter un état :focus pour l'accessibilité clavier ?`,
    messageEn: `♿ Add a :focus state for keyboard accessibility?`,
    autoApplicable: true,
    priority: 'high',
    modification: {
      type: 'css-change',
      path: mod.path,
      target: focusSelector,
      property: 'outline',
      value: '2px solid #03A5C0'
    }
  };
}

// Vérifier aria-label pour les boutons icon-only
function checkForAriaLabel(mod: ASTModification): ProactiveSuggestion | null {
  const changes = mod.changes as Record<string, unknown> | undefined;
  if (!changes) return null;
  
  const target = mod.target?.toLowerCase() || '';
  
  // Si c'est un bouton et qu'on ne voit pas de texte/children
  if ((target.includes('button') || target.includes('btn')) && 
      !changes.children && !changes.content && !changes.text) {
    return {
      type: 'accessibility',
      message: `♿ Ajouter un aria-label pour les lecteurs d'écran ?`,
      messageEn: `♿ Add an aria-label for screen readers?`,
      autoApplicable: false,
      priority: 'medium'
    };
  }
  
  return null;
}

// Vérifier alt pour les images
function checkForAltAttribute(mod: ASTModification): ProactiveSuggestion | null {
  const target = mod.target?.toLowerCase() || '';
  const changes = mod.changes as Record<string, unknown> | undefined;
  
  if (target === 'img' && changes && !changes.alt) {
    return {
      type: 'accessibility',
      message: `🖼️ Ajouter un attribut alt pour l'accessibilité ?`,
      messageEn: `🖼️ Add an alt attribute for accessibility?`,
      autoApplicable: false,
      priority: 'high'
    };
  }
  
  return null;
}

// Extraire un bloc CSS pour un sélecteur
function extractCSSBlock(css: string, selector: string): string | null {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`, 'i');
  const match = css.match(regex);
  return match ? match[1] : null;
}

// Générer une couleur plus foncée pour hover
function generateDarkerColor(color: string): string {
  // Pour les couleurs hex, assombrir de 10%
  if (color.startsWith('#')) {
    const hex = color.slice(1);
    let r, g, b;
    
    if (hex.length === 3) {
      r = parseInt(hex[0] + hex[0], 16);
      g = parseInt(hex[1] + hex[1], 16);
      b = parseInt(hex[2] + hex[2], 16);
    } else {
      r = parseInt(hex.slice(0, 2), 16);
      g = parseInt(hex.slice(2, 4), 16);
      b = parseInt(hex.slice(4, 6), 16);
    }
    
    // Assombrir de 15%
    r = Math.max(0, Math.floor(r * 0.85));
    g = Math.max(0, Math.floor(g * 0.85));
    b = Math.max(0, Math.floor(b * 0.85));
    
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }
  
  // Pour les couleurs nommées, retourner une version assombrie générique
  if (color.toLowerCase() === 'white') return '#e0e0e0';
  if (color.toLowerCase() === 'blue') return '#0000cc';
  if (color.toLowerCase().includes('03a5c0')) return '#028ba0';
  
  // Fallback: ajouter une opacité
  return `color-mix(in srgb, ${color} 85%, black)`;
}

// Formater les suggestions pour affichage
export function formatSuggestionsForDisplay(
  suggestions: ProactiveSuggestion[],
  isFrench: boolean = true
): string {
  if (suggestions.length === 0) return '';
  
  const header = isFrench ? '\n💡 Suggestions :' : '\n💡 Suggestions:';
  const lines = suggestions.map(s => {
    const message = isFrench ? s.message : s.messageEn;
    const autoTag = s.autoApplicable ? (isFrench ? ' [Auto]' : ' [Auto]') : '';
    return `• ${message}${autoTag}`;
  });
  
  return `${header}\n${lines.join('\n')}`;
}
