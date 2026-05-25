export interface SeoCity {
  slug: string;
  name: string;
  region: string;
  population: string;
  preposition: string; // "à", "au"
  highlight: string;
}

export const CITIES: SeoCity[] = [
  { slug: "paris", name: "Paris", region: "Île-de-France", population: "2,1 millions", preposition: "à", highlight: "première métropole économique de France" },
  { slug: "lyon", name: "Lyon", region: "Auvergne-Rhône-Alpes", population: "520 000", preposition: "à", highlight: "capitale gastronomique et 2e bassin économique français" },
  { slug: "marseille", name: "Marseille", region: "Provence-Alpes-Côte d'Azur", population: "870 000", preposition: "à", highlight: "porte d'entrée du sud et hub méditerranéen" },
  { slug: "toulouse", name: "Toulouse", region: "Occitanie", population: "490 000", preposition: "à", highlight: "ville rose, capitale européenne de l'aéronautique" },
  { slug: "nice", name: "Nice", region: "Provence-Alpes-Côte d'Azur", population: "350 000", preposition: "à", highlight: "5e ville de France, tournée vers le tourisme premium" },
  { slug: "nantes", name: "Nantes", region: "Pays de la Loire", population: "320 000", preposition: "à", highlight: "ville la plus dynamique de l'ouest" },
  { slug: "strasbourg", name: "Strasbourg", region: "Grand Est", population: "290 000", preposition: "à", highlight: "capitale européenne et carrefour économique" },
  { slug: "montpellier", name: "Montpellier", region: "Occitanie", population: "300 000", preposition: "à", highlight: "ville la plus jeune de France" },
  { slug: "bordeaux", name: "Bordeaux", region: "Nouvelle-Aquitaine", population: "260 000", preposition: "à", highlight: "capitale mondiale du vin, en pleine attractivité" },
  { slug: "lille", name: "Lille", region: "Hauts-de-France", population: "240 000", preposition: "à", highlight: "métropole transfrontalière du nord de l'Europe" },
  { slug: "rennes", name: "Rennes", region: "Bretagne", population: "220 000", preposition: "à", highlight: "ville étudiante et pôle tech breton" },
  { slug: "reims", name: "Reims", region: "Grand Est", population: "180 000", preposition: "à", highlight: "capitale du champagne et porte du Grand Est" },
  { slug: "toulon", name: "Toulon", region: "Provence-Alpes-Côte d'Azur", population: "170 000", preposition: "à", highlight: "grand port militaire et économique méditerranéen" },
  { slug: "saint-etienne", name: "Saint-Étienne", region: "Auvergne-Rhône-Alpes", population: "170 000", preposition: "à", highlight: "ville design, en pleine reconversion industrielle" },
  { slug: "le-havre", name: "Le Havre", region: "Normandie", population: "165 000", preposition: "au", highlight: "1er port français pour le commerce extérieur" },
  { slug: "grenoble", name: "Grenoble", region: "Auvergne-Rhône-Alpes", population: "160 000", preposition: "à", highlight: "capitale des Alpes et hub deeptech" },
  { slug: "dijon", name: "Dijon", region: "Bourgogne-Franche-Comté", population: "160 000", preposition: "à", highlight: "métropole gastronomique et patrimoniale" },
  { slug: "angers", name: "Angers", region: "Pays de la Loire", population: "155 000", preposition: "à", highlight: "ville où il fait bon vivre, championne du végétal" },
  { slug: "nimes", name: "Nîmes", region: "Occitanie", population: "150 000", preposition: "à", highlight: "ville romaine au carrefour Méditerranée-Rhône" },
  { slug: "aix-en-provence", name: "Aix-en-Provence", region: "Provence-Alpes-Côte d'Azur", population: "145 000", preposition: "à", highlight: "ville d'art, de droit et de tourisme haut de gamme" },
];

export const CITY_BY_SLUG = new Map(CITIES.map((c) => [c.slug, c]));
