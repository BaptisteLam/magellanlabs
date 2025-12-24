/**
 * DynamicWidget - Rendu de widgets React générés dynamiquement par Claude
 *
 * Ce composant compile et affiche du code React généré à la volée,
 * permettant une personnalisation illimitée des widgets CRM.
 */

import React, { useState, useEffect, Suspense } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { compileReactCode, validateCode } from '@/lib/widgetCompiler';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, RefreshCw, Code } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export interface DynamicWidgetProps {
  widgetId: string;
  title: string;
  config?: any;
  data?: any;
  generatedCode?: string;
  codeVersion?: number;
  dataSources?: {
    site_forms?: string[];
    crm_widgets?: string[];
    external_apis?: string[];
  };
  onRegenerate?: () => void;
  onEdit?: () => void;
  onUpdate?: (newData: any) => void;
  onConfigUpdate?: (newConfig: any) => void;
}

export function DynamicWidget({
  widgetId,
  generatedCode = '',
  codeVersion = 1,
  title,
  config = {},
  dataSources,
  onRegenerate,
}: DynamicWidgetProps) {
  const [Component, setComponent] = useState<React.ComponentType<any> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCompiling, setIsCompiling] = useState(!!generatedCode);
  const { toast } = useToast();

  useEffect(() => {
    if (generatedCode) {
      compileWidget();
    }
  }, [generatedCode, codeVersion]);

  const compileWidget = async () => {
    setIsCompiling(true);
    setError(null);

    try {
      // Validation basique du code
      const validation = validateCode(generatedCode);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      // Compilation du code
      const cacheKey = `${widgetId}_v${codeVersion}`;
      const CompiledComponent = compileReactCode(generatedCode, cacheKey);

      setComponent(() => CompiledComponent);
      setError(null);
    } catch (err: any) {
      console.error('[DynamicWidget] Compilation error:', err);
      setError(err.message || 'Failed to compile widget');
      toast({
        title: 'Erreur de compilation',
        description: 'Le widget n\'a pas pu être compilé. Vérifiez le code généré.',
        variant: 'destructive',
      });
    } finally {
      setIsCompiling(false);
    }
  };

  const handleRegenerate = () => {
    if (onRegenerate) {
      onRegenerate();
    } else {
      toast({
        title: 'Régénération',
        description: 'Utilisez le chat pour modifier ce widget',
      });
    }
  };

  // Pas de code généré - afficher un placeholder
  if (!generatedCode) {
    return (
      <Card className="p-6 border-dashed border-2">
        <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
          <Code className="w-12 h-12 mb-4 opacity-30" />
          <p className="text-sm text-center font-medium">{title}</p>
          <p className="text-xs text-center mt-2">
            Ce widget n'a pas encore de code généré.
            <br />
            Utilisez le chat pour le personnaliser.
          </p>
        </div>
      </Card>
    );
  }

  // Affichage pendant la compilation
  if (isCompiling) {
    return (
      <Card className="p-6">
        <div className="space-y-3">
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </Card>
    );
  }

  // Affichage en cas d'erreur de compilation
  if (error || !Component) {
    return (
      <Card className="p-6 border-destructive">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="ml-2">
            <div className="space-y-2">
              <p className="font-semibold">Erreur de compilation du widget</p>
              <p className="text-sm">{error || 'Unknown error'}</p>
              <div className="flex gap-2 mt-4">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={compileWidget}
                  className="gap-2"
                >
                  <RefreshCw className="h-3 w-3" />
                  Réessayer
                </Button>
                {onRegenerate && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleRegenerate}
                    className="gap-2"
                  >
                    <Code className="h-3 w-3" />
                    Régénérer
                  </Button>
                )}
              </div>
            </div>
          </AlertDescription>
        </Alert>
      </Card>
    );
  }

  // Rendu du widget avec gestion d'erreurs runtime
  return (
    <ErrorBoundary
      FallbackComponent={({ error, resetErrorBoundary }) => (
        <WidgetErrorFallback
          error={error}
          title={title}
          onReset={resetErrorBoundary}
          onRegenerate={handleRegenerate}
        />
      )}
      onReset={() => compileWidget()}
    >
      <Suspense
        fallback={
          <Card className="p-6">
            <Skeleton className="h-64 w-full" />
          </Card>
        }
      >
        <Component
          config={config}
          widgetId={widgetId}
          dataSources={dataSources}
        />
      </Suspense>
    </ErrorBoundary>
  );
}

/**
 * Fallback affiché en cas d'erreur runtime du widget
 */
function WidgetErrorFallback({
  error,
  title,
  onReset,
  onRegenerate,
}: {
  error: Error;
  title: string;
  onReset: () => void;
  onRegenerate: () => void;
}) {
  return (
    <Card className="p-6 border-destructive bg-destructive/5">
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold text-destructive">
              Erreur d'exécution du widget
            </h3>
            <p className="text-sm text-muted-foreground mt-1">{title}</p>
          </div>
        </div>

        <Alert variant="destructive">
          <AlertDescription>
            <p className="text-sm font-mono">{error.message}</p>
          </AlertDescription>
        </Alert>

        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={onReset} className="gap-2">
            <RefreshCw className="h-3 w-3" />
            Recharger
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onRegenerate}
            className="gap-2"
          >
            <Code className="h-3 w-3" />
            Demander une correction
          </Button>
        </div>

        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer hover:text-foreground">
            Détails techniques
          </summary>
          <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto">
            {error.stack}
          </pre>
        </details>
      </div>
    </Card>
  );
}

/**
 * Skeleton pour le chargement initial
 */
export function DynamicWidgetSkeleton() {
  return (
    <Card className="p-6">
      <div className="space-y-4">
        <Skeleton className="h-6 w-1/3" />
        <Skeleton className="h-48 w-full" />
        <div className="flex gap-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
    </Card>
  );
}

export default DynamicWidget;
