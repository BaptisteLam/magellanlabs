import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Menu, Moon, Sun, Coins, Plus, User, LogOut, FolderOpen } from 'lucide-react';
import { useThemeStore } from '@/stores/themeStore';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';

const Header = () => {
  const navigate = useNavigate();
  const { isDark, toggleTheme } = useThemeStore();
  const [user, setUser] = useState<any>(null);
  const [userEmail, setUserEmail] = useState<string>("");
  const isMobile = useIsMobile();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const getUserInitial = () => {
    if (!userEmail) return 'U';
    return userEmail.charAt(0).toUpperCase();
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };
  
  const navigation = [
    { name: 'Entreprise', href: '/about' },
    { name: 'Tarifs', href: '/tarifs' },
    { name: 'Support', href: '/contact' },
  ];

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setUserEmail(session?.user?.email ?? "");
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      setUserEmail(session?.user?.email ?? "");
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
                <>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="relative h-10 w-10 rounded-full hover:bg-accent">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src="" alt={userEmail} />
                          <AvatarFallback className="bg-[#03A5C0] text-white">
                            {getUserInitial()}
                          </AvatarFallback>
                        </Avatar>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-64 z-[100] bg-background" align="end">
                      <div className="p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium">50 Crédit</span>
                          <Coins className="w-4 h-4 text-[#03A5C0]" />
                        </div>
                        <Progress value={50} className="h-2 [&>div]:bg-[#03A5C0]" />
                      </div>
                      
                      <DropdownMenuSeparator />
                      
                      <DropdownMenuItem 
                        className="cursor-pointer transition-colors hover:bg-[#03A5C0] hover:text-white"
                        onClick={() => navigate('/credits')}
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Ajouter des crédits
                      </DropdownMenuItem>
                      
                      <DropdownMenuItem 
                        className="cursor-pointer transition-colors hover:bg-[#03A5C0] hover:text-white"
                        onClick={() => navigate('/dashboard')}
                      >
                        <FolderOpen className="w-4 h-4 mr-2" />
                        Mes projets
                      </DropdownMenuItem>
                      
                      <DropdownMenuItem 
                        className="cursor-pointer transition-colors hover:bg-[#03A5C0] hover:text-white"
                        onClick={() => navigate('/account')}
                      >
                        <User className="w-4 h-4 mr-2" />
                        Mon compte
                      </DropdownMenuItem>
                      
                      <DropdownMenuSeparator />
                      
                      <DropdownMenuItem 
                        className="cursor-pointer text-red-500 hover:bg-red-50 hover:text-red-600"
                        onClick={handleLogout}
                      >
                        <LogOut className="w-4 h-4 mr-2" />
                        Déconnexion
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  
                  <button
                    onClick={toggleTheme}
                    className="text-foreground/70 hover:text-[#03A5C0] transition-colors p-0 border-0 bg-transparent ml-2"
                  >
                    {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                  </button>
                </>
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
                  
                  <button
                    onClick={toggleTheme}
                    className="text-foreground/70 hover:text-[#03A5C0] transition-colors p-0 border-0 bg-transparent"
                  >
                    {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                  </button>
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
