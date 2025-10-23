import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

const LandingHero = () => {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-primary/5 via-background to-accent/5">
      {/* Animated background */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/10 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      <div className="container mx-auto px-4 py-20">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <h1 className="text-5xl md:text-7xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent animate-fade-in">
            Créez votre site web avec l'IA
          </h1>
          
          <p className="text-xl md:text-2xl text-muted-foreground animate-fade-in delay-200">
            Trinity Studio utilise l'intelligence artificielle pour créer des sites web professionnels en quelques secondes
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center animate-fade-in delay-400">
            <Link to="/builder">
              <Button size="lg" className="gap-2 text-lg px-8 py-6">
                Commencer maintenant
                <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
            <Link to="/tarifs">
              <Button size="lg" variant="outline" className="text-lg px-8 py-6">
                Voir les tarifs
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
};

export default LandingHero;
