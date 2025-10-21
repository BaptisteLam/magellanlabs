import { Sparkles } from 'lucide-react';

const AISearchHero = () => {
  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-white pt-20">
      {/* Grid background - more visible */}
      <div className="absolute inset-0 bg-grid-pattern opacity-[0.08]" />
      
      {/* Large cyan glows with animation */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[800px] h-[800px] rounded-full blur-[150px] animate-pulse-slow" 
             style={{ backgroundColor: 'rgba(91, 224, 229, 0.3)' }} />
        <div className="absolute bottom-0 right-1/4 w-[800px] h-[800px] rounded-full blur-[150px] animate-pulse-slower" 
             style={{ backgroundColor: 'rgba(91, 224, 229, 0.25)' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full blur-[120px] animate-pulse" 
             style={{ backgroundColor: 'rgba(91, 224, 229, 0.2)' }} />
      </div>

      {/* Main content */}
      <div className="relative z-10 w-full max-w-4xl px-4 text-center -mt-48">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border backdrop-blur-sm mb-6"
             style={{ borderColor: 'rgba(91, 224, 229, 0.3)', backgroundColor: 'rgba(91, 224, 229, 0.1)' }}>
          <Sparkles className="w-4 h-4" style={{ color: '#5BE0E5' }} />
          <span className="text-sm font-light" style={{ color: '#5BE0E5' }}>Propulsé par Mistral IA</span>
        </div>

        {/* Main title */}
        <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4 leading-tight">
          Crée ton site web en quelques secondes avec l'IA
        </h1>

        {/* Subtitle */}
        <p className="text-lg md:text-xl text-slate-600 font-light mb-10">
          Décris ton activité en une phrase... l'IA s'occupe du reste.
        </p>

        {/* Search input */}
        <div className="max-w-2xl mx-auto">
          <div className="relative bg-white backdrop-blur-md rounded-2xl border border-slate-200 shadow-xl">
            <input
              type="text"
              placeholder="Décris ton projet en quelques mots..."
              className="w-full bg-transparent border-none outline-none text-lg text-slate-900 placeholder:text-slate-400 font-light px-6 py-5"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default AISearchHero;
