import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

const ThankYou = () => {
  useEffect(() => {
    // Track conversion with Google Ads on page load
    if (typeof window.gtag !== 'undefined') {
      window.gtag('event', 'conversion', {'send_to': 'AW-17622509584/J4W4CKz19KcbEJDQiNNB'});
    }
  }, []);

  return (
    <>
      <Helmet>
        <title>Merci pour votre message | Trinity Studio</title>
        <meta name="description" content="Votre message a été envoyé avec succès. L'équipe Trinity Studio vous répondra dans les plus brefs délais." />
        <meta name="robots" content="noindex, nofollow" />
        
        {/* Google tag (gtag.js) */}
        <script async src="https://www.googletagmanager.com/gtag/js?id=AW-17622509584"></script>
        <script>
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'AW-17622509584');
          `}
        </script>

        {/* Event snippet for Contact conversion page */}
        <script>
          {`
            if (typeof gtag !== 'undefined') {
              gtag('event', 'conversion', {'send_to': 'AW-17622509584/J4W4CKz19KcbEJDQiNNB'});
            }
          `}
        </script>
      </Helmet>

      <div className="min-h-screen flex flex-col bg-gradient-to-b from-background to-background/95">
        <Header />
        
        <main className="flex-1 flex items-center justify-center px-4 py-16">
          <div className="max-w-2xl w-full text-center space-y-8">
            <div className="flex justify-center">
              <CheckCircle2 className="w-20 h-20 text-primary animate-in zoom-in duration-500" />
            </div>
            
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
              <h1 className="text-4xl md:text-5xl font-bold text-foreground">
                Message envoyé avec succès !
              </h1>
              <p className="text-xl text-muted-foreground max-w-lg mx-auto">
                Merci pour votre message. Notre équipe vous répondra dans les plus brefs délais.
              </p>
            </div>

            <div className="pt-8 space-y-4 animate-in fade-in slide-in-from-bottom-6 duration-1000">
              <p className="text-muted-foreground">
                En attendant, découvrez nos réalisations ou contactez-nous directement
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button asChild size="lg">
                  <Link to="/">
                    Retour à l'accueil
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link to="/portfolio">
                    Voir nos réalisations
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </main>

        <Footer />
      </div>
    </>
  );
};

export default ThankYou;
