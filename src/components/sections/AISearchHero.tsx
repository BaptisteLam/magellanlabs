import { Search } from 'lucide-react';
import { useState } from 'react';

const AISearchHero = () => {
  const [searchValue, setSearchValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Search:', searchValue);
    // Add your search logic here
  };

  return (
    <div className="relative min-h-[80vh] flex items-center justify-center overflow-hidden">
      {/* Grid background */}
      <div className="absolute inset-0 bg-grid-pattern opacity-[0.03]" />
      
      {/* Animated blue glows */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/4 w-96 h-96 bg-trinity-blue/20 rounded-full blur-[120px] animate-pulse-slow" />
        <div className="absolute bottom-1/3 right-1/4 w-96 h-96 bg-trinity-blue-light/15 rounded-full blur-[120px] animate-pulse-slower" />
      </div>

      {/* Main content */}
      <div className="relative z-10 w-full max-w-3xl px-4">
        <form onSubmit={handleSubmit} className="relative group">
          <div 
            className={`
              relative bg-white rounded-2xl shadow-xl
              transition-all duration-500 ease-out
              ${isFocused ? 'shadow-2xl ring-2 ring-trinity-blue/20 scale-[1.02]' : 'shadow-lg'}
            `}
          >
            <div className="flex items-center gap-4 px-6 py-5">
              <Search 
                className={`
                  w-6 h-6 flex-shrink-0 transition-colors duration-300
                  ${isFocused ? 'text-trinity-blue' : 'text-muted-foreground'}
                `} 
              />
              <input
                type="text"
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                placeholder="Décrivez votre projet IA..."
                className="flex-1 bg-transparent border-none outline-none text-lg placeholder:text-muted-foreground/50 font-light"
              />
            </div>
          </div>

          {/* Subtle glow effect on focus */}
          {isFocused && (
            <div className="absolute -inset-1 bg-gradient-to-r from-trinity-blue/10 via-trinity-blue-light/10 to-trinity-blue/10 rounded-2xl blur-xl -z-10 animate-pulse" />
          )}
        </form>

        <p className="text-center mt-6 text-sm text-muted-foreground font-light">
          Propulsé par l'intelligence artificielle Trinity
        </p>
      </div>
    </div>
  );
};

export default AISearchHero;
