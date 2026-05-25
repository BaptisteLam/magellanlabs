import type { SeoCombo } from "./index";

export interface SeoPageContent {
  title: string;
  metaDescription: string;
  h1: string;
  intro: string;
  benefits: { title: string; description: string }[];
  features: { title: string; description: string }[];
  faq: { question: string; answer: string }[];
  ctaTitle: string;
  ctaSubtitle: string;
  schemaJsonLd: object;
  breadcrumb: { name: string; url: string }[];
}

const SITE_URL = "https://magellanlabs.com";

export function generateSeoContent(combo: SeoCombo): SeoPageContent {
  const { subject, sector, city } = combo;

  const title = `Créer ${subject.article} ${subject.label} pour ${sector.label} ${city.preposition} ${city.name} | Magellan`;

  const metaDescription = `Créez ${subject.article} ${subject.label} professionnel pour votre ${sector.noun} ${city.preposition} ${city.name} en quelques minutes avec l'IA Magellan. ${subject.benefits[0]}. Sans code, sans agence.`;

  const h1 = `Créer ${subject.article} ${subject.label} pour ${sector.label} ${city.preposition} ${city.name}`;

  const intro = `Vous dirigez ${
    sector.label.startsWith("a") || sector.label.startsWith("é") || sector.label.startsWith("i") || sector.label.startsWith("o") || sector.label.startsWith("u")
      ? "une"
      : "un"
  } ${sector.label} ${city.preposition} ${city.name} ? Avec Magellan, vous pouvez créer ${subject.article} ${subject.label} sur-mesure pour ${subject.description}. ${sector.painPoint}. ${sector.proofPoint}. Magellan génère un site complet, optimisé pour le référencement local ${city.preposition} ${city.name} (${city.region}), prêt à convertir ${sector.audience}.`;

  const benefits = subject.benefits.map((b, i) => ({
    title: `Avantage ${i + 1}`,
    description: b,
  }));

  const features = subject.features.map((f) => ({
    title: f,
    description: `Un module pensé pour les ${sector.labelPlural} ${city.preposition} ${city.name}, configurable en quelques clics.`,
  }));

  const faq = [
    {
      question: `Combien de temps faut-il pour créer ${subject.article} ${subject.label} pour ${sector.label} ${city.preposition} ${city.name} ?`,
      answer: `Avec Magellan, comptez moins de 10 minutes pour obtenir une première version complète. L'IA génère le design, les textes et la structure, vous n'avez plus qu'à personnaliser.`,
    },
    {
      question: `Le ${subject.labelShort.toLowerCase()} sera-t-il optimisé pour le référencement local ${city.preposition} ${city.name} ?`,
      answer: `Oui. Chaque site Magellan inclut les balises SEO essentielles (title, meta description, schema.org LocalBusiness), une intégration Google Maps et un contenu adapté à votre zone géographique de ${city.name} et de ${city.region}.`,
    },
    {
      question: `Puis-je connecter mon propre nom de domaine ?`,
      answer: `Absolument. Magellan vous permet de connecter en un clic un domaine que vous possédez déjà, ou d'en acheter un directement depuis la plateforme.`,
    },
    {
      question: `Faut-il des compétences techniques pour utiliser Magellan ?`,
      answer: `Aucune. Magellan a été conçu pour les ${sector.labelPlural} qui veulent se concentrer sur leur métier. Vous décrivez votre activité, l'IA construit le site.`,
    },
    {
      question: `Combien coûte ${subject.article} ${subject.label} créé avec Magellan ?`,
      answer: `Vous pouvez commencer gratuitement. Les forfaits payants démarrent à quelques euros par mois, soit 10 à 50 fois moins cher qu'une agence web traditionnelle.`,
    },
    {
      question: `Le site fonctionnera-t-il sur mobile ?`,
      answer: `Oui, tous les sites Magellan sont 100% responsive. Or, plus de 70% des recherches locales ${city.preposition} ${city.name} se font depuis un mobile.`,
    },
  ];

  const ctaTitle = `Lancez ${subject.article} ${subject.label} pour votre ${sector.noun} ${city.preposition} ${city.name} dès maintenant`;
  const ctaSubtitle = `Rejoignez les ${sector.labelPlural} qui ont déjà digitalisé leur activité avec Magellan. Essai gratuit, sans carte bancaire.`;

  const url = `${SITE_URL}${combo.url}`;

  const schemaJsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": url,
        url,
        name: title,
        description: metaDescription,
        inLanguage: "fr-FR",
        isPartOf: { "@id": `${SITE_URL}/#website` },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Accueil", item: SITE_URL },
          { "@type": "ListItem", position: 2, name: "Créer un site", item: `${SITE_URL}/creer` },
          { "@type": "ListItem", position: 3, name: subject.labelShort, item: `${SITE_URL}/creer/${subject.slug}` },
          { "@type": "ListItem", position: 4, name: `${subject.labelShort} pour ${sector.label} ${city.preposition} ${city.name}`, item: url },
        ],
      },
      {
        "@type": "FAQPage",
        mainEntity: faq.map((f) => ({
          "@type": "Question",
          name: f.question,
          acceptedAnswer: { "@type": "Answer", text: f.answer },
        })),
      },
      {
        "@type": "Service",
        name: `Création de ${subject.label} pour ${sector.labelPlural} ${city.preposition} ${city.name}`,
        provider: { "@type": "Organization", name: "Magellan", url: SITE_URL },
        areaServed: { "@type": "City", name: city.name },
        serviceType: subject.labelShort,
      },
    ],
  };

  const breadcrumb = [
    { name: "Accueil", url: "/" },
    { name: "Créer un site", url: "/creer" },
    { name: subject.labelShort, url: `/creer/${subject.slug}` },
    { name: `${sector.label} ${city.preposition} ${city.name}`, url: combo.url },
  ];

  return {
    title,
    metaDescription,
    h1,
    intro,
    benefits,
    features,
    faq,
    ctaTitle,
    ctaSubtitle,
    schemaJsonLd,
    breadcrumb,
  };
}
