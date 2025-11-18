import { useEffect, useState } from 'react';
import { GeneratingPreview } from './GeneratingPreview';
import { Smartphone } from 'lucide-react';
import { Button } from './ui/button';
import QRCode from 'qrcode';

interface MobilePreviewProps {
  files: Record<string, string>;
  sessionId: string;
  isGenerating?: boolean;
}

export function MobilePreview({ files, sessionId, isGenerating }: MobilePreviewProps) {
  const [embedUrl, setEmbedUrl] = useState<string>('');
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (isGenerating || !files || Object.keys(files).length === 0) {
      setLoading(true);
      return;
    }

    createSnackPreview();
  }, [files, sessionId, isGenerating]);

  const createSnackPreview = async () => {
    try {
      setLoading(true);
      setError('');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/expo-snack`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ files, sessionId }),
        }
      );

      if (!response.ok) {
        throw new Error('Échec de création de la preview Expo');
      }

      const data = await response.json();
      
      if (data.embedUrl) {
        setEmbedUrl(data.embedUrl);
      }

      if (data.qrUrl) {
        const qrDataUrl = await QRCode.toDataURL(data.qrUrl, {
          width: 200,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#FFFFFF',
          },
        });
        setQrCodeDataUrl(qrDataUrl);
      }

      setLoading(false);
    } catch (err) {
      console.error('Error creating Snack preview:', err);
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
      setLoading(false);
    }
  };

  if (isGenerating) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="relative w-[375px] h-[667px] bg-background border-8 border-foreground rounded-[3rem] overflow-hidden shadow-2xl">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-foreground rounded-b-2xl z-10" />
          <div className="w-full h-full">
            <GeneratingPreview />
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="relative w-[375px] h-[667px] bg-background border-8 border-foreground rounded-[3rem] overflow-hidden shadow-2xl">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-foreground rounded-b-2xl z-10" />
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-center px-8">
              <Smartphone className="w-12 h-12 mx-auto mb-4 text-magellan-cyan animate-pulse" />
              <p className="text-sm text-muted-foreground">
                Création de la preview Expo...
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="relative w-[375px] h-[667px] bg-background border-8 border-foreground rounded-[3rem] overflow-hidden shadow-2xl">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-foreground rounded-b-2xl z-10" />
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-center px-8">
              <p className="text-sm text-destructive mb-4">{error}</p>
              <Button 
                onClick={createSnackPreview}
                style={{
                  borderColor: 'hsl(var(--magellan-cyan))',
                  backgroundColor: 'hsla(var(--magellan-cyan), 0.1)',
                  color: 'hsl(var(--magellan-cyan))'
                }}
                className="rounded-full px-4 py-0"
              >
                Réessayer
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex items-center justify-center gap-8 p-8">
      {/* iPhone Frame */}
      <div className="relative w-[375px] h-[667px] bg-background border-8 border-foreground rounded-[3rem] overflow-hidden shadow-2xl flex-shrink-0">
        {/* Notch */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-foreground rounded-b-2xl z-10" />
        
        {/* Screen Content */}
        <div className="w-full h-full pt-6">
          {embedUrl ? (
            <iframe
              src={embedUrl}
              className="w-full h-full border-0"
              title="Expo Snack Preview"
              allow="accelerometer; camera; encrypted-media; geolocation; gyroscope; microphone; midi; clipboard-write"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <p className="text-sm text-muted-foreground">Chargement...</p>
            </div>
          )}
        </div>
      </div>

      {/* QR Code & Instructions */}
      {qrCodeDataUrl && (
        <div className="flex flex-col items-center gap-4 max-w-xs">
          <div className="bg-card p-4 rounded-xl border border-border shadow-lg">
            <img src={qrCodeDataUrl} alt="QR Code Expo Go" className="w-48 h-48" />
          </div>
          
          <div className="text-center space-y-2">
            <p className="text-sm font-medium text-foreground">
              Scanner avec Expo Go
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              La preview navigateur ne dispose pas des fonctions natives. 
              Testez sur un appareil réel pour une expérience optimale.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open('https://expo.dev/go', '_blank')}
              className="mt-2"
              style={{
                borderColor: 'hsl(var(--magellan-cyan))',
                backgroundColor: 'hsla(var(--magellan-cyan), 0.1)',
                color: 'hsl(var(--magellan-cyan))'
              }}
            >
              Télécharger Expo Go
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
