export interface SeoSector {
  slug: string;
  label: string; // "un restaurant", "une boulangerie"
  labelPlural: string; // "restaurants"
  noun: string; // "restaurant"
  audience: string; // "vos clients", "vos patients"
  painPoint: string;
  proofPoint: string;
}

export const SECTORS: SeoSector[] = [
  {
    slug: "restaurant",
    label: "restaurant",
    labelPlural: "restaurants",
    noun: "restaurant",
    audience: "vos clients gourmands",
    painPoint:
      "Sans site moderne, vos clients ne trouvent ni votre menu ni vos horaires sur Google",
    proofPoint:
      "Les restaurants avec un site web et un menu en ligne enregistrent en moyenne 30% de réservations supplémentaires",
  },
  {
    slug: "avocat",
    label: "cabinet d'avocat",
    labelPlural: "avocats",
    noun: "avocat",
    audience: "vos futurs clients",
    painPoint:
      "Sans présence en ligne, vous laissez vos confrères capter les recherches Google de votre zone",
    proofPoint:
      "92% des justiciables recherchent un avocat en ligne avant de prendre rendez-vous",
  },
  {
    slug: "coach-sportif",
    label: "coach sportif",
    labelPlural: "coachs sportifs",
    noun: "coach sportif",
    audience: "vos futurs élèves",
    painPoint:
      "Sans site clair, vos prospects ne comprennent pas vos offres et choisissent un concurrent",
    proofPoint:
      "Un coach avec un site et un module de réservation triple son nombre de séances vendues",
  },
  {
    slug: "artisan",
    label: "artisan",
    labelPlural: "artisans",
    noun: "artisan",
    audience: "vos prospects locaux",
    painPoint:
      "Bouche-à-oreille ne suffit plus : 8 prospects sur 10 vérifient un artisan sur Google avant d'appeler",
    proofPoint:
      "Un artisan référencé en local génère en moyenne 5 demandes de devis qualifiés par semaine",
  },
  {
    slug: "agence-immobiliere",
    label: "agence immobilière",
    labelPlural: "agences immobilières",
    noun: "agent immobilier",
    audience: "acheteurs et vendeurs",
    painPoint:
      "Sans portail à jour, vos biens passent inaperçus face aux gros acteurs nationaux",
    proofPoint:
      "Les agences avec site optimisé local génèrent jusqu'à 40% de mandats supplémentaires",
  },
  {
    slug: "psychologue",
    label: "psychologue",
    labelPlural: "psychologues",
    noun: "psychologue",
    audience: "vos patients",
    painPoint:
      "Vos patients potentiels veulent vous connaître avant d'oser le premier appel : sans site, ils n'osent pas",
    proofPoint:
      "Un site clair avec présentation et tarifs multiplie par 4 les premières prises de contact",
  },
  {
    slug: "medecin",
    label: "médecin",
    labelPlural: "médecins",
    noun: "médecin",
    audience: "vos patients",
    painPoint:
      "Sans site, votre cabinet n'apparaît pas dans les recherches santé locales sur Google",
    proofPoint:
      "Un site médical améliore l'expérience patient et réduit le temps passé au téléphone de 50%",
  },
  {
    slug: "boulangerie",
    label: "boulangerie",
    labelPlural: "boulangeries",
    noun: "boulanger",
    audience: "votre clientèle de quartier",
    painPoint:
      "Vos clients du quartier ignorent vos nouveautés et vos commandes spéciales faute de vitrine numérique",
    proofPoint:
      "Une boulangerie avec site et commande en ligne fidélise 2x plus de clients réguliers",
  },
  {
    slug: "coiffeur",
    label: "salon de coiffure",
    labelPlural: "coiffeurs",
    noun: "coiffeur",
    audience: "vos clients",
    painPoint:
      "Sans réservation en ligne, vous perdez les clients qui veulent prendre RDV en dehors des horaires",
    proofPoint:
      "Un salon avec prise de RDV en ligne remplit ses créneaux creux et augmente son CA de 25%",
  },
  {
    slug: "photographe",
    label: "photographe",
    labelPlural: "photographes",
    noun: "photographe",
    audience: "vos futurs clients",
    painPoint:
      "Sans portfolio en ligne percutant, vos prospects ne perçoivent pas la valeur de votre travail",
    proofPoint:
      "Un photographe avec portfolio optimisé voit ses tarifs acceptés 2x plus souvent",
  },
  {
    slug: "consultant",
    label: "consultant",
    labelPlural: "consultants",
    noun: "consultant",
    audience: "vos prospects B2B",
    painPoint:
      "Sans site qui démontre votre expertise, vos prospects B2B ne vous prennent pas au sérieux",
    proofPoint:
      "Un consultant avec un site expert ferme 3x plus de missions à fort budget",
  },
  {
    slug: "freelance",
    label: "freelance",
    labelPlural: "freelances",
    noun: "freelance",
    audience: "vos prochains clients",
    painPoint:
      "Sans site pro, vos prospects négocient vos tarifs à la baisse faute de cadre rassurant",
    proofPoint:
      "Un freelance avec un site soigné augmente son TJM moyen de +30%",
  },
  {
    slug: "startup",
    label: "startup",
    labelPlural: "startups",
    noun: "fondateur de startup",
    audience: "utilisateurs et investisseurs",
    painPoint:
      "Sans site qui pitch votre solution, ni utilisateurs ni VCs ne franchissent l'étape suivante",
    proofPoint:
      "Une startup avec landing page optimisée multiplie son taux d'inscription par 5",
  },
  {
    slug: "association",
    label: "association",
    labelPlural: "associations",
    noun: "responsable associatif",
    audience: "bénévoles et donateurs",
    painPoint:
      "Sans site, vos campagnes de dons et de recrutement de bénévoles plafonnent",
    proofPoint:
      "Les associations avec un site et un module de dons collectent 4x plus de fonds",
  },
  {
    slug: "boutique",
    label: "boutique",
    labelPlural: "boutiques",
    noun: "commerçant",
    audience: "vos clients fidèles et nouveaux visiteurs",
    painPoint:
      "Sans vitrine en ligne, vos produits restent invisibles en dehors des heures d'ouverture",
    proofPoint:
      "Une boutique avec site e-commerce génère en moyenne +35% de chiffre d'affaires annuel",
  },
];

export const SECTOR_BY_SLUG = new Map(SECTORS.map((s) => [s.slug, s]));
