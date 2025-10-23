import { Button } from '@/components/ui/button';
import AISearchHero from '@/components/sections/AISearchHero';
import SEOHead from '@/components/SEOHead';
import { Home } from 'lucide-react';
import { Link } from 'react-router-dom';

const AIBuilder = () => {
  return (
    <div className="min-h-screen bg-background">
      <SEOHead 
        title="AI Website Builder - Trinity Studio"
        description="Create your website with AI in seconds"
        keywords="ai builder, website generator, ai website"
        canonicalUrl="https://trinitystudio.fr/builder"
      />
      
      {/* Simple header with only home button */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-sm border-b border-border">
        <div className="container mx-auto px-4 py-3">
          <Link to="/">
            <Button variant="ghost" size="sm" className="gap-2">
              <Home className="h-4 w-4" />
              Home
            </Button>
          </Link>
        </div>
      </div>

      {/* Main content - AI Builder */}
      <main className="pt-16">
        <AISearchHero />
      </main>
    </div>
  );
};

export default AIBuilder;
