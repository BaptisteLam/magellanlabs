import { useEffect, useState } from 'react';
import ShinyText from './ui/ShinyText';
import loadingSphereDark from '@/assets/loading-sphere-dark.webm';
import loadingSphereLight from '@/assets/loading-sphere-light.webm';
import { useThemeStore } from '@/stores/themeStore';

const loadingMessages = [
  "Analyse de votre demande et compréhension de vos besoins...",
  "Architecture des composants et structure du projet...",
  "Génération du code React avec les meilleures pratiques...",
  "Application du design system et optimisation visuelle...",
  "Configuration de l'environnement et des dépendances...",
  "Finalisation et vérification de la qualité du code..."
];

export function GeneratingPreview() {
  const [messageIndex, setMessageIndex] = useState(0);
  const { isDark } = useThemeStore();

  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % loadingMessages.length);
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-card/80 backdrop-blur-sm gap-8 px-4">
      <div className="flex items-center justify-center">
        <video
          src={isDark ? loadingSphereDark : loadingSphereLight}
          autoPlay
          loop
          muted
          playsInline
          className="w-32 h-32 object-contain"
        />
      </div>

      <div className="max-w-xl text-center">
        <h2
          key={messageIndex}
          className="text-sm font-medium animate-fade-in"
        >
          <ShinyText
            text={loadingMessages[messageIndex]}
            disabled={false}
            speed={3}
          />
        </h2>
      </div>
    </div>
  );
}
