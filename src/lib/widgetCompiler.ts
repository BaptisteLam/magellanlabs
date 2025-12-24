/**
 * Widget Compiler - Compile et exécute du code React généré dynamiquement
 *
 * SÉCURITÉ : Ce système utilise Function() pour exécuter du code généré.
 * Le code est généré par Claude et validé côté serveur avant stockage.
 */

import React from 'react';

// Cache des composants compilés pour éviter les recompilations
const componentCache = new Map<string, React.ComponentType<any>>();

export interface WidgetContext {
  // React core
  React: typeof React;
  useState: typeof React.useState;
  useEffect: typeof React.useEffect;
  useMemo: typeof React.useMemo;
  useCallback: typeof React.useCallback;
  useRef: typeof React.useRef;

  // Données et contexte
  config: any;
  widgetId: string;

  // Utilitaires fournis aux widgets
  formatCurrency: (value: number, currency?: string) => string;
  formatDate: (date: string | Date) => string;
  formatNumber: (value: number) => string;
  formatPercent: (value: number) => string;
}

/**
 * Compile du code React en composant exécutable
 *
 * @param code - Code JavaScript du composant (déjà transformé depuis JSX)
 * @param cacheKey - Clé unique pour le cache (widget ID + version)
 * @returns Composant React compilé
 */
export function compileReactCode(
  code: string,
  cacheKey: string
): React.ComponentType<any> {
  // Vérifier le cache
  if (componentCache.has(cacheKey)) {
    return componentCache.get(cacheKey)!;
  }

  try {
    // Créer une fonction qui retourne le composant
    // Le code doit retourner un composant React valide
    const componentFactory = new Function(
      'React',
      'useState',
      'useEffect',
      'useMemo',
      'useCallback',
      'useRef',
      'config',
      'widgetId',
      'formatCurrency',
      'formatDate',
      'formatNumber',
      'formatPercent',
      `
      "use strict";
      ${code}
      return GeneratedWidget;
      `
    );

    const Component = componentFactory(
      React,
      React.useState,
      React.useEffect,
      React.useMemo,
      React.useCallback,
      React.useRef,
      // Ces paramètres seront fournis via props
      undefined, // config
      undefined, // widgetId
      formatCurrency,
      formatDate,
      formatNumber,
      formatPercent
    );

    // Mettre en cache
    componentCache.set(cacheKey, Component);

    return Component;
  } catch (error) {
    console.error('[WidgetCompiler] Compilation error:', error);
    throw new Error(`Failed to compile widget: ${error.message}`);
  }
}

/**
 * Invalide le cache pour un widget spécifique
 */
export function invalidateCache(cacheKey: string): void {
  componentCache.delete(cacheKey);
}

/**
 * Vide tout le cache de composants
 */
export function clearCache(): void {
  componentCache.clear();
}

/**
 * Utilitaires fournis aux widgets générés
 */

export function formatCurrency(value: number, currency: string = 'EUR'): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
  }).format(value);
}

export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('fr-FR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(d);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('fr-FR').format(value);
}

export function formatPercent(value: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value / 100);
}

/**
 * Valide le code avant compilation (basique)
 * Une validation plus robuste est faite côté serveur
 */
export function validateCode(code: string): { valid: boolean; error?: string } {
  // Vérifications basiques de sécurité
  const dangerousPatterns = [
    /eval\(/i,
    /new\s+Function\(/i,
    /document\.cookie/i,
    /localStorage/i,
    /sessionStorage/i,
    /XMLHttpRequest/i,
    /<script/i,
    /onclick=/i,
    /onerror=/i,
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(code)) {
      return {
        valid: false,
        error: `Code contains potentially dangerous pattern: ${pattern}`,
      };
    }
  }

  return { valid: true };
}

/**
 * Wrapper sécurisé pour l'exécution de code
 * Capture les erreurs et fournit un fallback
 */
export function safeExecute<T>(
  fn: () => T,
  fallback: T,
  errorHandler?: (error: Error) => void
): T {
  try {
    return fn();
  } catch (error) {
    console.error('[WidgetCompiler] Execution error:', error);
    if (errorHandler) {
      errorHandler(error as Error);
    }
    return fallback;
  }
}
