export interface SeoSubject {
  slug: string;
  label: string;
  labelShort: string;
  article: string; // "un" | "une"
  description: string;
  benefits: string[];
  features: string[];
}

export const SUBJECTS: SeoSubject[] = [
  {
    slug: "site-vitrine",
    label: "site vitrine",
    labelShort: "Site vitrine",
    article: "un",
    description:
      "présenter votre activité, vos services et vos coordonnées avec une image professionnelle",
    benefits: [
      "Une présence en ligne crédible 24h/24",
      "Un design moderne qui rassure vos prospects",
      "Un référencement local optimisé sur Google",
    ],
    features: [
      "Page d'accueil percutante avec CTA",
      "Page services détaillée",
      "Formulaire de contact intégré",
      "Carte Google Maps et avis clients",
    ],
  },
  {
    slug: "landing-page",
    label: "landing page",
    labelShort: "Landing page",
    article: "une",
    description:
      "convertir vos visiteurs en clients avec une page unique optimisée pour l'action",
    benefits: [
      "Un taux de conversion jusqu'à 3x supérieur",
      "Un message clair, sans distraction",
      "Mesure précise du ROI de vos campagnes",
    ],
    features: [
      "Hero accrocheur orienté bénéfices",
      "Preuves sociales et témoignages",
      "Formulaire ou bouton de conversion proéminent",
      "A/B testing prêt à l'emploi",
    ],
  },
  {
    slug: "site-e-commerce",
    label: "site e-commerce",
    labelShort: "Site e-commerce",
    article: "un",
    description:
      "vendre vos produits en ligne avec un tunnel d'achat fluide et sécurisé",
    benefits: [
      "Ouverture d'un nouveau canal de vente",
      "Vente 24h/24, 7j/7",
      "Gestion automatisée des stocks et commandes",
    ],
    features: [
      "Catalogue produits illimité",
      "Paiement Stripe / PayPal sécurisé",
      "Panier abandonné automatique",
      "Tableau de bord ventes en temps réel",
    ],
  },
  {
    slug: "portfolio",
    label: "portfolio",
    labelShort: "Portfolio",
    article: "un",
    description:
      "valoriser vos réalisations et décrocher de nouveaux clients grâce à un book en ligne",
    benefits: [
      "Mise en valeur visuelle de vos projets",
      "Crédibilité renforcée auprès des recruteurs",
      "Démarche commerciale facilitée",
    ],
    features: [
      "Galerie projets responsive",
      "Études de cas détaillées",
      "Section témoignages clients",
      "Page contact avec brief intégré",
    ],
  },
  {
    slug: "blog",
    label: "blog",
    labelShort: "Blog",
    article: "un",
    description:
      "construire votre autorité, attirer un trafic qualifié et fidéliser votre audience",
    benefits: [
      "Trafic SEO long terme gratuit",
      "Positionnement d'expert dans votre niche",
      "Constitution d'une base email qualifiée",
    ],
    features: [
      "Éditeur d'articles intuitif",
      "Catégories et tags SEO",
      "Newsletter intégrée",
      "Commentaires modérés",
    ],
  },
  {
    slug: "site-rendez-vous",
    label: "site de prise de rendez-vous",
    labelShort: "Prise de rendez-vous",
    article: "un",
    description:
      "permettre à vos clients de réserver un créneau en ligne, sans appel téléphonique",
    benefits: [
      "Fin des allers-retours pour fixer un RDV",
      "Réduction des no-shows avec rappels SMS",
      "Agenda synchronisé avec Google Calendar",
    ],
    features: [
      "Calendrier de réservation en temps réel",
      "Confirmation automatique par email",
      "Paiement d'acompte en ligne",
      "Rappels SMS et email",
    ],
  },
  {
    slug: "page-de-vente",
    label: "page de vente",
    labelShort: "Page de vente",
    article: "une",
    description:
      "vendre un produit ou service premium grâce à une page longue argumentée",
    benefits: [
      "Storytelling persuasif structuré",
      "Levée des objections une par une",
      "Boost direct du chiffre d'affaires",
    ],
    features: [
      "Hero avec promesse forte",
      "Tableau comparatif et offres",
      "FAQ détaillée et garanties",
      "Plusieurs CTA stratégiquement placés",
    ],
  },
  {
    slug: "site-evenementiel",
    label: "site événementiel",
    labelShort: "Site événementiel",
    article: "un",
    description:
      "promouvoir votre événement et vendre vos billets en quelques clics",
    benefits: [
      "Billetterie intégrée sans commission cachée",
      "Communication centralisée pour les participants",
      "Données précises sur vos inscrits",
    ],
    features: [
      "Programme et intervenants",
      "Billetterie et codes promo",
      "Plan d'accès et logistique",
      "Compte à rebours dynamique",
    ],
  },
  {
    slug: "site-association",
    label: "site d'association",
    labelShort: "Site d'association",
    article: "un",
    description:
      "faire connaître votre association, recruter des bénévoles et collecter des dons",
    benefits: [
      "Visibilité renforcée auprès des donateurs",
      "Collecte de dons en ligne automatisée",
      "Espace adhérents sécurisé",
    ],
    features: [
      "Présentation de la mission et de l'équipe",
      "Module de don récurrent",
      "Inscription aux événements",
      "Espace presse et rapports d'activité",
    ],
  },
  {
    slug: "site-saas",
    label: "site SaaS",
    labelShort: "Site SaaS",
    article: "un",
    description:
      "lancer votre logiciel en ligne avec une page produit qui convertit en essais gratuits",
    benefits: [
      "Onboarding utilisateur fluide",
      "Pricing transparent qui rassure",
      "Acquisition self-serve scalable",
    ],
    features: [
      "Hero produit avec démo intégrée",
      "Pages fonctionnalités détaillées",
      "Grille tarifaire avec essai gratuit",
      "Documentation et blog intégrés",
    ],
  },
];

export const SUBJECT_BY_SLUG = new Map(SUBJECTS.map((s) => [s.slug, s]));
