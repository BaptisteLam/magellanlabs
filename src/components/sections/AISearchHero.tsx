import { Sparkles } from 'lucide-react';

const AISearchHero = () => {
  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950">
      {/* Grid background - more visible */}
      <div className="absolute inset-0 bg-grid-pattern opacity-[0.15]" />
      
      {/* Large blue glows */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[800px] h-[800px] bg-blue-600/30 rounded-full blur-[150px] animate-pulse-slow" />
        <div className="absolute bottom-0 right-1/4 w-[800px] h-[800px] bg-blue-500/25 rounded-full blur-[150px] animate-pulse-slower" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-600/20 rounded-full blur-[120px]" />
      </div>

      {/* Main content */}
      <div className="relative z-10 w-full max-w-4xl px-4 text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/20 bg-white/5 backdrop-blur-sm mb-8">
          <Sparkles className="w-4 h-4 text-white" />
          <span className="text-sm text-white/90 font-light">Propulsé par Mistral IA</span>
        </div>

        {/* Main title */}
        <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight">
          Crée ton site web en quelques secondes avec l'IA
        </h1>

        {/* Subtitle */}
        <p className="text-xl md:text-2xl text-white/70 font-light mb-12">
          Décris ton activité en une phrase... l'IA s'occupe du reste.
        </p>

        {/* Search input */}
        <div className="max-w-2xl mx-auto">
          <div className="relative bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 shadow-2xl">
            <input
              type="text"
              placeholder="Décris ton projet en quelques mots..."
              className="w-full bg-transparent border-none outline-none text-lg text-white placeholder:text-white/40 font-light px-6 py-5"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default AISearchHero;
