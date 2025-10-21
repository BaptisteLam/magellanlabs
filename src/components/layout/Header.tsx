import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Menu, X } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const location = useLocation();
  const { t, language, setLanguage } = useTranslation();

  const navigation = [
    { name: t('nav.home'), href: '/' },
    { name: t('nav.services'), href: '/services' },
    { name: t('nav.portfolio'), href: '/portfolio' },
    { name: t('nav.about'), href: '/about' },
    { name: t('nav.contact'), href: '/contact' },
  ];

  const isActive = (href: string) => location.pathname === href;

  return (
    <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
      <nav className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-3">
            <img 
              src="/lovable-uploads/dff9dd89-d57a-4a5c-9be4-818635659267.png" 
              alt="Trinity Studio - Agence Web"
              className="h-12 w-auto"
            />
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            {navigation.map((item) => (
              <Link
                key={item.name}
                to={item.href}
                className={`text-sm font-medium transition-colors hover:text-primary ${
                  isActive(item.href)
                    ? 'text-primary border-b-2 border-primary pb-1'
                    : 'text-foreground/80'
                }`}
              >
                {item.name}
              </Link>
            ))}
          </div>

          {/* Language Switcher & CTA */}
          <div className="hidden md:flex items-center space-x-4">
            <div className="flex items-center bg-trinity-blue-soft rounded-lg p-1">
              <button 
                className={`px-3 py-1 text-sm font-medium rounded-md shadow-sm transition-colors ${
                  language === 'fr' 
                    ? 'bg-white text-trinity-blue' 
                    : 'text-muted-foreground hover:text-trinity-blue'
                }`}
                onClick={() => setLanguage('fr')}
              >
                FR
              </button>
              <button 
                className={`px-3 py-1 text-sm font-medium rounded-md shadow-sm transition-colors ${
                  language === 'en' 
                    ? 'bg-white text-trinity-blue' 
                    : 'text-muted-foreground hover:text-trinity-blue'
                }`}
                onClick={() => setLanguage('en')}
              >
                EN
              </button>
            </div>
            <Button 
              asChild 
              className="btn-trinity-hero"
            >
              <Link to="/contact">{t('header.cta')}</Link>
            </Button>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </Button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="md:hidden py-4 space-y-2 bg-background border-t border-border">
            {navigation.map((item) => (
              <Link
                key={item.name}
                to={item.href}
                className={`block px-3 py-2 text-base font-medium transition-colors ${
                  isActive(item.href)
                    ? 'text-primary bg-trinity-blue-soft'
                    : 'text-foreground/80 hover:text-primary hover:bg-trinity-blue-soft'
                }`}
                onClick={() => setIsMenuOpen(false)}
              >
                {item.name}
              </Link>
            ))}
            
            {/* Language Switcher Mobile */}
            <div className="px-3 py-2">
              <div className="flex items-center bg-trinity-blue-soft rounded-lg p-1">
                <button 
                  className={`px-3 py-1 text-sm font-medium rounded-md shadow-sm transition-colors flex-1 ${
                    language === 'fr' 
                      ? 'bg-white text-trinity-blue' 
                      : 'text-muted-foreground hover:text-trinity-blue'
                  }`}
                  onClick={() => setLanguage('fr')}
                >
                  FR
                </button>
                <button 
                  className={`px-3 py-1 text-sm font-medium rounded-md shadow-sm transition-colors flex-1 ${
                    language === 'en' 
                      ? 'bg-white text-trinity-blue' 
                      : 'text-muted-foreground hover:text-trinity-blue'
                  }`}
                  onClick={() => setLanguage('en')}
                >
                  EN
                </button>
              </div>
            </div>
            
            <div className="pt-4 px-3">
              <Button 
                asChild 
                className="btn-trinity-hero w-full"
              >
                <Link to="/contact" onClick={() => setIsMenuOpen(false)}>
                  {t('header.cta')}
                </Link>
              </Button>
            </div>
          </div>
        )}
      </nav>
    </header>
  );
};

export default Header;