import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Helmet } from 'react-helmet';
import { useTranslation } from '@/hooks/useTranslation';

const NotFound = () => {
  const location = useLocation();
  const { language } = useTranslation();
  const isFr = language === 'fr';

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <>
      <Helmet>
        <title>{isFr ? 'Page Non Trouvée - 404 | Magellan' : 'Page Not Found - 404 | Magellan'}</title>
        <meta name="description" content={isFr ? "La page que vous recherchez n'existe pas ou a été déplacée. Retournez à l'accueil de Magellan pour découvrir nos services web." : "The page you're looking for doesn't exist or has been moved. Return to the Magellan homepage to explore our web services."} />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-8xl font-normal mb-4 bg-gradient-to-br from-[#03A5C0] to-[#0284a8] bg-clip-text text-transparent">404</h1>
          <p className="text-xs text-muted-foreground mb-8">{isFr ? 'Oops ! Page non trouvée' : 'Oops! Page not found'}</p>
          <a
            href="/"
            className="inline-flex items-center justify-center whitespace-nowrap font-medium ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 text-sm gap-2 transition-all border rounded-full px-4 py-0"
            style={{
              borderColor: 'rgb(3,165,192)',
              backgroundColor: 'rgba(3,165,192,0.1)',
              color: 'rgb(3,165,192)'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(3,165,192,0.15)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(3,165,192,0.1)'}
          >
            {isFr ? "Retour à l'accueil" : 'Return to Home'}
          </a>
        </div>
      </div>
    </>
  );
};

export default NotFound;
