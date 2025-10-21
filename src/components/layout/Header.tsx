import { Link, useLocation } from 'react-router-dom';

const Header = () => {
  const location = useLocation();
  
  const navigation = [
    { name: 'Accueil', href: '/' },
    { name: 'Services', href: '/services' },
    { name: 'Portfolio', href: '/portfolio' },
    { name: 'À propos', href: '/about' },
    { name: 'Contact', href: '/contact' },
  ];

  const isActive = (href: string) => location.pathname === href;

  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-border/30">
      <nav className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-center h-20">
          {/* Centered Navigation */}
          <div className="flex items-center gap-12">
            {navigation.map((item) => (
              <Link
                key={item.name}
                to={item.href}
                className={`
                  text-base font-normal transition-all duration-200 relative
                  ${isActive(item.href) 
                    ? 'text-foreground after:absolute after:bottom-[-8px] after:left-0 after:w-full after:h-[2px] after:bg-foreground' 
                    : 'text-foreground/60 hover:text-foreground'
                  }
                `}
              >
                {item.name}
              </Link>
            ))}
          </div>
        </div>
      </nav>
    </header>
  );
};

export default Header;