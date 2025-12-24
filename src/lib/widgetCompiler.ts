/**
 * Widget Compiler - Compile et exécute du code React généré dynamiquement
 *
 * SÉCURITÉ : Ce système utilise Function() pour exécuter du code généré.
 * Le code est généré par Claude et validé côté serveur avant stockage.
 */

import React from 'react';
import * as Recharts from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import * as LucideIcons from 'lucide-react';

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

// Contexte d'exécution complet pour les widgets générés
const WIDGET_CONTEXT = {
  // React
  React,
  useState: React.useState,
  useEffect: React.useEffect,
  useMemo: React.useMemo,
  useCallback: React.useCallback,
  useRef: React.useRef,
  
  // Recharts
  Recharts,
  LineChart: Recharts.LineChart,
  BarChart: Recharts.BarChart,
  PieChart: Recharts.PieChart,
  AreaChart: Recharts.AreaChart,
  XAxis: Recharts.XAxis,
  YAxis: Recharts.YAxis,
  CartesianGrid: Recharts.CartesianGrid,
  Tooltip: Recharts.Tooltip,
  Legend: Recharts.Legend,
  Line: Recharts.Line,
  Bar: Recharts.Bar,
  Pie: Recharts.Pie,
  Area: Recharts.Area,
  Cell: Recharts.Cell,
  ResponsiveContainer: Recharts.ResponsiveContainer,
  
  // shadcn/ui components
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
  Button,
  Badge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Input,
  Label,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Progress,
  Skeleton,
  
  // Icons
  Icons: LucideIcons,
  
  // Utilitaires
  formatCurrency,
  formatDate,
  formatNumber,
  formatPercent,
};

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
    // Liste des noms de paramètres pour la fonction
    const contextKeys = Object.keys(WIDGET_CONTEXT);
    
    // Créer une fonction qui retourne le composant
    const componentFactory = new Function(
      ...contextKeys,
      `
      "use strict";
      ${code}
      return GeneratedWidget;
      `
    );

    // Créer le composant de base avec le contexte
    const BaseComponent = componentFactory(
      ...contextKeys.map(key => WIDGET_CONTEXT[key as keyof typeof WIDGET_CONTEXT])
    );
    
    // Wrapper qui passe config et widgetId comme props
    const WrappedComponent: React.FC<{ config?: any; widgetId?: string; dataSources?: any }> = (props) => {
      return React.createElement(BaseComponent, {
        config: props.config || {},
        widgetId: props.widgetId || '',
        dataSources: props.dataSources || {},
      });
    };

    // Mettre en cache
    componentCache.set(cacheKey, WrappedComponent);

    return WrappedComponent;
  } catch (error: any) {
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
