import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { LogIn, UserPlus } from 'lucide-react';

const Header = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  
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
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-border/50">
      <nav className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <Link to="/" className="flex items-center">
            <img 
              src="/lovable-uploads/trinity-ai-logo.png" 
              alt="Trinity AI"
              className="h-14 w-auto"
            />
          </Link>

          {/* Desktop Navigation - Centered */}
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

          {/* Auth Buttons - Right Side */}
          <div className="flex items-center gap-2">
            {user ? (
              <Button
                onClick={() => navigate('/dashboard')}
                variant="ghost"
                className="text-sm gap-2 transition-colors"
                style={{ color: '#014AAD' }}
              >
                Dashboard
              </Button>
            ) : (
              <>
                <Button
                  onClick={() => navigate('/auth')}
                  variant="ghost"
                  className="text-sm gap-2 transition-colors hover:text-white"
                  style={{ color: '#014AAD' }}
                >
                  <LogIn className="w-4 h-4" />
                  Connexion
                </Button>
                <Button
                  onClick={() => navigate('/auth')}
                  className="text-sm gap-2 text-white transition-all hover:shadow-lg"
                  style={{ backgroundColor: '#014AAD' }}
                >
                  <UserPlus className="w-4 h-4" />
                  S'inscrire
                </Button>
              </>
            )}
          </div>
        </div>
      </nav>
    </header>
  );
};

export default Header;