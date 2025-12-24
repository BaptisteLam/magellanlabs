/**
 * Templates de widgets par secteur d'activité
 * Permet l'installation rapide de widgets préconfigurés selon le métier
 */

export interface WidgetTemplate {
  id: string;
  sector: string;
  sectorIcon: string;
  widgets: Array<{
    widget_type: string;
    title: string;
    config: any;
    layout: { x: number; y: number; w: number; h: number };
    description: string;
  }>;
}

export const WIDGET_TEMPLATES: WidgetTemplate[] = [
  // 1. Immobilier / Real Estate
  {
    id: 'real-estate',
    sector: 'Immobilier',
    sectorIcon: '🏢',
    widgets: [
      {
        widget_type: 'kpi-card',
        title: 'Biens Disponibles',
        description: 'Nombre total de propriétés en vente',
        config: {
          value: 127,
          trend: '+12%',
          trendUp: true,
          color: '#03A5C0',
          icon: 'home',
        },
        layout: { x: 0, y: 0, w: 3, h: 2 },
      },
      {
        widget_type: 'kpi-card',
        title: 'Visites Planifiées',
        description: 'Rendez-vous clients ce mois',
        config: {
          value: 42,
          trend: '+5%',
          trendUp: true,
          color: '#03A5C0',
          icon: 'calendar',
        },
        layout: { x: 3, y: 0, w: 3, h: 2 },
      },
      {
        widget_type: 'bar-chart',
        title: 'Ventes par Quartier',
        description: 'Répartition géographique des ventes',
        config: {
          data: [
            { name: 'Centre-Ville', value: 45 },
            { name: 'Banlieue', value: 32 },
            { name: 'Périphérie', value: 28 },
            { name: 'Campagne', value: 22 },
          ],
          xAxisKey: 'name',
          yAxisKey: 'value',
          color: '#03A5C0',
        },
        layout: { x: 6, y: 0, w: 6, h: 4 },
      },
      {
        widget_type: 'data-table',
        title: 'Propriétés Récentes',
        description: 'Dernières propriétés ajoutées',
        config: {
          columns: [
            { key: 'address', label: 'Adresse' },
            { key: 'price', label: 'Prix' },
            { key: 'surface', label: 'Surface' },
            { key: 'status', label: 'Statut' },
          ],
          data: [
            { address: '12 Rue de la Paix', price: '450 000 €', surface: '120 m²', status: 'Disponible' },
            { address: '34 Avenue Victor Hugo', price: '680 000 €', surface: '180 m²', status: 'Réservé' },
            { address: '56 Boulevard Haussmann', price: '320 000 €', surface: '85 m²', status: 'Disponible' },
          ],
        },
        layout: { x: 0, y: 2, w: 6, h: 4 },
      },
    ],
  },

  // 2. E-commerce
  {
    id: 'ecommerce',
    sector: 'E-commerce',
    sectorIcon: '🛒',
    widgets: [
      {
        widget_type: 'kpi-card',
        title: 'Chiffre d\'Affaires',
        description: 'Revenue du mois en cours',
        config: {
          value: '€124,567',
          trend: '+18%',
          trendUp: true,
          color: '#03A5C0',
          icon: 'euro',
        },
        layout: { x: 0, y: 0, w: 3, h: 2 },
      },
      {
        widget_type: 'kpi-card',
        title: 'Commandes',
        description: 'Total commandes ce mois',
        config: {
          value: 1842,
          trend: '+24%',
          trendUp: true,
          color: '#03A5C0',
          icon: 'shopping-cart',
        },
        layout: { x: 3, y: 0, w: 3, h: 2 },
      },
      {
        widget_type: 'kpi-card',
        title: 'Taux Conversion',
        description: 'Visiteurs → Clients',
        config: {
          value: '3.2%',
          trend: '+0.5%',
          trendUp: true,
          color: '#03A5C0',
          icon: 'trending-up',
        },
        layout: { x: 6, y: 0, w: 3, h: 2 },
      },
      {
        widget_type: 'kpi-card',
        title: 'Panier Moyen',
        description: 'Valeur moyenne commande',
        config: {
          value: '€67.45',
          trend: '-2%',
          trendUp: false,
          color: '#03A5C0',
          icon: 'bar-chart',
        },
        layout: { x: 9, y: 0, w: 3, h: 2 },
      },
      {
        widget_type: 'line-chart',
        title: 'Ventes sur 7 Jours',
        description: 'Évolution des ventes quotidiennes',
        config: {
          data: [
            { date: 'Lun', sales: 4200 },
            { date: 'Mar', sales: 5300 },
            { date: 'Mer', sales: 4800 },
            { date: 'Jeu', sales: 6100 },
            { date: 'Ven', sales: 7200 },
            { date: 'Sam', sales: 8500 },
            { date: 'Dim', sales: 6800 },
          ],
          xAxisKey: 'date',
          yAxisKey: 'sales',
          color: '#03A5C0',
        },
        layout: { x: 0, y: 2, w: 6, h: 4 },
      },
      {
        widget_type: 'pie-chart',
        title: 'Ventes par Catégorie',
        description: 'Répartition des ventes produits',
        config: {
          data: [
            { name: 'Électronique', value: 35 },
            { name: 'Mode', value: 28 },
            { name: 'Maison', value: 20 },
            { name: 'Sport', value: 17 },
          ],
          colors: ['#03A5C0', '#06b6d4', '#22d3ee', '#67e8f9'],
        },
        layout: { x: 6, y: 2, w: 6, h: 4 },
      },
    ],
  },

  // 3. Restaurant
  {
    id: 'restaurant',
    sector: 'Restaurant',
    sectorIcon: '🍽️',
    widgets: [
      {
        widget_type: 'kpi-card',
        title: 'Couverts Aujourd\'hui',
        description: 'Nombre de clients servis',
        config: {
          value: 187,
          trend: '+8%',
          trendUp: true,
          color: '#03A5C0',
          icon: 'users',
        },
        layout: { x: 0, y: 0, w: 3, h: 2 },
      },
      {
        widget_type: 'kpi-card',
        title: 'Réservations',
        description: 'Réservations ce soir',
        config: {
          value: 42,
          trend: '+15%',
          trendUp: true,
          color: '#03A5C0',
          icon: 'calendar',
        },
        layout: { x: 3, y: 0, w: 3, h: 2 },
      },
      {
        widget_type: 'kpi-card',
        title: 'CA Journée',
        description: 'Chiffre d\'affaires du jour',
        config: {
          value: '€3,245',
          trend: '+12%',
          trendUp: true,
          color: '#03A5C0',
          icon: 'euro',
        },
        layout: { x: 6, y: 0, w: 3, h: 2 },
      },
      {
        widget_type: 'kpi-card',
        title: 'Ticket Moyen',
        description: 'Dépense moyenne par client',
        config: {
          value: '€28.50',
          trend: '+3%',
          trendUp: true,
          color: '#03A5C0',
          icon: 'receipt',
        },
        layout: { x: 9, y: 0, w: 3, h: 2 },
      },
      {
        widget_type: 'bar-chart',
        title: 'Plats les Plus Commandés',
        description: 'Top 5 des plats',
        config: {
          data: [
            { name: 'Steak-Frites', value: 45 },
            { name: 'Salade César', value: 38 },
            { name: 'Burger Maison', value: 32 },
            { name: 'Risotto', value: 28 },
            { name: 'Pizza Margherita', value: 24 },
          ],
          xAxisKey: 'name',
          yAxisKey: 'value',
          color: '#03A5C0',
        },
        layout: { x: 0, y: 2, w: 6, h: 4 },
      },
      {
        widget_type: 'line-chart',
        title: 'Affluence par Heure',
        description: 'Nombre de couverts par créneau',
        config: {
          data: [
            { hour: '12h', covers: 25 },
            { hour: '13h', covers: 42 },
            { hour: '14h', covers: 18 },
            { hour: '19h', covers: 35 },
            { hour: '20h', covers: 52 },
            { hour: '21h', covers: 38 },
            { hour: '22h', covers: 15 },
          ],
          xAxisKey: 'hour',
          yAxisKey: 'covers',
          color: '#03A5C0',
        },
        layout: { x: 6, y: 2, w: 6, h: 4 },
      },
    ],
  },

  // 4. Conseil / Consulting
  {
    id: 'consulting',
    sector: 'Conseil',
    sectorIcon: '💼',
    widgets: [
      {
        widget_type: 'kpi-card',
        title: 'Projets Actifs',
        description: 'Missions en cours',
        config: {
          value: 18,
          trend: '+3',
          trendUp: true,
          color: '#03A5C0',
          icon: 'briefcase',
        },
        layout: { x: 0, y: 0, w: 3, h: 2 },
      },
      {
        widget_type: 'kpi-card',
        title: 'Heures Facturables',
        description: 'Total ce mois',
        config: {
          value: 1245,
          trend: '+18%',
          trendUp: true,
          color: '#03A5C0',
          icon: 'clock',
        },
        layout: { x: 3, y: 0, w: 3, h: 2 },
      },
      {
        widget_type: 'kpi-card',
        title: 'CA Mensuel',
        description: 'Chiffre d\'affaires',
        config: {
          value: '€156,780',
          trend: '+22%',
          trendUp: true,
          color: '#03A5C0',
          icon: 'trending-up',
        },
        layout: { x: 6, y: 0, w: 3, h: 2 },
      },
      {
        widget_type: 'kpi-card',
        title: 'Taux Utilisation',
        description: 'Consultants occupés',
        config: {
          value: '87%',
          trend: '+5%',
          trendUp: true,
          color: '#03A5C0',
          icon: 'users',
        },
        layout: { x: 9, y: 0, w: 3, h: 2 },
      },
      {
        widget_type: 'data-table',
        title: 'Projets Récents',
        description: 'Missions en cours',
        config: {
          columns: [
            { key: 'client', label: 'Client' },
            { key: 'project', label: 'Projet' },
            { key: 'deadline', label: 'Échéance' },
            { key: 'progress', label: 'Avancement' },
          ],
          data: [
            { client: 'TechCorp', project: 'Transformation Digitale', deadline: '15/02/2025', progress: '65%' },
            { client: 'FinanceGroup', project: 'Audit Stratégique', deadline: '28/02/2025', progress: '40%' },
            { client: 'RetailCo', project: 'Optimisation Logistique', deadline: '10/03/2025', progress: '82%' },
          ],
        },
        layout: { x: 0, y: 2, w: 6, h: 4 },
      },
      {
        widget_type: 'pie-chart',
        title: 'Répartition par Secteur',
        description: 'Clients par industrie',
        config: {
          data: [
            { name: 'Tech', value: 35 },
            { name: 'Finance', value: 28 },
            { name: 'Retail', value: 22 },
            { name: 'Industrie', value: 15 },
          ],
          colors: ['#03A5C0', '#06b6d4', '#22d3ee', '#67e8f9'],
        },
        layout: { x: 6, y: 2, w: 6, h: 4 },
      },
    ],
  },

  // 5. Construction / BTP
  {
    id: 'construction',
    sector: 'Construction',
    sectorIcon: '🏗️',
    widgets: [
      {
        widget_type: 'kpi-card',
        title: 'Chantiers Actifs',
        description: 'Projets en cours',
        config: {
          value: 12,
          trend: '+2',
          trendUp: true,
          color: '#03A5C0',
          icon: 'hard-hat',
        },
        layout: { x: 0, y: 0, w: 3, h: 2 },
      },
      {
        widget_type: 'kpi-card',
        title: 'Équipes Terrain',
        description: 'Ouvriers déployés',
        config: {
          value: 87,
          trend: '+5',
          trendUp: true,
          color: '#03A5C0',
          icon: 'users',
        },
        layout: { x: 3, y: 0, w: 3, h: 2 },
      },
      {
        widget_type: 'kpi-card',
        title: 'Budget Utilisé',
        description: 'Sur projets en cours',
        config: {
          value: '€2.4M',
          trend: '68%',
          trendUp: false,
          color: '#03A5C0',
          icon: 'euro',
        },
        layout: { x: 6, y: 0, w: 3, h: 2 },
      },
      {
        widget_type: 'kpi-card',
        title: 'Jours Sans Accident',
        description: 'Sécurité sur chantier',
        config: {
          value: 142,
          trend: 'Record',
          trendUp: true,
          color: '#03A5C0',
          icon: 'shield',
        },
        layout: { x: 9, y: 0, w: 3, h: 2 },
      },
      {
        widget_type: 'data-table',
        title: 'Chantiers en Cours',
        description: 'État d\'avancement projets',
        config: {
          columns: [
            { key: 'name', label: 'Chantier' },
            { key: 'client', label: 'Client' },
            { key: 'deadline', label: 'Livraison' },
            { key: 'progress', label: 'Avancement' },
          ],
          data: [
            { name: 'Résidence Beauséjour', client: 'Promotech', deadline: '06/2025', progress: '45%' },
            { name: 'Centre Commercial Sud', client: 'RetailGroup', deadline: '09/2025', progress: '22%' },
            { name: 'Immeuble Bureaux A12', client: 'OfficeSpace', deadline: '03/2025', progress: '78%' },
          ],
        },
        layout: { x: 0, y: 2, w: 6, h: 4 },
      },
      {
        widget_type: 'bar-chart',
        title: 'Matériaux par Chantier',
        description: 'Consommation matériaux',
        config: {
          data: [
            { name: 'Béton', value: 2400 },
            { name: 'Acier', value: 1850 },
            { name: 'Bois', value: 1200 },
            { name: 'Isolation', value: 980 },
          ],
          xAxisKey: 'name',
          yAxisKey: 'value',
          color: '#03A5C0',
        },
        layout: { x: 6, y: 2, w: 6, h: 4 },
      },
    ],
  },

  // 6. Santé / Healthcare
  {
    id: 'healthcare',
    sector: 'Santé',
    sectorIcon: '🏥',
    widgets: [
      {
        widget_type: 'kpi-card',
        title: 'Patients Aujourd\'hui',
        description: 'Consultations du jour',
        config: {
          value: 64,
          trend: '+8%',
          trendUp: true,
          color: '#03A5C0',
          icon: 'users',
        },
        layout: { x: 0, y: 0, w: 3, h: 2 },
      },
      {
        widget_type: 'kpi-card',
        title: 'RDV en Attente',
        description: 'Rendez-vous à confirmer',
        config: {
          value: 18,
          trend: '-3',
          trendUp: false,
          color: '#03A5C0',
          icon: 'calendar',
        },
        layout: { x: 3, y: 0, w: 3, h: 2 },
      },
      {
        widget_type: 'kpi-card',
        title: 'Taux Remplissage',
        description: 'Agenda occupé',
        config: {
          value: '92%',
          trend: '+5%',
          trendUp: true,
          color: '#03A5C0',
          icon: 'trending-up',
        },
        layout: { x: 6, y: 0, w: 3, h: 2 },
      },
      {
        widget_type: 'kpi-card',
        title: 'Urgences',
        description: 'Patients prioritaires',
        config: {
          value: 3,
          trend: 'Stable',
          trendUp: false,
          color: '#03A5C0',
          icon: 'alert-circle',
        },
        layout: { x: 9, y: 0, w: 3, h: 2 },
      },
      {
        widget_type: 'line-chart',
        title: 'Consultations sur 7 Jours',
        description: 'Évolution hebdomadaire',
        config: {
          data: [
            { day: 'Lun', patients: 58 },
            { day: 'Mar', patients: 62 },
            { day: 'Mer', patients: 55 },
            { day: 'Jeu', patients: 67 },
            { day: 'Ven', patients: 71 },
            { day: 'Sam', patients: 42 },
            { day: 'Dim', patients: 28 },
          ],
          xAxisKey: 'day',
          yAxisKey: 'patients',
          color: '#03A5C0',
        },
        layout: { x: 0, y: 2, w: 6, h: 4 },
      },
      {
        widget_type: 'pie-chart',
        title: 'Types de Consultation',
        description: 'Répartition par spécialité',
        config: {
          data: [
            { name: 'Généraliste', value: 45 },
            { name: 'Pédiatrie', value: 22 },
            { name: 'Cardiologie', value: 18 },
            { name: 'Dermatologie', value: 15 },
          ],
          colors: ['#03A5C0', '#06b6d4', '#22d3ee', '#67e8f9'],
        },
        layout: { x: 6, y: 2, w: 6, h: 4 },
      },
    ],
  },

  // 7. Éducation / Education
  {
    id: 'education',
    sector: 'Éducation',
    sectorIcon: '🎓',
    widgets: [
      {
        widget_type: 'kpi-card',
        title: 'Étudiants Inscrits',
        description: 'Total inscriptions',
        config: {
          value: 1248,
          trend: '+12%',
          trendUp: true,
          color: '#03A5C0',
          icon: 'users',
        },
        layout: { x: 0, y: 0, w: 3, h: 2 },
      },
      {
        widget_type: 'kpi-card',
        title: 'Cours Actifs',
        description: 'Formations en cours',
        config: {
          value: 42,
          trend: '+5',
          trendUp: true,
          color: '#03A5C0',
          icon: 'book',
        },
        layout: { x: 3, y: 0, w: 3, h: 2 },
      },
      {
        widget_type: 'kpi-card',
        title: 'Taux Réussite',
        description: 'Examens validés',
        config: {
          value: '87.5%',
          trend: '+3%',
          trendUp: true,
          color: '#03A5C0',
          icon: 'award',
        },
        layout: { x: 6, y: 0, w: 3, h: 2 },
      },
      {
        widget_type: 'kpi-card',
        title: 'Taux Présence',
        description: 'Assiduité étudiants',
        config: {
          value: '92%',
          trend: '+1%',
          trendUp: true,
          color: '#03A5C0',
          icon: 'calendar-check',
        },
        layout: { x: 9, y: 0, w: 3, h: 2 },
      },
      {
        widget_type: 'bar-chart',
        title: 'Inscriptions par Formation',
        description: 'Programmes les plus demandés',
        config: {
          data: [
            { name: 'Informatique', value: 342 },
            { name: 'Commerce', value: 278 },
            { name: 'Design', value: 215 },
            { name: 'Ingénierie', value: 198 },
            { name: 'Marketing', value: 185 },
          ],
          xAxisKey: 'name',
          yAxisKey: 'value',
          color: '#03A5C0',
        },
        layout: { x: 0, y: 2, w: 6, h: 4 },
      },
      {
        widget_type: 'line-chart',
        title: 'Évolution Inscriptions',
        description: 'Tendance sur 6 mois',
        config: {
          data: [
            { month: 'Sep', students: 980 },
            { month: 'Oct', students: 1050 },
            { month: 'Nov', students: 1120 },
            { month: 'Déc', students: 1180 },
            { month: 'Jan', students: 1220 },
            { month: 'Fév', students: 1248 },
          ],
          xAxisKey: 'month',
          yAxisKey: 'students',
          color: '#03A5C0',
        },
        layout: { x: 6, y: 2, w: 6, h: 4 },
      },
    ],
  },
];

/**
 * Récupère les templates pour un secteur spécifique
 */
export function getTemplatesBySector(sectorId: string): WidgetTemplate | undefined {
  return WIDGET_TEMPLATES.find((t) => t.id === sectorId);
}

/**
 * Récupère tous les secteurs disponibles
 */
export function getAllSectors(): Array<{ id: string; name: string; icon: string }> {
  return WIDGET_TEMPLATES.map((t) => ({
    id: t.id,
    name: t.sector,
    icon: t.sectorIcon,
  }));
}
