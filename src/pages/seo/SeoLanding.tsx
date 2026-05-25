import { useParams, Link, Navigate } from "react-router-dom";
import { useMemo } from "react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import SEOHead from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  ArrowRight,
  Check,
  Sparkles,
  MapPin,
  Zap,
  Clock,
} from "lucide-react";
import { resolveSeoCombo, SECTORS, CITIES, SUBJECTS } from "@/data/seo";
import { generateSeoContent } from "@/data/seo/content";

const SITE_URL = "https://magellanlabs.com";

const SeoLanding = () => {
  const { slug } = useParams<{ slug: string }>();
  const combo = useMemo(() => (slug ? resolveSeoCombo(slug) : null), [slug]);

  if (!combo) return <Navigate to="/404" replace />;

  const content = useMemo(() => generateSeoContent(combo), [combo]);
  const { subject, sector, city } = combo;

  // Related links for internal linking
  const relatedSubjects = SUBJECTS.filter((s) => s.slug !== subject.slug).slice(0, 4);
  const relatedSectors = SECTORS.filter((s) => s.slug !== sector.slug).slice(0, 4);
  const relatedCities = CITIES.filter((c) => c.slug !== city.slug).slice(0, 6);

  return (
    <div className="min-h-screen">
      <SEOHead
        title={content.title}
        description={content.metaDescription}
        keywords={`${subject.label}, ${sector.label}, ${city.name}, création site internet ${city.name}, ${subject.labelShort} ${sector.labelPlural}, site web ${city.name}, Magellan`}
        canonicalUrl={`${SITE_URL}${combo.url}`}
        structuredData={content.schemaJsonLd}
      />
      <Header />

      <main>
        {/* Breadcrumb */}
        <nav className="container mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-4" aria-label="Breadcrumb">
          <ol className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {content.breadcrumb.map((b, i) => (
              <li key={b.url} className="flex items-center gap-2">
                {i > 0 && <span>/</span>}
                {i === content.breadcrumb.length - 1 ? (
                  <span className="text-foreground font-medium">{b.name}</span>
                ) : (
                  <Link to={b.url} className="hover:text-primary">{b.name}</Link>
                )}
              </li>
            ))}
          </ol>
        </nav>

        {/* Hero */}
        <section className="pb-12 lg:pb-20 bg-gradient-soft">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto text-center">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-trinity-blue-soft text-trinity-blue text-sm font-medium mb-6">
                <Sparkles className="w-4 h-4" />
                <span>Généré par IA en moins de 10 minutes</span>
              </div>
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-trinity-blue mb-6">
                {content.h1}
              </h1>
              <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
                {content.intro}
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Button asChild size="lg" className="btn-trinity-hero group">
                  <Link to="/auth?mode=signup">
                    Créer mon {subject.labelShort.toLowerCase()} gratuitement
                    <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link to="/builder">Voir un exemple</Link>
                </Button>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-6 mt-8 text-sm text-muted-foreground">
                <div className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500" />Sans carte bancaire</div>
                <div className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500" />SEO local {city.name}</div>
                <div className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500" />100% responsive</div>
              </div>
            </div>
          </div>
        </section>

        {/* Context local */}
        <section className="py-12 lg:py-16">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto bg-white rounded-2xl p-8 shadow-trinity">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-trinity-blue-soft rounded-xl flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-6 h-6 text-trinity-blue" />
                </div>
                <div>
                  <h2 className="text-xl md:text-2xl font-bold text-trinity-blue mb-3">
                    Pourquoi {sector.labelPlural} {city.preposition} {city.name} choisissent Magellan
                  </h2>
                  <p className="text-muted-foreground leading-relaxed mb-3">
                    {city.name} ({city.population} d'habitants, {city.region}) est {city.highlight}. La concurrence locale entre {sector.labelPlural} y est forte, et la visibilité en ligne fait la différence : {sector.proofPoint.toLowerCase()}.
                  </p>
                  <p className="text-muted-foreground leading-relaxed">
                    Magellan génère pour vous {subject.article} {subject.label} déjà optimisé pour les recherches Google associant votre métier et la ville de {city.name}, sans connaissance technique requise.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Bénéfices */}
        <section className="py-12 lg:py-20 bg-trinity-blue-soft">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12 max-w-3xl mx-auto">
              <h2 className="text-2xl md:text-3xl font-bold text-trinity-blue mb-4">
                Ce que vous gagnez avec {subject.article} {subject.label} Magellan
              </h2>
              <p className="text-lg text-muted-foreground">
                Des résultats concrets, pensés pour les {sector.labelPlural} {city.preposition} {city.name}.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {content.benefits.map((b, i) => (
                <div key={i} className="bg-white rounded-2xl p-6 shadow-trinity">
                  <div className="w-12 h-12 bg-gradient-hero rounded-xl flex items-center justify-center mb-4">
                    <Zap className="w-6 h-6 text-white" />
                  </div>
                  <p className="text-trinity-blue font-semibold leading-relaxed">{b.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Fonctionnalités */}
        <section className="py-12 lg:py-20">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12 max-w-3xl mx-auto">
              <h2 className="text-2xl md:text-3xl font-bold text-trinity-blue mb-4">
                Tout ce qu'il faut dans votre {subject.labelShort.toLowerCase()}
              </h2>
              <p className="text-lg text-muted-foreground">
                Un site complet, prêt à convertir {sector.audience} dès le premier jour.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
              {content.features.map((f, i) => (
                <div key={i} className="flex items-start gap-4 bg-white rounded-2xl p-6 shadow-trinity">
                  <div className="w-10 h-10 bg-trinity-blue-soft rounded-lg flex items-center justify-center flex-shrink-0">
                    <Check className="w-5 h-5 text-trinity-blue" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-trinity-blue mb-1">{f.title}</h3>
                    <p className="text-sm text-muted-foreground">{f.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Process en 3 étapes */}
        <section className="py-12 lg:py-20 bg-gradient-soft">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12 max-w-3xl mx-auto">
              <h2 className="text-2xl md:text-3xl font-bold text-trinity-blue mb-4">
                Comment ça marche
              </h2>
              <p className="text-lg text-muted-foreground">
                3 étapes, moins de 10 minutes, et votre {subject.labelShort.toLowerCase()} est en ligne.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {[
                { n: "1", t: "Décrivez votre activité", d: `Indiquez que vous êtes ${sector.label} ${city.preposition} ${city.name}. L'IA comprend votre métier.` },
                { n: "2", t: "L'IA génère le site", d: `En moins de 2 minutes, votre ${subject.labelShort.toLowerCase()} est prêt avec textes et design.` },
                { n: "3", t: "Publiez et convertissez", d: `Connectez votre domaine, partagez l'URL et commencez à recevoir des demandes.` },
              ].map((step) => (
                <div key={step.n} className="bg-white rounded-2xl p-6 shadow-trinity text-center">
                  <div className="w-12 h-12 bg-gradient-hero rounded-full flex items-center justify-center mx-auto mb-4 text-white font-bold text-lg">
                    {step.n}
                  </div>
                  <h3 className="font-semibold text-trinity-blue mb-2">{step.t}</h3>
                  <p className="text-sm text-muted-foreground">{step.d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="py-12 lg:py-20">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mx-auto">
              <h2 className="text-2xl md:text-3xl font-bold text-trinity-blue mb-8 text-center">
                Questions fréquentes
              </h2>
              <Accordion type="single" collapsible className="w-full">
                {content.faq.map((item, i) => (
                  <AccordionItem key={i} value={`item-${i}`}>
                    <AccordionTrigger className="text-left font-semibold">{item.question}</AccordionTrigger>
                    <AccordionContent className="text-muted-foreground">{item.answer}</AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          </div>
        </section>

        {/* Maillage interne */}
        <section className="py-12 lg:py-16 bg-trinity-blue-soft">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-5xl mx-auto">
              <h2 className="text-xl md:text-2xl font-bold text-trinity-blue mb-6">
                Explorez d'autres solutions Magellan
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div>
                  <h3 className="font-semibold text-trinity-blue mb-3 text-sm uppercase tracking-wide">Autres types de sites</h3>
                  <ul className="space-y-2">
                    {relatedSubjects.map((s) => (
                      <li key={s.slug}>
                        <Link
                          to={`/creer/${s.slug}-pour-${sector.slug}-${city.slug}`}
                          className="text-sm text-trinity-blue hover:underline"
                        >
                          {s.labelShort} pour {sector.label} {city.preposition} {city.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 className="font-semibold text-trinity-blue mb-3 text-sm uppercase tracking-wide">Mêmes solutions, autres secteurs</h3>
                  <ul className="space-y-2">
                    {relatedSectors.map((s) => (
                      <li key={s.slug}>
                        <Link
                          to={`/creer/${subject.slug}-pour-${s.slug}-${city.slug}`}
                          className="text-sm text-trinity-blue hover:underline"
                        >
                          {subject.labelShort} pour {s.label} {city.preposition} {city.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 className="font-semibold text-trinity-blue mb-3 text-sm uppercase tracking-wide">Dans d'autres villes</h3>
                  <ul className="space-y-2">
                    {relatedCities.map((c) => (
                      <li key={c.slug}>
                        <Link
                          to={`/creer/${subject.slug}-pour-${sector.slug}-${c.slug}`}
                          className="text-sm text-trinity-blue hover:underline"
                        >
                          {subject.labelShort} pour {sector.label} {c.preposition} {c.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <div className="mt-8 text-center">
                <Link to="/creer" className="text-sm text-trinity-blue font-medium hover:underline inline-flex items-center gap-1">
                  Voir les 3000 combinaisons disponibles
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* CTA final */}
        <section className="py-16 lg:py-24 bg-trinity-blue text-white">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <div className="max-w-3xl mx-auto">
              <Clock className="w-12 h-12 mx-auto mb-4 opacity-80" />
              <h2 className="text-2xl md:text-4xl font-bold mb-4">{content.ctaTitle}</h2>
              <p className="text-lg text-white/80 mb-8">{content.ctaSubtitle}</p>
              <Button asChild size="lg" className="bg-white text-trinity-blue hover:bg-white/90 group">
                <Link to="/auth?mode=signup">
                  Démarrer gratuitement
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default SeoLanding;
