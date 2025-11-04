import { useEffect, useState } from 'react';

const loadingMessages = [
  "Création de la landing page",
  "Préparation des fichiers du site",
  "Génération du design",
  "Optimisation des composants",
  "Configuration des styles",
  "Finalisation du projet"
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
    <div className="w-full h-full flex flex-col items-center justify-center bg-white relative overflow-hidden">
      {/* Grid background animé */}
      <div 
        className="absolute inset-0 animate-scroll-down" 
        style={{ 
          backgroundImage: 'linear-gradient(rgba(148, 163, 184, 0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(148, 163, 184, 0.15) 1px, transparent 1px)',
          backgroundSize: '80px 80px'
        }} 
      />
      
      {/* Message animé avec effet de vague */}
      <div className="relative z-10 px-8">
        <h2 
          key={messageIndex}
          className="text-2xl font-semibold text-slate-700 animate-fade-in"
          style={{
            animation: 'wave 2s ease-in-out infinite, fade-in 0.5s ease-out'
          }}
        >
          {loadingMessages[messageIndex]}
        </h2>
      </div>

      <style>{`
        @keyframes scroll-down {
          0% {
            transform: translateY(0);
          }
          100% {
            transform: translateY(80px);
          }
        }
        
        @keyframes wave {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-10px);
          }
        }
        
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .animate-scroll-down {
          animation: scroll-down 2s linear infinite;
        }
      `}</style>
    </div>
  );
}
