import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Menu, Moon, Sun } from 'lucide-react';
import { useThemeStore } from '@/stores/themeStore';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from '@/components/ui/sheet';

const Header = () => {
  const navigate = useNavigate();
  const { isDark, toggleTheme } = useThemeStore();
  const [user, setUser] = useState<any>(null);
  const isMobile = useIsMobile();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
  const navigation = [
    { name: 'Entreprise', href: '/about' },
    { name: 'Tarifs', href: '/tarifs' },
    { name: 'Support', href: '/contact' },
  ];

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-md border-b border-border/50">
      <nav className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <Link to="/" className="flex items-center">
            <img 
              src={isDark ? "/lovable-uploads/magellan-logo-dark.png" : "/lovable-uploads/magellan-logo-light.png"}
              alt="Magellan"
              className="h-20 w-auto"
            />
          </Link>

          {/* Desktop Navigation - Centered */}
          {!isMobile && (
            <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-10">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  to={item.href}
                  className="text-sm text-foreground/70 hover:text-foreground transition-colors duration-200 font-normal"
                >
                  {item.name}
                </Link>
              ))}
            </div>
          )}

          {/* Desktop Auth Buttons - Right Side */}
          {!isMobile && (
            <div className="flex items-center gap-2">
              {user ? (
                <Button
                  onClick={() => navigate('/dashboard')}
                  variant="ghost"
                  className="text-sm gap-2 transition-all hover:border rounded-full px-4 py-2 text-foreground/70"
                  style={{ 
                    borderColor: 'transparent'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#03A5C0';
                    e.currentTarget.style.backgroundColor = 'rgba(3, 165, 192, 0.1)';
                    e.currentTarget.style.color = '#03A5C0';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'transparent';
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = '';
                  }}
                >
                  Dashboard
                </Button>
              ) : (
                <>
                  <Button
                    onClick={() => navigate('/auth')}
                    variant="ghost"
                    className="text-sm gap-2 transition-all hover:border rounded-full px-4 py-2 text-foreground/70"
                    style={{ 
                      borderColor: 'transparent'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = '#03A5C0';
                      e.currentTarget.style.backgroundColor = 'rgba(3, 165, 192, 0.1)';
                      e.currentTarget.style.color = '#03A5C0';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'transparent';
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.color = '';
                    }}
                  >
                    Connexion
                  </Button>
                  
                  <Button
                    onClick={toggleTheme}
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-full text-foreground/70 hover:text-[#03A5C0] transition-colors"
                  >
                    {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                  </Button>
                </>
              )}
            </div>
          )}

          {/* Mobile Menu */}
          {isMobile && (
            <Sheet open={isMenuOpen} onOpenChange={setIsMenuOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full text-foreground/70"
                >
                  <Menu className="w-5 h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-64">
                <div className="flex flex-col gap-6 mt-8">
                  {/* Navigation Links */}
                  <div className="flex flex-col gap-4">
                    {navigation.map((item) => (
                      <Link
                        key={item.name}
                        to={item.href}
                        onClick={() => setIsMenuOpen(false)}
                        className="text-sm text-foreground/70 hover:text-foreground transition-colors duration-200 font-normal"
                      >
                        {item.name}
                      </Link>
                    ))}
                  </div>

                  {/* Auth Button */}
                  {user ? (
                    <Button
                      onClick={() => {
                        setIsMenuOpen(false);
                        navigate('/dashboard');
                      }}
                      variant="ghost"
                      className="justify-start text-sm transition-all hover:border rounded-full px-4 py-2 text-foreground/70"
                      style={{ borderColor: 'transparent' }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = '#03A5C0';
                        e.currentTarget.style.backgroundColor = 'rgba(3, 165, 192, 0.1)';
                        e.currentTarget.style.color = '#03A5C0';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'transparent';
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.color = '';
                      }}
                    >
                      Dashboard
                    </Button>
                  ) : (
                    <Button
                      onClick={() => {
                        setIsMenuOpen(false);
                        navigate('/auth');
                      }}
                      variant="ghost"
                      className="justify-start text-sm transition-all hover:border rounded-full px-4 py-2 text-foreground/70"
                      style={{ borderColor: 'transparent' }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = '#03A5C0';
                        e.currentTarget.style.backgroundColor = 'rgba(3, 165, 192, 0.1)';
                        e.currentTarget.style.color = '#03A5C0';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'transparent';
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.color = '';
                      }}
                    >
                      Connexion
                    </Button>
                  )}

                  {/* Theme Toggle */}
                  <Button
                    onClick={toggleTheme}
                    variant="ghost"
                    className="justify-start text-sm gap-2 rounded-full px-4 py-2 text-foreground/70 hover:text-[#03A5C0] transition-colors"
                  >
                    {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                    <span>{isDark ? 'Mode clair' : 'Mode sombre'}</span>
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          )}
        </div>
      </nav>
    </header>
  );
};

export default Header;
