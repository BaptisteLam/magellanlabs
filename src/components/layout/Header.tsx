import { Link } from 'react-router-dom';

const Header = () => {
  const navigation = [
    { name: 'Entreprise', href: '/about' },
    { name: 'Tarifs', href: '/tarifs' },
    { name: 'Support', href: '/contact' },
  ];

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
        </div>
      </nav>
    </header>
  );
};

export default Header;