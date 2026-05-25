import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import SEOHead from "@/components/SEOHead";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SUBJECTS, SECTORS, CITIES, TOTAL_COMBOS, buildUrl } from "@/data/seo";
import { Search, ArrowRight, Sparkles } from "lucide-react";

const SITE_URL = "https://magellanlabs.com";

const SeoIndex = () => {
  const [q, setQ] = useState("");

  const filteredSubjects = useMemo(
    () => SUBJECTS.filter((s) => s.label.toLowerCase().includes(q.toLowerCase())),
    [q],
  );
  const filteredSectors = useMemo(
    () => SECTORS.filter((s) => s.label.toLowerCase().includes(q.toLowerCase())),
    [q],
  );
  const filteredCities = useMemo(
    () => CITIES.filter((c) => c.name.toLowerCase().includes(q.toLowerCase())),
    [q],
  );

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Créer un site internet avec l'IA",
    description: `Découvrez les ${TOTAL_COMBOS} solutions Magellan pour créer votre site web par secteur et par ville.`,
    url: `${SITE_URL}/creer`,
  };

  return (
    <div className="min-h-screen">
      <SEOHead
        title="Créer un site internet avec l'IA — Tous secteurs, toutes villes | Magellan"
        description={`Découvrez les ${TOTAL_COMBOS} solutions Magellan pour créer votre site web : site vitrine, e-commerce, landing page, portfolio... pour restaurants, avocats, coachs, artisans dans toutes les grandes villes de France.`}
        keywords="création site internet, site web IA, site vitrine, e-commerce, landing page, par ville, par secteur, Magellan"
        canonicalUrl={`${SITE_URL}/creer`}
        structuredData={structuredData}
      />
      <Header />

      <main>
        {/* Hero */}
        <section className="pt-28 pb-12 lg:pt-32 lg:pb-20 bg-gradient-soft">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto text-center">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-trinity-blue-soft text-trinity-blue text-sm font-medium mb-6">
                <Sparkles className="w-4 h-4" />
                <span>{TOTAL_COMBOS} pages personnalisées</span>
              </div>
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-trinity-blue mb-6">
                Créez votre site internet en moins de 10 minutes
              </h1>
              <p className="text-lg text-muted-foreground mb-8">
                {SUBJECTS.length} types de sites × {SECTORS.length} secteurs × {CITIES.length} villes :
                trouvez la solution Magellan adaptée à votre activité, où que vous soyez en France.
              </p>
              <div className="relative max-w-xl mx-auto">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Rechercher un secteur, une ville, un type de site..."
                  className="pl-12 h-12"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Par type de site */}
        <section className="py-12 lg:py-16">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl md:text-3xl font-bold text-trinity-blue mb-8">
              Par type de site
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredSubjects.map((s) => (
                <Link
                  key={s.slug}
                  to={buildUrl(s.slug, "freelance", "paris")}
                  className="group bg-white rounded-xl p-5 shadow-trinity hover-lift border border-transparent hover:border-trinity-blue/20"
                >
                  <h3 className="font-semibold text-trinity-blue mb-1 flex items-center justify-between">
                    {s.labelShort}
                    <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </h3>
                  <p className="text-sm text-muted-foreground line-clamp-2">{s.description}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* Par secteur */}
        <section className="py-12 lg:py-16 bg-trinity-blue-soft">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl md:text-3xl font-bold text-trinity-blue mb-8">
              Par secteur d'activité
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {filteredSectors.map((s) => (
                <Link
                  key={s.slug}
                  to={buildUrl("site-vitrine", s.slug, "paris")}
                  className="bg-white rounded-lg p-4 text-center shadow-trinity hover-lift"
                >
                  <span className="text-sm font-medium text-trinity-blue capitalize">{s.label}</span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* Par ville */}
        <section className="py-12 lg:py-16">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl md:text-3xl font-bold text-trinity-blue mb-8">
              Par ville
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {filteredCities.map((c) => (
                <Link
                  key={c.slug}
                  to={buildUrl("site-vitrine", "freelance", c.slug)}
                  className="bg-white rounded-lg p-4 shadow-trinity hover-lift"
                >
                  <div className="font-semibold text-trinity-blue text-sm">{c.name}</div>
                  <div className="text-xs text-muted-foreground">{c.region}</div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-16 lg:py-20 bg-trinity-blue text-white">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center max-w-3xl">
            <h2 className="text-2xl md:text-4xl font-bold mb-4">
              Lancez votre site dès aujourd'hui
            </h2>
            <p className="text-lg text-white/80 mb-8">
              Choisissez votre combinaison ou laissez l'IA Magellan vous guider.
            </p>
            <Button asChild size="lg" className="bg-white text-trinity-blue hover:bg-white/90">
              <Link to="/auth?mode=signup">Démarrer gratuitement</Link>
            </Button>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default SeoIndex;
