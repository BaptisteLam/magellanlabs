import { useEffect, useState } from 'react';
import ShinyText from './ui/ShinyText';

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

  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % loadingMessages.length);
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-background">
      <div className="px-8 max-w-2xl text-center">
        <h2 
          key={messageIndex}
          className="text-2xl font-semibold animate-fade-in"
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
