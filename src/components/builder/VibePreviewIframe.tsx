import { useState, useRef, useCallback, useEffect } from 'react';
import { RefreshCw, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface VibePreviewIframeProps {
  src: string;
  className?: string;
}

/**
 * Iframe wrapper for VibeSDK preview URLs.
 * Detects load errors and shows a branded Magellan error page
 * instead of the raw Cloudflare error page.
 */
export function VibePreviewIframe({ src, className = '' }: VibePreviewIframeProps) {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [retryCount, setRetryCount] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const checkTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const handleLoad = useCallback(() => {
    setIsLoading(false);

    // Check if the iframe loaded an error page by probing its content
    // We use a short delay to let the page render
    if (checkTimeoutRef.current) clearTimeout(checkTimeoutRef.current);
    checkTimeoutRef.current = setTimeout(() => {
      try {
        const iframe = iframeRef.current;
        if (!iframe) return;

        // Try to access iframe document (same-origin only)
        const doc = iframe.contentDocument || iframe.contentWindow?.document;
        if (doc) {
          const bodyText = doc.body?.innerText || '';
          const title = doc.title || '';

          // Detect common error patterns from Cloudflare/Vite
          const errorPatterns = [
            'Internal Server Error',
            'Application error',
            '502 Bad Gateway',
            '503 Service',
            '504 Gateway',
            'ReferenceError',
            'SyntaxError',
            'TypeError',
            'Unexpected token',
          ];

          const isError = errorPatterns.some(
            p => bodyText.includes(p) || title.includes(p)
          );

          if (isError) {
            console.warn('[VibePreviewIframe] Detected error page in iframe');
            setHasError(true);
          }
        }
      } catch {
        // Cross-origin - can't inspect, that's OK
        // We'll rely on the message listener for cross-origin error detection
      }
    }, 2000);
  }, []);

  // Listen for error messages posted from the iframe (Vite error overlay)
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        // Vite sends error events
        if (data?.type === 'error' || data?.type === 'vite:error') {
          console.warn('[VibePreviewIframe] Received error from iframe:', data);
          setHasError(true);
        }
      } catch {
        // Not JSON, ignore
      }
    };

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
      if (checkTimeoutRef.current) clearTimeout(checkTimeoutRef.current);
    };
  }, []);

  // Reset error state when src changes
  useEffect(() => {
    setHasError(false);
    setIsLoading(true);
  }, [src]);

  const handleRetry = () => {
    setHasError(false);
    setIsLoading(true);
    setRetryCount(prev => prev + 1);

    if (iframeRef.current) {
      // Force reload by appending a cache-busting param
      const url = new URL(src);
      url.searchParams.set('_retry', String(retryCount + 1));
      iframeRef.current.src = url.toString();
    }
  };

  if (hasError) {
    return (
      <div className={`w-full h-full flex items-center justify-center ${className}`}
        style={{ backgroundColor: '#1a1a2e' }}
      >
        <div className="text-center max-w-md px-6">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6"
            style={{ backgroundColor: 'rgba(3, 165, 192, 0.15)' }}
          >
            <AlertTriangle className="w-8 h-8" style={{ color: '#03A5C0' }} />
          </div>

          <h2 className="text-xl font-semibold text-white mb-2">
            Preview error
          </h2>
          <p className="text-sm text-slate-400 mb-6">
            The generated site encountered an error while loading.
            This can happen when the AI generates code with missing dependencies.
            Try regenerating with a simpler prompt.
          </p>

          <div className="flex flex-col gap-3">
            <Button
              onClick={handleRetry}
              className="gap-2"
              style={{
                backgroundColor: '#03A5C0',
                color: 'white',
              }}
            >
              <RefreshCw className="w-4 h-4" />
              Retry preview
            </Button>

            <button
              onClick={() => setHasError(false)}
              className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
            >
              Show original page anyway
            </button>
          </div>

          {retryCount > 0 && (
            <p className="text-xs text-slate-500 mt-4">
              Retried {retryCount} time{retryCount > 1 ? 's' : ''}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`w-full h-full relative ${className}`}>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center z-10"
          style={{ backgroundColor: '#1a1a2e' }}
        >
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
              style={{ borderColor: '#03A5C0', borderTopColor: 'transparent' }}
            />
            <p className="text-sm text-slate-400">Loading preview...</p>
          </div>
        </div>
      )}
      <iframe
        ref={iframeRef}
        src={src}
        title="Preview"
        className="w-full h-full border-0"
        sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-modals"
        onLoad={handleLoad}
        onError={() => {
          setIsLoading(false);
          setHasError(true);
        }}
      />
    </div>
  );
}
