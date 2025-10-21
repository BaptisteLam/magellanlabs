import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import SEOHead from "@/components/SEOHead";
import { useTranslation } from "@/hooks/useTranslation";

const TermsOfService = () => {
  const { t } = useTranslation();

  return (
    <>
      <SEOHead
        title="Conditions Générales de Vente"
        description="Conditions générales de vente de Trinity Studio. Consultez nos conditions pour la création de sites web, le développement et les services SEO."
        keywords="CGV, conditions générales, conditions de vente, Trinity Studio, agence web"
        canonicalUrl="https://trinity-studio.fr/cgv"
      />
      <Header />
      <main className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-16 max-w-4xl">
          <h1 className="text-4xl font-bold mb-8 text-foreground">Conditions Générales de Vente</h1>
          
          <div className="space-y-8 text-foreground/80">
            <section>
              <p className="mb-4">
                <strong>Date de dernière mise à jour :</strong> 10 janvier 2025
              </p>
              <p>
                Les présentes Conditions Générales de Vente (CGV) régissent les relations contractuelles entre Trinity Studio et ses clients pour la fourniture de services de création de sites web, développement, design et référencement.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4 text-foreground">1. Identification</h2>
              <p>
                <strong>Trinity Studio</strong><br />
                Agence de création de sites web et développement digital<br />
                15 Rue de la République<br />
                75011 Paris, France<br />
                Email : contact@trinity-studio.fr<br />
                Téléphone : +33 6 78 01 57 32
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4 text-foreground">2. Objet</h2>
              <p>
                Les présentes CGV ont pour objet de définir les conditions dans lesquelles Trinity Studio fournit ses services aux clients, notamment :
              </p>
              <ul className="list-disc pl-6 space-y-2 mt-3">
                <li>Création de sites web (vitrines, e-commerce, applications web)</li>
                <li>Développement web et applications sur mesure</li>
                <li>Design UI/UX et identité visuelle</li>
                <li>Services de référencement naturel (SEO)</li>
                <li>Maintenance et hébergement de sites web</li>
                <li>Formation et accompagnement</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4 text-foreground">3. Acceptation des CGV</h2>
              <p>
                Toute commande de prestations implique l'acceptation sans réserve des présentes CGV. Le fait de passer commande implique l'adhésion entière et sans réserve du client aux présentes conditions générales de vente.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4 text-foreground">4. Devis et commandes</h2>
              <p className="mb-3">
                Tout projet débute par l'établissement d'un devis détaillé, gratuit et sans engagement. Le devis comprend :
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>La description détaillée des prestations</li>
                <li>Les délais de réalisation</li>
                <li>Le prix total TTC</li>
                <li>Les modalités de paiement</li>
                <li>La durée de validité du devis (30 jours)</li>
              </ul>
              <p className="mt-3">
                La commande est confirmée par la signature du devis et le versement de l'acompte prévu.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4 text-foreground">5. Prix</h2>
              <p>
                Tous nos prix sont indiqués en euros et hors taxes (HT), sauf mention contraire. La TVA applicable est celle en vigueur au jour de la facturation. Les prix comprennent uniquement les prestations mentionnées dans le devis. Toute prestation supplémentaire fera l'objet d'un devis complémentaire.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4 text-foreground">6. Modalités de paiement</h2>
              <p className="mb-3">Sauf accord particulier, les conditions de paiement sont les suivantes :</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Acompte de 50% à la signature du devis</li>
                <li>40% à la validation du projet</li>
                <li>10% à la mise en ligne ou livraison finale</li>
              </ul>
              <p className="mt-3">
                Les paiements peuvent être effectués par virement bancaire ou carte bancaire. Les factures sont payables sous 30 jours à compter de leur émission. En cas de retard de paiement, des pénalités de 3 fois le taux d'intérêt légal seront appliquées, ainsi qu'une indemnité forfaitaire pour frais de recouvrement de 40€.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4 text-foreground">7. Délais de réalisation</h2>
              <p>
                Les délais de réalisation indiqués dans le devis sont donnés à titre indicatif et dépendent de la fourniture par le client de tous les éléments nécessaires (contenus, images, accès, etc.). Trinity Studio s'engage à respecter au mieux ces délais, mais ne saurait être tenu responsable des retards dus au client ou à des événements indépendants de sa volonté.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4 text-foreground">8. Obligations du client</h2>
              <p className="mb-3">Le client s'engage à :</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Fournir tous les éléments nécessaires à la réalisation du projet dans les délais convenus</li>
                <li>Désigner un interlocuteur unique pour le suivi du projet</li>
                <li>Valider les différentes étapes du projet dans les délais impartis</li>
                <li>Garantir la propriété et les droits d'utilisation de tous les contenus fournis</li>
                <li>Respecter les délais de paiement</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4 text-foreground">9. Propriété intellectuelle</h2>
              <p className="mb-3">
                <strong>9.1 Création originale :</strong> Trinity Studio reste propriétaire des créations réalisées jusqu'au paiement intégral du prix convenu.
              </p>
              <p className="mb-3">
                <strong>9.2 Droits d'utilisation :</strong> Après paiement complet, le client dispose des droits d'utilisation du site ou de l'application pour l'usage défini dans le devis.
              </p>
              <p className="mb-3">
                <strong>9.3 Code source :</strong> Le code source reste la propriété de Trinity Studio, sauf accord contraire spécifié dans le contrat.
              </p>
              <p>
                <strong>9.4 Référence :</strong> Trinity Studio se réserve le droit de mentionner le projet réalisé dans son portfolio et ses supports de communication, sauf refus explicite du client.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4 text-foreground">10. Garanties</h2>
              <p className="mb-3">
                Trinity Studio garantit que :
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Les prestations seront réalisées avec soin et professionnalisme</li>
                <li>Le site sera fonctionnel sur les navigateurs modernes principaux</li>
                <li>Le code respectera les standards du web en vigueur</li>
                <li>Une période de garantie de 30 jours après la livraison couvre les bugs et dysfonctionnements</li>
              </ul>
              <p className="mt-3">
                Cette garantie ne couvre pas les modifications demandées par le client après livraison, ni les problèmes causés par des interventions tierces.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4 text-foreground">11. Maintenance et hébergement</h2>
              <p>
                Les services de maintenance et d'hébergement font l'objet de contrats séparés. En l'absence de contrat de maintenance, Trinity Studio n'est pas tenu d'assurer les mises à jour, corrections ou interventions après la période de garantie.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4 text-foreground">12. Résiliation</h2>
              <p className="mb-3">
                <strong>12.1 Par le client :</strong> Le client peut résilier le contrat à tout moment. Les sommes déjà versées restent acquises à Trinity Studio au titre des travaux réalisés.
              </p>
              <p>
                <strong>12.2 Par Trinity Studio :</strong> En cas de manquement grave du client à ses obligations (notamment défaut de paiement ou non-fourniture des éléments nécessaires), Trinity Studio peut résilier le contrat après mise en demeure restée sans effet pendant 15 jours.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4 text-foreground">13. Responsabilité</h2>
              <p>
                La responsabilité de Trinity Studio est limitée au montant des prestations facturées. Trinity Studio ne saurait être tenu responsable des dommages indirects (perte de chiffre d'affaires, perte de données, etc.). Le client est seul responsable du contenu publié sur son site.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4 text-foreground">14. Force majeure</h2>
              <p>
                Trinity Studio ne pourra être tenu responsable de l'inexécution de ses obligations en cas de force majeure, notamment en cas de grève, panne informatique, interruption de services tiers, catastrophe naturelle ou tout événement échappant à son contrôle.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4 text-foreground">15. Protection des données</h2>
              <p>
                Les données personnelles collectées dans le cadre de nos prestations sont traitées conformément à notre <a href="/politique-de-confidentialite" className="text-primary hover:underline">Politique de Confidentialité</a> et au RGPD.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4 text-foreground">16. Droit applicable et litiges</h2>
              <p>
                Les présentes CGV sont soumises au droit français. En cas de litige, les parties s'engagent à rechercher une solution amiable avant toute action judiciaire. À défaut d'accord, les tribunaux compétents seront ceux du ressort de Paris.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4 text-foreground">17. Modification des CGV</h2>
              <p>
                Trinity Studio se réserve le droit de modifier les présentes CGV à tout moment. Les conditions applicables sont celles en vigueur à la date de la commande.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4 text-foreground">18. Contact</h2>
              <p>
                Pour toute question concernant ces CGV, contactez-nous :<br />
                Email : <a href="mailto:contact@trinity-studio.fr" className="text-primary hover:underline">contact@trinity-studio.fr</a><br />
                Téléphone : <a href="tel:+33678015732" className="text-primary hover:underline">+33 6 78 01 57 32</a>
              </p>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
};

export default TermsOfService;
