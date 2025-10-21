import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import SEOHead from "@/components/SEOHead";
import { useTranslation } from "@/hooks/useTranslation";

const PrivacyPolicy = () => {
  const { t } = useTranslation();

  return (
    <>
      <SEOHead
        title="Politique de Confidentialité"
        description="Politique de confidentialité de Trinity Studio. Découvrez comment nous collectons, utilisons et protégeons vos données personnelles."
        keywords="politique de confidentialité, RGPD, protection des données, Trinity Studio"
        canonicalUrl="https://trinity-studio.fr/politique-de-confidentialite"
      />
      <Header />
      <main className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-16 max-w-4xl">
          <h1 className="text-4xl font-bold mb-8 text-foreground">Politique de Confidentialité</h1>
          
          <div className="space-y-8 text-foreground/80">
            <section>
              <p className="mb-4">
                <strong>Date de dernière mise à jour :</strong> 10 janvier 2025
              </p>
              <p>
                Trinity Studio s'engage à protéger la confidentialité et la sécurité de vos données personnelles. Cette politique de confidentialité décrit comment nous collectons, utilisons et protégeons vos informations conformément au RGPD.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4 text-foreground">1. Responsable du traitement</h2>
              <p>
                <strong>Trinity Studio</strong><br />
                15 Rue de la République<br />
                75011 Paris, France<br />
                Email : contact@trinity-studio.fr<br />
                Téléphone : +33 6 78 01 57 32
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4 text-foreground">2. Données collectées</h2>
              <p className="mb-3">Nous collectons les informations suivantes :</p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Données d'identité :</strong> nom, prénom, société</li>
                <li><strong>Données de contact :</strong> adresse email, numéro de téléphone</li>
                <li><strong>Données de navigation :</strong> adresse IP, cookies, pages visitées</li>
                <li><strong>Données du projet :</strong> informations relatives à votre demande de services</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4 text-foreground">3. Finalités du traitement</h2>
              <p className="mb-3">Vos données sont utilisées pour :</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Répondre à vos demandes de contact et de devis</li>
                <li>Gérer la relation client et la réalisation de prestations</li>
                <li>Améliorer nos services et notre site web</li>
                <li>Vous envoyer des informations sur nos services (avec votre consentement)</li>
                <li>Respecter nos obligations légales et réglementaires</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4 text-foreground">4. Base légale du traitement</h2>
              <p className="mb-3">Les traitements de données sont fondés sur :</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Votre consentement</li>
                <li>L'exécution d'un contrat ou de mesures précontractuelles</li>
                <li>Le respect d'une obligation légale</li>
                <li>Notre intérêt légitime à développer notre activité</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4 text-foreground">5. Durée de conservation</h2>
              <p>
                Vos données personnelles sont conservées pendant la durée nécessaire aux finalités pour lesquelles elles ont été collectées, et conformément aux obligations légales. Les données de contact sont conservées 3 ans maximum après le dernier contact. Les données contractuelles sont conservées pendant la durée du contrat puis archivées conformément aux obligations légales.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4 text-foreground">6. Destinataires des données</h2>
              <p className="mb-3">Vos données peuvent être transmises à :</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Les membres de l'équipe Trinity Studio</li>
                <li>Nos prestataires techniques (hébergement, maintenance)</li>
                <li>Les autorités légales sur demande justifiée</li>
              </ul>
              <p className="mt-3">
                Nous ne vendons ni ne louons vos données personnelles à des tiers.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4 text-foreground">7. Vos droits</h2>
              <p className="mb-3">Conformément au RGPD, vous disposez des droits suivants :</p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Droit d'accès :</strong> obtenir une copie de vos données</li>
                <li><strong>Droit de rectification :</strong> corriger vos données inexactes</li>
                <li><strong>Droit à l'effacement :</strong> supprimer vos données</li>
                <li><strong>Droit à la limitation :</strong> limiter le traitement de vos données</li>
                <li><strong>Droit à la portabilité :</strong> recevoir vos données dans un format structuré</li>
                <li><strong>Droit d'opposition :</strong> vous opposer au traitement de vos données</li>
                <li><strong>Droit de retirer votre consentement</strong> à tout moment</li>
              </ul>
              <p className="mt-4">
                Pour exercer vos droits, contactez-nous à : <a href="mailto:contact@trinity-studio.fr" className="text-primary hover:underline">contact@trinity-studio.fr</a>
              </p>
              <p className="mt-2">
                Vous avez également le droit de déposer une plainte auprès de la CNIL (Commission Nationale de l'Informatique et des Libertés).
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4 text-foreground">8. Cookies</h2>
              <p>
                Notre site utilise des cookies pour améliorer votre expérience de navigation et analyser le trafic. Vous pouvez gérer vos préférences de cookies dans les paramètres de votre navigateur.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4 text-foreground">9. Sécurité des données</h2>
              <p>
                Nous mettons en œuvre des mesures techniques et organisationnelles appropriées pour protéger vos données contre tout accès non autorisé, perte ou altération. Cela inclut le chiffrement, les contrôles d'accès et la surveillance régulière de nos systèmes.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4 text-foreground">10. Modifications</h2>
              <p>
                Nous nous réservons le droit de modifier cette politique de confidentialité à tout moment. Les modifications seront publiées sur cette page avec une date de mise à jour.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4 text-foreground">11. Contact</h2>
              <p>
                Pour toute question concernant cette politique de confidentialité, contactez-nous :<br />
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

export default PrivacyPolicy;
