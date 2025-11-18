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

  return (
    <div className="w-full h-full flex items-center justify-center gap-6 p-6 bg-background">
      {/* iPhone Frame avec contenu */}
      <div className="relative w-[375px] h-[667px] bg-card border-[14px] border-foreground/80 rounded-[3rem] overflow-hidden shadow-2xl flex-shrink-0">
        {/* Notch */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-foreground/80 rounded-b-2xl z-10" />
        
        {/* Screen Content */}
        <div className="w-full h-full">
          {isGenerating || loading ? (
            <GeneratingPreview />
          ) : error ? (
            <div className="w-full h-full flex items-center justify-center p-6">
              <div className="text-center">
                <p className="text-sm text-destructive mb-4">{error}</p>
                <Button 
                  onClick={createSnackPreview}
                  style={{
                    borderColor: 'hsl(var(--magellan-cyan))',
                    backgroundColor: 'hsla(var(--magellan-cyan), 0.1)',
                    color: 'hsl(var(--magellan-cyan))'
                  }}
                  className="rounded-full px-4 py-0 border transition-all hover:bg-[hsla(var(--magellan-cyan),0.2)]"
                >
                  Réessayer
                </Button>
              </div>
            </div>
          ) : embedUrl ? (
            <iframe
              src={embedUrl}
              className="w-full h-full border-0 bg-background"
              title="Expo Snack Preview"
              allow="accelerometer; camera; encrypted-media; geolocation; gyroscope; microphone; midi; clipboard-write"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Smartphone className="w-12 h-12 text-muted-foreground animate-pulse" />
            </div>
          )}
        </div>
      </div>

      {/* QR Code & Instructions à droite */}
      {!isGenerating && qrCodeDataUrl && (
        <div className="flex flex-col items-start gap-4 max-w-xs">
          <div className="bg-card p-4 rounded-xl border border-border shadow-lg">
            <img src={qrCodeDataUrl} alt="QR Code Expo Go" className="w-48 h-48" />
          </div>
          
          <div className="space-y-3">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">
                Scanner avec Expo Go
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                La preview navigateur ne dispose pas des fonctions natives. 
                Testez sur un appareil réel pour une expérience optimale.
              </p>
            </div>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open('https://expo.dev/go', '_blank')}
              className="w-full"
              style={{
                borderColor: 'hsl(var(--magellan-cyan))',
                backgroundColor: 'hsla(var(--magellan-cyan), 0.1)',
                color: 'hsl(var(--magellan-cyan))'
              }}
            >
              <Smartphone className="w-4 h-4 mr-2" />
              Télécharger Expo Go
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
